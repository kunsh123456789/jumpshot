import { anim, type AnimDef, type KeySpec } from './types';
import type { PoseSpec } from '../../render/rig';

/** Player air attacks and finishers (air base pose: FK legs). Contact = move startup. */

// ---- AIR KICK CHAIN (3 variants) ----
const AK1_HIT: PoseSpec = { laU: 1.8, laL: 0.0, lbU: -0.5, lbL: -0.8, lean: -0.52, spin: 0.08, aU: -0.95, aL: 1.0, bU: 2.1, bL: 0.7, head: -0.1, stretch: 1.07 };
export const akick1: AnimDef = anim({
  id: 'akick1', len: 19, base: 'air', strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { laU: 0.85, laL: -2.0, lean: 0.1 } },
    { f: 2, p: { laU: 1.15, laL: -2.5, lbU: -0.2, lbL: -1.0, lean: 0.18, spin: -0.12, aU: 1.6, aL: 1.4, bU: 0.4 }, e: 'inOut' },
    { f: 4, p: AK1_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 6, p: AK1_HIT, e: 'hold' },
    { f: 8, p: { ...AK1_HIT, laU: 1.88, laL: 0.06, lean: -0.57 }, e: 'out' },
    { f: 12, p: { laU: 1.0, laL: -1.8, lean: -0.1, aU: 1.2, bU: 0.6 }, e: 'snapOut' },
    { f: 19, p: {}, e: 'inOut' },
  ],
});
const AK2_HIT: PoseSpec = { lbU: 1.84, lbL: 0.0, laU: -0.55, laL: -1.25, lean: -0.58, spin: 0.15, aU: 2.05, aL: 0.9, bU: -0.85, bL: 1.0, head: -0.1, stretch: 1.07 };
export const akick2: AnimDef = anim({
  id: 'akick2', len: 19, base: 'air', strike: 'leg', reach: 'footB',
  keys: [
    { f: 0, p: { lbU: 0.6, lbL: -1.8, lean: 0.08 } },
    { f: 2, p: { lbU: 1.1, lbL: -2.45, laU: -0.2, laL: -1.2, spin: -0.16, lean: 0.16, aU: 0.6, bU: 1.4 }, e: 'inOut' },
    { f: 4, p: AK2_HIT, e: 'snapIn', smear: ['footB'], impact: true },
    { f: 6, p: AK2_HIT, e: 'hold' },
    { f: 8, p: { ...AK2_HIT, lbU: 1.92, lean: -0.62 }, e: 'out' },
    { f: 12, p: { lbU: 0.9, lbL: -1.7, lean: -0.1, aU: 1.3, bU: 0.5 }, e: 'snapOut' },
    { f: 19, p: {}, e: 'inOut' },
  ],
});
const AK3_HIT: PoseSpec = { spin: 0.55, laU: 2.0, laL: 0.05, lbU: -0.4, lbL: -1.0, lean: -0.62, aU: -0.95, aL: 0.9, bU: 2.25, bL: 0.6, stretch: 1.08 };
export const akick3: AnimDef = anim({
  id: 'akick3', len: 22, base: 'air', strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { spin: -0.2, laU: 0.8, laL: -2.0 } },
    { f: 3, p: { spin: -0.78, laU: 0.6, laL: -2.45, lbU: 0.35, lbL: -1.85, aU: 2.25, aL: 0.8, bU: 1.45, lean: 0.28 }, e: 'inOut' },
    { f: 5, p: AK3_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 8, p: AK3_HIT, e: 'hold' },
    { f: 10, p: { ...AK3_HIT, spin: 0.66, laU: 2.08 }, e: 'out' },
    { f: 15, p: { spin: 0.2, laU: 1.0, laL: -1.8, lean: -0.1 }, e: 'snapOut' },
    { f: 22, p: {}, e: 'inOut' },
  ],
});
const AH_HIT: PoseSpec = { spin: 0.3, lbU: 1.78, lbL: 0.0, laU: -0.3, laL: -1.5, lean: -0.72, aU: -1.1, aL: 0.9, bU: 2.5, bL: 0.4, stretch: 1.12, head: -0.1 };
export const aheavy: AnimDef = anim({
  id: 'aheavy', len: 27, base: 'air', strike: 'leg', reach: 'footB',
  keys: [
    { f: 0, p: { spin: -0.2 } },
    { f: 5, p: { spin: -0.92, lbU: 0.4, lbL: -2.5, laU: 0.8, laL: -1.9, aU: 2.6, aL: 0.6, bU: 2.2, lean: 0.32, flex: 6 }, e: 'inOut' },
    { f: 7, p: AH_HIT, e: 'snapIn', smear: ['footB'], impact: true },
    { f: 10, p: AH_HIT, e: 'hold' },
    { f: 14, p: { ...AH_HIT, spin: 0.38, lbU: 1.86 }, e: 'out' },
    { f: 19, p: { spin: 0.1, lbU: 0.6, lbL: -1.6, lean: -0.1 }, e: 'snapOut' },
    { f: 27, p: {}, e: 'inOut' },
  ],
});

