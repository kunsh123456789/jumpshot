import { audio } from '../core/audio';
import type { TrackDef } from '../data/rhythm';

/**
 * A built-in procedural track on a strict beat grid. Step k (16th notes) plays
 * at `anchor + k * stepDur` in AudioContext time, so the beat grid is known
 * exactly and judging needs no analysis. Every quarter note carries a
 * transient (kick or snare) so the beat is always audible.
 */
export class SynthTrack {
  readonly beatSec: number;
  readonly stepSec: number;
  /** Context time of step 0 (a downbeat). */
  anchor = 0;
  private next = 0;
  running = false;
  /** Metronome-only (calibration). */
  metronome = false;

  constructor(readonly def: TrackDef) {
    this.beatSec = 60 / def.bpm;
    this.stepSec = this.beatSec / 4;
  }

  /** Start with step 0 at context time t0. */
  start(t0: number): void { this.anchor = t0; this.next = 0; this.running = true; }

  /** Continue from the next step after a pause, without skipping a beat. */
  resumeAt(t0: number): void {
    // Re-anchor so the step we resume on lands at t0 (rounded up to a beat to keep bars intact).
    const step = Math.ceil(this.next / 4) * 4;
    this.next = step;
    this.anchor = t0 - step * this.stepSec;
    this.running = true;
  }

  stop(): void { this.running = false; }

  /** Schedule all steps that start before `until` (context time). */
  schedule(now: number, until: number): void {
    if (!this.running) return;
    // Fell far behind (tab was hidden): skip ahead, staying on the grid.
    const late = now - (this.anchor + this.next * this.stepSec);
    if (late > 0.25) this.next += Math.ceil(late / this.stepSec);
    while (this.anchor + this.next * this.stepSec < until) {
      const t = this.anchor + this.next * this.stepSec;
      if (this.metronome) { if (this.next % 4 === 0) audio.click(t, this.next % 16 === 0); }
      else this.step(this.next, t);
      this.next++;
    }
  }

  private step(k: number, t: number): void {
    switch (this.def.style) {
      case 'dojo': this.dojo(k, t); break;
      case 'neon': this.neon(k, t); break;
      case 'volcano': this.volcano(k, t); break;
    }
  }

