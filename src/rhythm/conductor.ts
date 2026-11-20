import { audio } from '../core/audio';
import { RHYTHM } from '../data/rhythm';
import type { SongDef } from '../data/songs';
import { BeatClock, type SectionInfo } from './beatClock';
import { SongSynth } from './synth';

export type SourceKind = 'song' | 'metronome' | 'file' | 'mic';

/**
 * Plays the music and owns the beat clock.
 *
 * Scheduling uses the "two clocks" pattern: a setInterval timer (25 ms) wakes
 * up and schedules every 16th-note step whose time falls inside the next
 * 120 ms of AudioContext time. Notes are therefore placed on the audio clock
 * with sample accuracy regardless of frame rate or timer jitter.
 *
 * The song's tempo map is built lazily, section by section, a few seconds
 * ahead of the scheduler, so sections can change tempo / time signature and
 * the song can loop forever.
 */
export class Conductor {
  readonly clock = new BeatClock();
  kind: SourceKind = 'song';
  song: SongDef | null = null;
  playing = false;
  paused = false;
  private synth: SongSynth | null = null;
  private timer = 0;
  private nextStep = 0;
  // timeline builder state
  private defEnd = 0;
  private defBeat = 0;
  private defBar = 0;
  private nextSection = 0;
  private pausedAt = 0;
  /** Extra layer intensity from the fight (0..1). */
  hype = 0;

  get ctx(): AudioContext | null { return audio.ctx; }

  /** Start a built-in song (or the calibration metronome) from beat 0. */
  startSong(song: SongDef, kind: 'song' | 'metronome' = 'song'): void {
    audio.unlock();
    const ctx = audio.ctx;
    this.stop();
    if (!ctx) return;
    this.kind = kind;
    this.song = song;
    this.synth = new SongSynth(song);
    const c = this.clock;
    c.ctx = ctx;
    c.map.clear();
    this.defEnd = 0; this.defBeat = 0; this.defBar = 0; this.nextSection = 0;
    this.extendTo(8);
    c.songStart = ctx.currentTime + RHYTHM.startDelaySec;
    this.nextStep = 0;
    this.playing = true;
    this.paused = false;
    this.runTimer();
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.playing = false;
    this.paused = false;
  }

  pause(): void {
    if (!this.playing || this.paused || !this.ctx) return;
    window.clearInterval(this.timer);
    this.timer = 0;
    this.paused = true;
    this.pausedAt = this.ctx.currentTime - this.clock.songStart;
    // Rewind the scheduler to the pause point; notes already queued past it are short and decay out.
    this.nextStep = Math.max(0, Math.ceil(this.clock.map.beatAt(this.pausedAt) * 4));
  }

  resume(): void {
    if (!this.paused || !this.ctx) return;
    this.paused = false;
    this.clock.songStart = this.ctx.currentTime + 0.1 - this.pausedAt;
    this.runTimer();
  }

  private runTimer(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), RHYTHM.schedulerTickMs);
    this.tick();
  }

  /** Append sections until the tempo map covers song time `until`. */
  private extendTo(until: number): void {
    const song = this.song;
    if (!song) return;
    const map = this.clock.map;
    let guard = 0;
    while (this.defEnd <= until && guard++ < 64) {
      if (this.nextSection >= song.sections.length) this.nextSection = song.loopFrom;
      const idx = this.nextSection++;
      const d = song.sections[idx];
      const spb = 60 / d.bpm;
      const info: SectionInfo = { name: d.name, kind: d.kind, intensity: d.intensity, chords: d.chords, index: idx, bars: d.bars };
      map.push({ beat: this.defBeat, time: this.defEnd, spb, bpb: d.beatsPerBar, barBeat0: this.defBeat, bar0: this.defBar, section: info });
      const beats = d.bars * d.beatsPerBar;
      this.defBeat += beats;
      this.defEnd += beats * spb;
      this.defBar += d.bars;
    }
  }

  /** Scheduler wake-up: extend the timeline and schedule steps inside the lookahead window. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing || this.paused || !this.synth) return;
    const c = this.clock;
    const songNow = ctx.currentTime - c.songStart;
    this.extendTo(songNow + 6);
    if (ctx.state !== 'running') return;
    const horizon = ctx.currentTime + RHYTHM.scheduleAheadSec;
    // Fell far behind (tab was hidden): skip ahead on the grid instead of bursting.
    const late = songNow - c.map.timeAt(this.nextStep / 4);
    if (late > 0.25) this.nextStep = Math.ceil(c.map.beatAt(songNow) * 4);
    let guard = 0;
    while (guard++ < 64) {
      const beat = this.nextStep / 4;
      const t = c.songStart + c.map.timeAt(beat);
      if (t >= horizon) break;
      this.renderStep(this.nextStep, Math.max(t, ctx.currentTime));
      this.nextStep++;
    }
  }

  private renderStep(k: number, t: number): void {
    const map = this.clock.map;
    const beat = k / 4;
    const seg = map.segmentAtBeat(beat);
    const inSec = Math.floor(beat + 1e-9) - seg.barBeat0;
    const beatInBar = ((inSec % seg.bpb) + seg.bpb) % seg.bpb;
    const sixteenth = ((k % 4) + 4) % 4;
    if (this.kind === 'metronome') {
      if (sixteenth === 0) audio.click(t, beatInBar === 0);
      return;
    }
    this.synth!.step({
      t, sixteenth, beatInBar, bpb: seg.bpb, spb: seg.spb,
      barInSection: Math.floor(inSec / seg.bpb), sectionBars: seg.section.bars,
      section: seg.section, hype: this.hype,
    });
  }
}
