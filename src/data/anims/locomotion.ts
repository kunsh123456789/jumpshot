import { anim, type AnimDef } from './types';

/**
 * Player locomotion and utility animations. Poses are authored facing right:
 * arm/leg angles are absolute from straight down (+ = toward facing),
 * elbows/knees relative. Grounded keys use plant=1 (IK feet at footA/footB
 * with liftA/liftB), airborne keys use FK legs.
 */

/** Fighting-stance bounce + breathing (authored loop, not noise). */
export const idle: AnimDef = anim({
  id: 'idle', len: 48, loop: true,
  keys: [
    { f: 0, p: {} },
    { f: 12, p: { rootY: -14, lean: 0.25, aU: 1.22, bU: 0.5, head: -0.05 }, e: 'inOut' },
    { f: 24, p: { rootY: -8, lean: 0.18, aU: 1.12, bU: 0.6, rootX: 1.5 }, e: 'inOut' },
    { f: 36, p: { rootY: -13, lean: 0.24, aU: 1.2, bU: 0.52, rootX: -1 }, e: 'inOut' },
  ],
});

/**
 * Classic stick run: contact -> down -> passing -> up (flight), twice per
 * 20-frame loop. The stance foot sweeps back 56 units per half-cycle, which
 * matches the run speed at rate 1 (feet don't slide). Arms pump opposite the legs.
 */
const RUN_A = { rootY: -4, lean: 0.55, footA: 30, liftA: 0, footB: -34, liftB: 22, aU: -0.95, aL: 1.55, bU: 1.85, bL: 1.25, head: -0.15, flex: -3 };
export const run: AnimDef = anim({
  id: 'run', len: 20, loop: true,
  keys: [
    { f: 0, p: RUN_A, sfx: 'step' },
    { f: 3, p: { rootY: -11, lean: 0.58, footA: 14, footB: -22, liftB: 32, aU: -0.3, aL: 1.7, bU: 1.15, bL: 1.6, head: -0.12, flex: -3 }, e: 'out' },
    { f: 5, p: { rootY: -2, lean: 0.55, footA: 2, footB: 4, liftB: 28, aU: 0.4, aL: 1.8, bU: 0.6, bL: 1.8, head: -0.15, flex: -3 }, e: 'inOut' },
    { f: 7, p: { rootY: 5, lean: 0.52, footA: -20, liftA: 6, footB: 26, liftB: 15, aU: 1.75, aL: 1.3, bU: -0.85, bL: 1.55, head: -0.18, flex: -3 }, e: 'out' },
    { f: 10, p: { rootY: -4, lean: 0.55, footB: 30, liftB: 0, footA: -34, liftA: 22, aU: 1.85, aL: 1.25, bU: -0.95, bL: 1.55, head: -0.15, flex: -3 }, e: 'in', sfx: 'step' },
    { f: 13, p: { rootY: -11, lean: 0.58, footB: 14, footA: -22, liftA: 32, aU: 1.15, aL: 1.6, bU: -0.3, bL: 1.7, head: -0.12, flex: -3 }, e: 'out' },
    { f: 15, p: { rootY: -2, lean: 0.55, footB: 2, footA: 4, liftA: 28, aU: 0.6, aL: 1.8, bU: 0.4, bL: 1.8, head: -0.15, flex: -3 }, e: 'inOut' },
    { f: 17, p: { rootY: 5, lean: 0.52, footB: -20, liftB: 6, footA: 26, liftA: 15, aU: -0.85, aL: 1.55, bU: 1.75, bL: 1.3, head: -0.18, flex: -3 }, e: 'out' },
  ],
});

/** Lean in and push off into the run. */
export const runStart: AnimDef = anim({
  id: 'runStart', len: 6,
  keys: [
    { f: 0, p: {} },
    { f: 2, p: { lean: 0.8, rootY: -22, aU: -0.9, aL: 1.4, bU: 1.5, bL: 1.3, footA: 30, footB: -20, head: -0.2 }, e: 'snapOut' },
    { f: 6, p: RUN_A, e: 'inOut' },
  ],
});

