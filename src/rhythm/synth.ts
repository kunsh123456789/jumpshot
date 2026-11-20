import { audio } from '../core/audio';
import type { SongDef } from '../data/songs';
import type { SectionInfo } from './beatClock';

/** Everything a pattern needs to render one 16th-note step. */
export interface StepInfo {
  /** Context time of the step. */
  t: number;
  /** 0..3 within the beat. */
  sixteenth: number;
  beatInBar: number;
  bpb: number;
  /** Bar index within the current section, and the section length in bars. */
  barInSection: number;
  sectionBars: number;
  /** Seconds per beat. */
  spb: number;
  section: SectionInfo;
  /** Extra intensity from the fight (style rank), 0..1. */
  hype: number;
}

const semi = (n: number) => Math.pow(2, n / 12);

/**
 * Procedural band for the built-in songs. Every quarter note carries a kick or
 * snare transient so the beat is always audible; layers fade in with section
 * intensity and fight hype; builds roll the snare and sweep noise into drops.
 */
export class SongSynth {
  constructor(private song: SongDef) {}

  /** Root frequency of the current bar's chord. */
  chordHz(s: StepInfo): number {
    const ch = s.section.chords;
    return this.song.keyHz * semi(ch.length ? ch[s.barInSection % ch.length] : 0);
  }

