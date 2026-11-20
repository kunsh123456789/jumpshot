import { drawn, type AnimDef, LYING_BASE } from './types';
import type { PoseSpec } from '../../render/rig';

/**
 * Hand-Drawn animation set (revision pass 5), used when Animation Style is
 * Hand-Drawn. Each animation is a list of DRAWINGS with hold lengths in
 * 60 Hz ticks, authored in the reference's language: very low crouches before
 * action, fully committed extremes, the flat horizontal lunge, tumbling air
 * poses and flat collapses. The contact drawing sits exactly on the move's
 * first active frame (same lengths and contact frames as the Smooth set, so
 * frame data and hit timing are unchanged), and is always a big pose delta
 * from the drawing before it. Smooth style keeps the original key poses.
 */

/** Fighting crouch: low, wide, leaning in, fists forward (reference frame 0 / 82 / 85). */
const CROUCH: PoseSpec = { rootY: -30, lean: 0.46, head: -0.22, aU: 1.3, aL: 1.6, bU: 0.55, bL: 2.15, footA: 34, footB: -38, flex: -4 };
const CROUCH2: PoseSpec = { ...CROUCH, rootY: -35, lean: 0.52, aU: 1.38, aL: 1.48, bU: 0.6, bL: 2.05, head: -0.27 };

// ======================================================================= locomotion
export const idle: AnimDef = drawn({
  id: 'idle', loop: true,
  drawings: [
    { hold: 12, p: CROUCH },
    { hold: 12, p: CROUCH2 },
    { hold: 12, p: { ...CROUCH, rootX: 1.5, aU: 1.24 } },
    { hold: 12, p: { ...CROUCH2, rootX: -1 } },
  ],
});

/** Crouch-run (reference 82-85): low, pitched forward, long strides. Four drawings, on fives. */
const RUN_STRIDE: PoseSpec = { rootY: -16, lean: 0.78, head: -0.35, footA: 44, liftA: 0, footB: -50, liftB: 26, aU: -1.25, aL: 1.6, bU: 2.0, bL: 1.3, flex: -6 };
const RUN_PASS: PoseSpec = { rootY: -6, lean: 0.72, head: -0.3, footA: 4, liftA: 0, footB: 10, liftB: 38, aU: 0.3, aL: 1.9, bU: 0.6, bL: 1.9, flex: -5 };
export const run: AnimDef = drawn({
  id: 'run', loop: true,
  drawings: [
    { hold: 5, p: RUN_STRIDE, sfx: 'step' },
    { hold: 5, p: RUN_PASS },
    { hold: 5, p: { ...RUN_STRIDE, footA: -50, liftA: 26, footB: 44, liftB: 0, aU: 2.0, aL: 1.3, bU: -1.25, bL: 1.6 }, sfx: 'step' },
    { hold: 5, p: { ...RUN_PASS, footA: 10, liftA: 38, footB: 4, liftB: 0 } },
  ],
});
export const runStart: AnimDef = drawn({
  id: 'runStart',
  drawings: [
    { hold: 3, p: { lean: 1.0, rootY: -34, aU: -1.4, aL: 1.2, bU: 1.9, bL: 1.1, footA: 40, footB: -26, head: -0.35, flex: -7 } },
    { hold: 3, p: RUN_STRIDE },
  ],
});
export const runStop: AnimDef = drawn({
  id: 'runStop',
  drawings: [
    { hold: 5, p: { lean: -0.6, rootY: -38, rootX: -10, footA: 58, footB: -10, aU: 2.0, aL: 0.7, bU: 1.7, bL: 0.9, head: 0.3, flex: 8 }, sfx: 'step' },
    { hold: 5, p: { lean: -0.3, rootY: -34, rootX: -6, footA: 46, footB: -16, aU: 1.6, aL: 1.1, bU: 1.3, bL: 1.3, head: 0.15, flex: 4 } },
    { hold: 6, p: CROUCH },
  ],
});
export const runTurn: AnimDef = drawn({
  id: 'runTurn',
  drawings: [
    { hold: 4, p: { lean: -0.65, rootY: -36, footA: 52, footB: -8, aU: 1.9, bU: 1.6, aL: 0.9, bL: 1.1, flex: 8, head: 0.25 } },
    { hold: 5, p: { ...RUN_STRIDE, lean: 0.9 } },
  ],
});