/** Skid stop: brace the front foot, lean back, arms thrown forward, then settle. */
export const runStop: AnimDef = anim({
  id: 'runStop', len: 16,
  keys: [
    { f: 0, p: { lean: 0.45, rootY: -12, footA: 26, footB: -24 } },
    { f: 3, p: { lean: -0.42, rootY: -26, rootX: -8, footA: 50, footB: -8, aU: 1.75, aL: 0.8, bU: 1.55, bL: 1.0, head: 0.18, flex: 6 }, e: 'snapOut', sfx: 'step' },
    { f: 8, p: { lean: -0.25, rootY: -22, rootX: -4, footA: 42, footB: -12, aU: 1.5, aL: 1.2, bU: 1.2, bL: 1.4, head: 0.1, flex: 3 }, e: 'out' },
    { f: 16, p: {}, e: 'inOut' },
  ],
});

/** Reverse direction mid-run: skid, coil, push off the other way. */
export const runTurn: AnimDef = anim({
  id: 'runTurn', len: 9,
  keys: [
    { f: 0, p: { lean: -0.5, rootY: -24, footA: 46, footB: -10, aU: 1.7, bU: 1.5, aL: 1.0, bL: 1.2, flex: 6 }, e: 'snapOut' },
    { f: 4, p: { lean: 0.65, rootY: -20, footA: 10, footB: -32, aU: -0.7, aL: 1.5, bU: 1.4, bL: 1.3, head: -0.2 }, e: 'inOut' },
    { f: 9, p: RUN_A, e: 'inOut' },
  ],
});

/** Magnetism dash: low forward lean, limbs trailing (whole-body echoes are added). */
export const dash: AnimDef = anim({
  id: 'dash', len: 12, loop: true,
  keys: [
    { f: 0, p: { lean: 0.85, rootY: -24, aU: -1.35, aL: 0.7, bU: -1.55, bL: 0.5, head: -0.3, plant: 0.45, laU: 1.1, laL: -1.3, lbU: -1.0, lbL: -0.5, footA: 38, footB: -44, liftB: 8, flex: -7 } },
    { f: 6, p: { lean: 0.82, rootY: -21, aU: -1.25, aL: 0.8, bU: -1.45, bL: 0.6, head: -0.28, plant: 0.45, laU: 1.0, laL: -1.4, lbU: -0.9, lbL: -0.6, footA: 36, footB: -42, liftB: 10, flex: -7 }, e: 'inOut' },
  ],
});
export const airDash: AnimDef = anim({
  id: 'airDash', len: 12, loop: true, base: 'air',
  keys: [
    { f: 0, p: { lean: 0.9, aU: -1.15, aL: 0.8, bU: -1.35, bL: 0.6, laU: 0.3, laL: -1.5, lbU: -0.75, lbL: -0.7, head: -0.3, flex: -7 } },
    { f: 6, p: { lean: 0.86, aU: -1.05, aL: 0.9, bU: -1.25, bL: 0.7, laU: 0.4, laL: -1.6, lbU: -0.65, lbL: -0.8, head: -0.28, flex: -7 }, e: 'inOut' },
  ],
});

/** The Jumpshot leap after a launcher: explode up stretched, tuck, ready at the apex. */
export const leap: AnimDef = anim({
  id: 'leap', len: 18, base: 'air',
  keys: [
    { f: 0, p: { rootY: 6, aU: 3.05, aL: 0.1, bU: -0.45, bL: 1.0, laU: 0.1, laL: -0.1, lbU: -0.3, lbL: -0.2, stretch: 1.12, head: -0.45, lean: -0.15, flex: 7 } },
    { f: 6, p: { laU: 1.65, laL: -2.35, lbU: 0.5, lbL: -1.7, aU: 2.4, aL: 0.8, bU: 0.6, bL: 1.4, head: -0.25, lean: 0.1 }, e: 'snapOut' },
    { f: 18, p: { aU: 1.35, aL: 1.7, bU: 0.75, bL: 1.9, laU: 1.05, laL: -1.75, lbU: 0.1, lbL: -1.0 }, e: 'inOut' },
  ],
});

