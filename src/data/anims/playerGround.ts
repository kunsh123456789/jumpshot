import { anim, type AnimDef } from './types';
import type { PoseSpec } from '../../render/rig';

/**
 * Player grounded attacks. Frame numbers are move frames: the contact key sits
 * on the move's first active frame (= startup in data/moves.ts) and the
 * animation length is startup + active + recovery.
 * Shape: anticipation (coil) -> snapIn to the EXTREME contact pose (smear) ->
 * hold -> follow-through slightly past -> snapOut recoil -> ease to stance.
 */

// ---- JAB (lead hand) S4 A3 R13 ----
const JAB1_HIT: PoseSpec = { rootX: 4, rootY: -16, lean: 0.46, aU: 1.66, aL: 0.0, bU: 0.22, bL: 2.5, footA: 30, footB: -42, head: -0.28, flex: -5, stretch: 1.06 };
export const jab1: AnimDef = anim({
  id: 'jab1', len: 20, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootX: -2, rootY: -12, lean: 0.12, aU: 0.9, aL: 2.3, bU: 0.6, bL: 2.2 } },
    { f: 2, p: { rootX: -10, rootY: -20, lean: -0.12, aU: 0.3, aL: 2.8, bU: 0.8, bL: 2.1, head: 0.12, footB: -32, flex: 5 }, e: 'inOut' },
    { f: 4, p: JAB1_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 6, p: JAB1_HIT, e: 'hold' },
    { f: 8, p: { ...JAB1_HIT, rootX: 6, lean: 0.5, aU: 1.76, aL: 0.12 }, e: 'out' },
    { f: 12, p: { rootX: 2, rootY: -14, lean: 0.3, aU: 1.2, aL: 1.55, bU: 0.45, bL: 2.3, footA: 26, footB: -32 }, e: 'snapOut' },
    { f: 20, p: {}, e: 'inOut' },
  ],
});

// ---- JAB 2 (rear straight) S4 A3 R13 ----
const JAB2_HIT: PoseSpec = { rootX: 6, rootY: -34, lean: 0.85, aU: 0.45, aL: 2.3, bU: 1.22, bL: 0.0, footA: 38, footB: -44, head: -0.1, flex: -7, stretch: 1.06 };
export const jab2: AnimDef = anim({
  id: 'jab2', len: 20, strike: 'arm', reach: 'handB',
  keys: [
    { f: 0, p: { rootX: -4, rootY: -12, lean: 0.15, aU: 1.3, aL: 1.6, bU: 0.4, bL: 2.4 } },
    { f: 2, p: { rootX: -8, rootY: -24, lean: 0.12, aU: 1.42, aL: 1.35, bU: 0.05, bL: 2.8, footB: -32, head: 0.08, flex: 4 }, e: 'inOut' },
    { f: 4, p: JAB2_HIT, e: 'snapIn', smear: ['handB'], impact: true },
    { f: 6, p: JAB2_HIT, e: 'hold' },
    { f: 8, p: { ...JAB2_HIT, rootX: 8, lean: 0.9, bU: 1.3, bL: 0.1 }, e: 'out' },
    { f: 12, p: { rootX: 3, rootY: -14, lean: 0.32, aU: 0.9, aL: 2.0, bU: 1.0, bL: 1.6, footA: 26, footB: -32 }, e: 'snapOut' },
    { f: 20, p: {}, e: 'inOut' },
  ],
});

