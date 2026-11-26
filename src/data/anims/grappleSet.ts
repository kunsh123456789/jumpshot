import { drawn, type AnimDef } from './types';
import { registerAnims } from './index';

/**
 * Grappling hook mobility drawings (hook, New moveset; sim/grapple.ts). The swing and hang
 * are drawn upright with both arms straight up on the rope; the renderer turns the whole
 * body about the hip so the arms line up with the rope (Animator.spinAdd).
 */

/** Fast swing: arms locked on the rope, legs tucked and trailing. */
export const grapSwing: AnimDef = drawn({ id: 'grapSwing', base: 'air', loop: true, drawings: [
  { hold: 6, p: { lean: -0.05, head: 0.15, aU: 3.1, aL: 0.04, bU: 2.98, bL: 0.14, laU: 0.75, laL: -1.25, lbU: 0.2, lbL: -0.7, flex: 3, stretch: 1.05 } },
  { hold: 6, p: { lean: -0.04, head: 0.18, aU: 3.08, aL: 0.06, bU: 3.0, bL: 0.12, laU: 0.7, laL: -1.3, lbU: 0.15, lbL: -0.75, flex: 3, stretch: 1.04 } },
] });
/** Slow hang: dangling, legs loose and long. */
export const grapHang: AnimDef = drawn({ id: 'grapHang', base: 'air', loop: true, drawings: [
  { hold: 10, p: { lean: 0.02, head: 0.05, aU: 3.1, aL: 0.06, bU: 3.0, bL: 0.15, laU: 0.25, laL: -0.35, lbU: -0.12, lbL: -0.2, stretch: 1.08 } },
  { hold: 10, p: { lean: 0.0, head: 0.1, aU: 3.08, aL: 0.08, bU: 3.02, bL: 0.12, laU: 0.18, laL: -0.3, lbU: -0.05, lbL: -0.25, stretch: 1.07 } },
] });
/** Zip to a wall: the rope arm reaching ahead, body stretched flat into the pull. */
export const grapZip: AnimDef = drawn({ id: 'grapZip', base: 'air', loop: true, drawings: [
  { hold: 4, p: { lean: 0.75, head: -0.45, aU: 1.75, aL: 0.02, bU: -0.7, bL: 0.5, laU: -0.35, laL: -0.5, lbU: -0.75, lbL: -0.25, stretch: 1.12, flex: 4 } },
  { hold: 4, p: { lean: 0.78, head: -0.48, aU: 1.72, aL: 0.04, bU: -0.6, bL: 0.6, laU: -0.3, laL: -0.6, lbU: -0.8, lbL: -0.2, stretch: 1.1, flex: 4 } },
] });
/** Stuck to a wall, back to it, facing the arena: one hand on the wall up behind, feet braced on it. */
export const grapCling: AnimDef = drawn({ id: 'grapCling', base: 'air', loop: true, drawings: [
  { hold: 12, p: { rootY: -4, lean: 0.32, head: -0.2, aU: -2.4, aL: 0.5, bU: 1.15, bL: 1.5, laU: -0.9, laL: 0.4, lbU: 0.95, lbL: -1.75, flex: -3 } },
  { hold: 12, p: { rootY: -2, lean: 0.3, head: -0.16, aU: -2.38, aL: 0.48, bU: 1.2, bL: 1.45, laU: -0.88, laL: 0.38, lbU: 1.0, lbL: -1.8, flex: -3 } },
] });

registerAnims([grapSwing, grapHang, grapZip, grapCling], 'grappleSet');
