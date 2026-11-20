import { RHYTHM } from '../data/rhythm';

/**
 * Live beat tracking from the microphone ("Listen mode"): play music from any
 * app on a speaker and the game locks onto its beat.
 *
 * Every animation frame the analyser's spectrum is turned into one spectral-
 * flux sample (time-stamped in performance.now() ms). Four times a second the
 * last 8 s are binned to a 100 Hz onset envelope, the tempo is estimated by a
 * prior-weighted autocorrelation and the phase by a recency-weighted comb
 * filter. A small PLL smooths both so the beat grid is stable; a big tempo
 * change has to repeat for ~1 s before the grid jumps (song changes).
 */
export class LiveTracker {
  private stream: MediaStream | null = null;
  private srcNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private spec = new Float32Array(0);
  private prevSpec = new Float32Array(0);
  private td = new Float32Array(0);
  private readonly cap = 2048;
  private times = new Float64Array(this.cap);
  private vals = new Float32Array(this.cap);
  private head = 0;
  private count = 0;
  private lastEst = 0;
  private latencyMs = 30;
  private halfWinMs = 10;
  private maxBin = 0;

  /** Beat period (ms); 0 until a tempo was found. */
  period = 0;
  /** A beat time (perf ms) on the current grid. */
  anchor = 0;
  conf = 0;
  locked = false;
  private stableSince = 0;
  private candidate = 0;
  private candidateN = 0;
  /** Smoothed strength of the half-period phase relative to the best phase. */
  private halfRatio = 0;
  /** Input level 0..1 for the HUD meter. */
  level = 0;
  error = '';

  get running(): boolean { return !!this.analyser; }
  get bpm(): number { return this.period > 0 ? 60000 / this.period : 0; }