// ---- CROSS (lunging overhand, lead hand from high) S5 A3 R16 ----
const CROSS_HIT: PoseSpec = { rootX: 8, rootY: -22, lean: 0.72, aU: 1.25, aL: 0.04, bU: -0.45, bL: 1.2, footA: 40, footB: -42, head: -0.35, flex: -8, stretch: 1.1, spin: 0.06 };
export const cross: AnimDef = anim({
  id: 'cross', len: 24, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootX: -2, rootY: -14, lean: 0.1, aU: 1.6, aL: 1.6 } },
    { f: 3, p: { rootX: -10, rootY: -12, lean: -0.22, aU: 2.75, aL: 1.25, bU: 0.9, bL: 1.6, footB: -30, flex: 7, head: 0.12, spin: -0.08 }, e: 'inOut' },
    { f: 5, p: CROSS_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 8, p: CROSS_HIT, e: 'hold' },
    { f: 10, p: { ...CROSS_HIT, rootX: 10, lean: 0.78, aU: 1.05, aL: 0.1 }, e: 'out' },
    { f: 15, p: { rootX: 4, rootY: -16, lean: 0.38, aU: 1.1, aL: 1.6, bU: 0.4, bL: 2.0, footA: 30, footB: -34 }, e: 'snapOut' },
    { f: 24, p: {}, e: 'inOut' },
  ],
});

// ---- SPINNING BACKFIST (heavy side) S10 A4 R20 ----
const BACKFIST_HIT: PoseSpec = { spin: 0.04, rootX: 8, rootY: -18, lean: 0.48, aU: 1.8, aL: 0.05, bU: -0.75, bL: 1.2, footA: 36, footB: -40, head: -0.3, flex: -6, stretch: 1.1 };
export const backfist: AnimDef = anim({
  id: 'backfist', len: 34, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootX: -2, lean: 0.15, aU: 1.0, aL: 2.0 } },
    { f: 6, p: { rootX: -8, rootY: -22, lean: -0.3, aU: -1.35, aL: 0.9, bU: 1.6, bL: 1.0, footA: 18, footB: -36, head: 0.3, flex: 9 }, e: 'inOut' },
    { f: 8, p: { rootX: -10, rootY: -23, lean: -0.36, aU: -1.5, aL: 0.8, bU: 1.7, bL: 0.95, footA: 16, footB: -37, head: 0.34, flex: 10 }, e: 'out' },
    { f: 10, p: BACKFIST_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 13, p: BACKFIST_HIT, e: 'hold' },
    { f: 16, p: { ...BACKFIST_HIT, aU: 2.02, aL: 0.3, spin: 0.18, rootX: 10, lean: 0.52 }, e: 'out' },
    { f: 22, p: { rootX: 4, rootY: -14, lean: 0.3, aU: 1.4, aL: 1.4, spin: 0.05, footA: 28, footB: -32 }, e: 'snapOut' },
    { f: 34, p: {}, e: 'inOut' },
  ],
});

// ---- RISING HOOK (NE light) S5 A4 R15 ----
const HOOK_HIT: PoseSpec = { rootY: -8, rootX: 4, lean: 0.32, aU: 2.05, aL: 1.2, bU: 0.1, bL: 2.4, footA: 30, footB: -36, liftB: 4, head: -0.3, flex: 4, stretch: 1.05, spin: -0.06 };
export const hook: AnimDef = anim({
  id: 'hook', len: 24, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootY: -16, lean: 0.3 } },
    { f: 3, p: { rootY: -30, lean: 0.55, aU: -0.2, aL: 1.6, bU: 0.9, bL: 2.0, footA: 26, footB: -30, head: 0.08, flex: -4 }, e: 'inOut' },
    { f: 5, p: HOOK_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 8, p: HOOK_HIT, e: 'hold' },
    { f: 10, p: { ...HOOK_HIT, aU: 2.3, aL: 1.3, lean: 0.25 }, e: 'out' },
    { f: 14, p: { rootY: -12, lean: 0.2, aU: 1.4, aL: 1.7 }, e: 'snapOut' },
    { f: 24, p: {}, e: 'inOut' },
  ],
});

