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

export function strikeAnim(id: string, m: MoveDef, d: StrikeDrawings): AnimDef {
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