  async start(ctx: AudioContext): Promise<boolean> {
    this.error = '';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone not available in this browser');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      this.error = e instanceof Error ? (e.name === 'NotAllowedError' ? 'Microphone permission was denied' : e.message) : String(e);
      return false;
    }
    this.srcNode = ctx.createMediaStreamSource(this.stream);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0;
    this.srcNode.connect(an); // not connected to the speakers
    this.analyser = an;
    this.spec = new Float32Array(an.frequencyBinCount);
    this.prevSpec = new Float32Array(an.frequencyBinCount).fill(-100);
    this.td = new Float32Array(an.fftSize);
    this.maxBin = Math.min(an.frequencyBinCount - 1, Math.floor((6000 / ctx.sampleRate) * an.fftSize));
    this.halfWinMs = (an.fftSize / ctx.sampleRate) * 500;
    const track = this.stream.getAudioTracks()[0];
    const st = track?.getSettings?.() as MediaTrackSettings & { latency?: number };
    this.latencyMs = st && typeof st.latency === 'number' && st.latency > 0 ? st.latency * 1000 : 30;
    this.reset();
    return true;
  }

  stop(): void {
    this.srcNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.srcNode = null; this.analyser = null;
    this.reset();
  }

  reset(): void {
    this.head = 0; this.count = 0; this.period = 0; this.anchor = 0; this.conf = 0;
    this.locked = false; this.candidate = 0; this.candidateN = 0; this.lastEst = 0; this.halfRatio = 0;
  }

  /** Call every animation frame. */
  poll(now: number): void {
    const an = this.analyser;
    if (!an) return;
    an.getFloatFrequencyData(this.spec);
    an.getFloatTimeDomainData(this.td);
    let rms = 0;
    for (let i = 0; i < this.td.length; i++) rms += this.td[i] * this.td[i];
    rms = Math.sqrt(rms / this.td.length);
    this.level += (Math.min(1, rms * 6) - this.level) * 0.3;
    let flux = 0;
    for (let k = 1; k <= this.maxBin; k++) {
      const v = Math.max(-100, this.spec[k]);
      const d = v - this.prevSpec[k];
      if (d > 0) flux += d;
      this.prevSpec[k] = v;
    }
    const t = now - this.halfWinMs - this.latencyMs;
    this.push(t, flux / 20);
    if (now - this.lastEst > 250) { this.lastEst = now; this.estimate(now); }
  }

  /** Feed an onset sample directly (tests). */
  push(t: number, v: number): void {
    this.times[this.head] = t;
    this.vals[this.head] = v;
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  estimate(now: number): void {
    const BIN = 10, NB = 800, W = NB * BIN;
    const t0 = now - W;
    const env = new Float32Array(NB);
    const has = new Uint8Array(NB);
    for (let i = 0; i < this.count; i++) {
      const j = (this.head - 1 - i + this.cap) % this.cap;
      const t = this.times[j];
      if (t < t0) break;
      const b = Math.floor((t - t0) / BIN);
      if (b < 0 || b >= NB) continue;
      if (!has[b] || this.vals[j] > env[b]) env[b] = this.vals[j];
      has[b] = 1;
    }
    // Fill gaps (frame rate < 100 Hz) by linear interpolation.
    let last = -1, filled = 0;
    for (let b = 0; b < NB; b++) {
      if (!has[b]) continue;
      filled++;
      if (last >= 0 && b - last > 1) for (let k = last + 1; k < b; k++) env[k] = env[last] + ((env[b] - env[last]) * (k - last)) / (b - last);
      last = b;
    }
    if (filled < NB * 0.3) { this.decay(); return; }
    // Detrend + rectify.
    const pre = new Float64Array(NB + 1);
    for (let i = 0; i < NB; i++) pre[i + 1] = pre[i] + env[i];
    const e = new Float32Array(NB);
    let energy = 0;
    for (let i = 0; i < NB; i++) {
      const a = Math.max(0, i - 15), z = Math.min(NB, i + 16);
      const v = env[i] - (pre[z] - pre[a]) / (z - a);
      e[i] = v > 0 ? v : 0;
      energy += e[i] * e[i];
    }
    if (energy < 1e-6 || this.level < 0.01) { this.decay(); return; }

    // Tempo (lags 30..100 bins = 200..60 BPM).
    const ac = new Float64Array(202);
    for (let L = 0; L <= 201; L++) {
      let s = 0;
      for (let i = L; i < NB; i++) s += e[i] * e[i - L];
      ac[L] = s / (NB - L);
    }
    let best = 30, bs = -Infinity;
    for (let L = 30; L <= 100; L++) {
      const oct = Math.log2(L / 50);
      const sc = (ac[L] + 0.5 * ac[L * 2]) * Math.exp(-0.5 * (oct / 0.9) * (oct / 0.9));
      if (sc > bs) { bs = sc; best = L; }
    }
    let Lf = best;
    {
      const a = ac[best - 1], b = ac[best], c = ac[best + 1];
      const den = a - 2 * b + c;
      if (den < 0) Lf = best + (0.5 * (a - c)) / den;
    }
    let P = Lf * BIN;
    // Folding a fast tempo to half-time makes every other detected beat equally valid.
    let fold = 1;
    while (60000 / P > RHYTHM.maxBpm) { P *= 2; fold *= 2; }
    while (60000 / P < RHYTHM.minBpm) P /= 2;
    const conf = ac[0] > 0 ? Math.max(0, ac[best] / ac[0]) : 0;

    // Phase: comb over the most recent beats (recency weighted), 2 ms resolution.
    const at = (x: number) => {
      if (x < 0 || x >= NB - 1) return 0;
      const i = Math.floor(x), f = x - i;
      return e[i] * (1 - f) + e[i + 1] * f;
    };
    const end = NB - 1;
    const comb = (phi: number) => {
      let s = 0, w = 1;
      for (let k = 0; k < 24; k++) {
        const x = end - phi - k * Pb;
        if (x < 1) break;
        s += w * (at(x) + 0.5 * (at(x - 0.5) + at(x + 0.5)));
        w *= 0.88;
      }
      return s;
    };
    let bphi = 0, bsum = -1;
    const Pb = P / BIN;
    for (let phi = 0; phi < Pb; phi += 0.2) {
      const s = comb(phi);
      if (s > bsum) { bsum = s; bphi = phi; }
    }
    // Equal-strength beats half a period apart (e.g. kick and snare alike): either is "the" beat.
    if (fold === 1) {
      let half = 0;
      for (let d = -1.6; d <= 1.6; d += 0.2) half = Math.max(half, comb((bphi + Pb / 2 + d + Pb) % Pb));
      this.halfRatio = this.halfRatio * 0.7 + (half / Math.max(1e-9, bsum)) * 0.3;
      if (this.halfRatio > 0.6) fold = 2;
    }
    const beatT = t0 + (end - bphi) * BIN + BIN / 2;

    // PLL update.
    this.conf = this.conf * 0.7 + conf * 0.3;
    if (this.period === 0 || Math.abs(P / this.period - 1) > 0.05) {
      if (this.candidate > 0 && Math.abs(P / this.candidate - 1) < 0.04) this.candidateN++;
      else { this.candidate = P; this.candidateN = 1; }
      if (this.candidateN >= (this.period === 0 ? 2 : 4)) {
        this.period = P; this.anchor = beatT; this.stableSince = now; this.candidateN = 0;
      }
    } else {
      this.candidateN = 0;
      this.period = this.period * 0.85 + P * 0.15;
      // Of the equivalent beat candidates (folded tempo), follow the one nearest the prediction.
      let bestErr = Infinity, ref = 0;
      for (let j = 0; j < fold; j++) {
        const cand = beatT - (j * P) / fold;
        const pb = this.prevBeat(cand);
        let err = cand - pb, r0 = pb;
        if (err > this.period / 2) { err -= this.period; r0 = pb + this.period; }
        if (Math.abs(err) < Math.abs(bestErr)) { bestErr = err; ref = r0; }
      }
      this.anchor = ref + bestErr * 0.35;
    }
    this.locked = this.period > 0 && this.conf > 0.08 && now - this.stableSince > 1500;
  }

  private decay(): void {
    this.conf *= 0.7;
    if (this.conf < 0.04) { this.locked = false; }
  }

  prevBeat(t: number): number {
    if (this.period <= 0) return NaN;
    return this.anchor + Math.floor((t - this.anchor) / this.period) * this.period;
  }
}
