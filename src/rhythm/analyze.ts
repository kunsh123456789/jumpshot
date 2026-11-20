import { RHYTHM } from '../data/rhythm';

/**
 * Offline beat detection for a decoded song.
 *
 *  1. Mix to mono and resample to 22.05 kHz (OfflineAudioContext).
 *  2. Onset strength: log-magnitude spectral flux (1024-pt FFT, 256 hop ≈ 11.6 ms),
 *     detrended with a moving average and half-wave rectified.
 *  3. Global tempo: autocorrelation of the onset envelope weighted by a
 *     log-Gaussian prior around 120 BPM (+ harmonic support from 2× lag).
 *  4. Beat positions: dynamic-programming beat tracker (Ellis 2007, as used
 *     by librosa) — picks beats on strong onsets while penalising deviation
 *     from the tempo.
 *  5. If the tracked beats fit a straight line tightly (programmed / quantised
 *     music), they are replaced by that perfect grid; otherwise the DP beats
 *     are kept so live-played tempo drift is followed.
 *  6. The tempo is folded into a fightable range (72–168 BPM) by taking every
 *     other beat or adding half-beats.
 */
export interface BeatMap {
  bpm: number;
  /** Beat times in seconds from the start of the song. */
  beats: Float64Array;
  duration: number;
  /** 0..1 rough confidence (how much stronger onsets are on beats than on average). */
  confidence: number;
  /** True when beats were regularised to a perfect grid. */
  grid: boolean;
  /** Per-beat loudness 0..1 (smoothed over two bars, percentile-normalised): drives fight intensity like built-in sections. */
  energy: Float32Array;
}

const SR = 22050;
const N = 1024;
const HOP = 256;
const FPS = SR / HOP;
/** Empirical alignment (measured on synthetic click/kick tracks): centred-frame flux peaks ~1 hop early. */
const BIAS_SEC = 0.008;

const yieldUI = () => new Promise<void>((r) => setTimeout(r, 0));

/** Mono 22.05 kHz copy of the buffer. */
async function toMono(buf: AudioBuffer): Promise<Float32Array> {
  try {
    const len = Math.ceil(buf.duration * SR);
    const oc = new OfflineAudioContext(1, len, SR);
    const src = oc.createBufferSource();
    src.buffer = buf;
    src.connect(oc.destination);
    src.start();
    const out = await oc.startRendering();
    return out.getChannelData(0);
  } catch {
    // Fallback: manual mixdown + naive decimation.
    const ratio = buf.sampleRate / SR;
    const len = Math.floor(buf.length / ratio);
    const out = new Float32Array(len);
    const chs: Float32Array[] = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    for (let i = 0; i < len; i++) {
      const j = Math.floor(i * ratio);
      let s = 0;
      for (const ch of chs) s += ch[j];
      out[i] = s / chs.length;
    }
    return out;
  }
}

// ---------------------------------------------------------------- FFT
const bitrev = new Uint16Array(N);
const cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
const hann = new Float32Array(N);
(() => {
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    bitrev[i] = r;
  }
  for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); sinT[i] = -Math.sin((2 * Math.PI * i) / N); }
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
})();

