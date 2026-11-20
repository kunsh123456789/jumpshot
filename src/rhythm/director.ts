import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { SONGS, METRONOME_SONG, type SongDef } from '../data/songs';
import { GOOD, GREAT, RHYTHM, type Grade } from '../data/rhythm';
import { SUPER } from '../data/tuning';
import { Conductor } from './conductor';
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

  constructor() {
    const s = SONGS.find((x) => x.id === settings.songId);
    if (s) this.song = s;
  }

  /** Clock is usable (music started, output mapping known, not paused). */
  get live(): boolean { return this.running && this.conductor.playing && !this.conductor.paused && this.clock.ready; }

  selectSong(s: SongDef): void { this.song = s; settings.songId = s.id; }

  // ------------------------------------------------------------ transport
  startRun(): void {
    this.stats = { counts: [0, 0, 0, 0], streak: 0, bestStreak: 0, judged: 0 };
    this.moveGrade = -1; this.tapGrade = -1; this.bonusPaid = true;
    this.clock.inputOffsetMs = settings.rhythmOffset;
    this.conductor.startSong(this.song);
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
    if (this.metro.playing) this.metro.clock.sync(perfNow);
    this.conductor.hype = audio.intensity;
  }

  /** Short status for the HUD while the clock is not live. */
  statusText(): string { return this.conductor.paused ? 'PAUSED' : 'COUNT-IN…'; }

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
  onMoveStart(_w: World, p: Fighter, ev: SwipeEvent | null, resnap: boolean): void {
    if (!resnap && ev) {
      const j = this.judged.get(ev);
      this.moveGrade = j ? j.grade : -1;
      this.bonusPaid = !(j && j.grade >= GOOD);
    } // ev = null: a chained follow-up keeps the grade of the input that started the string
    this.snap(p);
  }

  /**
   * Snap the move's contact frame onto the musical grid: pick the 16th-note
   * grid point nearest the natural contact time, either compressing the
   * startup (down to snapMinStartupFrac) or delaying it (at most
   * snapMaxDelayMs). Slow tempos fall back to a finer grid. The dash and any
   * air hangs are re-timed with it.
   */
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

  enemyCanStart(_w: World, _e: Fighter): boolean { void this.enemyWait; return true; }
  enemyWindup(_w: World, _e: Fighter, wind: number): number { void this.enemyTarget; return wind; }
  enemyWindupTick(_w: World, _e: Fighter): void {}
  tokenBonus(): number { return 0; }
  cooldownMult(): number { return 1; }
}
