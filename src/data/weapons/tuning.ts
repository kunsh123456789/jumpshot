/** Shared weapon-system tunables (revision pass 7). Per-move numbers live in each weapon file. */
export const WEAPON_T = {
  /** Highest the hero can get above the floor (world units): chained air grabs and zips stop here. */
  heroMaxHeight: 520,
  /** Verlet points in the grappling-hook rope. */
  ropePoints: 10,
  /** How long a fired hook that missed stays out (frames). */
  hookMissFrames: 10,
  /** Pull: where the victim stops in front of the player (world units) and its hit-stun on arrival. */
  pullStop: 66,
  pullStun: 30,
  /** Grab: reach from the player's centre once the dash has arrived (world units, + the victim's hurt radius). */
  grabReach: 64,
  /** Thrown bodies: bowling damage falls off per collision by this factor. */
  thrownFalloff: 0.75,
  /** Stretch goal: beams reflect once off the arena walls (off by default). */
  beamWallReflect: false as boolean,
  /** Beam flash length (frames), light and heavy. */
  beamFrames: 6,
  beamHeavyFrames: 14,
  /** Status effects and extra hooks (third weapon batch). */
  shatterMult: 1.6,
  popMult: 1.35,
  chainRange: 330,
  bleedEvery: 20,
  bleedDamage: 2,
  bubbleHeight: 250,
  spikeWidth: 48,
  spikeFrames: 14,
  /** Breather weapon-swap prompt and the first-time tooltip (ms). */
  tipMs: 6000,
} as const;

/** Reworked movesets (sim/moveset2.ts). Per-move numbers live in each weapon file. */
export const V2 = {
  /** Whip: hits past this fraction of the lash's length crack for tipMult damage. */
  tipFrac: 0.68, tipMult: 2,
  /** Fists fury: fill per hit (0..1), how long it burns (frames), damage and knockback while it burns. */
  furyPerHit: 0.07, furyFrames: 360, furyDmg: 1.18, furyKb: 1.35,
  /** Scythe: reaping delay after the third doom mark (frames) and its damage; soul heal; life steal below deathsDoor HP. */
  reapDelay: 30, reapDmg: 22, soulHeal: 4, deathsDoor: 0.3, lifesteal: 0.25,
  /** Daggers execute: base damage + damage per remaining bleed frame (set per move). */
  executeBase: 6,
  /** Hook tie: partner range at tie time, rope length, share of a hit passed down the rope. */
  tieRange: 380, tieLen: 220, tieShare: 0.5,
  /** Whip lasso: damage to each enemy the orbiting body hits. */
  orbitDmg: 9,
  /** Ice: sliding faster than this on ice shatters into the next enemy; freeze from a new wall. */
  slideShatterSpeed: 380, slideShatterDmg: 10, wallFreeze: 70,
  /** Ice: friction on ice (per frame; the normal floor is PHYS.groundFriction) and the hero's skate speed. */
  iceFriction: 0.965, skateMult: 1.4,
  /** Fists slip dodge: the automatic counter. */
  slipCounter: 'fs2_counter',
} as const;

/**
 * Grappling hook mobility (hook, New moveset): roof swings, wall zips and wall clings
 * (sim/grapple.ts). Distances in world units, speeds in units/s, times in frames (60/s).
 */
export const GRAPPLE = {
  /** The roof the hook bites into: this far above the floor (the hero can never go above it). */
  roofHeight: 650,
  /** Hip height above the feet, and the hands' distance from the hip with arms raised (the rig). */
  hipH: 68, handOff: 100,
  /** Rope length to the hip: shortest (a tight hang under the roof) and longest (feet skim the floor). */
  minLen: 170, maxLen: 560,
  /** How far ahead of the hip a swing rope lands (plus some of the current speed). */
  ahead: 290, aheadPerSpeed: 0.16, aheadMax: 170,
  /** Swing physics: gravity, the forward pump on the downswing, reeling speed, top speed. */
  gravity: 2050, pump: 1600, steer: 950, reel: 760, reelUp: 2100, maxSpeed: 1950,
  /** Off the floor: the running start along the arc, how far ahead the rope lands, and how high
   *  above the floor the bottom of that first swing passes. */
  yank: 820, aheadGround: 360, groundClear: 40,
  /** A flick swings one arc and lets go once this far past the anchor (fraction of the rope) on the way up. */
  releaseAt: 0.78,
  /** Holding the input keeps swinging up to this long; an un-held swing lets go by this time anyway. */
  maxHold: 420, maxAuto: 150,
  /** Let-go pop (upward speed added) and the low air drag after a let-go (frames). */
  pop: 260, jumpPop: 800, fling: 70, flingDrag: 0.994,
  /** Dodge zip-up: hang under the roof this long before dropping (unless the input is held). */
  hang: 46,
  /** Wall zip speed and the cling: slide speed, when the slide speeds up, how long you can stay. */
  zipSpeed: 2400, clingSlide: 40, clingSlip: 70, clingMax: 210,
  /** Wall jump launch (away, up) and the flat side kick-off. */
  wallJumpVx: 980, wallJumpVy: -1020, wallFlatVx: 1250, wallFlatVy: -520,
  /** Swinging (or zipping) into a wall this fast sticks you to it. */
  wallStickSpeed: 260,
  /** Body hits while swinging: minimum speed and hit radius (around the hip). */
  kickSpeed: 430, kickR: 54,
  /** Side swipes zip to the wall when no enemy is on that side within this range. */
  sideClear: 560,
} as const;
