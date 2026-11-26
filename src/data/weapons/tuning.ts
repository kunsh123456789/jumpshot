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