export const fall: AnimDef = anim({
  id: 'fall', len: 24, loop: true, base: 'air',
  keys: [
    { f: 0, p: { laU: 0.5, laL: -0.8, lbU: -0.15, lbL: -0.6, aU: 1.95, aL: 1.0, bU: 1.6, bL: 1.1, lean: 0.0 } },
    { f: 12, p: { laU: 0.42, laL: -0.7, lbU: -0.1, lbL: -0.7, aU: 2.05, aL: 0.9, bU: 1.7, bL: 1.0, lean: -0.03 }, e: 'inOut' },
  ],
});

/** Landing: quick deep crouch (compressed), short hold, recover. */
export const land: AnimDef = anim({
  id: 'land', len: 12,
  keys: [
    { f: 0, p: { rootY: -36, lean: 0.55, aU: 0.5, aL: 1.4, bU: 0.15, bL: 1.6, footA: 30, footB: -28, stretch: 0.93, head: 0.1 }, sfx: 'land' },
    { f: 3, p: { rootY: -33, lean: 0.5, aU: 0.6, aL: 1.5, bU: 0.2, bL: 1.7, footA: 30, footB: -28, stretch: 0.96, head: 0.05 }, e: 'out' },
    { f: 12, p: {}, e: 'inOut' },
  ],
});

/** Dodge: snap into a low back-lean, hold, recover. */
export const dodge: AnimDef = anim({
  id: 'dodge', len: 14,
  keys: [
    { f: 0, p: { lean: -0.55, rootY: -24, rootX: -14, aU: 1.55, aL: 2.35, bU: 1.25, bL: 2.4, head: 0.32, footA: 36, footB: -46, flex: 9 } },
    { f: 6, p: { lean: -0.5, rootY: -22, rootX: -12, aU: 1.5, aL: 2.3, bU: 1.2, bL: 2.35, head: 0.28, footA: 36, footB: -44, flex: 8 }, e: 'out' },
    { f: 14, p: {}, e: 'inOut' },
  ],
});

/** Perfect parry: snap the forearm up to deflect, hold the counter-flash pose, settle into guard. */
export const parry: AnimDef = anim({
  id: 'parry', len: 20,
  keys: [
    { f: 0, p: { rootX: 8, rootY: -18, lean: 0.28, aU: 2.5, aL: 0.6, bU: 1.05, bL: 1.85, footA: 36, head: -0.22, flex: -3 }, impact: true },
    { f: 5, p: { rootX: 8, rootY: -18, lean: 0.28, aU: 2.5, aL: 0.6, bU: 1.05, bL: 1.85, footA: 36, head: -0.22, flex: -3 }, e: 'hold' },
    { f: 11, p: { rootY: -16, lean: 0.38, aU: 1.4, aL: 1.6, bU: 0.45, bL: 2.4, footA: 30 }, e: 'snapOut' },
    { f: 20, p: {}, e: 'inOut' },
  ],
});

/** Taunt: beckoning "come on" twice. */
export const taunt: AnimDef = anim({
  id: 'taunt', len: 64,
  keys: [
    { f: 0, p: {} },
    { f: 9, p: { lean: -0.15, rootY: -6, aU: 1.7, aL: 2.5, bU: 0.15, bL: 0.6, head: 0.12, footA: 18 }, e: 'inOut' },
    { f: 15, p: { lean: -0.12, rootY: -6, aU: 1.7, aL: 1.6, bU: 0.15, bL: 0.6, head: 0.12, footA: 18 }, e: 'snapOut' },
    { f: 22, p: { lean: -0.15, rootY: -6, aU: 1.7, aL: 2.55, bU: 0.15, bL: 0.6, head: 0.12, footA: 18 }, e: 'inOut' },
    { f: 28, p: { lean: -0.12, rootY: -6, aU: 1.7, aL: 1.6, bU: 0.15, bL: 0.6, head: 0.05, footA: 18 }, e: 'snapOut' },
    { f: 40, p: { lean: -0.1, rootY: -8, aU: 1.5, aL: 2.2, bU: 0.2, bL: 0.7, head: 0.0, footA: 18 }, e: 'inOut' },
    { f: 64, p: {}, e: 'inOut' },
  ],
});