/** Magnetism dash: the flat horizontal flying lunge (reference 6-9, 47-49). */
const LUNGE: PoseSpec = { plant: 0, rootY: -14, lean: 1.38, head: -0.45, aU: 1.5, aL: 0.15, bU: 1.25, bL: 0.4, laU: -1.25, laL: -0.2, lbU: -1.55, lbL: -0.1, flex: -4, stretch: 1.08 };
export const dash: AnimDef = drawn({
  id: 'dash', loop: true,
  drawings: [
    { hold: 6, p: LUNGE },
    { hold: 6, p: { ...LUNGE, aU: 1.62, bU: 1.1, laU: -1.4, lbU: -1.4, rootY: -18 } },
  ],
});
export const airDash: AnimDef = drawn({
  id: 'airDash', loop: true, base: 'air',
  drawings: [
    { hold: 6, p: { lean: 1.42, head: -0.45, aU: 1.5, aL: 0.15, bU: 1.25, bL: 0.4, laU: -1.25, laL: -0.2, lbU: -1.55, lbL: -0.1, flex: -4, stretch: 1.08 } },
    { hold: 6, p: { lean: 1.36, head: -0.42, aU: 1.62, aL: 0.1, bU: 1.1, bL: 0.5, laU: -1.4, laL: -0.3, lbU: -1.4, lbL: -0.2, flex: -4, stretch: 1.08 } },
  ],
});

export const leap: AnimDef = drawn({
  id: 'leap', base: 'air',
  drawings: [
    { hold: 6, p: { rootY: 8, aU: 3.1, aL: 0.05, bU: 2.8, bL: 0.2, laU: 0.0, laL: -0.05, lbU: -0.35, lbL: -0.1, stretch: 1.16, head: -0.5, lean: -0.1, flex: 8 } },
    { hold: 6, p: { laU: 2.1, laL: -2.6, lbU: 1.2, lbL: -2.4, aU: 2.2, aL: 1.2, bU: 0.4, bL: 1.6, head: -0.1, lean: 0.35, flex: -6 } },
    { hold: 6, p: { aU: 1.5, aL: 1.6, bU: 0.8, bL: 1.8, laU: 1.1, laL: -1.7, lbU: 0.1, lbL: -1.0, lean: 0.15 } },
  ],
});
export const fall: AnimDef = drawn({
  id: 'fall', loop: true, base: 'air',
  drawings: [
    { hold: 12, p: { laU: 0.7, laL: -1.1, lbU: -0.25, lbL: -0.7, aU: 2.3, aL: 0.8, bU: 1.9, bL: 0.9, lean: 0.05 } },
    { hold: 12, p: { laU: 0.55, laL: -0.9, lbU: -0.15, lbL: -0.8, aU: 2.45, aL: 0.7, bU: 2.05, bL: 0.8, lean: -0.04 } },
  ],
});
export const land: AnimDef = drawn({
  id: 'land',
  drawings: [
    { hold: 4, p: { rootY: -52, lean: 0.75, aU: 0.4, aL: 1.2, bU: -0.1, bL: 1.4, footA: 42, footB: -40, stretch: 0.9, head: 0.15, flex: -6 }, sfx: 'land' },
    { hold: 4, p: { rootY: -42, lean: 0.6, aU: 0.9, aL: 1.5, bU: 0.3, bL: 1.8, footA: 38, footB: -38, head: 0 } },
    { hold: 4, p: CROUCH },
  ],
});
export const dodge: AnimDef = drawn({
  id: 'dodge',
  drawings: [
    { hold: 4, p: { lean: -0.8, rootY: -42, rootX: -20, aU: 1.7, aL: 2.4, bU: 1.4, bL: 2.45, head: 0.45, footA: 44, footB: -54, flex: 11 } },
    { hold: 5, p: { lean: -0.62, rootY: -38, rootX: -16, aU: 1.6, aL: 2.3, bU: 1.3, bL: 2.35, head: 0.35, footA: 42, footB: -50, flex: 9 } },
    { hold: 5, p: CROUCH },
  ],
});

