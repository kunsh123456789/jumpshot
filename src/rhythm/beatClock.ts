/**
 * The beat clock: the single source of musical time in Rhythm Mode.
 *
 * Everything is expressed on the WebAudio timeline (AudioContext seconds).
 * "Song time" is context time minus the moment beat 0 was scheduled. A
 * TempoMap turns song time into beats and back; it is a list of constant-tempo
 * segments, so it supports tempo changes and time-signature changes between
 * sections (built-in songs), and arbitrary beat lists (one segment per beat for
 * analysed songs / live tracking).
 *
 * Two notions of "now":
 *  - ctx.currentTime: where the audio *scheduler* is (sound scheduled here is
 *    heard output-latency later);
 *  - heard time: the context time the listener hears right now. Gameplay, the
 *    beat HUD and judging all use heard time, so they line up with the ears.
 * Pointer timestamps (performance.now() domain) are mapped onto the heard
 * timeline through getOutputTimestamp(), falling back to base+output latency.
 */

export interface SectionInfo {
  name: string;
  kind: string;
  intensity: number;
  /** Chord root per bar (semitones above key), cycled. */
  chords: number[];
  /** Index in the song's section list (or -1). */
  index: number;
  /** Section length in bars (0 = open-ended). */
  bars: number;
}

export interface Segment {
  /** Beat number at the segment start. */
  beat: number;
  /** Song time (s) at the segment start. */
  time: number;
  /** Seconds per beat inside the segment. */
  spb: number;
  /** Beats per bar, and the beat number where this bar grid started (a section start). */
  bpb: number;
  barBeat0: number;
  /** Bar number at barBeat0. */
  bar0: number;
  section: SectionInfo;
}

export class TempoMap {
  readonly segs: Segment[] = [];

  clear(): void { this.segs.length = 0; }

  push(s: Segment): void { this.segs.push(s); }

  get last(): Segment | null { return this.segs.length ? this.segs[this.segs.length - 1] : null; }

  /** End of the defined timeline (the last segment extends forever after it). */
  get endTime(): number { const l = this.last; return l ? l.time : 0; }

  private segAtTime(t: number): Segment {
    const a = this.segs;
    let lo = 0, hi = a.length - 1;
    if (t <= a[0].time) return a[0];
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (a[m].time <= t) lo = m; else hi = m - 1;
    }
    return a[lo];
  }

  private segAtBeat(b: number): Segment {
    const a = this.segs;
    let lo = 0, hi = a.length - 1;
    if (b <= a[0].beat) return a[0];
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (a[m].beat <= b) lo = m; else hi = m - 1;
    }
    return a[lo];
  }

  /** Fractional beat at song time t (extrapolates before the first / after the last segment). */
  beatAt(t: number): number {
    const s = this.segAtTime(t);
    return s.beat + (t - s.time) / s.spb;
  }

  /** Song time of (fractional) beat b. */
  timeAt(b: number): number {
    const s = this.segAtBeat(b);
    return s.time + (b - s.beat) * s.spb;
  }

  segmentAtTime(t: number): Segment { return this.segAtTime(t); }
  segmentAtBeat(b: number): Segment { return this.segAtBeat(b); }
}

export class BeatClock {
  readonly map = new TempoMap();
  ctx: AudioContext | null = null;
  /** Context time of song time 0 (beat 0 for built-in songs). */
  songStart = 0;
  /** Smoothed perf-ms minus heard-context-ms offset. */
  private perfOffset = NaN;
  /** Player latency calibration (ms): subtracted from input times. */
  inputOffsetMs = 0;

  get ready(): boolean { return !!this.ctx && this.map.segs.length > 0 && isFinite(this.perfOffset); }

  // ------------------------------------------------------------ clock mapping
  /** Re-estimate the perf ↔ heard-context mapping. Call once per frame. */
  sync(perfNow: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let off: number;
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime && ts.performanceTime && ts.contextTime > 0 && ts.performanceTime > 0) {
      off = ts.performanceTime - ts.contextTime * 1000;
    } else {
      const lat = (ctx.baseLatency || 0) + ((ctx as AudioContext & { outputLatency?: number }).outputLatency || 0);
      off = perfNow - (ctx.currentTime - lat) * 1000;
    }
    if (!isFinite(this.perfOffset) || Math.abs(off - this.perfOffset) > 30) this.perfOffset = off;
    else this.perfOffset += (off - this.perfOffset) * 0.02;
  }

  /** Heard context time at a performance.now()-domain timestamp. */
  heardAt(perfMs: number): number { return (perfMs - this.perfOffset) / 1000; }
  /** performance.now() at which context time t is heard. */
  perfOf(ctxT: number): number { return ctxT * 1000 + this.perfOffset; }
  /** Output latency estimate (s): how far the scheduler runs ahead of the ears. */
  latency(perfNow: number): number { return this.ctx ? Math.max(0, this.ctx.currentTime - this.heardAt(perfNow)) : 0; }

  // ------------------------------------------------------------ musical queries (context time in, beats out)
  beatAt(ctxT: number): number { return this.map.beatAt(ctxT - this.songStart); }
  timeOfBeat(b: number): number { return this.songStart + this.map.timeAt(b); }
  /** Beat position of an input stamped in performance.now() ms (calibration applied). */
  inputBeat(perfMs: number): number { return this.beatAt(this.heardAt(perfMs - this.inputOffsetMs)); }
  inputTime(perfMs: number): number { return this.heardAt(perfMs - this.inputOffsetMs); }

  segment(ctxT: number): Segment { return this.map.segmentAtTime(ctxT - this.songStart); }
  bpm(ctxT: number): number { return 60 / this.segment(ctxT).spb; }
  beatLen(ctxT: number): number { return this.segment(ctxT).spb; }
  /** Integer beat / subdivision counters (div 1 = quarter, 2 = eighth, 4 = sixteenth). */
  beat(ctxT: number): number { return Math.floor(this.beatAt(ctxT) + 1e-9); }
  sub(ctxT: number, div: number): number { return Math.floor(this.beatAt(ctxT) * div + 1e-9); }
  /** Phase within the current beat, 0..1. */
  phase(ctxT: number): number { const b = this.beatAt(ctxT); return b - Math.floor(b); }
  /** Seconds until the next subdivision boundary. */
  timeToNext(ctxT: number, div = 1): number { return this.timeOfBeat((this.sub(ctxT, div) + 1) / div) - ctxT; }
  /** Context time of the first grid point (1/div beat) at or after t. */
  nextGrid(ctxT: number, div = 1): number {
    const b = this.beatAt(ctxT) * div;
    const k = Math.ceil(b - 1e-6);
    return this.timeOfBeat(k / div);
  }
  /** Context time of the last grid point at or before t. */
  prevGrid(ctxT: number, div = 1): number { return this.timeOfBeat(Math.floor(this.beatAt(ctxT) * div + 1e-6) / div); }
  /** Bar number and beat-in-bar (0-based) at t. */
  barInfo(ctxT: number): { bar: number; beatInBar: number; bpb: number } {
    const s = this.segment(ctxT);
    const b = Math.floor(this.beatAt(ctxT) + 1e-9) - s.barBeat0;
    const bar = s.bar0 + Math.floor(b / s.bpb);
    return { bar, beatInBar: ((b % s.bpb) + s.bpb) % s.bpb, bpb: s.bpb };
  }
  section(ctxT: number): SectionInfo { return this.segment(ctxT).section; }
}
