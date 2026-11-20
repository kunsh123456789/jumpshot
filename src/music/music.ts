import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { G_GOOD, G_GREAT, G_NONE, G_OFF, G_PERFECT, RHYTHM, TRACKS, type Grade, type MusicMode, type TrackDef } from '../data/rhythm';
import { SynthTrack } from './tracks';
import { analyzeSong, type BeatMap } from './analyze';
import { LiveTracker } from './live';

export interface Song { name: string; buffer: AudioBuffer; map: BeatMap; key: string }
export interface Judgement { grade: Grade; delta: number }

/**
 * Owns whatever is providing the beat (built-in synth track, a loaded song, or
 * the microphone) and answers "where are the beats?" in performance.now() ms —
 * the same clock pointer events are stamped with — so judging is a subtraction.
 *
 * AudioContext time → perf time uses getOutputTimestamp() when available (it
 * includes output latency, e.g. Bluetooth headphones), falling back to
 * baseLatency + outputLatency. The user's calibration offset is applied on top.
 */
export class MusicManager {
  mode: MusicMode = 'builtin';
  track: TrackDef = TRACKS[1];
  synth: SynthTrack | null = null;
  song: Song | null = null;
  readonly live = new LiveTracker();
  playing = false;
  paused = false;
  /** Calibration metronome (independent of the game track). */
  calib: SynthTrack | null = null;
  private src: AudioBufferSourceNode | null = null;
  private songAnchor = 0;
  private pausePos = 0;
  private perfOffset = NaN;
  private cache = new Map<string, Song>();

  // ------------------------------------------------------------ clock
  private syncClock(now: number): void {
    const ctx = audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let off: number;
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (ts && ts.performanceTime && ts.contextTime && ts.performanceTime > 0 && ts.contextTime > 0) {
      off = ts.performanceTime - ts.contextTime * 1000;
    } else {
      const lat = (ctx.baseLatency || 0) + ((ctx as AudioContext & { outputLatency?: number }).outputLatency || 0);
      off = now + lat * 1000 - ctx.currentTime * 1000;
    }
    if (!isFinite(this.perfOffset) || Math.abs(off - this.perfOffset) > 30) this.perfOffset = off;
    else this.perfOffset += (off - this.perfOffset) * 0.02;
  }
  ctxToPerf(t: number): number { return t * 1000 + this.perfOffset; }
  perfToCtx(ms: number): number { return (ms - this.perfOffset) / 1000; }

  // ------------------------------------------------------------ selection
  /** Name shown in menus/HUD. */
  label(): string {
    switch (this.mode) {
      case 'classic': return 'CLASSIC (no beat)';
      case 'builtin': return `${this.track.name} · ${this.track.bpm} BPM`;
      case 'file': return this.song ? `${this.song.name} · ${Math.round(this.song.map.bpm)} BPM` : 'YOUR SONG';
      case 'mic': return this.live.locked ? `LISTENING · ${Math.round(this.live.bpm)} BPM` : 'LISTENING…';
    }
  }

  get rhythmMode(): boolean { return this.mode !== 'classic'; }

  /** Judging / beat-sync available right now. */
  get active(): boolean {
    switch (this.mode) {
      case 'classic': return false;
      case 'builtin': return this.playing && !!this.synth?.running && isFinite(this.perfOffset);
      case 'file': return this.playing && !!this.song && !!this.src && isFinite(this.perfOffset) && this.song.map.beats.length > 1;
      case 'mic': return this.live.running && this.live.locked;
    }
  }

  get beatMs(): number {
    switch (this.mode) {
      case 'builtin': return 60000 / this.track.bpm;
      case 'file': return this.song ? 60000 / this.song.map.bpm : 500;
      case 'mic': return this.live.period || 500;
      default: return 500;
    }
  }

  selectBuiltin(def: TrackDef): void { this.stop(); this.mode = 'builtin'; this.track = def; }
  selectClassic(): void { this.stop(); this.mode = 'classic'; }
  selectSong(s: Song): void { this.stop(); this.mode = 'file'; this.song = s; }
  async selectMic(): Promise<boolean> {
    this.stop();
    audio.unlock();
    if (!audio.ctx) { this.live.error = 'Audio is not available'; return false; }
    const ok = this.live.running || (await this.live.start(audio.ctx));
    if (ok) this.mode = 'mic';
    return ok;
  }