// ======================================================================= ground attacks (same lengths / contact frames as the Smooth set)
/** JAB S4: coil back-and-down, then fully committed lunging straight. */
export const jab1: AnimDef = drawn({
  id: 'jab1', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 1, p: { ...CROUCH, aU: 1.1, aL: 1.9 } },
    { hold: 2, p: { rootX: -14, rootY: -38, lean: -0.15, aU: 0.15, aL: 2.75, bU: 1.0, bL: 1.9, head: 0.2, footA: 30, footB: -44, flex: 7 } },
    { hold: 1, p: { rootX: -16, rootY: -40, lean: -0.25, aU: -0.05, aL: 2.95, bU: 1.1, bL: 1.8, head: 0.25, footA: 30, footB: -46, flex: 8 } },
    { hold: 3, p: { rootX: 14, rootY: -30, lean: 0.95, aU: 1.62, aL: 0.0, bU: -0.45, bL: 1.4, footA: 50, footB: -58, head: -0.4, flex: -9, stretch: 1.12 }, smear: ['handA'], impact: true },
    { hold: 5, p: { rootX: 16, rootY: -30, lean: 1.0, aU: 1.72, aL: 0.12, bU: -0.5, bL: 1.3, footA: 50, footB: -58, head: -0.42, flex: -9, stretch: 1.1 } },
    { hold: 5, p: { rootX: 6, rootY: -32, lean: 0.55, aU: 1.25, aL: 1.4, bU: 0.4, bL: 2.1, footA: 40, footB: -44, head: -0.25 } },
    { hold: 3, p: CROUCH },
  ],
});
/** JAB 2 S4: rear straight, body pitched almost flat behind it. */
export const jab2: AnimDef = drawn({
  id: 'jab2', strike: 'arm', reach: 'handB',
  drawings: [
    { hold: 1, p: { ...CROUCH, bU: 0.3, bL: 2.5 } },
    { hold: 2, p: { rootX: -10, rootY: -38, lean: 0.0, aU: 1.5, aL: 1.3, bU: -0.15, bL: 2.8, footA: 32, footB: -44, head: 0.15, flex: 6 } },
    { hold: 1, p: { rootX: -12, rootY: -40, lean: -0.1, aU: 1.55, aL: 1.2, bU: -0.3, bL: 2.9, footA: 32, footB: -46, head: 0.2, flex: 7 } },
    { hold: 3, p: { rootX: 16, rootY: -42, lean: 1.05, aU: 0.3, aL: 2.4, bU: 1.56, bL: 0.0, footA: 54, footB: -60, head: -0.25, flex: -10, stretch: 1.12 }, smear: ['handB'], impact: true },
    { hold: 5, p: { rootX: 18, rootY: -42, lean: 1.1, aU: 0.3, aL: 2.4, bU: 1.64, bL: 0.1, footA: 54, footB: -60, head: -0.25, flex: -10, stretch: 1.1 } },
    { hold: 5, p: { rootX: 6, rootY: -34, lean: 0.55, aU: 1.0, aL: 1.9, bU: 1.0, bL: 1.6, footA: 40, footB: -44 } },
    { hold: 3, p: CROUCH },
  ],
});
/** CROSS S5: arm swung all the way overhead, then an overhand that drags the body flat. */
export const cross: AnimDef = drawn({
  id: 'cross', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 2, p: { ...CROUCH, aU: 2.0, aL: 1.3 } },
    { hold: 2, p: { rootX: -12, rootY: -26, lean: -0.4, aU: 3.05, aL: 1.0, bU: 1.0, bL: 1.5, footA: 30, footB: -40, flex: 9, head: 0.2, spin: -0.1 } },
    { hold: 1, p: { rootX: -14, rootY: -24, lean: -0.5, aU: 3.3, aL: 0.8, bU: 1.1, bL: 1.4, footA: 30, footB: -42, flex: 10, head: 0.25, spin: -0.12 } },
    { hold: 3, p: { rootX: 18, rootY: -30, lean: 1.0, aU: 1.2, aL: 0.04, bU: -0.75, bL: 1.1, footA: 56, footB: -60, head: -0.45, flex: -10, stretch: 1.14, spin: 0.08 }, smear: ['handA'], impact: true },
    { hold: 5, p: { rootX: 20, rootY: -30, lean: 1.05, aU: 1.0, aL: 0.1, bU: -0.8, bL: 1.0, footA: 56, footB: -60, head: -0.45, flex: -10, stretch: 1.12, spin: 0.08 } },
    { hold: 6, p: { rootX: 6, rootY: -32, lean: 0.6, aU: 1.1, aL: 1.6, bU: 0.4, bL: 2.0, footA: 42, footB: -44 } },
    { hold: 5, p: CROUCH },
  ],
});
/** SPINNING BACKFIST S10 (heavy): wind the whole body round, then the arm whips through. */
export const backfist: AnimDef = drawn({
  id: 'backfist', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 3, p: { ...CROUCH, rootX: -4, aU: 0.9, aL: 2.1 } },
    { hold: 4, p: { rootX: -12, rootY: -36, lean: -0.42, aU: -1.6, aL: 0.8, bU: 1.9, bL: 0.9, footA: 22, footB: -46, head: 0.4, flex: 11, spin: -0.2 } },
    { hold: 3, p: { rootX: -14, rootY: -38, lean: -0.55, aU: -1.85, aL: 0.6, bU: 2.0, bL: 0.8, footA: 20, footB: -48, head: 0.45, flex: 12, spin: -0.28 } },
    { hold: 4, p: { spin: 0.08, rootX: 16, rootY: -30, lean: 0.62, aU: 1.85, aL: 0.03, bU: -1.0, bL: 1.0, footA: 50, footB: -54, head: -0.4, flex: -8, stretch: 1.14 }, smear: ['handA'], impact: true },
    { hold: 6, p: { spin: 0.3, rootX: 18, rootY: -30, lean: 0.66, aU: 2.3, aL: 0.3, bU: -1.0, bL: 1.0, footA: 50, footB: -54, head: -0.4, flex: -8, stretch: 1.1 } },
    { hold: 6, p: { rootX: 6, rootY: -32, lean: 0.4, aU: 1.5, aL: 1.3, spin: 0.08, footA: 40, footB: -42 } },
    { hold: 8, p: CROUCH },
  ],
});
/** RISING HOOK S5: dip almost to the floor, then rip upward. */
export const hook: AnimDef = drawn({
  id: 'hook', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 2, p: { ...CROUCH, rootY: -44, lean: 0.7 } },
    { hold: 3, p: { rootY: -54, lean: 0.85, aU: -0.45, aL: 1.6, bU: 1.0, bL: 1.9, footA: 36, footB: -40, head: 0.1, flex: -7 } },
    { hold: 3, p: { rootY: -6, rootX: 6, lean: 0.25, aU: 2.35, aL: 1.0, bU: -0.1, bL: 2.3, footA: 34, footB: -40, liftB: 8, head: -0.45, flex: 6, stretch: 1.12, spin: -0.08 }, smear: ['handA'], impact: true },
    { hold: 5, p: { rootY: -4, rootX: 6, lean: 0.15, aU: 2.6, aL: 1.1, bU: -0.1, bL: 2.3, footA: 34, footB: -40, liftB: 8, head: -0.5, flex: 6, stretch: 1.1 } },
    { hold: 5, p: { rootY: -24, lean: 0.35, aU: 1.6, aL: 1.6, footA: 36, footB: -40 } },
    { hold: 6, p: CROUCH },
  ],
});
/** JUMPSHOT LAUNCHER S6: crouch almost to the floor, then explode into one long vertical line. */
const LAUNCH_HIT: PoseSpec = { rootY: 28, lean: -0.22, aU: 3.12, aL: 0.0, bU: -0.35, bL: 0.8, footA: 12, footB: -10, liftA: 14, liftB: 20, head: -0.55, flex: 10, stretch: 1.22 };
export const launcher: AnimDef = drawn({
  id: 'launcher', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 2, p: { ...CROUCH, rootY: -44, lean: 0.62 } },
    { hold: 2, p: { rootY: -58, lean: 0.85, aU: -0.05, aL: 1.2, bU: 0.45, bL: 2.2, footA: 42, footB: -42, head: 0.15, flex: -8, stretch: 0.92 } },
    { hold: 2, p: { rootY: -60, lean: 0.9, aU: -0.4, aL: 1.0, bU: 0.5, bL: 2.2, footA: 42, footB: -42, head: 0.18, flex: -9, stretch: 0.9 } },
    { hold: 4, p: LAUNCH_HIT, smear: ['handA'], impact: true },
    { hold: 4, p: { ...LAUNCH_HIT, aU: 3.16, rootY: 26 } },
    { hold: 6, p: { ...LAUNCH_HIT, rootY: 6, lean: 0.1, aU: 2.6, aL: 0.6, liftA: 0, liftB: 0, stretch: 1.05 } },
    { hold: 6, p: CROUCH },
  ],
});
export const launcherH: AnimDef = drawn({
  id: 'launcherH', strike: 'arm', reach: 'handA',
  drawings: [
    { hold: 3, p: { ...CROUCH, rootY: -44, lean: 0.62 } },
    { hold: 3, p: { rootY: -58, lean: 0.85, spin: -0.14, aU: -0.1, aL: 1.2, bU: 0.4, bL: 2.3, footA: 44, footB: -42, head: 0.15, flex: -9, stretch: 0.92 } },
    { hold: 3, p: { rootY: -62, lean: 0.92, spin: -0.2, aU: -0.5, aL: 1.0, bU: 0.4, bL: 2.3, footA: 44, footB: -42, head: 0.2, flex: -10, stretch: 0.9 } },
    { hold: 4, p: { ...LAUNCH_HIT, rootY: 34, stretch: 1.26, spin: 0.05 }, smear: ['handA'], impact: true },
    { hold: 4, p: { ...LAUNCH_HIT, rootY: 32, stretch: 1.22, aU: 3.18 } },
    { hold: 7, p: { ...LAUNCH_HIT, rootY: 8, lean: 0.1, aU: 2.6, aL: 0.6, liftA: 0, liftB: 0, stretch: 1.05 } },
    { hold: 7, p: CROUCH },
  ],
});

