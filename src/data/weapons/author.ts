import { drawn, type AnimDef, type DrawingSpec, type LimbId } from '../anims/types';
import type { PoseSpec } from '../../render/rig';
import type { MoveDef } from '../moves';

/**
 * Authoring helper for weapon moves (revision pass 7): the drawings of an
 * attack are written as anticipation poses, the contact pose (and an optional
 * second active pose), and recovery poses. Holds are spread over the move's
 * frame data so the CONTACT drawing starts exactly on the first active frame
 * (startup), whatever the startup is, and the total length is
 * startup + active + recovery, same as the hand-drawn Fists set.
 */
export interface StrikeDrawings {
  base?: 'ground' | 'air';
  strike?: 'arm' | 'leg' | 'body';
  reach?: LimbId;
  /** Extra generated in-betweens on every moving segment. */
  inbetweens?: number;
  antic: PoseSpec[];
  hit: PoseSpec;
  hit2?: PoseSpec;
  follow: PoseSpec[];
  smear?: LimbId[];
  /** Play the strike segment on ones (very fast swings). */
  ones?: boolean;
}

function spread(total: number, n: number): number[] {
  const out: number[] = [];
  let left = total;
  for (let i = 0; i < n; i++) { const h = Math.max(1, Math.round(left / (n - i))); out.push(h); left -= h; }
  // the last drawing absorbs rounding so the sum is exact
  out[n - 1] += left;
  return out;
}

/** Blend two pose specs (missing channels take the other side's value). */
function mixPose(a: PoseSpec, b: PoseSpec, k: number): PoseSpec {
  const o: PoseSpec = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof PoseSpec>;
  for (const ch of keys) { const va = a[ch] ?? b[ch]!, vb = b[ch] ?? a[ch]!; o[ch] = va + (vb - va) * k; }
  return o;
}
/** Push a pose further along the motion that led into it (overshoot / tightened anticipation). */
function pushPose(from: PoseSpec, to: PoseSpec, k: number): PoseSpec {
  const o: PoseSpec = { ...to };
  for (const ch of Object.keys(to) as (keyof PoseSpec)[]) {
    if (ch === 'rootX' || ch === 'rootY' || ch === 'footA' || ch === 'footB' || ch === 'plant' || ch === 'liftA' || ch === 'liftB') continue;
    const f = from[ch];
    if (f === undefined) continue;
    o[ch] = to[ch]! + (to[ch]! - f) * k;
  }
  if (to.stretch !== undefined) o.stretch = 1 + (to.stretch - 1) * 0.8;
  return o;
}

/**
 * Revision pass 8 (A3 audit): every weapon attack gets at least a two-step
 * anticipation (a settle breakdown into the wind-up, plus a tightened extreme
 * on longer startups), an overshoot drawing straight after contact (the
 * follow-through), a smear on the striking limb and generated in-betweens on
 * heavy / launcher / spike moves. Holds are re-spread so the CONTACT drawing
 * still starts exactly on the first active frame.
 */
function refine(m: MoveDef, d: StrikeDrawings): StrikeDrawings {
  const base = d.base === 'air' ? AIRP : LOW;
  const antic = [...d.antic];
  if (m.startup >= 5 && antic.length < 2) antic.unshift(mixPose(base, antic[0], 0.5));
  if (m.startup >= 9 && antic.length < 3) antic.push(pushPose(antic[antic.length - 2] ?? base, antic[antic.length - 1], 0.15));
  const follow = [...d.follow];
  if (follow.length < 3) follow.unshift(pushPose(antic[antic.length - 1], d.hit2 ?? d.hit, 0.12));
  const strike = d.strike ?? 'arm';
  const smear = d.smear ?? (strike === 'leg' ? ['footA'] : strike === 'body' ? ['handA', 'handB'] : ['handA']) as LimbId[];
  const major = m.tags.includes('heavy') || m.tags.includes('launcher') || !!m.spike;
  return { ...d, antic, follow, smear, inbetweens: Math.max(d.inbetweens ?? 0, major ? 1 : 0) };
}