  step(s: StepInfo): void {
    switch (this.song.style) {
      case 'dojo': this.dojo(s); break;
      case 'neon': this.neon(s); break;
      case 'volcano': this.volcano(s); break;
    }
    this.transitions(s);
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

  /** Builds: snare roll that doubles in the last bar + rising noise; breaks: a downbeat crash into the next section. */
  private transitions(s: StepInfo): void {
    const lastBar = s.barInSection === s.sectionBars - 1;
    if (s.section.kind === 'build') {
      const roll = lastBar ? 1 : s.barInSection >= s.sectionBars - 2 ? 2 : 4;
      if (s.sixteenth % roll === 0) this.snare(s.t, 0.1 + 0.18 * (s.barInSection + s.sixteenth / 4) / s.sectionBars, 2200, 0.07);
      if (s.sixteenth === 0 && s.beatInBar === 0) audio.noiseBurst(s.t, s.spb * s.bpb, 0.05 + 0.1 * s.barInSection / s.sectionBars, 'bandpass', 600, 2, 6000, audio.music);
    }
    if (s.section.kind === 'drop' && s.barInSection === 0 && s.beatInBar === 0 && s.sixteenth === 0) {
      audio.noiseBurst(s.t, 1.1, 0.35, 'highpass', 4000, 0.5, 9000, audio.music);
      audio.tone(s.t, 'sine', 70, 30, 0.6, 0.6, audio.music);
    }
  }

  // ------------------------------------------------------------ styles
  /** Taiko-ish boom-bap with a pentatonic pluck. Works in 3/4 (waltz bridge). */
  private dojo(s: StepInfo): void {
    const { t, sixteenth: q, beatInBar: b, bpb } = s;
    const I = Math.max(s.section.intensity, s.hype * 0.8);
    const root = this.chordHz(s);
    const waltz = bpb === 3;
    if (q === 0) {
      if (b === 0) { this.kick(t, 0.85, 120, 38, 0.26); audio.tone(t, 'sine', 90, 55, 0.4, 0.3, audio.music); }
      else if (waltz) this.snare(t, 0.18, 1500, 0.1);
      else if (b % 2 === 1) this.snare(t, 0.3, 1400, 0.16);
      else this.kick(t, 0.6, 120, 38, 0.22);
    }
    if (q === 2 && b === bpb - 1 && I > 0.6) this.kick(t, 0.4, 120, 40, 0.16);
    if (q % 2 === 0) this.hat(t, q === 2 ? 0.08 : 0.04, 0.04);
    if (I > 0.7 && q % 2 === 1) this.hat(t, 0.035);
    if (q === 0 && (b === 0 || (!waltz && b === 2))) this.bass(t, root, s.spb * 0.9, 0.09, 'triangle');
    if (q === 2 && b === 1 && !waltz) this.bass(t, root * 1.5, s.spb * 0.4, 0.06, 'triangle');
    const pent = [1, 1.189, 1.335, 1.498, 1.782, 2];
    const mel = [0, -1, 2, -1, 3, -1, 2, 1, 0, -1, 4, -1, 3, 2, -1, -1];
    const n = mel[(b * 4 + q) % 16];
    if (n >= 0 && I > 0.3 && s.section.kind !== 'break') {
      const f = root * 4 * pent[(n + s.barInSection) % pent.length];
      audio.tone(t, 'triangle', f, f * 0.995, 0.22, 0.03 + I * 0.04, audio.music, 0.002);
    }
  }

  /** Four-on-the-floor minor groove (the classic JUMPSHOT loop, sectioned). */
  private neon(s: StepInfo): void {
    const { t, sixteenth: q, beatInBar: b } = s;
    const I = Math.max(s.section.intensity, s.hype * 0.8);
    const root = this.chordHz(s);
    const brk = s.section.kind === 'break';
    if (q === 0 && (!brk || b === 0)) this.kick(t, brk ? 0.5 : 0.75);
    if (q === 0 && b % 2 === 1) this.snare(t, brk ? 0.15 : 0.35, 1800, 0.14);
    if (!brk && (q === 2 || (I > 0.55 && q % 2 === 1))) this.hat(t, q === 2 ? 0.12 : 0.05);
    if (brk && q === 2) this.hat(t, 0.05);
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    const st = (b * 4 + q) % 16;
    if (pat[st] && I > 0.25) {
      const f = root * (st === 13 ? 1.5 : st === 11 ? 1.189 : 1);
      this.bass(t, f, 0.16, 0.08 + I * 0.08);
    }
    if (I > 0.45 && q % 2 === 0) {
      const arp = [4, 3, 2, 1.5, 2, 3, 4, 6];
      const f = root * arp[(st / 2) % 8] * 2;
      audio.tone(t, 'square', f, f, 0.07, 0.02 + I * 0.035, audio.music);
    }
    if (brk && q === 0) {
      const f = root * 8 * [1, 1.2, 1.5, 1.2][b % 4];
      audio.tone(t, 'sine', f, f, s.spb * 0.9, 0.06, audio.music, 0.02);
    }
  }

  /** Breakbeat-flavoured, every quarter hit hard. */
  private volcano(s: StepInfo): void {
    const { t, sixteenth: q, beatInBar: b } = s;
    const I = Math.max(s.section.intensity, s.hype * 0.8);
    const root = this.chordHz(s);
    const brk = s.section.kind === 'break';
    const st = (b * 4 + q) % 16;
    if (st === 0 || st === 8) this.kick(t, brk ? 0.55 : 0.85, 170, 38, 0.2);
    if (!brk && (st === 10 || (st === 14 && s.barInSection % 2 === 1))) this.kick(t, 0.5, 150, 40, 0.14);
    if (st === 4 || st === 12) this.snare(t, brk ? 0.2 : 0.45, 2000, 0.16);
    if (st === 7 && I > 0.5) this.snare(t, 0.12, 2400, 0.06);
    if (!brk) this.hat(t, q === 2 ? 0.1 : 0.045, q === 2 ? 0.05 : 0.025);
    const pat = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0];
    if (pat[st] && I > 0.3 && !brk) {
      const f = root * (st === 7 ? 1.498 : st === 14 ? 1.189 : 2);
      audio.tone(t, 'sawtooth', f, f, 0.11, 0.06 + I * 0.05, audio.music);
      audio.tone(t, 'square', f * 0.5, f * 0.5, 0.12, 0.05 + I * 0.04, audio.music);
    }
    if (brk && q === 0) audio.tone(t, 'sawtooth', root * 2, root * 2, s.spb, 0.05, audio.music, 0.05);
    if (I > 0.6 && q % 2 === 0 && !brk) {
      const lead = [8, 6, 4.75, 6, 8, 9.5, 8, 6];
      const f = root * lead[(st / 2 + s.barInSection) % 8];
      audio.tone(t, 'sawtooth', f, f * 1.01, 0.09, 0.02 + I * 0.03, audio.music);
    }
  }
}
