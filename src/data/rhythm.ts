/**
 * Rhythm-mode tunables. All windows are in milliseconds, measured from the
 * moment you *see/hear* the beat (output-latency compensated) to the moment the
 * swipe/tap was recognised by the pad (perf timestamp of the pointer sample).
 */

/** Judgement grades, worst to best. */
export const G_NONE = -1, G_OFF = 0, G_GOOD = 1, G_GREAT = 2, G_PERFECT = 3;
export type Grade = number;

export const GRADE_NAME = ['OFF', 'GOOD', 'GREAT', 'PERFECT'] as const;
export const GRADE_COLOR = ['#8a93a6', '#6fe3ff', '#7dff8a', '#ffe14a'] as const;

export const RHYTHM = {
  /** |Δ| to the nearest beat (quarter note). */
  perfectMs: 50,
  greatMs: 85,
  goodMs: 115,
  /** Off-beat (8th-note) accents also count as GOOD within this window (capped at 12% of the beat). */
  halfBeatMs: 55,
  halfBeatMaxFrac: 0.12,

  /** Damage multiplier per grade [OFF, GOOD, GREAT, PERFECT]. */
  damageMult: [0.7, 1.0, 1.2, 1.45],
  /** Extra super meter per judged input. */
  superBonus: [0, 0.5, 1.2, 2.5],
  /** Style points per judged input that lands on beat (applied when the move hits). */
  styleBonus: [0, 1, 2, 4],

  /** On-beat streak: every non-OFF input extends it, an OFF breaks it. */
  streakTiers: [0, 8, 16, 32] as number[],
  /** Score multiplier for each streak tier. */
  streakScoreMult: [1, 1.25, 1.5, 2] as number[],
  /** Style gain multiplier for each streak tier. */
  streakStyleMult: [1, 1.15, 1.3, 1.5] as number[],
  /** A break only counts while there was something to lose. */
  streakBreakMin: 3,

  /** On-beat parry tap (GREAT or better): extra style + score. */
  rhythmParryStyle: 6,
  rhythmParryScore: 150,

  /** Enemy strikes are delayed until a beat, but never shorter than this fraction of the authored wind-up. */
  enemyWindMinFrac: 0.75,
  /** ...and never extended by more than this many frames (else they take the next eligible beat anyway). */
  enemyWindMaxExtra: 40,

  /** Keep within a comfortable fighting tempo: detected tempos are folded into this range. */
  minBpm: 72,
  maxBpm: 168,

  /** Beat HUD: how many ms of the future are shown on each side of the target. */
  hudLookaheadMs: 1500,

  /** Calibration: clicks per test and tempo. */
  calibrateBpm: 100,
  calibrateClicks: 16,
  offsetMin: -200,
  offsetMax: 200,
} as const;

export type MusicMode = 'classic' | 'builtin' | 'file' | 'mic';

export interface TrackDef {
  id: string;
  name: string;
  bpm: number;
  style: 'dojo' | 'neon' | 'volcano';
  desc: string;
}

/** Built-in procedural tracks (perfectly synced: the game is the band). */
export const TRACKS: TrackDef[] = [
  { id: 'dojo', name: 'DOJO PULSE', bpm: 100, style: 'dojo', desc: 'laid-back · 100 BPM · easiest' },
  { id: 'neon', name: 'NEON RUSH', bpm: 124, style: 'neon', desc: 'driving · 124 BPM' },
  { id: 'volcano', name: 'VOLCANO BREAKER', bpm: 148, style: 'volcano', desc: 'frantic · 148 BPM · hardest' },
];
