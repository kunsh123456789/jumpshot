import type { Family } from './cines';

/**
 * The Special Bar and Special moves (revision pass 8, PART B). All tunables.
 * See TUNING.md ("Special Bar").
 */
export const SPECIAL = {
  /** One full charge. */
  full: 100,
  /** Segments the bar holds (1 = a single full charge; 2-3 store more). Overflow carries into the next. */
  segments: 1,

  // ---- charge sources ----
  /** Every landed hit, x (1 + combo hits * perComboHit, capped), + bonuses for air hits and multi-enemy hits. */
  perHit: 0.8,
  perComboHit: 0.04,
  comboCap: 2.2,
  airBonus: 0.5,
  multiBonus: 0.5,
  /** Rhythm Mode: extra charge per judged swipe (Miss, Good, Great, Perfect). */
  rhythmBonus: [0, 0.4, 1.2, 2.4] as number[],
  parry: 9,
  /** Orb pickups (the Jackpot drop from KOs). */
  orb: 10,
  /** Killing an enemy (normal, elite, boss). */
  kill: 3.5,
  killElite: 10,
  killBoss: 20,
  /** Catch-up: charge per point of damage taken. */
  perDamageTaken: 0.35,

  // ---- activation ----
  /** Sim frames of the activation beat (freeze bubble + pose) before the trace starts. */
  introFrames: 30,
  /** Radius of the freeze bubble around the hero. */
  bubbleRadius: 260,
  /** Safety: if no result arrives within this many sim frames of the input phase, resolve SLOPPY. */
  inputTimeoutFrames: 900,

  // ---- trace phase ----
  /** Time limit (s) to trace the path; Assist uses traceSecAssist. Rhythm Mode rounds to whole beats. */
  traceSec: 2.2,
  traceSecAssist: 3.4,
  /** Tolerance band (fraction of the smaller screen side); Assist multiplies by toleranceAssist. */
  tolerance: 0.085,
  toleranceAssist: 1.6,
  /** Score = coverage * wCoverage + accuracy * wAccuracy + speed bonus * wSpeed. */
  wCoverage: 0.5,
  wAccuracy: 0.35,
  wSpeed: 0.15,

  // ---- QTE phase ----
  /** Prompt window (ms) of the shrinking ring; Assist uses qteWindowAssist. Perfect = in the last perfectFrac of it. */
  qteWindowMs: 950,
  qteWindowAssist: 1400,
  perfectFrac: 0.35,
  /** Late grace after the ring closes (ms). */
  lateGraceMs: 120,
  /** Rapid-tap burst: taps needed. */
  mashTaps: 6,
  mashWindowMs: 1500,
  /** Skip QTE (Settings): counts as this fraction of prompts hit (a CLEAN result). */
  skipQteFrac: 0.75,

  // ---- result tiers ----
  /** total = trace * wTrace + qteHitFraction * wQte + perfect bonus. */
  wTrace: 0.55,
  wQte: 0.45,
  perfectBonus: 0.03,
  /** SLOPPY below clean, CLEAN below perfect, PERFECT at or above. */
  tierClean: 0.5,
  tierPerfect: 0.82,
  /** Damage multiplier per tier (SLOPPY, CLEAN, PERFECT). */
  tierDamage: [0.65, 1, 1.35] as number[],
  tierNames: ['SLOPPY', 'CLEAN', 'PERFECT'] as string[],

  // ---- who gets caught ----
  /** Range (world units) for the Mega Jumpshot / Cyclone, and the Hammer Swing's grab. */
  rangeFists: 560,
  rangeStaff: 620,
  rangeThrow: 560,
} as const;

/** QTE prompts per family: 'N' / 'S' / 'E' / 'W' = swipe that way ('F' = toward the facing side), 'tap', 'mash'. */
export const QTE_PROMPTS: Record<Family, string[]> = {
  fists: ['N', 'tap', 'F', 'S'],
  staff: ['F', 'tap', 'mash', 'N'],
  laser: ['tap', 'mash', 'F'],
  hook: ['F', 'S', 'tap'],
  throw: ['mash', 'F', 'tap', 'S'],
};