// ======================================================================= air attacks
/** Air kick: tuck tight, then snap the leg out with the body laid back flat. */
export const akick1: AnimDef = drawn({
  id: 'akick1', base: 'air', strike: 'leg', reach: 'footA',
  drawings: [
    { hold: 2, p: { laU: 1.3, laL: -2.6, lbU: 0.5, lbL: -1.8, lean: 0.3, spin: -0.2, aU: 1.9, aL: 1.2, bU: 0.4, bL: 1.6 } },
    { hold: 2, p: { laU: 1.5, laL: -2.8, lbU: 0.7, lbL: -2.0, lean: 0.4, spin: -0.35, aU: 2.1, aL: 1.0, bU: 0.5, bL: 1.6, flex: -6 } },
    { hold: 4, p: { laU: 1.9, laL: 0.0, lbU: -0.75, lbL: -0.6, lean: -0.75, spin: 0.15, aU: -1.25, aL: 0.8, bU: 2.45, bL: 0.4, head: -0.15, stretch: 1.12 }, smear: ['footA'], impact: true },
    { hold: 4, p: { laU: 1.98, laL: 0.06, lbU: -0.8, lbL: -0.6, lean: -0.8, spin: 0.18, aU: -1.25, aL: 0.8, bU: 2.45, bL: 0.4, stretch: 1.1 } },
    { hold: 4, p: { laU: 1.0, laL: -1.9, lean: -0.1, aU: 1.3, bU: 0.6 } },
    { hold: 3, p: { laU: 0.7, laL: -1.1, lbU: -0.25, lbL: -0.7, aU: 2.0, aL: 0.9, bU: 1.7, bL: 1.0 } },
  ],
});
export const akick2: AnimDef = drawn({
  id: 'akick2', base: 'air', strike: 'leg', reach: 'footB',
  drawings: [
    { hold: 2, p: { lbU: 1.2, lbL: -2.6, laU: 0.4, laL: -1.8, lean: 0.3, spin: -0.22, aU: 0.5, bU: 1.9, bL: 1.2 } },
    { hold: 2, p: { lbU: 1.4, lbL: -2.8, laU: 0.6, laL: -2.0, lean: 0.4, spin: -0.38, aU: 0.6, bU: 2.1, bL: 1.0, flex: -6 } },
    { hold: 4, p: { lbU: 1.92, lbL: 0.0, laU: -0.75, laL: -1.1, lean: -0.78, spin: 0.2, aU: 2.4, aL: 0.6, bU: -1.1, bL: 0.8, head: -0.15, stretch: 1.12 }, smear: ['footB'], impact: true },
    { hold: 4, p: { lbU: 2.0, lbL: 0.05, laU: -0.8, laL: -1.1, lean: -0.82, spin: 0.22, aU: 2.4, aL: 0.6, bU: -1.1, bL: 0.8, stretch: 1.1 } },
    { hold: 4, p: { lbU: 0.9, lbL: -1.8, lean: -0.1, aU: 1.3, bU: 0.5 } },
    { hold: 3, p: { laU: 0.7, laL: -1.1, lbU: -0.25, lbL: -0.7, aU: 2.0, aL: 0.9, bU: 1.7, bL: 1.0 } },
  ],
});
/** Spinning air kick: body wound right round before the kick. */
export const akick3: AnimDef = drawn({
  id: 'akick3', base: 'air', strike: 'leg', reach: 'footA',
  drawings: [
    { hold: 2, p: { spin: -0.55, laU: 0.9, laL: -2.4, lbU: 0.4, lbL: -1.9, aU: 2.3, aL: 0.8, bU: 1.5, lean: 0.3 } },
    { hold: 3, p: { spin: -1.15, laU: 0.6, laL: -2.6, lbU: 0.5, lbL: -2.1, aU: 2.6, aL: 0.6, bU: 1.7, lean: 0.4, flex: -6 } },
    { hold: 4, p: { spin: 0.72, laU: 2.1, laL: 0.04, lbU: -0.5, lbL: -0.9, lean: -0.7, aU: -1.1, aL: 0.8, bU: 2.4, bL: 0.5, stretch: 1.12 }, smear: ['footA'], impact: true },
    { hold: 4, p: { spin: 0.85, laU: 2.15, laL: 0.06, lbU: -0.5, lbL: -0.9, lean: -0.72, aU: -1.1, aL: 0.8, bU: 2.4, bL: 0.5, stretch: 1.1 } },
    { hold: 4, p: { spin: 0.3, laU: 1.0, laL: -1.8, lean: -0.1 } },
    { hold: 5, p: { laU: 0.7, laL: -1.1, lbU: -0.25, lbL: -0.7, aU: 2.0, aL: 0.9, bU: 1.7, bL: 1.0 } },
  ],
});
export const aheavy: AnimDef = drawn({
  id: 'aheavy', base: 'air', strike: 'leg', reach: 'footB',
  drawings: [
    { hold: 3, p: { spin: -0.5, lbU: 0.6, lbL: -2.3, laU: 0.8, laL: -1.9, aU: 2.4, aL: 0.8, bU: 2.0, lean: 0.3 } },
    { hold: 4, p: { spin: -1.25, lbU: 0.2, lbL: -2.7, laU: 1.0, laL: -2.1, aU: 2.9, aL: 0.4, bU: 2.4, lean: 0.42, flex: 8 } },
    { hold: 4, p: { spin: 0.38, lbU: 1.86, lbL: 0.0, laU: -0.45, laL: -1.5, lean: -0.85, aU: -1.3, aL: 0.8, bU: 2.7, bL: 0.3, stretch: 1.16, head: -0.15 }, smear: ['footB'], impact: true },
    { hold: 3, p: { spin: 0.45, lbU: 1.92, lbL: 0.02, laU: -0.45, laL: -1.5, lean: -0.88, aU: -1.3, aL: 0.8, bU: 2.7, bL: 0.3, stretch: 1.14 } },
    { hold: 5, p: { spin: 0.5, lbU: 1.95, lean: -0.8, aU: -1.0, bU: 2.4 } },
    { hold: 8, p: { spin: 0.1, lbU: 0.6, lbL: -1.6, lean: -0.1 } },
  ],
});
/** SPIKE S6: heel cocked over the head, then axed straight down. */
export const spike: AnimDef = drawn({
  id: 'spike', base: 'air', strike: 'leg', reach: 'footA',
  drawings: [
    { hold: 2, p: { spin: -0.3, laU: 2.0, laL: -1.2, aU: 2.4, aL: 0.5, bU: -0.8 } },
    { hold: 4, p: { spin: -0.45, laU: 3.2, laL: 0.0, lbU: -0.2, lbL: -0.9, aU: 2.7, aL: 0.3, bU: -1.2, bL: 0.5, lean: -0.6, head: 0.15, flex: 11, stretch: 1.14 } },
    { hold: 4, p: { spin: 0.62, laU: 0.65, laL: 0.0, lbU: -0.55, lbL: -1.1, lean: 0.85, aU: -0.9, aL: 0.7, bU: -1.15, bL: 0.6, head: 0.25, stretch: 1.14 }, smear: ['footA'], impact: true },
    { hold: 4, p: { spin: 0.7, laU: 0.6, laL: 0.0, lbU: -0.55, lbL: -1.1, lean: 0.9, aU: -0.9, aL: 0.7, bU: -1.15, bL: 0.6, head: 0.25, stretch: 1.12 } },
    { hold: 4, p: { spin: 0.4, laU: 0.8, laL: -0.8, lean: 0.6, aU: 0.5, bU: -0.5 } },
    { hold: 9, p: { spin: 0.1, laU: 1.0, laL: -1.4, lean: 0.2, aU: 1.6, bU: 0.6 } },
  ],
});