// ---- FLYING KNEE (NE heavy) S8 A7 R18, travels through enemies during active ----
const KNEE_HIT: PoseSpec = { plant: 0, rootY: 34, lean: -0.12, laU: 1.95, laL: -2.55, lbU: -0.65, lbL: -0.9, aU: -1.3, aL: 0.6, bU: 2.85, bL: 0.3, head: -0.25, flex: 6, stretch: 1.06 };
export const knee: AnimDef = anim({
  id: 'knee', len: 33, strike: 'leg',
  keys: [
    { f: 0, p: { rootY: -16, lean: 0.3 } },
    { f: 5, p: { rootY: -32, lean: 0.52, aU: -0.9, aL: 0.8, bU: -1.1, bL: 0.7, footA: 30, footB: -30, head: -0.1 }, e: 'inOut' },
    { f: 8, p: KNEE_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 15, p: { ...KNEE_HIT, laU: 2.0, rootY: 30 }, e: 'out' },
    { f: 20, p: { rootY: -30, lean: 0.45, aU: 0.6, bU: 0.3, footA: 32, footB: -26, stretch: 0.95 }, e: 'snapOut', sfx: 'land' },
    { f: 33, p: {}, e: 'inOut' },
  ],
});

// ---- JUMPSHOT LAUNCHER S6 A4 R16: crouch low, explode up into one long vertical line ----
const LAUNCH_HIT: PoseSpec = { rootY: 18, lean: -0.2, aU: 3.1, aL: 0.03, bU: -0.3, bL: 0.85, footA: 14, footB: -12, liftA: 8, liftB: 12, head: -0.5, flex: 9, stretch: 1.15 };
export const launcher: AnimDef = anim({
  id: 'launcher', len: 26, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootY: -18, lean: 0.32, aU: 0.9, aL: 2.0 } },
    { f: 4, p: { rootY: -42, lean: 0.62, aU: 0.08, aL: 1.5, bU: 0.55, bL: 2.3, footA: 32, footB: -30, head: 0.1, flex: -7, stretch: 0.96 }, e: 'inOut' },
    { f: 6, p: LAUNCH_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 9, p: LAUNCH_HIT, e: 'hold' },
    { f: 13, p: { ...LAUNCH_HIT, aU: 3.15, aL: 0.12, rootY: 16, stretch: 1.1 }, e: 'out' },
    { f: 26, p: {}, e: 'inOut' },
  ],
});
const LAUNCHH_HIT: PoseSpec = { rootY: 24, lean: -0.25, aU: 3.12, aL: 0.02, bU: -0.45, bL: 0.8, footA: 12, footB: -10, liftA: 12, liftB: 16, head: -0.55, flex: 11, stretch: 1.2, spin: 0.04 };
export const launcherH: AnimDef = anim({
  id: 'launcherH', len: 31, strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { rootY: -18, lean: 0.32, aU: 0.9, aL: 2.0 } },
    { f: 6, p: { rootY: -48, lean: 0.72, spin: -0.12, aU: -0.05, aL: 1.3, bU: 0.4, bL: 2.3, footA: 36, footB: -32, head: 0.15, flex: -9, stretch: 0.94 }, e: 'inOut' },
    { f: 8, p: { rootY: -50, lean: 0.74, spin: -0.14, aU: -0.1, aL: 1.25, bU: 0.4, bL: 2.3, footA: 36, footB: -32, head: 0.16, flex: -10, stretch: 0.93 }, e: 'out' },
    { f: 9, p: LAUNCHH_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 12, p: LAUNCHH_HIT, e: 'hold' },
    { f: 16, p: { ...LAUNCHH_HIT, aU: 3.18, rootY: 20, stretch: 1.13 }, e: 'out' },
    { f: 31, p: {}, e: 'inOut' },
  ],
});

// ---- LEG SWEEP (SE light) S5 A4 R16 ----
const SWEEP_HIT: PoseSpec = { plant: 0, rootY: -46, lean: 0.22, spin: -0.04, laU: 1.58, laL: 0.0, lbU: 0.35, lbL: -2.6, aU: 0.8, aL: 1.6, bU: -0.55, bL: 0.35, head: 0.0, stretch: 1.06 };
export const sweep: AnimDef = anim({
  id: 'sweep', len: 25, strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { rootY: -20, lean: 0.35 } },
    { f: 3, p: { rootY: -40, lean: 0.55, spin: -0.12, aU: 0.9, aL: 1.3, bU: -0.3, bL: 1.2, footA: 8, footB: -30 }, e: 'inOut' },
    { f: 5, p: SWEEP_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 8, p: SWEEP_HIT, e: 'hold' },
    { f: 11, p: { ...SWEEP_HIT, laU: 1.7, spin: 0.02 }, e: 'out' },
    { f: 16, p: { rootY: -30, lean: 0.45, footA: 20, footB: -30, aU: 1.0, bU: 0.2 }, e: 'snapOut' },
    { f: 25, p: {}, e: 'inOut' },
  ],
});

