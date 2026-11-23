/**
 * Rhythm Mode tunables. Times are in milliseconds unless noted. "Beat" means a
 * quarter note. All timing is measured on the WebAudio timeline (what the
 * player hears), after the player's latency calibration offset is applied.
 */

/** Judgement grades, worst to best (array indices below). */
export const MISS = 0, GOOD = 1, GREAT = 2, PERFECT = 3;
export type Grade = 0 | 1 | 2 | 3;
export const GRADE_NAME = ['MISS', 'GOOD', 'GREAT', 'PERFECT'] as const;
export const GRADE_COLOR = ['#9aa3b5', '#6fe3ff', '#7dff8a', '#ffe14a'] as const;

export const RHYTHM = {
  // ---------------- Judging (swipe/tap time vs the nearest beat) ----------------
  perfectMs: 45,
  greatMs: 90,
  goodMs: 140,
  /** An input near the off-beat 8th note also counts as GOOD within this window (fast strings stay viable). */
  eighthGoodMs: 60,

  // ---------------- Rewards (off-beat is never punished: MISS = baseline) ----------------
  /** Damage multiplier for the attack an input started, [MISS, GOOD, GREAT, PERFECT]. */
  damageMult: [1.0, 1.1, 1.3, 1.6] as number[],
  /** Bonus score per connecting judged attack (multiplied by the streak multiplier). */
  scoreBonus: [0, 30, 70, 140] as number[],
  /** Style per connecting judged attack. */
  styleBonus: [0, 1, 2.5, 4.5] as number[],

  /** Streak (consecutive non-MISS inputs) tiers and their bonus multipliers. */
  streakTiers: [0, 8, 16, 32] as number[],
  streakMult: [1, 1.5, 2, 3] as number[],
  /** "STREAK LOST" only shows when a streak at least this long breaks. */
  streakBreakShowMin: 4,
  /** Parry/dodge whose tap was GREAT or better. */
  beatParryStyle: 8,
  beatParryScore: 250,

  // ---------------- Attack snapping (the hit lands on the grid) ----------------
  /** Grid the contact frame snaps to: 4 = 16th notes, 2 = 8ths, 1 = beats. */
  snapDiv: 4,
  /** Never delay a strike by more than this (ms); slower grids fall back to the next finer one. */
  snapMaxDelayMs: 135,
  /** Startup may be compressed to this fraction to land on an earlier grid point. */
  snapMinStartupFrac: 0.6,
  /** ...but never below this many frames. */
  snapMinStartupFrames: 2,

  // ---------------- Enemies on the beat ----------------
  /** Wind-ups last a whole number of beats (start on a beat, strike on a beat). Min/max beats. */
  enemyMinBeats: 1,
  enemyMaxBeats: 3,
  /** An attack-ready enemy waits at most this many frames for the next beat before starting. */
  enemyMaxWaitFrames: 40,

  // ---------------- Sections drive the fight ----------------
  /** Extra attack tokens at section intensity 1 (scaled linearly; rounded). */
  intensityTokenBonus: 1.4,
  /** Enemy cooldown multiplier at intensity 0 → 1. */
  cooldownAtLow: 1.35,
  cooldownAtHigh: 0.75,

  // ---------------- Groove / presentation ----------------
  /** Camera zoom pulse on every beat (fraction), scaled by section intensity; downbeats ×1.6. */
  beatZoomPulse: 0.012,
  /** Background flash on beats (0..1 alpha), scaled by intensity. */
  beatFlash: 0.06,
  /** Beat-track HUD lookahead (ms) on each side of the ring. */
  hudLookaheadMs: 1600,

  // ---------------- Scheduler / clock ----------------
  /** Lookahead scheduler: timer period and how far ahead notes are scheduled (s). */
  schedulerTickMs: 25,
  scheduleAheadSec: 0.12,
  /** Gap between pressing start and beat 0 (s). */
  startDelaySec: 0.25,

  // ---------------- Calibration ----------------
  calibrateBpm: 100,
  calibrateCountIn: 4,
  calibrateTaps: 12,
  offsetMin: -250,
  offsetMax: 250,

  // ---------------- Tempo folding for imported / heard music ----------------
  minBpm: 72,
  maxBpm: 168,
} as const;
