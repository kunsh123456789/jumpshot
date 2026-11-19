/**
 * Global tunables. Every number that shapes feel lives here (or in moves/enemies/
 * waves/upgrades). See TUNING.md for documentation of each value.
 * Units: world units (1280x720 logical view), seconds, or sim frames (60 Hz).
 */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export const WORLD = {
  viewW: 1280,
  viewH: 720,
  /** Arena width: wider than the view so the camera pans; walls at both ends. */
  arenaW: 1900,
  /** Ground line (y grows downward). */
  groundY: 445,
  /** Where the ground sits on screen at zoom 1 (logical px from top). */
  groundScreenY: 445,
  wallMargin: 30,
} as const;

export const PHYS = {
  gravity: 2700,            // units/s^2
  maxFall: 2200,
  groundFriction: 0.82,     // per-frame velocity multiplier while sliding on ground in hitstun
  airDrag: 0.995,
  /** Air stall: gravity multiplier while stalled after an air hit. */
  stallGravity: 0.12,
  stallFrames: 11,
  playerAirStallFrames: 12,
  /** Minimum downward speed that triggers a ground bounce (if available). */
  groundBounceMinVy: 900,
  groundBounceVy: -760,
  wallBounceMinVx: 650,
  wallBounceVxFactor: 0.55,
  wallBounceVy: -620,
  /** Speed above which a flying enemy bowls into another enemy. */
  bowlMinSpeed: 520,
  bowlDamage: 6,
  bowlKnockback: 520,
  separationPush: 0.35,
} as const;

export const PAD = {
  /** Fraction of screen height used by the pad in landscape. */
  landscapeHeight: 0.36,
  landscapeWidth: 0.56,
  /** Minimum fraction of screen height for the pad in portrait. */
  portraitMinHeight: 0.42,
  /** Swipe commits after this distance (fraction of pad's short side * sensitivity). */
  minDistFrac: 0.075,
  minDistPx: 16,
  /** Minimum speed (px/ms) at commit time. Slow drags still commit past 2x min distance. */
  minSpeed: 0.18,
  /** Stroke length (fraction of pad short side) for a HEAVY upgrade. */
  heavyDistFrac: 0.30,
  heavyMinSpeed: 0.75,       // px/ms average speed required for HEAVY
  /** Frames after commit during which a light swipe can upgrade to heavy. */
  heavyUpgradeFrames: 9,
  /** Directional sector half-width in degrees (22.5 = exact 8-way). */
  sectorHalfDeg: 22.5,
  /** Bias toward cardinal directions (deg added to cardinal sectors). */
  cardinalBiasDeg: 4,
  /** Turn angle that splits a continuous stroke into a new swipe. */
  chainTurnDeg: 60,
  tapMaxDistFrac: 0.05,
  tapMaxMs: 260,
  trailFadeMs: 250,
} as const;

export const INPUT = {
  bufferSize: 2,
  /** Buffered swipe lifetime in sim frames (~200 ms). Does not age during hitstop. */
  bufferFrames: 12,
  /** Keyboard: wait this long for a second key to form a diagonal. */
  keyChordMs: 34,
} as const;

export const PLAYER = {
  maxHp: 100,
  hurtInvulnFrames: 50,
  hurtStunFrames: 16,
  hurtKnockback: 380,
  dodgeFrames: 13,
  dodgeInvulnFrames: 12,
  dodgeDistance: 120,
  parryWindowFrames: 8,
  parryRangeBonus: 70,
  parryCritFrames: 30,
  parrySlowmoScale: 0.22,
  parrySlowmoSec: 0.45,
  critMult: 1.8,
  /** Auto-targeting. */
  targetRange: 560,
  targetConeDeg: 70,
  /** Attack magnetism dash. */
  dashSpeed: 2700,       // units/s
  dashMaxFrames: 11,
  dashMinDistance: 26,
  whiffStep: 28,
  airDashMaxFrames: 10,
  /** How high a target must be to count as "airborne" for targeting/jumping. */
  airborneHeight: 70,
  /** Max stalls per airtime before the player starts to fall normally. */
  maxAirStalls: 16,
  landingRecovery: 4,
  hpRegenSRank: 1.2, // hp per second while at S rank or higher
  scale: 1,
} as const;