export function strikeAnim(id: string, m: MoveDef, d0: StrikeDrawings): AnimDef {
  const d = refine(m, d0);
  const drawings: DrawingSpec[] = [];
  const S = m.startup, A = m.active, R = m.recovery;
  const ah = spread(S, d.antic.length);
  d.antic.forEach((p, i) => drawings.push({ hold: ah[i], p, ...(i === d.antic.length - 1 && d.ones ? { ones: true } : {}) }));
  if (d.hit2) {
    const h1 = Math.max(1, Math.ceil(A / 2));
    drawings.push({ hold: h1, p: d.hit, impact: true, smear: d.smear });
    drawings.push({ hold: A - h1 > 0 ? A - h1 : 1, p: d.hit2, smear: d.smear });
  } else drawings.push({ hold: A, p: d.hit, impact: true, smear: d.smear });
  const used = drawings.reduce((s, x) => s + x.hold, 0);
  const fh = spread(Math.max(d.follow.length, S + A + R - used), d.follow.length);
  d.follow.forEach((p, i) => drawings.push({ hold: fh[i], p }));
  return drawn({ id, base: d.base ?? 'ground', strike: d.strike ?? 'arm', reach: d.reach, inbetweens: d.inbetweens, drawings, len: S + A + R });
}

/** Low fighting crouch (matches the Hand-Drawn idle). */
export const LOW: PoseSpec = { rootY: -30, lean: 0.46, head: -0.22, aU: 1.3, aL: 1.6, bU: 0.55, bL: 2.15, footA: 34, footB: -38, flex: -4 };
/** Air base pose for weapon air moves. */
export const AIRP: PoseSpec = { lean: 0.05, head: -0.05, laU: 0.9, laL: -1.5, lbU: 0.2, lbL: -1.1 };

/**
 * Pose templates for the third weapon batch: every move is drawn from one of
 * these (anticipation drawings, a committed contact pose, recovery), so a
 * dozen weapons share one consistent pose language. `a` tilts the strike arm.
 */
export type Tpl = 'jab' | 'slash' | 'overhead' | 'upper' | 'low' | 'spin' | 'throw' | 'shoot' | 'shootUp' | 'shootDown' | 'slam' | 'stomp'
  | 'air' | 'airDown' | 'airUp' | 'airShoot' | 'dash' | 'twirl';