// ---- SLIDE KICK (SE heavy) S7 A11 R16, travels during active ----
const SLIDE_HIT: PoseSpec = { plant: 0, rootY: -50, lean: -0.65, spin: -0.12, laU: 1.48, laL: 0.0, lbU: 0.95, lbL: -2.05, aU: -1.5, aL: 0.4, bU: -1.1, bL: 0.4, head: 0.25, stretch: 1.06 };
export const slide: AnimDef = anim({
  id: 'slide', len: 34, strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { rootY: -18, lean: 0.3 } },
    { f: 5, p: { rootY: -32, lean: 0.58, aU: -0.5, bU: -0.75, footA: 32, footB: -14 }, e: 'inOut' },
    { f: 7, p: SLIDE_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 18, p: { ...SLIDE_HIT, laU: 1.52 }, e: 'out' },
    { f: 24, p: { rootY: -32, lean: 0.4, footA: 26, footB: -22, aU: 0.8, bU: 0.3 }, e: 'snapOut' },
    { f: 34, p: {}, e: 'inOut' },
  ],
});

// ---- QUAKE STOMP (S) S7 A3 R18: knee chambered high, slammed down ----
const STOMP_HIT: PoseSpec = { plant: 1, rootY: -36, lean: 0.58, aU: 0.35, aL: 0.4, bU: -0.55, bL: 0.5, footA: 36, footB: -26, head: 0.15, stretch: 0.93 };
export const stomp: AnimDef = anim({
  id: 'stomp', len: 28, strike: 'leg',
  keys: [
    { f: 0, p: { rootY: -10 } },
    { f: 5, p: { plant: 0.25, rootY: 8, lean: -0.1, laU: 1.8, laL: -2.25, aU: 2.6, aL: 0.5, bU: 2.4, bL: 0.5, head: -0.12, flex: 4, stretch: 1.04 }, e: 'inOut' },
    { f: 7, p: STOMP_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 10, p: STOMP_HIT, e: 'hold' },
    { f: 16, p: { rootY: -24, lean: 0.35, aU: 0.8, aL: 1.4, bU: 0.3, bL: 1.8 }, e: 'snapOut' },
    { f: 28, p: {}, e: 'inOut' },
  ],
});
const STOMPH_HIT: PoseSpec = { plant: 1, rootY: -42, lean: 0.72, aU: 0.2, aL: 0.2, bU: -0.65, bL: 0.3, footA: 40, footB: -28, stretch: 0.9, head: 0.22 };
export const stompH: AnimDef = anim({
  id: 'stompH', len: 36, strike: 'body',
  keys: [
    { f: 0, p: { rootY: -14 } },
    { f: 5, p: { rootY: -32, lean: 0.42, aU: 0.2, aL: 1.2, bU: 0.1, bL: 1.4 }, e: 'inOut' },
    { f: 9, p: { plant: 0, rootY: 22, lean: -0.15, laU: 1.95, laL: -2.4, lbU: 0.6, lbL: -1.7, aU: 3.0, aL: 0.3, bU: 2.9, bL: 0.3, flex: 9, stretch: 1.1, head: -0.2 }, e: 'snapOut' },
    { f: 11, p: STOMPH_HIT, e: 'snapIn', smear: ['footA', 'handA'], impact: true },
    { f: 15, p: STOMPH_HIT, e: 'hold' },
    { f: 22, p: { rootY: -26, lean: 0.4, aU: 0.7, aL: 1.4, bU: 0.3, bL: 1.7 }, e: 'snapOut' },
    { f: 36, p: {}, e: 'inOut' },
  ],
});