  async loadFile(file: File, progress: (f: number, label: string) => void): Promise<Song> {
    audio.unlock();
    const ctx = audio.ctx;
    if (!ctx) throw new Error('Audio is not available');
    const key = `${file.name}:${file.size}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    progress(0, 'decoding');
    const data = await file.arrayBuffer();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(data);
    } catch {
      throw new Error("Couldn't decode that file — try an MP3, M4A, WAV or OGG");
    }
    if (buffer.duration < 8) throw new Error('That clip is too short (needs 8+ seconds)');
    const map = await analyzeSong(buffer, progress);
    if (map.beats.length < 8) throw new Error("Couldn't find a steady beat in that song");
    const song: Song = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), buffer, map, key };
    this.cache.set(key, song);
    return song;
  }

  // ------------------------------------------------------------ transport
  /** Start the selected music from the top. */
  start(): void {
    audio.unlock();
    const ctx = audio.ctx;
    this.stopSources();
    this.paused = false;
    this.playing = this.mode !== 'classic';
    audio.musicTrim = 1;
    if (!ctx) return;
    switch (this.mode) {
      case 'builtin':
        this.synth = new SynthTrack(this.track);
        this.synth.start(ctx.currentTime + 0.12);
        break;
      case 'file':
        if (this.song) { audio.musicTrim = songTrim(this.song.buffer); this.playSong(0); }
        break;
      case 'classic':
        // Classic mode keeps the original groove as plain background music.
        this.synth = new SynthTrack(TRACKS[1]);
        this.synth.start(ctx.currentTime + 0.12);
        this.playing = true;
        break;
      case 'mic': break;
    }
    audio.applyVolume();
  }

  stop(): void {
    this.stopSources();
    this.playing = false;
    this.paused = false;
  }

  /** Stop everything including the microphone. */
  shutdown(): void { this.stop(); if (this.live.running) this.live.stop(); }

  pause(): void {
    if (!this.playing || this.paused) return;
    this.paused = true;
    const ctx = audio.ctx;
    if (this.synth) this.synth.stop();
    if (this.src && ctx && this.song) {
      this.pausePos = (ctx.currentTime - this.songAnchor) % this.song.buffer.duration;
      this.src.onended = null;
      try { this.src.stop(); } catch { /* already stopped */ }
      this.src.disconnect();
      this.src = null;
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const ctx = audio.ctx;
    if (!ctx) return;
    if (this.synth) this.synth.resumeAt(ctx.currentTime + 0.1);
    if (this.mode === 'file' && this.song) this.playSong(this.pausePos);
  }

  private playSong(pos: number): void {
    const ctx = audio.ctx!;
    const s = this.song!;
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.loop = true;
    src.connect(audio.music);
    const t0 = ctx.currentTime + 0.06;
    src.start(t0, Math.max(0, pos) % s.buffer.duration);
    this.songAnchor = t0 - pos;
    this.src = src;
  }

  private stopSources(): void {
    if (this.synth) { this.synth.stop(); this.synth = null; }
    if (this.src) {
      try { this.src.stop(); } catch { /* ignore */ }
      this.src.disconnect();
      this.src = null;
    }
  }

  /** Per animation frame: clock sync, scheduling, mic polling. */
  update(now: number): void {
    const ctx = audio.ctx;
    if (!ctx) return;
    this.syncClock(now);
    if (ctx.state === 'running') {
      if (this.synth && !this.paused) this.synth.schedule(ctx.currentTime, ctx.currentTime + 0.15);
      if (this.calib) this.calib.schedule(ctx.currentTime, ctx.currentTime + 0.15);
    }
    if (this.live.running) this.live.poll(now);
  }

  // ------------------------------------------------------------ beats (perf ms)
  /** Latest beat at or before t, NaN if none. */
  prevBeat(t: number): number { return this.beatAround(t, false); }
  /** First beat strictly after t, NaN if none. */
  nextBeat(t: number): number { return this.beatAround(t, true); }

  private beatAround(t: number, next: boolean): number {
    switch (this.mode) {
      case 'builtin': case 'classic': {
        const sy = this.synth;
        if (!sy || !isFinite(this.perfOffset)) return NaN;
        const B = sy.beatSec;
        const k = Math.floor((this.perfToCtx(t) - sy.anchor) / B) + (next ? 1 : 0);
        return this.ctxToPerf(sy.anchor + k * B);
      }
      case 'file': {
        const s = this.song;
        if (!s || !isFinite(this.perfOffset) || s.map.beats.length === 0) return NaN;
        const beats = s.map.beats, dur = s.buffer.duration;
        const pos = this.perfToCtx(t) - this.songAnchor;
        const n = Math.floor(pos / dur);
        const local = pos - n * dur;
        const i = upperBound(beats, local) - 1;
        let b: number;
        if (next) b = i + 1 < beats.length ? beats[i + 1] + n * dur : beats[0] + (n + 1) * dur;
        else b = i >= 0 ? beats[i] + n * dur : beats[beats.length - 1] + (n - 1) * dur;
        return this.ctxToPerf(this.songAnchor + b);
      }
      case 'mic': {
        const p = this.live.prevBeat(t);
        return next ? p + this.live.period : p;
      }
    }
  }

  /** Running beat number at t (for bar accents). */
  beatIndex(t: number): number {
    switch (this.mode) {
      case 'builtin': case 'classic': {
        const sy = this.synth;
        return sy ? Math.round((this.perfToCtx(t) - sy.anchor) / sy.beatSec) : 0;
      }
      case 'file': {
        const s = this.song;
        if (!s) return 0;
        const pos = this.perfToCtx(t) - this.songAnchor;
        const n = Math.floor(pos / s.buffer.duration);
        return upperBound(s.map.beats, pos - n * s.buffer.duration) - 1 + n * s.map.beats.length;
      }
      case 'mic': return this.live.period > 0 ? Math.round((t - this.live.anchor) / this.live.period) : 0;
    }
  }

  /** Judge an input made at perf time t (ms). */
  judge(t: number): Judgement {
    if (!this.active) return { grade: G_NONE, delta: 0 };
    const tt = t - settings.rhythmOffset;
    const p = this.prevBeat(tt), n = this.nextBeat(tt);
    if (!isFinite(p) || !isFinite(n)) return { grade: G_NONE, delta: 0 };
    const per = this.beatMs;
    const gap = n - p;
    const dp = tt - p, dn = n - tt;
    const delta = dp <= dn ? dp : -dn; // + = late, - = early
    const ad = Math.abs(delta);
    if (ad <= RHYTHM.perfectMs) return { grade: G_PERFECT, delta };
    if (ad <= RHYTHM.greatMs) return { grade: G_GREAT, delta };
    if (ad <= RHYTHM.goodMs) return { grade: G_GOOD, delta };
    if (gap < per * 1.6) {
      const mid = (p + n) / 2;
      if (Math.abs(tt - mid) <= Math.min(RHYTHM.halfBeatMs, gap * RHYTHM.halfBeatMaxFrac)) return { grade: G_GOOD, delta };
    } else if (gap > per * 2.5) {
      return { grade: G_NONE, delta }; // a break in the music: nothing to miss
    }
    return { grade: G_OFF, delta };
  }

  // ------------------------------------------------------------ calibration
  startCalibration(): void {
    audio.unlock();
    const ctx = audio.ctx;
    if (!ctx) return;
    this.calib = new SynthTrack({ id: 'cal', name: 'CAL', bpm: RHYTHM.calibrateBpm, style: 'neon', desc: '' });
    this.calib.metronome = true;
    this.calib.start(ctx.currentTime + 0.3);
  }
  stopCalibration(): void { if (this.calib) { this.calib.stop(); this.calib = null; } }
  /** Signed ms from the nearest metronome click (perf ms) and that click's index. */
  calibDelta(t: number): { delta: number; index: number } {
    const c = this.calib;
    if (!c || !isFinite(this.perfOffset)) return { delta: NaN, index: -1 };
    const k = Math.round((this.perfToCtx(t) - c.anchor) / c.beatSec);
    return { delta: t - this.ctxToPerf(c.anchor + k * c.beatSec), index: k };
  }
  /** Perf time of calibration click k. */
  calibClick(k: number): number { const c = this.calib; return c ? this.ctxToPerf(c.anchor + k * c.beatSec) : NaN; }
}

function upperBound(a: Float64Array, x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; }
  return lo;
}

/** Mastered songs are far louder than the synth bed; match them roughly. */
function songTrim(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 97) { s += d[i] * d[i]; n++; }
  const rms = Math.sqrt(s / Math.max(1, n)) || 0.1;
  return Math.max(0.3, Math.min(1.5, 0.11 / rms));
}

export const music = new MusicManager();