// ======================================================================= reactions (shared by everyone)
export const hurtLight: AnimDef = drawn({
  id: 'hurtLight',
  drawings: [
    { hold: 4, p: { rootX: -16, rootY: -14, lean: -0.65, head: 0.95, flex: 13, aU: -0.8, aL: 1.2, bU: -1.1, bL: 1.0, footA: 18, footB: -38 } },
    { hold: 5, p: { rootX: -10, rootY: -30, lean: -0.25, head: 0.35, aU: 0.5, aL: 1.6, bU: 0.1, footA: 22, footB: -36 } },
    { hold: 9, p: CROUCH },
  ],
});
export const hurtHeavy: AnimDef = drawn({
  id: 'hurtHeavy',
  drawings: [
    { hold: 5, p: { rootX: -22, rootY: -6, lean: -0.95, head: 1.15, flex: 17, aU: 2.8, aL: 0.3, bU: -2.6, bL: 0.3, footA: 8, footB: -54, stretch: 1.08 } },
    { hold: 6, p: { rootY: -44, lean: 0.95, head: -0.55, aU: 0.3, aL: 0.9, bU: 0.0, bL: 1.1, flex: -9, footA: 30, footB: -30 } },
    { hold: 6, p: { rootY: -38, lean: 0.75, head: -0.4, aU: 0.8, aL: 1.3, bU: 0.3, bL: 1.6, footA: 32, footB: -34 } },
    { hold: 9, p: CROUCH },
  ],
});
/** Launched: stretched long, held, then into the tumble. */
export const launched: AnimDef = drawn({
  id: 'launched', base: 'air',
  drawings: [
    { hold: 5, p: { lean: -0.6, head: 0.9, flex: 13, aU: -1.9, aL: 0.3, bU: -2.4, bL: 0.2, laU: -0.25, laL: -0.3, lbU: -0.6, lbL: -0.2, stretch: 1.14 } },
    { hold: 7, p: { lean: -0.5, head: 0.6, aU: 2.8, aL: 0.5, bU: -2.4, bL: 0.4, laU: 1.4, laL: -0.5, lbU: -0.7, lbL: -0.6, flex: 8 } },
  ],
});
/** Tumble (reference 12-20, 91-95): four flung airborne drawings; the sim adds its spin on top. */
export const tumble: AnimDef = drawn({
  id: 'tumble', loop: true, base: 'air',
  drawings: [
    { hold: 7, p: { lean: -0.5, head: 0.6, aU: 2.8, aL: 0.5, bU: -2.4, bL: 0.4, laU: 1.4, laL: -0.5, lbU: -0.7, lbL: -0.6, flex: 8 } },
    { hold: 7, p: { lean: -0.2, head: 0.3, aU: 1.6, aL: 1.6, bU: -1.2, bL: 1.4, laU: 0.5, laL: -2.0, lbU: 0.3, lbL: -1.8, flex: 2 } },
    { hold: 7, p: { lean: 0.3, head: -0.4, aU: -2.2, aL: 0.6, bU: 2.6, bL: 0.4, laU: -0.6, laL: -0.4, lbU: 1.5, lbL: -0.5, flex: -7 } },
    { hold: 7, p: { lean: 0.1, head: 0.2, aU: -1.0, aL: 1.7, bU: 1.4, bL: 1.5, laU: 0.2, laL: -1.9, lbU: 0.6, lbL: -2.1, flex: -2 } },
  ],
});
/** Knockdown: slammed perfectly flat (reference 21-22 / 77 / 97), one small bounce. */
export const knockdown: AnimDef = drawn({
  id: 'knockdown', base: 'lying',
  drawings: [
    { hold: 4, p: { rootY: -54, lean: -1.57, head: 0.4, aU: -1.4, aL: 0.2, bU: -3.05, bL: 0.2, laU: 1.65, laL: -0.05, lbU: 1.5, lbL: -0.1, stretch: 1.04 }, sfx: 'land' },
    { hold: 4, p: { rootY: -46, lean: -1.4, head: 0.6, aU: -2.2, aL: 0.6, bU: -2.6, bL: 0.5, laU: 2.3, laL: -0.6, lbU: 2.0, lbL: -0.9 } },
    { hold: 6, p: { rootY: -54, lean: -1.57, head: 0.2, aU: -2.6, aL: 0.3, bU: -2.9, bL: 0.2, laU: 1.62, laL: -0.05, lbU: 1.52, lbL: -0.15 } },
  ],
});
export const lying: AnimDef = drawn({
  id: 'lying', loop: true, base: 'lying',
  drawings: [
    { hold: 32, p: { rootY: -54, lean: -1.57, head: 0.2, aU: -2.6, aL: 0.3, bU: -2.9, bL: 0.2, laU: 1.62, laL: -0.05, lbU: 1.52, lbL: -0.15 } },
    { hold: 32, p: { rootY: -55, lean: -1.57, head: 0.25, aU: -2.55, aL: 0.35, bU: -2.9, bL: 0.2, laU: 1.62, laL: -0.05, lbU: 1.52, lbL: -0.15 } },
  ],
});
export const getup: AnimDef = drawn({
  id: 'getup',
  drawings: [
    { hold: 5, p: { ...LYING_BASE, plant: 0, rootY: -54, lean: -0.5, head: 0.15, aU: -0.6, aL: 0.8, bU: -1.0, bL: 0.4, laU: 1.5, laL: -1.4, lbU: 1.1, lbL: -2.0 } },
    { hold: 6, p: { plant: 0.7, rootY: -56, lean: 1.1, aU: 0.0, aL: 0.3, bU: -0.15, bL: 0.4, footA: 16, footB: -34, head: -0.3 } },
    { hold: 6, p: { rootY: -46, lean: 0.75, aU: 0.9, aL: 1.6, bU: 0.3, bL: 2.0, footA: 30, footB: -34, head: -0.25 } },
    { hold: 7, p: CROUCH },
  ],
});

