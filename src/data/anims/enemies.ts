import { anim, type AnimDef } from './types';
import type { PoseSpec } from '../../render/rig';

/**
 * Enemy animations. The same rig with per-kind proportions (render/rig.ts RIGS).
 * Names: `enemy.<name>` is the shared default, `<kind>.<name>` overrides it.
 * Attack animations are keyed by the attack id in data/enemies.ts. Their
 * anticipation (frames 0..contact) is stretched over the attack's windup, so
 * the telegraph is one big, readable wind-up pose; after contact, 1:1 frames.
 */

export const enemyIdle: AnimDef = anim({
  id: 'enemy.idle', len: 56, loop: true,
  keys: [
    { f: 0, p: { rootY: -9 } },
    { f: 14, p: { rootY: -12.5, lean: 0.23 }, e: 'inOut' },
    { f: 28, p: { rootY: -8, lean: 0.19, rootX: 1 }, e: 'inOut' },
    { f: 42, p: { rootY: -11.5, lean: 0.22 }, e: 'inOut' },
  ],
});
const WALK0: PoseSpec = { rootY: -10, footA: 20, footB: -18, liftB: 8 };
export const enemyWalk: AnimDef = anim({
  id: 'enemy.walk', len: 24, loop: true,
  keys: [
    { f: 0, p: WALK0, sfx: 'step' },
    { f: 6, p: { rootY: -14, footA: 6, footB: -4, liftB: 15, lean: 0.24 }, e: 'inOut' },
    { f: 12, p: { rootY: -10, footB: 20, footA: -18, liftA: 8 }, e: 'inOut', sfx: 'step' },
    { f: 18, p: { rootY: -14, footB: 6, footA: -4, liftA: 15, lean: 0.24 }, e: 'inOut' },
  ],
});
export const enemyTaunt: AnimDef = anim({
  id: 'enemy.taunt', len: 40, loop: true,
  keys: [
    { f: 0, p: { lean: -0.15, head: 0.3, aU: 2.4, aL: 1.8, bU: 2.6, bL: 1.9, rootY: -4 } },
    { f: 10, p: { lean: -0.1, head: 0.2, aU: 2.45, aL: 2.4, bU: 2.65, bL: 2.4, rootY: -8 }, e: 'snapOut' },
    { f: 20, p: { lean: -0.15, head: 0.3, aU: 2.4, aL: 1.8, bU: 2.6, bL: 1.9, rootY: -4 }, e: 'inOut' },
    { f: 30, p: { lean: -0.1, head: 0.2, aU: 2.45, aL: 2.4, bU: 2.65, bL: 2.4, rootY: -8 }, e: 'snapOut' },
  ],
});

// ---- Brute: wide, low, heavy breathing; heavy stomping walk ----
const BRUTE: PoseSpec = { rootY: -16, lean: 0.32, aU: 0.7, aL: 1.4, bU: 0.25, bL: 1.6, footA: 30, footB: -34, head: 0 };
export const bruteIdle: AnimDef = anim({
  id: 'brute.idle', len: 72, loop: true,
  keys: [
    { f: 0, p: BRUTE },
    { f: 36, p: { ...BRUTE, rootY: -21, lean: 0.37, aU: 0.76, bU: 0.3, head: 0.06 }, e: 'inOut' },
  ],
});
export const bruteWalk: AnimDef = anim({
  id: 'brute.walk', len: 36, loop: true,
  keys: [
    { f: 0, p: { ...BRUTE, footA: 32, footB: -24, liftB: 10 }, sfx: 'step' },
    { f: 9, p: { ...BRUTE, rootY: -24, footA: 8, footB: 0, liftB: 18, lean: 0.4 }, e: 'inOut' },
    { f: 18, p: { ...BRUTE, footB: 32, footA: -24, liftA: 10 }, e: 'in', sfx: 'step' },
    { f: 27, p: { ...BRUTE, rootY: -24, footB: 8, footA: 0, liftA: 18, lean: 0.4 }, e: 'inOut' },
  ],
});

// ---- Rusher: leaning forward, coiled, twitchy ----
const RUSH: PoseSpec = { rootY: -20, lean: 0.52, aU: -0.25, aL: 1.6, bU: -0.55, bL: 1.4, footA: 26, footB: -30, head: -0.22 };
export const rusherIdle: AnimDef = anim({
  id: 'rusher.idle', len: 30, loop: true,
  keys: [
    { f: 0, p: RUSH },
    { f: 15, p: { ...RUSH, rootY: -25, lean: 0.57, rootX: 3 }, e: 'inOut' },
  ],
});
export const rusherWalk: AnimDef = anim({
  id: 'rusher.walk', len: 20, loop: true,
  keys: [
    { f: 0, p: { ...RUSH, footA: 28, footB: -24, liftB: 10 } },
    { f: 5, p: { ...RUSH, rootY: -24, footA: 2, footB: 4, liftB: 24 }, e: 'inOut' },
    { f: 10, p: { ...RUSH, footB: 28, footA: -24, liftA: 10 }, e: 'in' },
    { f: 15, p: { ...RUSH, rootY: -24, footB: 2, footA: 4, liftA: 24 }, e: 'inOut' },
  ],
});

