import { G_GOOD, G_NONE, G_OFF, RHYTHM, type Grade } from '../data/rhythm';

/**
 * Sim-side rhythm bookkeeping. The Game judges each input against the music
 * (it owns the clock) and stamps the grade onto the SwipeEvent; the sim only
 * reads grades, keeps the on-beat streak and asks "when is the next beat?" to
 * time enemy strikes.
 */
export class RhythmState {
  /** Rhythm rules apply this run (beat source present and locked). */
  active = false;
  /** Estimated perf-time (ms) of the current sim tick. */
  now = 0;
  /** Current beat length (ms). */
  beatMs = 500;
  /** First beat strictly after t (perf ms); NaN when unknown. Provided by the Game. */
  beatAfter: (t: number) => number = () => NaN;

  /** Position inside the current beat (0..1), or -1 when no beat is known. Set by the Game. */
  beatPhase = -1;
  /** Running beat number (parity drives two-beat idle cycles). */
  beatCount = 0;

  streak = 0;
  bestStreak = 0;
  /** Judged inputs per grade [OFF, GOOD, GREAT, PERFECT]. */
  counts = [0, 0, 0, 0];
  lastGrade: Grade = G_NONE;
  /** The last OFF broke a streak worth mentioning. */
  lastBroke = 0;

  reset(): void {
    this.streak = 0; this.bestStreak = 0; this.counts = [0, 0, 0, 0];
    this.lastGrade = G_NONE; this.lastBroke = 0;
  }

  /** Record a judged input; returns the streak length it broke (0 if none). */
  note(g: Grade): number {
    if (g === G_NONE) return 0;
    this.counts[g]++;
    this.lastGrade = g;
    if (g >= G_GOOD) {
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      return 0;
    }
    const broke = this.streak;
    this.streak = 0;
    this.lastBroke = broke >= RHYTHM.streakBreakMin ? broke : 0;
    return this.lastBroke;
  }

  tier(): number {
    const t = RHYTHM.streakTiers;
    for (let i = t.length - 1; i >= 0; i--) if (this.streak >= t[i]) return i;
    return 0;
  }
  scoreMult(): number { return this.active ? RHYTHM.streakScoreMult[this.tier()] : 1; }
  styleMult(): number { return this.active ? RHYTHM.streakStyleMult[this.tier()] : 1; }
  damageMult(g: Grade): number { return this.active && g >= G_OFF ? RHYTHM.damageMult[g] : 1; }

  /** Accuracy 0..1 weighted by grade. */
  accuracy(): number {
    const c = this.counts;
    const n = c[0] + c[1] + c[2] + c[3];
    return n ? (c[1] * 0.5 + c[2] * 0.8 + c[3]) / n : 0;
  }
  total(): number { return this.counts[0] + this.counts[1] + this.counts[2] + this.counts[3]; }
}
