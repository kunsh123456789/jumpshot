import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { SONGS, METRONOME_SONG, type SongDef } from '../data/songs';
import { GOOD, GREAT, MISS, RHYTHM, type Grade } from '../data/rhythm';
import { SUPER } from '../data/tuning';
import { Conductor } from './conductor';
import { judgeAt, type Judgement } from './judge';
import type { RhythmSim } from './simHooks';
import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import type { MoveDef } from '../data/moves';
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
  onMoveStart(_w: World, _p: Fighter, ev: SwipeEvent | null, resnap: boolean): void {
    if (!resnap) {
      const j = ev ? this.judged.get(ev) : undefined;
      this.moveGrade = j ? j.grade : -1;
      this.bonusPaid = !(j && j.grade >= GOOD);
    }
    void this.snapTarget; void MISS; void FRAME; void (null as unknown as MoveDef);
  }
  onMoveTick(_w: World, _p: Fighter): void {}
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