const T: Record<Tpl, { base?: 'ground' | 'air'; strike?: 'arm' | 'leg' | 'body'; reach?: 'handA' | 'footA'; antic: PoseSpec[]; hit: PoseSpec; hit2?: PoseSpec; follow: PoseSpec[]; smear?: ('handA' | 'handB' | 'footA' | 'footB')[] }> = {
  jab: { reach: 'handA', smear: ['handA'], antic: [{ ...LOW, aU: 0.5, aL: 1.8, rootX: -6, lean: 0.1 }],
    hit: { ...LOW, lean: 0.85, rootX: 16, aU: 1.62, aL: 0.0, bU: -0.3, bL: 1.6, footA: 48, footB: -46, head: -0.3, stretch: 1.1 }, follow: [{ ...LOW, lean: 0.7, rootX: 12, aU: 1.5, aL: 0.4 }, LOW] },
  slash: { reach: 'handA', smear: ['handA', 'handB'], antic: [{ ...LOW, aU: 2.7, aL: 0.4, bU: 2.2, bL: 0.8, lean: 0.1, spin: -0.15 }],
    hit: { ...LOW, lean: 0.8, rootX: 14, aU: 1.1, aL: 0.0, bU: 0.6, bL: 0.6, footA: 48, footB: -44, head: -0.2, spin: 0.12, stretch: 1.08 }, follow: [{ ...LOW, lean: 0.7, aU: 0.6, aL: 0.3, bU: 0.3, bL: 0.8 }, LOW] },
  overhead: { reach: 'handA', smear: ['handA', 'handB'], antic: [{ ...LOW, rootY: -16, aU: 2.6, aL: 0.4, bU: 2.4, bL: 0.6, lean: -0.05 }, { rootY: 4, lean: -0.35, aU: 3.2, aL: 0.2, bU: 3.1, bL: 0.3, footA: 30, footB: -34, head: 0.25, flex: 8, stretch: 1.05 }],
    hit: { ...LOW, rootY: -56, lean: 1.0, aU: 0.7, aL: 0.0, bU: 0.55, bL: 0.1, footA: 56, footB: -48, head: 0.15, stretch: 1.12 }, follow: [{ ...LOW, rootY: -50, lean: 0.9, aU: 0.6, aL: 0.1 }, { ...LOW, rootY: -40, lean: 0.6 }, LOW] },
  upper: { strike: 'arm', reach: 'handA', smear: ['handA'], antic: [{ ...LOW, rootY: -50, lean: 0.8, aU: -0.3, aL: 1.4 }],
    hit: { rootY: 26, lean: -0.2, aU: 3.1, aL: 0.0, bU: 0.3, bL: 1.6, footA: 14, footB: -12, liftA: 10, liftB: 16, head: -0.5, stretch: 1.2 }, follow: [{ rootY: 10, lean: 0.0, aU: 2.6, aL: 0.5, footA: 20, footB: -16 }, LOW] },
  low: { strike: 'arm', reach: 'handA', smear: ['handA'], antic: [{ ...LOW, rootY: -40, aU: 0.2, aL: 1.4, spin: -0.2, lean: 0.4 }],
    hit: { ...LOW, rootY: -58, lean: 0.95, rootX: 14, aU: 0.75, aL: 0.0, bU: -0.6, bL: 1.0, footA: 58, footB: -44, head: 0.0, stretch: 1.08 }, follow: [{ ...LOW, rootY: -50, lean: 0.8, aU: 0.6, aL: 0.4 }, LOW] },
  spin: { strike: 'body', smear: ['handA', 'handB'], antic: [{ ...LOW, rootY: -44, aU: -1.0, aL: 0.3, bU: -1.2, bL: 0.4, spin: -0.2, flex: 6 }],
    hit: { ...LOW, rootY: -52, lean: 0.55, aU: 1.62, aL: 0.0, bU: 1.45, bL: 0.2, footA: 58, footB: -54, stretch: 1.08 }, hit2: { ...LOW, rootY: -52, lean: 0.3, aU: 0.8, aL: 0.0, bU: -0.7, bL: 0.2, footA: 58, footB: -54 },
    follow: [{ ...LOW, rootY: -46, lean: 0.3, aU: -0.8, aL: 0.3, bU: -1.1, bL: 0.4 }, LOW] },
  twirl: { strike: 'body', smear: ['handA', 'handB'], antic: [{ ...LOW, aU: 2.5, aL: 0.4, bU: 2.2, bL: 0.6 }],
    hit: { ...LOW, rootY: -18, aU: 3.0, aL: 0.1, bU: 2.4, bL: 0.6, lean: 0.12, head: -0.3 }, hit2: { ...LOW, rootY: -18, aU: 2.3, aL: 0.2, bU: 3.0, bL: 0.1, lean: 0.12, head: -0.3 }, follow: [{ ...LOW, aU: 2.6, aL: 0.4 }, LOW] },
  throw: { strike: 'arm', smear: ['handA'], antic: [{ ...LOW, lean: -0.1, aU: -1.2, aL: 0.4, spin: -0.35, rootX: -10, flex: 6, stretch: 0.94 }],
    hit: { ...LOW, lean: 0.8, rootX: 16, aU: 1.9, aL: 0.0, bU: 0.3, bL: 1.6, footA: 52, footB: -44, head: -0.3, spin: 0.15, stretch: 1.1 }, follow: [{ ...LOW, lean: 0.6, aU: 1.6, aL: 0.3 }, LOW] },
  shoot: { strike: 'arm', antic: [{ ...LOW, rootY: -24, aU: 1.2, aL: 0.8, bU: 1.0, bL: 1.0, lean: 0.25 }],
    hit: { ...LOW, rootY: -24, aU: 1.57, aL: 0.0, bU: 1.45, bL: 0.4, lean: 0.2, rootX: -6, head: -0.15, stretch: 1.04 }, follow: [{ ...LOW, rootY: -24, aU: 1.8, aL: 0.2, bU: 1.6, bL: 0.5, rootX: -8 }, LOW] },
  shootUp: { strike: 'arm', antic: [{ ...LOW, rootY: -30, aU: 2.2, aL: 0.8, lean: 0.2 }],
    hit: { ...LOW, rootY: -20, aU: 2.7, aL: 0.0, bU: 2.6, bL: 0.4, lean: 0.0, head: -0.45, stretch: 1.05 }, follow: [{ ...LOW, aU: 2.9, aL: 0.3 }, LOW] },
  shootDown: { strike: 'arm', antic: [{ ...LOW, rootY: -30, aU: 1.2, aL: 0.8, lean: 0.4 }],
    hit: { ...LOW, rootY: -40, aU: 0.85, aL: 0.0, bU: 0.75, bL: 0.4, lean: 0.6, head: 0.0, stretch: 1.04 }, follow: [{ ...LOW, rootY: -36, aU: 0.9, aL: 0.3 }, LOW] },
  slam: { strike: 'arm', smear: ['handA', 'handB'], antic: [{ ...LOW, rootY: -10, aU: 2.8, aL: 0.2, bU: 2.6, bL: 0.4 }, { rootY: 6, lean: -0.2, aU: 3.1, aL: 0.1, bU: 3.0, bL: 0.2, footA: 30, footB: -30, liftA: 12, head: -0.3 }],
    hit: { ...LOW, rootY: -58, lean: 0.95, aU: 0.5, aL: 0.0, bU: 0.4, bL: 0.2, footA: 54, footB: -48, head: 0.15, stretch: 1.1 }, follow: [{ ...LOW, rootY: -52, lean: 0.85, aU: 0.5, aL: 0.2 }, LOW] },
  stomp: { strike: 'leg', smear: ['footA'], antic: [{ ...LOW, rootY: 8, plant: 0.35, laU: 1.35, laL: -1.7, aU: 2.3, aL: 0.6, bU: 2.1, bL: 0.6, lean: -0.05 }],
    hit: { ...LOW, rootY: -36, lean: 0.45, aU: 0.55, aL: 0.5, bU: -0.55, bL: 0.6, footA: 40, footB: -26 }, follow: [{ ...LOW, rootY: -32, lean: 0.35 }, LOW] },
  dash: { strike: 'body', smear: ['handA'], antic: [{ ...LOW, rootY: -40, lean: 0.9, aU: -0.6, aL: 0.8, bU: -0.8, bL: 0.8 }],
    hit: { rootY: -28, lean: 1.2, rootX: 18, aU: 1.62, aL: 0.0, bU: -1.2, bL: 0.4, footA: 30, footB: -60, liftB: 20, head: -0.4, plant: 0.2, stretch: 1.12 }, follow: [{ ...LOW, rootY: -40, lean: 0.8, rootX: 10 }, LOW] },
  air: { base: 'air', reach: 'handA', smear: ['handA', 'handB'], antic: [{ ...AIRP, aU: 2.6, aL: 0.4, bU: 2.2, bL: 0.6, lean: -0.2, spin: -0.2 }],
    hit: { ...AIRP, aU: 1.3, aL: 0.0, bU: 0.9, bL: 0.4, lean: 0.4, spin: 0.2, laU: 1.2, laL: -1.6 }, follow: [{ ...AIRP, aU: 0.8, aL: 0.3, lean: 0.3 }] },
  airDown: { base: 'air', reach: 'handA', smear: ['handA', 'handB'], antic: [{ ...AIRP, aU: 3.0, aL: 0.2, bU: 2.9, bL: 0.3, lean: -0.3, laU: 1.8, laL: -2.2 }],
    hit: { ...AIRP, aU: 0.5, aL: 0.0, bU: 0.4, bL: 0.1, lean: 0.7, laU: 0.6, laL: -0.4, lbU: -0.3, lbL: -0.8, spin: 0.3, stretch: 1.12 }, follow: [{ ...AIRP, aU: 0.5, aL: 0.2, lean: 0.6 }, AIRP] },
  airUp: { base: 'air', strike: 'body', smear: ['handA'], antic: [{ ...AIRP, aU: 0.5, aL: 1.2, lean: 0.3, laU: 1.4, laL: -2.0 }],
    hit: { ...AIRP, aU: 3.05, aL: 0.0, bU: 2.4, bL: 0.6, lean: -0.15, laU: 0.4, laL: -0.4, head: -0.4, stretch: 1.1 }, follow: [{ ...AIRP, aU: 2.8, aL: 0.3 }] },
  airShoot: { base: 'air', strike: 'arm', antic: [{ ...AIRP, aU: 1.2, aL: 0.8 }], hit: { ...AIRP, aU: 1.57, aL: 0.0, bU: 1.45, bL: 0.4, lean: 0.15 }, follow: [AIRP] },
};

/** A move's drawings from a template; `x` patches the contact pose (e.g. aU to aim). */
export function tplAnim(id: string, m: MoveDef, tpl: Tpl, x: PoseSpec = {}, inbetweens = 0): AnimDef {
  const t = T[tpl];
  return strikeAnim(id, m, { base: t.base, strike: t.strike, reach: t.reach, smear: t.smear, antic: t.antic, hit: { ...t.hit, ...x }, hit2: t.hit2 && { ...t.hit2, ...x }, follow: t.follow, inbetweens });
}