function fft(re: Float32Array, im: Float32Array): void {
  for (let i = 0; i < N; i++) {
    const j = bitrev[i];
    if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j, b = a + half;
        const tr = re[b] * cosT[k] - im[b] * sinT[k];
        const ti = re[b] * sinT[k] + im[b] * cosT[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
}

/** Onset strength envelope at FPS frames/second. */
async function onsetEnvelope(x: Float32Array, progress: (f: number) => void): Promise<Float32Array> {
  const frames = Math.floor(x.length / HOP);
  const env = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N);
  const maxBin = Math.floor((8000 / SR) * N);
  let prev = new Float32Array(maxBin + 1), cur = new Float32Array(maxBin + 1);
  for (let f = 0; f < frames; f++) {
    const c = f * HOP - N / 2;
    for (let i = 0; i < N; i++) {
      const j = c + i;
      re[i] = j >= 0 && j < x.length ? x[j] * hann[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    for (let k = 1; k <= maxBin; k++) {
      const m = Math.log(1 + 1000 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
      cur[k] = m;
      const d = m - prev[k];
      if (d > 0) flux += d;
    }
    env[f] = f === 0 ? 0 : flux;
    const t = prev; prev = cur; cur = t;
    if ((f & 2047) === 2047) { progress(f / frames); await yieldUI(); }
  }
  // Detrend (moving average over ~0.4 s), rectify, normalise.
  const w = Math.round(FPS * 0.4);
  const pre = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + env[i];
  const out = new Float32Array(frames);
  let sq = 0;
  for (let i = 0; i < frames; i++) {
    const a = Math.max(0, i - w), b = Math.min(frames, i + w + 1);
    const v = env[i] - (pre[b] - pre[a]) / (b - a);
    out[i] = v > 0 ? v : 0;
    sq += out[i] * out[i];
  }
  const sd = Math.sqrt(sq / Math.max(1, frames)) || 1;
  for (let i = 0; i < frames; i++) out[i] /= sd;
  return out;
}

/** Autocorrelation tempo estimate; returns the beat period in frames (fractional). */
export function estimatePeriod(env: Float32Array, fps: number, lo = 55, hi = 215): { period: number; strength: number } {
  const minL = Math.floor((60 * fps) / hi), maxL = Math.ceil((60 * fps) / lo);
  const ac = new Float64Array(maxL * 2 + 2);
  const n = env.length;
  for (let L = 0; L <= Math.min(maxL * 2 + 1, n - 1); L++) {
    let s = 0;
    for (let i = L; i < n; i++) s += env[i] * env[i - L];
    ac[L] = s / (n - L);
  }
  const L120 = (60 * fps) / 120;
  let best = minL, bs = -Infinity;
  const score = (L: number) => {
    const oct = Math.log2(L / L120);
    const prior = Math.exp(-0.5 * (oct / 0.9) * (oct / 0.9));
    return (ac[L] + 0.5 * ac[Math.min(ac.length - 1, L * 2)]) * prior;
  };
  for (let L = minL; L <= maxL; L++) {
    const s = score(L);
    if (s > bs) { bs = s; best = L; }
  }
  // Parabolic interpolation on the raw autocorrelation.
  let p = best;
  if (best > minL && best < maxL) {
    const a = ac[best - 1], b = ac[best], c = ac[best + 1];
    const den = a - 2 * b + c;
    if (den < 0) p = best + 0.5 * (a - c) / den;
  }
  return { period: p, strength: ac[0] > 0 ? ac[best] / ac[0] : 0 };
}

/** Ellis-style DP beat tracker. Returns beat frame indices. */
function trackBeats(env: Float32Array, period: number, tightness = 100): number[] {
  const n = env.length;
  // Local score: onset envelope smoothed by a narrow Gaussian.
  const P = Math.round(period);
  const win: number[] = [];
  for (let i = -P; i <= P; i++) win.push(Math.exp(-0.5 * Math.pow((i * 32) / period, 2)));
  const local = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (let i = -P; i <= P; i++) { const j = t + i; if (j >= 0 && j < n) s += env[j] * win[i + P]; }
    local[t] = s;
  }
  const cum = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period * 2), hi = Math.round(period / 2);
  const txw = new Float32Array(lo - hi + 1);
  for (let d = hi; d <= lo; d++) txw[d - hi] = -tightness * Math.pow(Math.log(d / period), 2);
  let maxLocal = 0;
  for (let t = 0; t < n; t++) if (local[t] > maxLocal) maxLocal = local[t];
  let started = false;
  for (let t = 0; t < n; t++) {
    let best = -Infinity, bi = -1;
    for (let d = hi; d <= lo; d++) {
      const tau = t - d;
      if (tau < 0) break;
      const v = cum[tau] + txw[d - hi];
      if (v > best) { best = v; bi = tau; }
    }
    if (!started && local[t] < 0.01 * maxLocal) { cum[t] = local[t]; back[t] = -1; continue; }
    started = true;
    if (bi >= 0 && best > 0) { cum[t] = local[t] + best; back[t] = bi; }
    else { cum[t] = local[t]; back[t] = -1; }
  }
  // Last beat: last local maximum of cum above half the median of maxima.
  const maxima: number[] = [];
  for (let t = 1; t < n - 1; t++) if (cum[t] > cum[t - 1] && cum[t] >= cum[t + 1]) maxima.push(t);
  if (maxima.length === 0) return [];
  const vals = maxima.map((t) => cum[t]).sort((a, b) => a - b);
  const med = vals[Math.floor(vals.length / 2)];
  let last = maxima[maxima.length - 1];
  for (let i = maxima.length - 1; i >= 0; i--) if (cum[maxima[i]] > 0.5 * med) { last = maxima[i]; break; }
  const beats: number[] = [];
  for (let b = last; b >= 0; b = back[b]) beats.push(b);
  beats.reverse();
  // Trim weak beats at both ends (intro/outro silence).
  let rms = 0;
  for (const b of beats) rms += local[b] * local[b];
  rms = Math.sqrt(rms / Math.max(1, beats.length));
  const th = 0.4 * rms;
  let a = 0, z = beats.length;
  while (a < z && local[beats[a]] < th) a++;
  while (z > a && local[beats[z - 1]] < th) z--;
  return beats.slice(a, z);
}

/** Least-squares line t = a + b·k through (k, t) points; RMS residual in seconds. */
function fitGrid(pts: [number, number][]): { a: number; b: number; rms: number; inliers: number } {
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [k, t] of pts) { sx += k; sy += t; sxx += k * k; sxy += k * t; }
  const b = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
  const a = (sy - b * sx) / n;
  let r = 0;
  for (const [k, t] of pts) { const e = t - (a + b * k); r += e * e; }
  return { a, b, rms: Math.sqrt(r / Math.max(1, n)), inliers: 0 };
}

export async function analyzeSong(buf: AudioBuffer, progress: (f: number, label: string) => void = () => {}): Promise<BeatMap> {
  progress(0, 'mixing');
  const x = await toMono(buf);
  await yieldUI();
  const env = await onsetEnvelope(x, (f) => progress(0.05 + f * 0.75, 'listening'));
  progress(0.82, 'finding tempo');
  await yieldUI();
  const { period } = estimatePeriod(env, FPS);
  progress(0.88, 'tracking beats');
  await yieldUI();
  const frames = trackBeats(env, period);
  let times = frames.map((f) => f / FPS + BIAS_SEC);
  let grid = false;
  // Regularise near-perfect grids (quantised music) — removes ±1 frame jitter
  // and the odd DP slip. Robust fit: drop outliers, refit, require 90% inliers.
  if (times.length >= 16) {
    let fit = fitGrid(times.map((t, i) => [i, t]));
    for (let it = 0; it < 2; it++) {
      // Re-index by the fitted period so a skipped/doubled beat doesn't break the line.
      const pts: [number, number][] = [];
      for (const t of times) {
        const k = Math.round((t - fit.a) / fit.b);
        if (Math.abs(t - (fit.a + k * fit.b)) < 0.035) pts.push([k, t]);
      }
      if (pts.length < 8) break;
      fit = fitGrid(pts);
      fit.inliers = pts.length;
    }
    if (fit.rms < 0.015 && fit.inliers >= times.length * 0.9) {
      grid = true;
      const n0 = Math.round((times[0] - fit.a) / fit.b);
      const n1 = Math.round((times[times.length - 1] - fit.a) / fit.b);
      const g: number[] = [];
      for (let k = n0; k <= n1; k++) g.push(fit.a + k * fit.b);
      times = g;
    }
  }
  // Tempo of the tracked beats.
  const ivs: number[] = [];
  for (let i = 1; i < times.length; i++) ivs.push(times[i] - times[i - 1]);
  ivs.sort((a, b) => a - b);
  let beatSec = ivs.length ? ivs[Math.floor(ivs.length / 2)] : period / FPS;
  // Fold into a fightable tempo.
  const envAt = (t: number) => { const i = Math.round((t - BIAS_SEC) * FPS); return i >= 0 && i < env.length ? env[i] : 0; };
  while (60 / beatSec > RHYTHM.maxBpm && times.length > 2) {
    let s0 = 0, s1 = 0;
    for (let i = 0; i < times.length; i++) (i % 2 === 0 ? (s0 += envAt(times[i])) : (s1 += envAt(times[i])));
    const par = s0 >= s1 ? 0 : 1;
    times = times.filter((_, i) => i % 2 === par);
    beatSec *= 2;
  }
  while (60 / beatSec < RHYTHM.minBpm && times.length > 1) {
    const out: number[] = [];
    for (let i = 0; i < times.length; i++) {
      out.push(times[i]);
      if (i + 1 < times.length) out.push((times[i] + times[i + 1]) / 2);
    }
    times = out;
    beatSec /= 2;
  }
  // Confidence: onset strength on beats vs the overall mean.
  let on = 0;
  for (const t of times) on += Math.max(envAt(t), envAt(t - 1 / FPS), envAt(t + 1 / FPS));
  on /= Math.max(1, times.length);
  let mean = 0;
  for (let i = 0; i < env.length; i++) mean += env[i];
  mean /= Math.max(1, env.length);
  const confidence = Math.max(0, Math.min(1, (on / Math.max(1e-6, mean) - 1) / 4));
  // Loudness per beat → intensity: RMS over each beat, smoothed over 8 beats, normalised between the 10th and 90th percentile.
  const raw = new Float32Array(times.length);
  for (let i = 0; i < times.length; i++) {
    const a = Math.max(0, Math.floor(times[i] * SR)), z = Math.min(x.length, Math.floor((i + 1 < times.length ? times[i + 1] : times[i] + beatSec) * SR));
    let e = 0, n = 0;
    for (let k = a; k < z; k += 8) { e += x[k] * x[k]; n++; }
    raw[i] = Math.sqrt(e / Math.max(1, n));
  }
  const sm = new Float32Array(times.length);
  for (let i = 0; i < times.length; i++) {
    let e = 0, n = 0;
    for (let k = Math.max(0, i - 4); k < Math.min(times.length, i + 4); k++) { e += raw[k]; n++; }
    sm[i] = e / Math.max(1, n);
  }
  const sorted = Array.from(sm).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.1)] ?? 0, hi = sorted[Math.floor(sorted.length * 0.9)] ?? 1;
  const energy = sm.map((v) => Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))));
  progress(1, 'done');
  return { bpm: 60 / beatSec, beats: Float64Array.from(times), duration: buf.duration, confidence, grid, energy };
}
