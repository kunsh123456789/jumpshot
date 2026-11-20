import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { SONGS, METRONOME_SONG, type SongDef } from '../data/songs';
import { GOOD, GREAT, RHYTHM, type Grade } from '../data/rhythm';
import { SUPER } from '../data/tuning';
import { Conductor, type LoadedSong } from './conductor';
import { analyzeSong } from './analyze';
import { LiveTracker } from './live';
import { judgeAt, type Judgement } from './judge';
import type { RhythmSim } from './simHooks';
import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import type { SwipeEvent } from '../ui/pad';

const FRAME = 1 / 60;

/** Run statistics shown on the results screen. */
export interface RhythmStats { counts: number[]; streak: number; bestStreak: number; judged: number }

/**
 * Rhythm Mode facade. The Game talks to this object only through a handful of
 * guarded calls (start/stop/pause, judge inputs, per-frame update, draw); the
 * simulation talks to it only through the RhythmSim interface.
 */
export class RhythmDirector implements RhythmSim {
  readonly conductor = new Conductor();
  /** Separate conductor for the calibration metronome (a paused run keeps its own). */
  readonly metro = new Conductor();
  get clock() { return this.conductor.clock; }
  song: SongDef = SONGS[1];
  /** What the run plays: a built-in song, a loaded file, or the microphone. */
  source: 'song' | 'file' | 'mic' = 'song';
  file: LoadedSong | null = null;
  readonly tracker = new LiveTracker();
  private fileCache = new Map<string, LoadedSong>();
  /** A Rhythm Mode run is in progress (music + rules). */
  running = false;
  stats: RhythmStats = { counts: [0, 0, 0, 0], streak: 0, bestStreak: 0, judged: 0 };
  /** Judgements of this tick's inputs, by event. */
  private judged = new WeakMap<SwipeEvent, Judgement>();
  /** Listeners (HUD) for each judgement. */
  onJudge: ((j: Judgement, brokeStreak: number, tap: boolean) => void) | null = null;

  // ---- RhythmSim state ----
  now = 0;
  private moveGrade: Grade | -1 = -1;
  private bonusPaid = true;
  private tapGrade: Grade | -1 = -1;
  private snapTarget = 0;
  private enemyTarget = new WeakMap<Fighter, number>();
  private enemyWait = new WeakMap<Fighter, number>();
  /** Tuned note pre-scheduled on the grid for the current move (cancelled if the move is interrupted). */
  private note: { gain: GainNode; t: number; serial: number } | null = null;

  constructor() {
    const s = SONGS.find((x) => x.id === settings.songId);
    if (s) this.song = s;
  }

  /** Clock is usable (music started, output mapping known, not paused). */
  get live(): boolean { return this.running && this.conductor.playing && !this.conductor.paused && this.clock.ready && this.conductor.locked; }

  selectSong(s: SongDef): void { this.song = s; settings.songId = s.id; this.source = 'song'; }
  selectFile(f: LoadedSong): void { this.file = f; this.source = 'file'; }

  /** Ask for the microphone (Listen mode). Resolves false with `live.error` set on failure. */
  async selectMic(): Promise<boolean> {
    audio.unlock();
    if (!audio.ctx) { this.tracker.error = 'Audio is not available'; return false; }
    const ok = this.tracker.running || (await this.tracker.start(audio.ctx));
    if (ok) this.source = 'mic';
    return ok;
  }
  stopMic(): void { if (this.tracker.running) this.tracker.stop(); }