  // ------------------------------------------------------------ instruments
  private kick(t: number, gain = 0.75, f0 = 150, f1 = 40, dur = 0.18): void {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.66);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audio.music); o.start(t); o.stop(t + dur + 0.02);
  }
  private snare(t: number, gain = 0.35, freq = 1800, dur = 0.14): void {
    audio.noiseBurst(t, dur, gain, 'bandpass', freq, 0.8, freq * 0.5, audio.music);
    audio.tone(t, 'triangle', 220, 160, 0.06, gain * 0.5, audio.music);
  }
  private hat(t: number, gain: number, dur = 0.03): void { audio.noiseBurst(t, dur, gain, 'highpass', 8000, 0.7, 0, audio.music); }
  private bass(t: number, f: number, dur: number, gain: number, wave: OscillatorType = 'sawtooth'): void {
    audio.tone(t, wave, f, f, dur, gain, audio.music);
    audio.tone(t, 'sine', f / 2, f / 2, dur * 1.2, gain * 1.5, audio.music);
  }

  // ------------------------------------------------------------ styles
  /** 100 BPM: taiko-ish boom-bap with a pentatonic pluck. */
  private dojo(k: number, t: number): void {
    const st = k % 16, bar = Math.floor(k / 16) % 8;
    const hype = audio.intensity;
    if (st === 0 || st === 8 || st === 10) this.kick(t, st === 10 ? 0.45 : 0.8, 120, 38, 0.24);
    if (st === 4 || st === 12) { this.snare(t, 0.3, 1400, 0.16); audio.noiseBurst(t, 0.05, 0.25, 'highpass', 3000, 1, 0, audio.music); }
    if (st % 2 === 0) this.hat(t, st % 4 === 2 ? 0.09 : 0.05, 0.04);
    if (hype > 0.5 && st % 2 === 1) this.hat(t, 0.04);
    // low taiko on bar downbeats
    if (st === 0) audio.tone(t, 'sine', 90, 55, 0.4, 0.35, audio.music);
    const roots = [65.4, 65.4, 77.8, 58.3, 65.4, 65.4, 87.3, 73.4];
    const root = roots[bar];
    if (st === 0 || st === 6 || st === 11) this.bass(t, root, 0.26, 0.1, 'triangle');
    // pluck melody (minor pentatonic)
    const pent = [1, 1.189, 1.335, 1.498, 1.782, 2];
    const mel = [0, -1, 2, -1, 3, -1, 2, 1, 0, -1, 4, -1, 3, 2, -1, -1];
    const n = mel[st];
    if (n >= 0 && (hype > 0.2 || st % 4 === 0)) {
      const f = root * 4 * pent[(n + bar) % pent.length];
      audio.tone(t, 'triangle', f, f * 0.995, 0.22, 0.06, audio.music, 0.002);
    }
  }

  /** 124 BPM: four-on-the-floor minor groove (the original JUMPSHOT loop). */
  private neon(k: number, t: number): void {
    const st = k % 16, bar = Math.floor(k / 16) % 4;
    const roots = [55, 55, 43.65, 49];
    const root = roots[bar];
    const hype = audio.intensity;
    if (st % 4 === 0) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, 0.35, 1800, 0.14);
    if (st % 2 === 1 || hype > 0.5) this.hat(t, st % 2 === 1 ? 0.12 : 0.06);
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (pat[st]) {
      const f = root * (st === 13 ? 1.5 : st === 11 ? 1.189 : 1);
      this.bass(t, f, 0.16, 0.16);
    }
    if (hype > 0.3 && st % 2 === 0) {
      const arp = [4, 3, 2, 1.5, 2, 3, 4, 6];
      const f = root * arp[(st / 2) % 8] * 2;
      audio.tone(t, 'square', f, f, 0.07, 0.035 + hype * 0.03, audio.music);
    }
  }

  /** 148 BPM: breakbeat-flavoured, every quarter hit hard. */
  private volcano(k: number, t: number): void {
    const st = k % 16, bar = Math.floor(k / 16) % 4;
    const hype = audio.intensity;
    const roots = [41.2, 41.2, 49, 36.7];
    const root = roots[bar];
    if (st === 0 || st === 8) this.kick(t, 0.85, 170, 38, 0.2);
    if (st === 10 || (st === 14 && bar % 2 === 1)) this.kick(t, 0.5, 150, 40, 0.14);
    if (st === 4 || st === 12) this.snare(t, 0.45, 2000, 0.16);
    if (st === 7 && hype > 0.4) this.snare(t, 0.12, 2400, 0.06);
    this.hat(t, st % 4 === 2 ? 0.1 : 0.05, st % 4 === 2 ? 0.05 : 0.025);
    if (st === 0 && bar === 0) audio.noiseBurst(t, 0.9, 0.18, 'highpass', 5000, 0.5, 9000, audio.music);
    const pat = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0];
    if (pat[st]) {
      const f = root * (st === 7 ? 1.498 : st === 14 ? 1.189 : 2);
      audio.tone(t, 'sawtooth', f, f, 0.11, 0.1, audio.music);
      audio.tone(t, 'square', f * 0.5, f * 0.5, 0.12, 0.08, audio.music);
    }
    if (hype > 0.35 && st % 2 === 0) {
      const lead = [8, 6, 4.75, 6, 8, 9.5, 8, 6];
      const f = root * lead[(st / 2 + bar) % 8];
      audio.tone(t, 'sawtooth', f, f * 1.01, 0.09, 0.03 + hype * 0.025, audio.music);
    }
  }
}
