import { audio } from '../core/audio';
import { RHYTHM } from '../data/rhythm';
import type { SongDef } from '../data/songs';
import { BeatClock, type SectionInfo } from './beatClock';
import { SongSynth } from './synth';
import type { BeatMap } from './analyze';
import type { LiveTracker } from './live';

/** A decoded, analysed song file. */
export interface LoadedSong { name: string; key: string; buffer: AudioBuffer; map: BeatMap; trim: number }

/** Loudness bands stand in for sections on imported / heard music. */
const BANDS: SectionInfo[] = [
  { name: 'CALM', kind: 'break', intensity: 0.25, chords: [0], index: 0, bars: 0 },
  { name: 'GROOVE', kind: 'verse', intensity: 0.6, chords: [0], index: 1, bars: 0 },
  { name: 'PEAK', kind: 'drop', intensity: 1, chords: [0], index: 2, bars: 0 },
];

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
  // file source
  file: LoadedSong | null = null;
  private src: AudioBufferSourceNode | null = null;
  private trimGain: GainNode | null = null;
  private loops = 0;
  private band = 1;
  // mic source
  live: LiveTracker | null = null;
  private micLevel = 0;

  /** The beat grid is trustworthy (mic: tracker locked). */
  get locked(): boolean { return this.kind !== 'mic' || (!!this.live && this.live.locked && this.clock.map.segs.length > 0); }

  // ------------------------------------------------------------ song file
  startFile(song: LoadedSong): void {
    audio.unlock();
    const ctx = audio.ctx;
    this.stop();
    if (!ctx) return;
    this.kind = 'file';
    this.file = song;
    this.song = null; this.synth = null;
    const c = this.clock;
    c.ctx = ctx;
    c.map.clear();
    this.loops = 0; this.defEnd = 0; this.band = 1;
    this.appendLoop();
    c.songStart = ctx.currentTime + RHYTHM.startDelaySec;
    this.playFrom(0, c.songStart);
    this.playing = true;
    this.paused = false;
    this.runTimer();
  }

  private playFrom(pos: number, at: number): void {
    const ctx = audio.ctx!, f = this.file!;
    this.trimGain = ctx.createGain();
    this.trimGain.gain.value = f.trim;
    this.trimGain.connect(audio.music);
    const src = ctx.createBufferSource();
    src.buffer = f.buffer;
    src.loop = true;
    src.connect(this.trimGain);
    src.start(at, ((pos % f.buffer.duration) + f.buffer.duration) % f.buffer.duration);
    this.src = src;
  }

  private stopSource(): void {
    if (this.src) { try { this.src.stop(); } catch { /* already stopped */ } this.src.disconnect(); this.src = null; }
    if (this.trimGain) { this.trimGain.disconnect(); this.trimGain = null; }
  }

  /** Append one more loop of the song's beats to the tempo map (one segment per beat). */
  private appendLoop(): void {
    const f = this.file!;
    const B = f.map.beats, E = f.map.energy, N = B.length, dur = f.buffer.duration;
    const off = this.loops * dur;
    for (let i = 0; i < N; i++) {
      const t = off + B[i];
      const next = i + 1 < N ? off + B[i + 1] : off + dur + B[0];
      // Hysteresis so the band doesn't flicker at a boundary.
      const e = E[i] ?? 0.5;
      const up = [0.4, 0.75], down = [0.3, 0.65];
      if (this.band < 2 && e > up[this.band]) this.band++;
      else if (this.band > 0 && e < down[this.band - 1]) this.band--;
      this.clock.map.push({ beat: this.loops * N + i, time: t, spb: Math.max(0.2, next - t), bpb: 4, barBeat0: 0, bar0: 0, section: BANDS[this.band] });
    }
    this.loops++;
    this.defEnd = this.loops * dur;
  }

  // ------------------------------------------------------------ microphone
  startMic(live: LiveTracker): void {
    this.stop();
    this.kind = 'mic';
    this.live = live;
    this.song = null; this.synth = null; this.file = null;
    this.clock.ctx = audio.ctx;
    this.clock.map.clear();
    this.clock.songStart = 0;
    this.playing = true;
    this.paused = false;
  }

  /** Per frame (mic): poll the tracker and re-anchor the grid, keeping beat numbers continuous. */
  updateMic(perfNow: number): void {
    const l = this.live;
    if (!l || this.kind !== 'mic') return;
    l.poll(perfNow);
    this.micLevel += (l.level - this.micLevel) * 0.02;
    if (l.period <= 0 || !this.clock.synced) return;
    const c = this.clock, map = c.map;
    const anchor = c.heardAt(l.anchor);
    const spb = l.period / 1000;
    const beat = map.segs.length ? Math.round(map.beatAt(anchor)) : 0;
    const lv = Math.min(1, this.micLevel * 3);
    if (this.band < 2 && lv > [0.4, 0.75][this.band]) this.band++;
    else if (this.band > 0 && lv < [0.3, 0.65][this.band - 1]) this.band--;
    map.clear();
    map.push({ beat, time: anchor, spb, bpb: 4, barBeat0: 0, bar0: 0, section: BANDS[this.band] });
  }

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
    this.stopSource();
    this.playing = false;
    this.paused = false;
  }

  pause(): void {
    if (!this.playing || this.paused || !this.ctx || this.kind === 'mic') return;
    window.clearInterval(this.timer);
    this.timer = 0;
    this.paused = true;
    this.pausedAt = this.ctx.currentTime - this.clock.songStart;
    if (this.kind === 'file') this.stopSource();
    // Rewind the scheduler to the pause point; notes already queued past it are short and decay out.
    this.nextStep = Math.max(0, Math.ceil(this.clock.map.beatAt(this.pausedAt) * 4));
  }

  resume(): void {
    if (!this.paused || !this.ctx) return;
    this.paused = false;
    this.clock.songStart = this.ctx.currentTime + 0.1 - this.pausedAt;
    if (this.kind === 'file' && this.file) this.playFrom(this.pausedAt, this.ctx.currentTime + 0.1);
    this.runTimer();
  }

  private runTimer(): void {
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), RHYTHM.schedulerTickMs);
    this.tick();
  }

  /** Append sections until the tempo map covers song time `until`. */
  private extendTo(until: number): void {
    if (this.kind === 'file') { let g = 0; while (this.file && this.defEnd <= until && g++ < 8) this.appendLoop(); return; }
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
    if (!ctx || !this.playing || this.paused) return;
    if (this.kind === 'file') { this.extendTo(ctx.currentTime - this.clock.songStart + 6); return; }
    if (!this.synth) return;
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