// ======================================================================= FLURRY (super): the "hundred fists"
/**
 * Nine alternating straights, one every 3 ticks (the move's multi-hit
 * interval), out of a two-drawing coil. Each punch is a committed lunge with
 * the other fist chambered back; the smear config (data/smears.ts) fans ghost
 * arms around every punch and hatches the arc, so the volley reads as a blur
 * of fists in ink. Ends in flurryEnd's laid-back power kick.
 */
const FL_A: PoseSpec = { rootX: 16, rootY: -30, lean: 0.85, aU: 1.62, aL: 0.0, bU: -0.3, bL: 2.3, footA: 50, footB: -50, head: -0.35, flex: -8, stretch: 1.1 };
const FL_B: PoseSpec = { rootX: 18, rootY: -32, lean: 0.9, bU: 1.62, bL: 0.0, aU: -0.3, aL: 2.3, footA: 50, footB: -50, head: -0.35, flex: -8, stretch: 1.1, spin: 0.05 };
export const flurry: AnimDef = drawn({
  id: 'flurry', strike: 'arm',
  drawings: [
    { hold: 2, p: { rootX: -10, rootY: -40, lean: 0.2, aU: 0.2, aL: 2.7, bU: 0.0, bL: 2.8, footA: 40, footB: -46, head: 0.1, flex: 6 } },
    { hold: 2, p: { rootX: -14, rootY: -44, lean: 0.1, aU: -0.1, aL: 2.9, bU: -0.2, bL: 2.9, footA: 40, footB: -48, head: 0.15, flex: 8 } },
    ...Array.from({ length: 9 }, (_, i) => ({ hold: 3, p: i % 2 === 0 ? FL_A : FL_B, smear: [i % 2 === 0 ? 'handA' : 'handB'] as ('handA' | 'handB')[], impact: i === 0 })),
    { hold: 3, p: { rootX: 10, rootY: -32, lean: 0.55, aU: 1.2, aL: 1.3, bU: 0.4, bL: 2.0, footA: 44, footB: -44 } },
  ],
});
export const flurryEnd: AnimDef = drawn({
  id: 'flurryEnd', strike: 'leg', reach: 'footA',
  drawings: [
    { hold: 3, p: { plant: 0.3, spin: -0.6, laU: 1.2, laL: -2.6, lbU: 0.2, aU: 2.5, aL: 0.6, bU: 1.2, lean: 0.2, rootY: -20, flex: -6 } },
    { hold: 4, p: { plant: 0, spin: 0.25, laU: 1.95, laL: 0.0, lbU: -0.6, lbL: -0.5, lean: -0.85, aU: -1.2, aL: 0.8, bU: 2.5, bL: 0.4, stretch: 1.18, head: -0.15 }, smear: ['footA'], impact: true },
    { hold: 5, p: { plant: 0, spin: 0.3, laU: 2.02, laL: 0.04, lbU: -0.6, lbL: -0.5, lean: -0.9, aU: -1.2, aL: 0.8, bU: 2.5, bL: 0.4, stretch: 1.14, head: -0.15 } },
    { hold: 6, p: { plant: 0.3, spin: 0.15, laU: 1.4, laL: -0.6, lean: -0.5, aU: -0.6, bU: 1.6 } },
    { hold: 6, p: { rootY: -40, lean: 0.55, aU: 0.9, aL: 1.4, bU: 0.3, bL: 1.8, footA: 40, footB: -40 } },
    { hold: 5, p: CROUCH },
  ],
});

/** Which file the lab exports these to. */
export const HAND_FILE = 'handDrawn';