  /** Decode + analyse a song file (cached per name/size). */
  async loadFile(file: File, progress: (f: number, label: string) => void): Promise<LoadedSong> {
    audio.unlock();
    const ctx = audio.ctx;
    if (!ctx) throw new Error('Audio is not available');
    const key = `${file.name}:${file.size}`;
    const hit = this.fileCache.get(key);
    if (hit) return hit;
    progress(0, 'decoding');
    let buffer: AudioBuffer;
    try { buffer = await ctx.decodeAudioData(await file.arrayBuffer()); }
    catch { throw new Error("Couldn't decode that file — try an MP3, M4A, WAV or OGG"); }
    if (buffer.duration < 8) throw new Error('That clip is too short (needs 8+ seconds)');
    const map = await analyzeSong(buffer, progress);
    if (map.beats.length < 8) throw new Error("Couldn't find a steady beat in that song");
    // Mastered songs are much louder than the synth band: match them roughly.
    const d = buffer.getChannelData(0);
    let e = 0, n = 0;
    for (let i = 0; i < d.length; i += 97) { e += d[i] * d[i]; n++; }
    const trim = Math.max(0.3, Math.min(1.5, 0.11 / (Math.sqrt(e / Math.max(1, n)) || 0.1)));
    const song: LoadedSong = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), key, buffer, map, trim };
    this.fileCache.set(key, song);
    return song;
  }

  /** Label for HUD/results. */
  label(): string {
    if (this.source === 'file' && this.file) return `${this.file.name} · ${Math.round(this.file.map.bpm)} BPM`;
    if (this.source === 'mic') return 'LISTEN MODE';
    return this.song.name;
  }

  // ------------------------------------------------------------ transport
  startRun(): void {
    this.stats = { counts: [0, 0, 0, 0], streak: 0, bestStreak: 0, judged: 0 };
    this.moveGrade = -1; this.tapGrade = -1; this.bonusPaid = true;
    this.clock.inputOffsetMs = settings.rhythmOffset;
    if (this.source === 'file' && this.file) this.conductor.startFile(this.file);
    else if (this.source === 'mic' && this.tracker.running) this.conductor.startMic(this.tracker);
    else { this.source = 'song'; this.conductor.startSong(this.song); }
    this.running = true;
  }
  stop(): void { this.conductor.stop(); this.running = false; }
  pause(): void { this.conductor.pause(); }
  resume(): void { this.conductor.resume(); }

  startMetronome(bpm: number): void { this.metro.clock.inputOffsetMs = 0; this.metro.startSong(METRONOME_SONG(bpm), 'metronome'); }
  stopMetronome(): void { this.metro.stop(); }

  /** Per animation frame: keep the perf ↔ audio mapping fresh. */
  frame(perfNow: number): void {
    this.clock.sync(perfNow);
    if (this.conductor.kind === 'mic' && this.conductor.playing) this.conductor.updateMic(perfNow);
    if (this.metro.playing) this.metro.clock.sync(perfNow);
    this.conductor.hype = audio.intensity;
  }

  /** Short status for the HUD while the clock is not live. */
  statusText(): string {
    if (this.conductor.paused) return 'PAUSED';
    if (this.conductor.kind === 'mic') return this.tracker.level < 0.02 ? 'PLAY MUSIC' : 'LISTENING…';
    return 'COUNT-IN…';
  }

  /** Heard context time at a perf timestamp. */
  heardAt(perfMs: number): number { return this.clock.heardAt(perfMs); }

  // ------------------------------------------------------------ input judging (Game.step)
  /** Judge this tick's swipes/taps; results are looked up by the sim hooks. */
  judgeInputs(events: SwipeEvent[]): void {
    if (!this.live) return;
    for (const ev of events) {
      if (ev.kind !== 'swipe' && ev.kind !== 'tap') continue;
      const j = judgeAt(this.clock, this.clock.inputTime(ev.time));
      this.judged.set(ev, j);
      const s = this.stats;
      s.counts[j.grade]++;
      s.judged++;
      let broke = 0;
      if (j.grade >= GOOD) { s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak; }
      else { broke = s.streak; s.streak = 0; }
      this.onJudge?.(j, broke, ev.kind === 'tap');
    }
  }

  streakTier(): number {
    const t = RHYTHM.streakTiers;
    for (let i = t.length - 1; i >= 0; i--) if (this.stats.streak >= t[i]) return i;
    return 0;
  }
  streakMult(): number { return RHYTHM.streakMult[this.streakTier()]; }
  accuracy(): number {
    const c = this.stats.counts, n = c[0] + c[1] + c[2] + c[3];
    return n ? (c[1] * 0.5 + c[2] * 0.8 + c[3]) / n : 0;
  }

  // ------------------------------------------------------------ RhythmSim (filled in by later milestones)
  onMoveStart(w: World, p: Fighter, ev: SwipeEvent | null, resnap: boolean): void {
    if (!resnap && ev) {
      const j = this.judged.get(ev);
      this.moveGrade = j ? j.grade : -1;
      this.bonusPaid = !(j && j.grade >= GOOD);
    } // ev = null: a chained follow-up keeps the grade of the input that started the string
    this.comboIndex = w.combo.hits;
    this.snap(p);
  }

  /**
   * Snap the move's contact frame onto the musical grid: pick the 16th-note
   * grid point nearest the natural contact time, either compressing the
   * startup (down to snapMinStartupFrac) or delaying it (at most
   * snapMaxDelayMs). Slow tempos fall back to a finer grid. The dash and any
   * air hangs are re-timed with it.
   */
  private comboIndex = 0;
  private snap(p: Fighter): void {
    const m = p.move;
    if (!this.live || !m) { p.snapBase = 0; this.snapTarget = 0; return; }
    const c = this.clock;
    const fr = p.moveFrame;
    const S0 = p.effStartup;
    const now = this.now;
    const t0 = now + (S0 - fr) * FRAME;
    const minS = Math.max(RHYTHM.snapMinStartupFrames, Math.ceil(S0 * RHYTHM.snapMinStartupFrac), fr + 1);
    const tMin = now + (minS - fr) * FRAME - 0.004;
    const maxDelay = RHYTHM.snapMaxDelayMs / 1000 + 1e-6;
    let best = NaN;
    for (let div = RHYTHM.snapDiv; div <= 16 && !isFinite(best); div *= 2) {
      const gp = c.prevGrid(t0, div), gn = c.nextGrid(t0, div);
      const okP = gp >= tMin, okN = gn - t0 <= maxDelay;
      if (okP && okN) best = t0 - gp <= gn - t0 ? gp : gn;
      else if (okP) best = gp;
      else if (okN) best = gn;
    }
    if (!isFinite(best)) { p.snapBase = 0; this.snapTarget = 0; return; }
    const S = Math.max(fr + 1, fr + Math.round((best - now) / FRAME));
    const delta = S - S0;
    p.snapBase = S0;
    p.effStartup = S;
    this.snapTarget = best;
    if (p.target && p.target.alive && this.conductor.kind === 'song') this.scheduleNote(best, p.moveSerial, this.comboIndex + 1);
    // Re-time the magnetism dash proportionally (it must end by the contact frame).
    if (p.dashFrames > 0 && fr < p.dashFrames) p.dashFrames = Math.max(fr + 1, Math.min(S, Math.round((p.dashFrames * S) / S0)));
    if (delta > 0) {
      // Waiting longer for the beat: keep air hangs alive until the hit.
      if (!p.grounded || p.stall > 0) p.stall = Math.max(p.stall, S - fr + m.active);
      const t = p.target;
      if (t && t.alive && !t.grounded && t.stall > 0) t.stall += delta;
    }
  }

  /** Each startup tick: re-derive the contact frame from the clock (hit-stop or step jitter can't drift it off the grid). */
  onMoveTick(_w: World, p: Fighter): void {
    if (!this.live || this.snapTarget <= 0 || p.snapBase <= 0) return;
    const fr = p.moveFrame;
    let S = fr + Math.max(1, Math.round((this.snapTarget - this.now) / FRAME));
    if (p.dashFrames > fr) S = Math.max(S, p.dashFrames);
    if (S !== p.effStartup && Math.abs(S - p.effStartup) <= 3) p.effStartup = S;
  }

  onTap(_w: World, ev: SwipeEvent): void { const j = this.judged.get(ev); this.tapGrade = j ? j.grade : -1; }

  damageMult(_w: World): number { return this.moveGrade >= 0 ? RHYTHM.damageMult[this.moveGrade] : 1; }

  /** On-beat rewards, paid once per move when it first connects (so whiffs can't farm them). */
  onPlayerHit(w: World, v: Fighter, _damage: number): void {
    if (this.bonusPaid || this.moveGrade < GOOD) return;
    this.bonusPaid = true;
    const g = this.moveGrade as Grade;
    const m = this.streakMult();
    w.combo.addStyle(RHYTHM.styleBonus[g]);
    w.combo.superMeter = Math.min(SUPER.max, w.combo.superMeter + RHYTHM.superBonus[g] * w.stats.superGain);
    const pts = Math.round(RHYTHM.scoreBonus[g] * m);
    w.combo.score += pts;
    if (g >= GREAT) w.events.emit('text', { text: `+${pts}`, x: v.x, y: v.y - 175 * v.scale, color: g === 3 ? '#ffe14a' : '#7dff8a', size: 15 });
  }

  onParry(w: World): void {
    if (this.tapGrade < GREAT) return;
    const p = w.player;
    w.combo.addStyle(RHYTHM.beatParryStyle);
    w.combo.score += Math.round(RHYTHM.beatParryScore * this.streakMult());
    w.events.emit('text', { text: 'ON-BEAT PARRY', x: p.x, y: p.y - 195 * p.scale, color: '#ffe14a', size: 24 });
  }

  /** Attack-ready enemies start their wind-up on the tick a beat begins (or after waiting too long). */
  enemyCanStart(_w: World, e: Fighter): boolean {
    if (!this.live) return true;
    const c = this.clock;
    const onBeat = c.beat(this.now) !== c.beat(this.now - FRAME);
    const waited = (this.enemyWait.get(e) ?? 0) + 1;
    if (onBeat || waited > RHYTHM.enemyMaxWaitFrames) { this.enemyWait.set(e, 0); return true; }
    this.enemyWait.set(e, waited);
    return false;
  }

  /** Wind-up = a whole number of beats, so the strike's first active frame lands on a beat. */
  enemyWindup(_w: World, e: Fighter, wind: number): number {
    if (!this.live) { this.enemyTarget.delete(e); return wind; }
    const c = this.clock;
    const beats = Math.max(RHYTHM.enemyMinBeats, Math.min(RHYTHM.enemyMaxBeats, Math.round((wind * FRAME) / c.beatLen(this.now))));
    // Land `beats` beats out, but never sooner than 75% of that (a wind-up started mid-beat after a long wait stays readable).
    let k = c.beat(this.now + 0.02) + beats;
    while (c.timeOfBeat(k) - this.now < 0.75 * beats * c.beatLen(this.now)) k++;
    const target = c.timeOfBeat(k);
    this.enemyTarget.set(e, target);
    return Math.max(1, Math.round((target - this.now) / FRAME));
  }

  /** Re-derive the remaining wind-up from the clock every tick (hit-stop can't push the strike off the beat). */
  enemyWindupTick(_w: World, e: Fighter): void {
    const target = this.enemyTarget.get(e);
    if (target === undefined || !this.live) { if (e.telegraph > 0) e.telegraph--; return; }
    e.timer = Math.max(1, Math.round((target - this.now) / FRAME) + 1);
    e.telegraph = e.timer;
  }

  /** Beats left before an enemy's strike (for the on-beat telegraph count), or -1. */
  enemyBeatsLeft(e: Fighter, now: number): number {
    const target = this.enemyTarget.get(e);
    if (target === undefined || e.state !== 'windup') return -1;
    return Math.max(0, Math.ceil(this.clock.beatAt(target) - this.clock.beatAt(now) - 1e-3));
  }

  private intensity(): number { return this.live ? this.clock.section(this.now).intensity : 0.5; }
  tokenBonus(): number { return Math.round(this.intensity() * RHYTHM.intensityTokenBonus - 0.2); }
  cooldownMult(): number { const i = this.intensity(); return RHYTHM.cooldownAtLow + (RHYTHM.cooldownAtHigh - RHYTHM.cooldownAtLow) * i; }

  // ------------------------------------------------------------ musical juice
  /** Beat phase / count for beat-locked idle loops. */
  poseBeat(): { phase: number; count: number } | null {
    if (!this.live) return null;
    const c = this.clock;
    return { phase: c.phase(this.now), count: c.beat(this.now) };
  }

  /** Semitone offset of the n-th note of a combo: walks the song scale over the current bar's chord. */
  private comboSemis(n: number): number {
    const c = this.clock, sc = this.conductor.kind === 'song' ? this.song.scale : [0, 3, 5, 7, 10];
    const sec = c.section(this.now);
    const bar = c.barInfo(this.now).bar - c.segment(this.now).bar0;
    const chord = sec.chords.length ? sec.chords[((bar % sec.chords.length) + sec.chords.length) % sec.chords.length] : 0;
    const i = Math.max(0, n - 1);
    return chord + sc[i % sc.length] + 12 * Math.min(1, Math.floor(i / sc.length));
  }

  /** Hit-sound pitch multiplier: combo hits climb the song's scale (a long combo plays a melody). */
  hitPitch(combo: number): number {
    if (!this.live) return 1;
    const s = this.comboSemis(combo) - 5;
    return Math.max(0.7, Math.min(2.2, Math.pow(2, s / 12)));
  }

  /** Pluck a chord tone exactly on the grid point the strike will land on. */
  private scheduleNote(tHeard: number, serial: number, n: number): void {
    const ctx = audio.ctx;
    if (!ctx || tHeard < ctx.currentTime + 0.004) return; // too close: the impact sound carries it
    this.cancelNote();
    const f = this.song.keyHz * 8 * Math.pow(2, this.comboSemis(n) / 12);
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(audio.music);
    audio.tone(tHeard, 'triangle', f, f, 0.22, 0.09, g, 0.002);
    audio.tone(tHeard, 'sine', f * 2, f * 2, 0.12, 0.04, g, 0.002);
    this.note = { gain: g, t: tHeard, serial };
  }

  private cancelNote(): void {
    const n = this.note;
    if (!n || !audio.ctx) return;
    if (n.t > audio.ctx.currentTime) { n.gain.gain.cancelScheduledValues(0); n.gain.gain.setValueAtTime(0, audio.ctx.currentTime); }
    this.note = null;
  }

  /** After each sim step: drop the pre-scheduled note if its move was interrupted before contact. */
  afterStep(w: World): void {
    const n = this.note;
    if (!n || !audio.ctx) return;
    const p = w.player;
    if (n.t <= audio.ctx.currentTime) { this.note = null; return; }
    if (p.state !== 'move' || p.moveSerial !== n.serial) this.cancelNote();
  }
}