// ---- Kicker: upright, light on the back foot, front foot flicking up ----
const KICKER: PoseSpec = { rootY: -6, lean: 0.06, aU: 1.3, aL: 1.7, bU: 0.7, bL: 2.0, footA: 22, footB: -22 };
export const kickerIdle: AnimDef = anim({
  id: 'kicker.idle', len: 40, loop: true,
  keys: [
    { f: 0, p: KICKER },
    { f: 10, p: { ...KICKER, liftA: 16, footA: 28, rootY: -3, lean: -0.05 }, e: 'snapOut' },
    { f: 20, p: KICKER, e: 'inOut' },
    { f: 30, p: { ...KICKER, liftA: 10, footA: 26, rootY: -4 }, e: 'snapOut' },
  ],
});

// ================= Attacks =================
function strike(id: string, len: number, contact: number, wind: PoseSpec, hit: PoseSpec, follow: PoseSpec, recoverAt: number,
  smear: ('handA' | 'handB' | 'footA' | 'footB')[], strikeBy: 'arm' | 'leg' | 'body', holdTo = contact + 4, opts: { reach?: 'handA' | 'footA'; windAt?: number } = {}): AnimDef {
  return anim({
    id, len, strike: strikeBy, reach: opts.reach,
    keys: [
      { f: 0, p: {} },
      { f: opts.windAt ?? Math.round(contact * 0.55), p: wind, e: 'inOut' },
      { f: contact - 1, p: { ...wind, ...tighten(wind) }, e: 'out' },
      { f: contact, p: hit, e: 'snapIn', smear, impact: true },
      { f: holdTo, p: hit, e: 'hold' },
      { f: recoverAt, p: follow, e: 'snapOut' },
      { f: len, p: {}, e: 'inOut' },
    ],
  });
}
/** The wind-up pose pulls a little further just before release. */
function tighten(w: PoseSpec): PoseSpec {
  const o: PoseSpec = {};
  if (w.aU !== undefined) o.aU = w.aU - 0.08 * Math.sign(w.aU || 1);
  if (w.flex !== undefined) o.flex = w.flex * 1.15;
  if (w.lean !== undefined) o.lean = w.lean * 1.08;
  return o;
}

export const punch = strike('punch', 36, 10,
  { rootX: -14, rootY: -16, lean: -0.3, aU: -0.8, aL: 2.6, bU: 1.1, bL: 1.7, footA: 16, footB: -30, head: 0.2, flex: 7 },
  { rootX: 6, rootY: -16, lean: 0.5, aU: 1.66, aL: 0, bU: 0.25, bL: 2.4, footA: 32, footB: -40, head: -0.25, flex: -5, stretch: 1.07 },
  { rootX: 8, lean: 0.35, aU: 1.2, aL: 1.5 }, 20, ['handA'], 'arm', 14, { reach: 'handA' });

export const lunge = strike('lunge', 46, 8,
  { rootY: -38, lean: 0.82, aU: -1.6, aL: 0.4, bU: -1.4, bL: 0.4, footA: 38, footB: -46, head: -0.3, flex: -5 },
  { plant: 0.3, rootY: -22, lean: 0.92, aU: 1.62, aL: 0, bU: -1.5, bL: 0.4, laU: 1.4, laL: -1.2, lbU: -1.0, lbL: -0.6, head: -0.4, stretch: 1.14 },
  { rootY: -24, lean: 0.5, aU: 1.0, aL: 1.4, bU: -0.2 }, 28, ['handA'], 'arm', 20, { windAt: 4 });
export const eLunge = { ...lunge, id: 'eLunge', spec: { ...lunge.spec, id: 'eLunge' } };
export const bRush = strike('bRush', 60, 8,
  { rootY: -36, lean: 0.85, aU: -1.7, aL: 0.4, bU: -1.5, bL: 0.4, footA: 40, footB: -48, head: -0.3, flex: -6 },
  { plant: 0.3, rootY: -20, lean: 0.95, aU: 1.6, aL: 0, bU: 1.5, bL: 0.1, laU: 1.4, laL: -1.2, lbU: -1.0, lbL: -0.6, head: -0.4, stretch: 1.12 },
  { rootY: -24, lean: 0.5, aU: 1.0, aL: 1.4, bU: 0.4 }, 30, ['handA', 'handB'], 'body', 20, { windAt: 4 });

