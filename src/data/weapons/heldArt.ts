import { J } from '../../render/rig';

/** Small drawing helpers for held weapons (third batch). All take the hero's joint array. */
const out4 = new Float32Array(4);

/** Lead hand position and the forearm direction (unit): [hx, hy, dx, dy]. */
export function forearm(j: Float32Array, hand: number = J.handA, elbow: number = J.elbA): Float32Array {
  const hx = j[hand * 2], hy = j[hand * 2 + 1];
  let dx = hx - j[elbow * 2], dy = hy - j[elbow * 2 + 1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  out4[0] = hx; out4[1] = hy; out4[2] = dx; out4[3] = dy;
  return out4;
}

/** A pole held in both hands: [grip x, grip y, tip x, tip y, butt x, butt y] (like the staff). */
export function pole(j: Float32Array, len: number, front: number, out: Float32Array): void {
  const ax = j[J.handA * 2], ay = j[J.handA * 2 + 1], bx = j[J.handB * 2], by = j[J.handB * 2 + 1];
  let dx = ax - bx, dy = ay - by;
  let L = Math.hypot(dx, dy);
  if (L < 6) { dx = ax - j[J.elbA * 2]; dy = ay - j[J.elbA * 2 + 1]; L = Math.hypot(dx, dy) || 1; }
  dx /= L; dy /= L;
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  out[0] = cx; out[1] = cy;
  out[2] = cx + dx * len * front; out[3] = cy + dy * len * front;
  if (out.length >= 6) { out[4] = cx - dx * len * (1 - front); out[5] = cy - dy * len * (1 - front); }
}

export function stroke(ctx: CanvasRenderingContext2D, col: string, w: number): void { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
