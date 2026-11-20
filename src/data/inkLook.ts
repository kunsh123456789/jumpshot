/**
 * Ink page look (revision pass 5) tunables: line weights in low-res pixels,
 * the page, the floor, the reflection and the locked wide camera.
 */
export const INKLOOK = {
  // ---------------- figures ----------------
  /** Hero limb / head-outline thickness (low-res px at the default Pixel resolution). */
  heroLimbPx: 2,
  heroHeadPx: 2,
  /** Enemy limb thickness (brute/boss ×1.35). Enemy heads are solid. */
  enemyLimbPx: 3,
  /** Head size multiplier on the rig's head radius. */
  headScale: 1.05,
  /** Reference resolution the px weights are authored at (fraction of 1280x720). Crisp keeps the same world widths. */
  refRes: 0.4,

  // ---------------- page ----------------
  /** Floor line thickness (low-res px). */
  floorPx: 3,
  /** Reflection vertical scale (1 = exact mirror). */
  reflectSquash: 0.85,
  /** Static doodle marks along the floor of the Blank Page (count across the arena). */
  floorDoodles: 7,

  // ---------------- camera: locked wide shot ----------------
  /** Fixed zoom: figures ≈ 13-14 % of the screen height. */
  zoom: 0.82,
  /** Floor line position as a fraction of the view height. */
  groundScreenFrac: 0.79,
  /** The camera only drifts when the player leaves this central fraction of the view. */
  deadzoneFrac: 0.5,
  /** Drift spring frequency (rad/s): slow and gentle. */
  driftOmega: 2.2,
  /** Punch-ins are allowed but scaled down to this fraction. */
  punchScale: 0.4,
} as const;
