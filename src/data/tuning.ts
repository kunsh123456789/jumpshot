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
  groundScreenY: 410,
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

/** Animation feel: springs, blends, turns, run cycle, pop detector. See SMOOTHNESS.md. */
export const ANIM = {
  /** Critically damped spring angular frequency (rad/s) per phase. Higher = snappier. */
  springStrike: 95,
  springAnticipation: 55,
  springHitReact: 60,
  springLocomotion: 38,
  springRecovery: 30,
  springIdle: 22,
  /** Per-part stiffness multipliers (overlapping action: these parts trail the torso). */
  headLag: 0.6,
  rearArmLag: 0.78,
  leanLag: 0.85,
  /** Crossfade lengths (frames). */
  blendDefault: 5,
  blendMoveMin: 3,
  blendMoveMax: 5,
  blendHitReact: 4,
  blendLand: 3,
  blendGetup: 6,
  /** Adaptive crossfade: extend blends so joints move at most blendMaxRate rad/frame (up to +blendExtraMax frames). */
  blendMaxRate: 0.42,
  blendExtraMax: 6,
  /** Outgoing pose keeps its momentum during a crossfade, decaying by this per frame. */
  outgoingMomentum: 0.55,
  outgoingMaxVel: 6,
  /** Eased facing turn (frames) instead of an instant mirror. */
  turnFrames: 5,
  turnFramesAttack: 4,
  /** After a magnetism dash, the wind-up gets at least this many frames (overlaps the dash). */
  minAnticFrames: 6,
  /** The dash pose is pre-blended this far toward the move's wind-up (limbs don't detour). */
  dashTowardAntic: 0.45,
  /** Follow-through: limbs carry past the contact pose by this fraction of the swing. */
  carryPast: 0.14,
  carryFrac: 0.3,
  /** Max head tilt toward the target (rad). */
  headLook: 0.35,
  /** Run cycle: stride grows with speed so cadence matches ground speed (feet stay planted). */
  strideBase: 40,
  stridePerSpeed: 0.1,
  strideMax: 90,
  footLift: 15,
  runBounce: 5,
  runLeanPerSpeed: 0.0006,
  accelLean: 0.00012,
  maxAccelLean: 0.28,
  /** Apex hang: gravity multiplier when |vy| is below apexBand (eases the top of arcs). */
  apexBand: 220,
  apexGravity: 0.6,
  /** Air-stall gravity blends in/out over these frames instead of switching. */
  stallEaseIn: 2,
  stallEaseOut: 7,
  /** Pop detector thresholds per sim tick. */
  popAngle: 0.5,
  popSpin: 0.9,
  popRoot: 120,
  /** Ticks after a hit during which the reaction counts as an intentional snap. */
  impactSnapFrames: 5,
  /** Hit-stop victim vibration (render-time, px amplitude and Hz). */
  hitstopShakeAmp: 3,
  hitstopShakeHz: 38,
  /** Motion trail lifetime (seconds of scaled time). */
  trailLife: 0.11,
  /** Afterimage spawn interval during dashes (seconds of render time). */
  ghostInterval: 0.022,
} as const;

export const PAD = {
  /** Default fraction of the screen height (from the bottom) that is the pad. Settings: 0.35..0.6. */
  regionDefault: 0.5,
  regionMin: 0.35,
  regionMax: 0.6,
  /** Portrait crop of the 1280x720 view: visible logical width and top edge. */
  portraitViewW: 640,
  portraitViewTop: -40,
  /** Flick (attack) detection: over the last flickWindowMs of samples the stroke must
   *  exceed flickSpeed (px/s) and flickMinDist (px). Both are divided by the sensitivity setting. */
  flickWindowMs: 75,
  flickSpeed: 1000,
  flickMinDist: 40,
  /** After a flick, the stroke re-arms when it slows below this fraction of flickSpeed. */
  rearmFrac: 0.45,
  /** ...and only after this long (ms), so one flick can never fire twice. */
  rearmMinMs: 60,
  /** Stroke length (px) and average speed (px/s) that upgrade a flick to HEAVY. */
  heavyDist: 120,
  heavySpeed: 1500,
  /** Frames after the flick during which it can still upgrade to heavy. */
  heavyUpgradeFrames: 9,
  /** Directional sector half-width in degrees (22.5 = exact 8-way). */
  sectorHalfDeg: 22.5,
  /** Bias toward cardinal directions (deg added to cardinal sectors). */
  cardinalBiasDeg: 4,
  /** Turn angle that splits a fast continuous stroke into a new attack (zig-zag chains). */
  chainTurnDeg: 60,
  tapMaxDist: 14,
  tapMaxMs: 260,
  trailFadeMs: 250,
} as const;

/** Drag-to-move: floating stick on the pad, and player locomotion. */
export const MOVE = {
  /** Stick dead zone and the radius that reaches full speed (px). */
  deadZone: 10,
  maxRadius: 90,
  /** Stick output is held (not updated) while the finger moves faster than this (px/s),
   *  so the start of a flick never shoves the player. */
  freezeSpeed: 800,
  /** Movement is suppressed for this many frames after a flick (post-flick finger drift). */
  suppressFrames: 4,
  /** Locomotion (world units/s and /s^2). */
  runSpeed: 340,
  accel: 2600,
  decel: 3400,
  airAccel: 900,
  airMax: 260,
  /** Speed falls off within this distance of a wall (soft clamp). */
  wallSoft: 90,
  /** Below this speed the run animation hands back to idle. */
  runThreshold: 25,
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
  dashSpeed: 2400,       // average units/s (the ease-out peaks at 2x for one tick)
  dashMaxFrames: 12,
  dashMinDistance: 26,
  whiffStep: 28,
  airDashMaxFrames: 10,
  /** How high a target must be to count as "airborne" for targeting/jumping. */
  airborneHeight: 70,
  /** Max stalls per airtime before the player starts to fall normally. */
  maxAirStalls: 16,
  landingRecovery: 4,
  hpRegenSRank: 1.2, // hp per second while at S rank or higher
  scale: 1.1,
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
  burstChance: 0.28,
  burstPush: 620,
  /** Air juggles allow an escape burst after burstThreshold * this many hits on one enemy. */
  airBurstFactor: 2.4,
  /** Height above which upward juggle knockback fades out (keeps juggles on screen). */
  juggleCeiling: 280,
  juggleCeilingFade: 170,
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
  /** Critically damped spring frequencies (rad/s). Zooming out is faster so launches stay framed. */
  followOmega: 7,
  zoomOmega: 4.5,
  zoomOutOmega: 9,
  /** Punch-in: target decay rate (1/s) and spring frequency for the eased in/out. */
  punchDecay: 7,
  punchOmega: 32,
  baseZoom: 1,
  minZoom: 0.8,
  crowdSpreadStart: 420,
  crowdSpreadFull: 1100,
  aerialHeightStart: 90,
  /** World units kept visible above the highest fighter's feet when aerial. */
  aerialHeadroom: 200,
  minAerialZoom: 0.7,
  /** Only when even min zoom can't fit, pan up by this fraction of the overflow. */
  aerialFollowY: 0.8,
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
