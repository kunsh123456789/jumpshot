/** Shared weapon-system tunables (revision pass 7). Per-move numbers live in each weapon file. */
export const WEAPON_T = {
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
  /** Breather weapon-swap prompt and the first-time tooltip (ms). */
  tipMs: 6000,
} as const;