// ---- SKY SLASH (diagonal air slash) ----
const AS_HIT: PoseSpec = { aU: 2.82, aL: 0.05, bU: -0.75, bL: 0.9, spin: 0.42, lean: 0.15, laU: 1.0, laL: -1.8, lbU: -0.4, lbL: -1.0, stretch: 1.08 };
export const aslash: AnimDef = anim({
  id: 'aslash', len: 23, base: 'air', strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { aU: 0.4, aL: 1.4 } },
    { f: 3, p: { aU: -0.55, aL: 0.85, bU: 0.85, spin: -0.42, lean: 0.38, laU: 1.3, laL: -2.1 }, e: 'inOut' },
    { f: 5, p: AS_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 8, p: AS_HIT, e: 'hold' },
    { f: 10, p: { ...AS_HIT, aU: 3.02, spin: 0.52 }, e: 'out' },
    { f: 15, p: { aU: 1.6, aL: 1.2, spin: 0.15, lean: 0.1 }, e: 'snapOut' },
    { f: 23, p: {}, e: 'inOut' },
  ],
});
const ASH_HIT: PoseSpec = { aU: 2.92, aL: 0.03, bU: -0.95, bL: 0.8, spin: 0.68, lean: 0.12, laU: 0.9, laL: -1.7, lbU: -0.5, lbL: -0.9, stretch: 1.12 };
export const aslashH: AnimDef = anim({
  id: 'aslashH', len: 27, base: 'air', strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { aU: 0.3, aL: 1.4 } },
    { f: 5, p: { aU: -0.95, aL: 0.8, bU: 1.0, spin: -0.62, lean: 0.42, laU: 1.35, laL: -2.2, flex: 5 }, e: 'inOut' },
    { f: 7, p: ASH_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 10, p: ASH_HIT, e: 'hold' },
    { f: 14, p: { ...ASH_HIT, aU: 3.1, spin: 0.8 }, e: 'out' },
    { f: 19, p: { aU: 1.6, aL: 1.2, spin: 0.2 }, e: 'snapOut' },
    { f: 27, p: {}, e: 'inOut' },
  ],
});

// ---- RISING AIR STRIKE (N in air) ----
const AR_HIT: PoseSpec = { aU: 3.12, aL: 0.03, bU: 0.1, bL: 1.4, laU: 1.55, laL: -2.15, lbU: -0.3, lbL: -0.4, lean: -0.3, head: -0.48, stretch: 1.14, flex: 6 };
export const arise: AnimDef = anim({
  id: 'arise', len: 23, base: 'air', strike: 'arm', reach: 'handA',
  keys: [
    { f: 0, p: { aU: 0.9, aL: 1.9 } },
    { f: 3, p: { aU: 0.15, aL: 2.05, lean: 0.38, laU: 0.4, laL: -0.9, bU: 0.85, flex: -5 }, e: 'inOut' },
    { f: 5, p: AR_HIT, e: 'snapIn', smear: ['handA'], impact: true },
    { f: 8, p: AR_HIT, e: 'hold' },
    { f: 10, p: { ...AR_HIT, aU: 3.18, aL: 0.12 }, e: 'out' },
    { f: 15, p: { aU: 2.0, aL: 1.0, lean: -0.1, laU: 1.1, laL: -1.7 }, e: 'snapOut' },
    { f: 23, p: {}, e: 'inOut' },
  ],
});

// ---- SPIKE: big wind-up (leg raised over the head), axe the heel down ----
const SPIKE_HIT: PoseSpec = { spin: 0.55, laU: 0.75, laL: 0.0, lbU: -0.45, lbL: -1.1, lean: 0.66, aU: -0.75, aL: 0.8, bU: -0.95, bL: 0.7, head: 0.2, stretch: 1.1 };
export const spike: AnimDef = anim({
  id: 'spike', len: 27, base: 'air', strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { spin: -0.2, laU: 1.4, laL: -1.6 } },
    { f: 4, p: { spin: -0.32, laU: 3.05, laL: -0.05, lbU: -0.15, lbL: -0.9, aU: 2.3, aL: 0.4, bU: -1.0, bL: 0.6, lean: -0.4, head: 0.1, flex: 9, stretch: 1.1 }, e: 'out' },
    { f: 6, p: SPIKE_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 9, p: SPIKE_HIT, e: 'hold' },
    { f: 12, p: { ...SPIKE_HIT, spin: 0.66, laU: 0.6 }, e: 'out' },
    { f: 18, p: { spin: 0.2, laU: 1.0, laL: -1.4, lean: 0.2, aU: 1.4, bU: 0.6 }, e: 'snapOut' },
    { f: 27, p: {}, e: 'inOut' },
  ],
});