export const COMBO = {
  /** Combo drops after this many frames without a hit. */
  timeoutFrames: 90,
  /** Combo also drops if no enemy is in a hit state for this long. */
  idleDropFrames: 50,
  /** Damage scaling: mult = max(floor, 1 - perHit * max(0, hits - freeHits)). */
  scaleFreeHits: 3,
  scalePerHit: 0.028,
  scaleFloor: 0.4,
  /** Repeated move penalty: each recent identical move multiplies damage by this. */
  repeatPenalty: 0.86,
  repeatWindow: 5,
  repeatFloor: 0.55,
  /** Hitstun scaling per hit the enemy has taken in this combo. */
  hitstunScalePerHit: 0.018,
  hitstunScaleFloor: 0.45,
  /** Juggle decay per juggle hit. */
  juggleKbDecay: 0.065,
  juggleKbFloor: 0.22,
  juggleGravityPerHit: 0.045,
  juggleStallDecay: 0.06,
  /** Grounded burst escape. */
  burstHitThreshold: 11,
  burstChance: 0.28,
  burstPush: 620,
  groundBounces: 1,
  wallBounces: 1,
  summaryMinHits: 3,
} as const;

export const STYLE = {
  ranks: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const,
  thresholds: [0, 12, 30, 55, 90, 135, 190],
  scoreMult: [1, 1.2, 1.5, 2, 2.6, 3.3, 4.2],
  max: 240,
  perHit: 1.4,
  varietyBonus: 2.2,
  airBonus: 1.2,
  multiBonus: 1.6,
  bounceBonus: 4,
  parryBonus: 14,
  finisherBonus: 30,
  launcherBonus: 3,
  koBonus: 5,
  passiveDelayFrames: 40,
  decayPerFrame: 0.55,
  comboEndDecayPerFrame: 2.4,
  hurtKeep: 0.35,
} as const;

export const SUPER = {
  max: 100,
  finisherCost: 50,
  perHitBase: 1.1,
  /** Multiplier per style rank. */
  rankMult: [0.6, 0.8, 1, 1.25, 1.5, 1.8, 2.2],
  parryGain: 10,
  orbGain: 12,
  jumpshotMinJuggle: 5,
  flurryMinCombo: 15,
  flurryHits: 9,
} as const;

export const SCORE = {
  perDamage: 10,
  koBonus: 250,
  koLaunchBonus: 150,
  comboBonusPerHitSq: 6,
  parry: 300,
  waveClear: 1000,
} as const;

export const JUICE = {
  shakeMax: 26,             // px cap for positional shake
  shakeRotMax: 0.035,       // radians cap
  shakeDecay: 5.5,          // trauma units per second
  punchZoomMax: 0.12,
  slowmoLastEnemyScale: 0.25,
  slowmoLastEnemySec: 0.7,
  slowmoFinisherScale: 0.25,
  slowmoFinisherSec: 0.55,
  flashFrames: 3,
  hitstopMaxFrames: 9,
  /** Hit sound pitch climbs with combo: 1 + perHit*min(combo, cap). */
  comboPitchPerHit: 0.011,
  comboPitchCap: 45,
  damageNumberLife: 0.85,
} as const;

export const CAMERA = {
  followRate: 6.5,
  zoomRate: 3.5,
  baseZoom: 1,
  minZoom: 0.8,
  crowdSpreadStart: 420,
  crowdSpreadFull: 1100,
  aerialHeightStart: 120,
  aerialZoom: 0.9,
  aerialFollowY: 0.45,
  lookAheadX: 40,
} as const;

export const WAVES_T = {
  breatherSec: 3,
  healFraction: 0.3,
  /** Attack tokens available by wave index: base + floor(wave / per), capped. */
  tokensBase: 1,
  tokensPerWaves: 3,
  tokensMax: 3,
  maxOnScreen: 7,
  spawnIntervalFrames: 50,
  arenaRotateEvery: 3,
} as const;

export const PICKUPS = {
  healthDropChance: 0.22,
  healthAmount: 8,
  orbDropChance: 0.5,
  magnetRange: 260,
  lifeFrames: 600,
} as const;