export const slam = strike('slam', 51, 12,
  { rootY: 6, lean: -0.45, aU: 3.05, aL: 0.3, bU: 2.95, bL: 0.4, head: 0.3, flex: 11, stretch: 1.08, footA: 18, footB: -30 },
  { rootY: -36, lean: 0.95, aU: 1.0, aL: 0.05, bU: 0.9, bL: 0.1, footA: 44, footB: -30, head: 0.1, stretch: 0.94 },
  { rootY: -24, lean: 0.5, aU: 0.8, aL: 1.2, bU: 0.6, bL: 1.3 }, 26, ['handA', 'handB'], 'body', 17);
export const hammer = strike('hammer', 81, 14,
  { rootY: 8, lean: -0.5, aU: 3.08, aL: 0.2, bU: 3.0, bL: 0.2, head: 0.32, flex: 12, stretch: 1.1, footA: 20, footB: -32 },
  { rootY: -38, lean: 1.0, aU: 1.08, aL: 0.0, bU: 1.0, bL: 0.0, footA: 46, footB: -32, head: 0.12, stretch: 0.92 },
  { rootY: -26, lean: 0.55, aU: 0.8, aL: 1.2, bU: 0.6, bL: 1.3 }, 40, ['handA', 'handB'], 'body', 20);

export const kick = strike('kick', 35, 8,
  { plant: 0.2, rootY: -2, lean: -0.45, laU: 2.25, laL: -2.6, aU: 1.5, aL: 1.5, bU: 0.7, bL: 1.8, head: 0.05 },
  { plant: 0.35, rootY: 2, lean: -0.82, laU: 2.15, laL: 0.0, aU: -0.6, aL: 1.1, bU: 1.9, bL: 1.0, head: -0.05, stretch: 1.08 },
  { plant: 1, rootY: -12, lean: 0.1 }, 20, ['footA'], 'leg', 13, { reach: 'footA' });
export const eKick = strike('eKick', 37, 8,
  { spin: -0.5, plant: 0.3, laU: 1.0, laL: -2.3, lean: 0.2, aU: 2.0, bU: 1.2 },
  { spin: 0.2, plant: 0.3, laU: 2.02, laL: 0.05, lean: -0.72, aU: -0.8, bU: 2.0, stretch: 1.08 },
  { spin: 0.05, rootY: -14, lean: 0.1 }, 22, ['footA'], 'leg', 13);
export const bSweep = strike('bSweep', 63, 10,
  { rootY: -30, lean: 0.4, spin: -0.12, laU: 0.6, laL: -1.6, aU: 0.9, aL: 1.0, footA: 10, footB: -30 },
  { plant: 0.1, rootY: -46, lean: 0.62, spin: 0.1, laU: 1.62, laL: 0, lbU: -1.0, lbL: -1.3, aU: 1.2, bU: -0.6, stretch: 1.05 },
  { rootY: -28, lean: 0.4, footA: 20 }, 30, ['footA'], 'leg', 17);

export const throwDart = strike('throw', 42, 10,
  { lean: -0.42, aU: -2.7, aL: 0.4, bU: 1.45, bL: 0.3, footA: 16, footB: -34, head: 0.15, flex: 7 },
  { lean: 0.5, rootX: 12, aU: 1.88, aL: 0.05, bU: -0.6, bL: 0.8, footA: 38, stretch: 1.06 },
  { lean: 0.25, aU: 1.2, aL: 1.3 }, 22, ['handA'], 'arm', 13);
export const bash = strike('bash', 37, 8,
  { rootX: -12, rootY: -18, lean: -0.2, aU: 0.85, aL: 1.9, bU: 0.4, bL: 2.2, footB: -32 },
  { rootX: 8, rootY: -18, lean: 0.55, aU: 1.55, aL: 0.55, footA: 34, footB: -40, stretch: 1.05 },
  { rootX: 10, lean: 0.3 }, 20, ['handA'], 'arm', 13);
export const ePunch = strike('ePunch', 31, 6,
  { rootX: -10, rootY: -16, lean: -0.1, aU: 0.4, aL: 2.6, bU: 1.2, bL: 1.6 },
  { rootX: 6, rootY: -16, lean: 0.52, aU: 1.66, aL: 0, bU: 0.3, bL: 2.4, footA: 32, footB: -40, stretch: 1.08 },
  { rootX: 8, lean: 0.3, aU: 1.2, aL: 1.5 }, 14, ['handA'], 'arm', 9, { reach: 'handA' });