// ---- JUMPSHOT FINISHER (cinematic): back-flip, leg over the top, axe kick straight down ----
const FIN_HIT: PoseSpec = { spin: -5.73, laU: 0.6, laL: 0.0, lbU: -0.5, lbL: -1.0, lean: 0.62, aU: -0.85, aL: 0.7, bU: -1.05, bL: 0.7, head: 0.25, stretch: 1.16 };
export const jumpshotFinisher: AnimDef = anim({
  id: 'jumpshotFinisher', len: 42, base: 'air', strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { laU: 1.6, laL: -2.3, lbU: 1.0, lbL: -2.0, aU: 2.4, aL: 0.8, lean: 0.2 } },
    { f: 6, p: { spin: -2.6, laU: 1.85, laL: -2.45, lbU: 1.55, lbL: -2.25, aU: 2.6, aL: 0.6, bU: 2.4, flex: 6 }, e: 'inOut' },
    { f: 12, p: { spin: -5.15, laU: 3.0, laL: -0.1, lbU: 0.2, lbL: -1.2, aU: 2.6, aL: 0.3, bU: 2.3, lean: -0.3, stretch: 1.1 }, e: 'out' },
    { f: 14, p: { spin: -5.35, laU: 3.05, laL: -0.05, lbU: 0.2, lbL: -1.2, aU: 2.65, aL: 0.3, bU: 2.35, lean: -0.32, stretch: 1.12 }, e: 'out' },
    { f: 16, p: FIN_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 20, p: FIN_HIT, e: 'hold' },
    { f: 26, p: { ...FIN_HIT, spin: -5.85, laU: 0.5 }, e: 'out' },
    { f: 34, p: { spin: -6.1, laU: 1.0, laL: -1.4, lean: 0.2, aU: 1.4, bU: 0.6 }, e: 'snapOut' },
    { f: 42, p: { spin: -Math.PI * 2 }, e: 'inOut' },
  ],
});

// ---- FLURRY: 9 alternating straights every 3 frames, then the flurry end kick ----
const FL_A: PoseSpec = { lean: 0.5, rootX: 14, aU: 1.66, aL: 0.0, bU: 0.55, bL: 2.5, footA: 40, footB: -24, head: -0.25, stretch: 1.05 };
const FL_B: PoseSpec = { lean: 0.53, rootX: 15, bU: 1.66, bL: 0.0, aU: 0.6, aL: 2.4, footA: 40, footB: -22, head: -0.25, stretch: 1.05 };
const flurryKeys: KeySpec[] = [{ f: 0, p: { lean: 0.1, rootX: -6, aU: 0.8, aL: 2.3, bU: 0.6, bL: 2.4 } }];
for (let i = 0; i < 9; i++) {
  const a = (i & 1) === 0;
  flurryKeys.push({ f: 4 + i * 3, p: a ? FL_A : FL_B, e: 'snapIn', smear: [a ? 'handA' : 'handB'], impact: i === 0 });
}
flurryKeys.push({ f: 31, p: FL_A, e: 'hold' }, { f: 34, p: { lean: 0.3, rootX: 8 }, e: 'snapOut' });
export const flurry: AnimDef = anim({ id: 'flurry', len: 34, strike: 'arm', keys: flurryKeys });

const FE_HIT: PoseSpec = { plant: 0, spin: 0.2, laU: 1.88, laL: 0.0, lbU: -0.4, lbL: -0.6, lean: -0.68, aU: -0.95, aL: 1.0, bU: 2.2, bL: 0.5, stretch: 1.14, head: -0.1 };
export const flurryEnd: AnimDef = anim({
  id: 'flurryEnd', len: 29, strike: 'leg', reach: 'footA',
  keys: [
    { f: 0, p: { plant: 0.3, spin: -0.35, laU: 1.0, laL: -2.3, aU: 2.2, lean: -0.2 } },
    { f: 3, p: FE_HIT, e: 'snapIn', smear: ['footA'], impact: true },
    { f: 7, p: FE_HIT, e: 'hold' },
    { f: 12, p: { ...FE_HIT, laU: 1.98, lean: -0.72 }, e: 'out' },
    { f: 20, p: { rootY: -24, lean: 0.3, aU: 1.0, bU: 0.3 }, e: 'snapOut' },
    { f: 29, p: {}, e: 'inOut' },
  ],
});
