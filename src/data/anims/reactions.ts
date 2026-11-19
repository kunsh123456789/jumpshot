import { anim, type AnimDef, LYING_BASE } from './types';
import type { PoseSpec } from '../../render/rig';

/**
 * Hit reactions, shared by the player and all enemies (each rig's proportions
 * change how they read). Every reaction is a short authored sequence:
 * HIT pose (snapped) -> HOLD -> stagger/tumble -> recover.
 */
export const hurtLight: AnimDef = anim({
  id: 'hurtLight', len: 18,
  keys: [
    { f: 0, p: { rootX: -10, rootY: -8, lean: -0.42, head: 0.7, flex: 10, aU: -0.5, aL: 1.3, bU: -0.85, bL: 1.1, footA: 14, footB: -30 } },
    { f: 3, p: { rootX: -10, rootY: -8, lean: -0.42, head: 0.7, flex: 10, aU: -0.5, aL: 1.3, bU: -0.85, bL: 1.1, footA: 14, footB: -30 }, e: 'hold' },
    { f: 8, p: { rootX: -6, lean: -0.15, head: 0.2, rootY: -15, aU: 0.6, aL: 1.6, bU: 0.2, footA: 18, footB: -28 }, e: 'snapOut' },
    { f: 18, p: {}, e: 'inOut' },
  ],
});
const HEAVY_HIT: PoseSpec = { rootX: -16, rootY: -4, lean: -0.68, head: 0.9, flex: 14, aU: 2.5, aL: 0.4, bU: -2.35, bL: 0.4, footA: 8, footB: -44, stretch: 1.06 };
export const hurtHeavy: AnimDef = anim({
  id: 'hurtHeavy', len: 26,
  keys: [
    { f: 0, p: HEAVY_HIT },
    { f: 4, p: HEAVY_HIT, e: 'hold' },
    { f: 12, p: { rootY: -28, lean: 0.68, head: -0.35, aU: 0.4, aL: 1.0, bU: 0.1, bL: 1.2, flex: -7, footA: 26, footB: -26 }, e: 'snapOut' },
    { f: 26, p: {}, e: 'inOut' },
  ],
});
const BEHIND_HIT: PoseSpec = { rootX: 12, rootY: -10, lean: 0.62, head: -0.58, flex: -10, aU: -0.95, aL: 0.6, bU: -1.25, bL: 0.5, footA: 36, footB: -16 };
export const hurtBehind: AnimDef = anim({
  id: 'hurtBehind', len: 18,
  keys: [
    { f: 0, p: BEHIND_HIT },
    { f: 3, p: BEHIND_HIT, e: 'hold' },
    { f: 9, p: { rootX: 6, rootY: -16, lean: 0.3, head: -0.2, aU: 0.5, bU: 0.1 }, e: 'snapOut' },
    { f: 18, p: {}, e: 'inOut' },
  ],
});

const TUMBLE_A: PoseSpec = { lean: -0.4, head: 0.5, aU: 2.65, aL: 0.6, bU: -2.25, bL: 0.5, laU: 1.2, laL: -0.6, lbU: -0.6, lbL: -0.7, flex: 7 };
const TUMBLE_B: PoseSpec = { lean: -0.25, head: 0.3, aU: 1.8, aL: 1.3, bU: -1.5, bL: 1.1, laU: 0.7, laL: -1.5, lbU: 0.1, lbL: -1.4, flex: 3 };
/** Launched: stretched, limbs trailing below, held a beat before tumbling. */
export const launched: AnimDef = anim({
  id: 'launched', len: 12, base: 'air',
  keys: [
    { f: 0, p: { lean: -0.5, head: 0.75, flex: 11, aU: -1.65, aL: 0.4, bU: -2.15, bL: 0.3, laU: -0.2, laL: -0.4, lbU: -0.5, lbL: -0.3, stretch: 1.1 } },
    { f: 4, p: { lean: -0.5, head: 0.75, flex: 11, aU: -1.65, aL: 0.4, bU: -2.15, bL: 0.3, laU: -0.2, laL: -0.4, lbU: -0.5, lbL: -0.3, stretch: 1.1 }, e: 'hold' },
    { f: 12, p: TUMBLE_A, e: 'snapOut' },
  ],
});
/** Airborne tumble (the sim adds a controlled constant spin on top). */
export const tumble: AnimDef = anim({
  id: 'tumble', len: 28, loop: true, base: 'air',
  keys: [
    { f: 0, p: TUMBLE_A },
    { f: 14, p: TUMBLE_B, e: 'inOut' },
  ],
});
/** Ground-bounce impact: compressed against the floor, limbs flung up. */
export const groundBounce: AnimDef = anim({
  id: 'groundBounce', len: 12, base: 'air',
  keys: [
    { f: 0, p: { lean: -1.2, rootY: -26, head: 0.6, aU: 2.9, aL: 0.3, bU: -2.9, bL: 0.3, laU: 1.9, laL: -0.3, lbU: 1.7, lbL: -0.5, stretch: 0.9 } },
    { f: 3, p: { lean: -1.2, rootY: -26, head: 0.6, aU: 2.9, aL: 0.3, bU: -2.9, bL: 0.3, laU: 1.9, laL: -0.3, lbU: 1.7, lbL: -0.5, stretch: 0.9 }, e: 'hold' },
    { f: 12, p: TUMBLE_A, e: 'snapOut' },
  ],
});
/** Wall splat: flattened against the wall, held, then peels off into a tumble. */
export const wallSplat: AnimDef = anim({
  id: 'wallSplat', len: 16, base: 'air',
  keys: [
    { f: 0, p: { lean: -0.42, head: 0.78, flex: 10, aU: 2.95, aL: 0.15, bU: -2.95, bL: 0.15, laU: 0.45, laL: -0.1, lbU: -0.45, lbL: -0.1, stretch: 1.05 } },
    { f: 6, p: { lean: -0.42, head: 0.78, flex: 10, aU: 2.95, aL: 0.15, bU: -2.95, bL: 0.15, laU: 0.45, laL: -0.1, lbU: -0.45, lbL: -0.1, stretch: 1.05 }, e: 'hold' },
    { f: 16, p: TUMBLE_A, e: 'snapOut' },
  ],
});

/** Knockdown: slam flat (compressed), small bounce, settle. */
export const knockdown: AnimDef = anim({
  id: 'knockdown', len: 14, base: 'lying',
  keys: [
    { f: 0, p: { rootY: -42, lean: -1.4, head: 0.5, aU: -1.6, aL: 0.5, bU: -3.0, bL: 0.4, laU: 1.95, laL: -0.4, lbU: 1.6, lbL: -0.6, stretch: 0.94 }, sfx: 'land' },
    { f: 4, p: { rootY: -46, lean: -1.48, aU: -1.9, bU: -2.8, laU: 1.7, lbU: 1.5 }, e: 'snapOut' },
    { f: 14, p: {}, e: 'inOut' },
  ],
});
export const lying: AnimDef = anim({
  id: 'lying', len: 64, loop: true, base: 'lying',
  keys: [
    { f: 0, p: {} },
    { f: 32, p: { rootY: -49, lean: -1.53 }, e: 'inOut' },
  ],
});
/** Get-up: push up on the hands, crouch, rise into guard. */
export const getup: AnimDef = anim({
  id: 'getup', len: 24,
  keys: [
    { f: 0, p: { ...LYING_BASE } },
    { f: 4, p: { plant: 0, rootY: -50, lean: -0.4, head: 0.1, aU: -0.5, aL: 0.8, bU: -0.95, bL: 0.4, laU: 1.4, laL: -1.3, lbU: 1.0, lbL: -1.9 }, e: 'snapOut' },
    { f: 9, p: { plant: 0.7, rootY: -42, lean: 0.95, aU: 0.1, aL: 0.3, bU: -0.1, bL: 0.4, footA: 14, footB: -30, head: -0.2 }, e: 'out' },
    { f: 16, p: { rootY: -32, lean: 0.55, aU: 0.9, aL: 1.7, bU: 0.3, bL: 2.0, footA: 22, footB: -26 }, e: 'inOut' },
    { f: 24, p: {}, e: 'inOut' },
  ],
});
const STUN: PoseSpec = { lean: -0.15, head: 0.45, rootY: -16, rootX: -2, aU: 0.15, aL: 0.3, bU: -0.2, bL: 0.4, footA: 16, footB: -18 };
export const stunned: AnimDef = anim({
  id: 'stunned', len: 44, loop: true,
  keys: [
    { f: 0, p: STUN },
    { f: 22, p: { ...STUN, lean: 0.12, head: -0.25, rootX: 4, rootY: -13, aU: 0.25, bU: -0.1 }, e: 'inOut' },
  ],
});
export const guardbreak: AnimDef = anim({
  id: 'guardbreak', len: 22,
  keys: [
    { f: 0, p: { lean: -0.58, head: 0.68, rootX: -10, rootY: -6, aU: 2.75, aL: 0.5, bU: -1.5, bL: 0.8, flex: 10, footA: 10, footB: -32 } },
    { f: 5, p: { lean: -0.58, head: 0.68, rootX: -10, rootY: -6, aU: 2.75, aL: 0.5, bU: -1.5, bL: 0.8, flex: 10, footA: 10, footB: -32 }, e: 'hold' },
    { f: 22, p: STUN, e: 'snapOut' },
  ],
});
export const burst: AnimDef = anim({
  id: 'burst', len: 24,
  keys: [
    { f: 0, p: { lean: -0.2, head: -0.45, rootY: 4, aU: 2.88, aL: 0.1, bU: -2.88, bL: 0.1, footA: 34, footB: -34, flex: 11, stretch: 1.12 } },
    { f: 7, p: { lean: -0.2, head: -0.45, rootY: 4, aU: 2.88, aL: 0.1, bU: -2.88, bL: 0.1, footA: 34, footB: -34, flex: 11, stretch: 1.12 }, e: 'hold' },
    { f: 24, p: {}, e: 'snapOut' },
  ],
});
