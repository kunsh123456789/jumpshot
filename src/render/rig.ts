import { clamp } from '../core/math';

/**
 * Procedural stickman rig.
 * A pose is a flat Float32Array of channels (angles in radians, offsets in
 * world units at scale 1) authored facing RIGHT:
 *  - arm/leg upper angles are ABSOLUTE from straight-down, positive = rotate
 *    toward facing (pi/2 = horizontal forward, pi = straight up).
 *  - lower (elbow/knee) angles are RELATIVE to the upper segment.
 *  - lean tilts the spine forward; spin rotates the whole body about the hip.
 *  - plant blends legs from FK to 2-bone IK feet planted at footA/footB,
 *    lifted liftA/liftB above the ground (used by the run cycle).
 */
export const Ch = {
  rootX: 0, rootY: 1, lean: 2, head: 3,
  aU: 4, aL: 5, bU: 6, bL: 7,        // arms: A = lead/front, B = rear
  laU: 8, laL: 9, lbU: 10, lbL: 11,  // legs
  spin: 12, plant: 13, footA: 14, footB: 15, flex: 16,
  liftA: 17, liftB: 18,
} as const;
export const POSE_N = 19;
export type ChName = keyof typeof Ch;
export type PoseSpec = Partial<Record<ChName, number>>;

/** Channels that are angles (blended along the shortest arc). Spin is excluded on purpose:
 *  it carries authored multi-turn rotations (flips) and is unwound on clip changes instead. */
export const IS_ANGLE: readonly boolean[] = (() => {
  const a = new Array<boolean>(POSE_N).fill(false);
  for (const c of [Ch.lean, Ch.head, Ch.aU, Ch.aL, Ch.bU, Ch.bL, Ch.laU, Ch.laL, Ch.lbU, Ch.lbL]) a[c] = true;
  return a;
})();

export const RIG = {
  hipH: 64, torso: 46, neck: 7, headR: 11.5,
  upperArm: 26, foreArm: 25, thigh: 35, shin: 35,
  /** Half shoulder / hip spread seen from the side, plus counter-rotation amounts. */
  shoulderHalf: 2.5, hipHalf: 2, shoulderTwist: 5, hipTwist: 3,
} as const;

// Joint indices into a Float32Array of (x, y) pairs.
export const J = {
  hip: 0, chest: 1, neck: 2, head: 3,
  elbA: 4, handA: 5, elbB: 6, handB: 7,
  kneeA: 8, footA: 9, kneeB: 10, footB: 11, spineC: 12,
  shA: 13, shB: 14, hipA: 15, hipB: 16,
} as const;
export const JOINT_N = 17;

export const STANCE: PoseSpec = {
  rootX: 0, rootY: -6, lean: 0.14, head: -0.06,
  aU: 0.95, aL: 1.9, bU: 0.45, bL: 2.15,
  laU: 0.25, laL: -0.4, lbU: -0.25, lbL: -0.3,
  spin: 0, plant: 1, footA: 18, footB: -19, flex: 0, liftA: 0, liftB: 0,
};

/** Build a pose array from a spec layered on top of a base spec. */
export function makePose(spec: PoseSpec, base: PoseSpec = STANCE): Float32Array {
  const p = new Float32Array(POSE_N);
  for (const k in Ch) {
    const key = k as ChName;
    p[Ch[key]] = spec[key] ?? base[key] ?? 0;
  }
  return p;
}

/** Shortest signed angular difference b - a in (-pi, pi]. */
export function shortDelta(a: number, b: number): number {
  let d = b - a;
  d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
  return d;
}

/** Arc preference: take the shortest path only when the direct path is this much longer (rad). */
const WRAP_PREFERENCE = 1.2;

/**
 * Joint-angle difference b - a along the natural path: the direct path between
 * authored values unless that is clearly the long way round (a real wraparound),
 * in which case the shortest arc. Limbs never spin the long way, and arms don't
 * flip over the back when the short arc is only marginally shorter.
 */
export function angDelta(a: number, b: number): number {
  const lin = b - a;
  const sh = shortDelta(a, b);
  return Math.abs(lin) - Math.abs(sh) > WRAP_PREFERENCE ? sh : lin;
}

/** Blend two poses; angle channels take the shortest arc. */
export function lerpPose(a: Float32Array, b: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < POSE_N; i++) {
    out[i] = IS_ANGLE[i] ? a[i] + angDelta(a[i], b[i]) * t : a[i] + (b[i] - a[i]) * t;
  }
}
export function copyPose(src: Float32Array, out: Float32Array): void {
  out.set(src);
}

/**
 * 2-bone IK. Writes mid joint and end joint at indices midJ / endJ.
 * bend in [-1, 1] chooses (and scales) which side the mid joint bends toward.
 */
export function ik2(
  out: Float32Array, rootJ: number, midJ: number, endJ: number,
  tx: number, ty: number, l1: number, l2: number, bend: number,
): void {
  const ax = out[rootJ * 2], ay = out[rootJ * 2 + 1];
  let dx = tx - ax, dy = ty - ay;
  let d = Math.sqrt(dx * dx + dy * dy);
  const maxD = l1 + l2 - 0.01;
  if (d < 0.001) { dx = 0; dy = 1; d = 0.001; }
  const dd = Math.min(d, maxD);
  const a = Math.atan2(dy, dx);
  const c = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1);
  const b = Math.acos(c);
  const ang = a + bend * b;
  out[midJ * 2] = ax + Math.cos(ang) * l1;
  out[midJ * 2 + 1] = ay + Math.sin(ang) * l1;
  out[endJ * 2] = ax + (dx / d) * dd;
  out[endJ * 2 + 1] = ay + (dy / d) * dd;
}

const tmpIK = new Float32Array(JOINT_N * 2);

/**
 * Forward kinematics from pose -> joints (world space, y down).
 * (bx, by) is the feet/base point, f = facing in [-1, 1] (fractional values
 * during an eased turn: the body rotates through the camera plane),
 * s = scale. Runs both in the sim tick and at render time on interpolated poses.
 */
export function computeJoints(
  p: Float32Array, bx: number, by: number, f: number, s: number, groundY: number,
  out: Float32Array,
): void {
  const hipX = bx + p[Ch.rootX] * f * s;
  const hipY = by - (RIG.hipH + p[Ch.rootY]) * s;
  const set = (j: number, x: number, y: number) => { out[j * 2] = x; out[j * 2 + 1] = y; };
  set(J.hip, hipX, hipY);

  const lean = p[Ch.lean];
  const sx = Math.sin(lean), cy = Math.cos(lean);
  const chestX = hipX + sx * RIG.torso * s * f;
  const chestY = hipY - cy * RIG.torso * s;
  set(J.chest, chestX, chestY);
  const flex = p[Ch.flex] * s;
  set(J.spineC, (hipX + chestX) / 2 - cy * flex * f, (hipY + chestY) / 2 - sx * flex);

  const ha = lean + p[Ch.head];
  const nX = chestX + Math.sin(ha) * RIG.neck * s * f;
  const nY = chestY - Math.cos(ha) * RIG.neck * s;
  set(J.neck, nX, nY);
  set(J.head, nX + Math.sin(ha) * RIG.headR * s * f, nY - Math.cos(ha) * RIG.headR * s);

  // Counter-rotation: when one arm reaches forward the shoulders turn into
  // the strike and the hips turn the opposite way.
  const twist = clamp((Math.sin(p[Ch.aU]) - Math.sin(p[Ch.bU])) * 0.45, -0.7, 0.7);
  const shBaseX = chestX - sx * 3 * s * f, shBaseY = chestY + 3 * s;
  set(J.shA, shBaseX + (RIG.shoulderHalf + RIG.shoulderTwist * twist) * s * f, shBaseY);
  set(J.shB, shBaseX + (-RIG.shoulderHalf + RIG.shoulderTwist * twist) * s * f, shBaseY);
  set(J.hipA, hipX + (RIG.hipHalf - RIG.hipTwist * twist) * s * f, hipY);
  set(J.hipB, hipX + (-RIG.hipHalf - RIG.hipTwist * twist) * s * f, hipY);

  limb(out, J.shA, J.elbA, J.handA, p[Ch.aU], p[Ch.aL], RIG.upperArm * s, RIG.foreArm * s, f);
  limb(out, J.shB, J.elbB, J.handB, p[Ch.bU], p[Ch.bL], RIG.upperArm * s, RIG.foreArm * s, f);
  limb(out, J.hipA, J.kneeA, J.footA, p[Ch.laU], p[Ch.laL], RIG.thigh * s, RIG.shin * s, f);
  limb(out, J.hipB, J.kneeB, J.footB, p[Ch.lbU], p[Ch.lbL], RIG.thigh * s, RIG.shin * s, f);

  // Legs IK (planted feet), blended by plant weight.
  const plant = p[Ch.plant];
  if (plant > 0.001) {
    tmpIK[J.hipA * 2] = out[J.hipA * 2]; tmpIK[J.hipA * 2 + 1] = out[J.hipA * 2 + 1];
    tmpIK[J.hipB * 2] = out[J.hipB * 2]; tmpIK[J.hipB * 2 + 1] = out[J.hipB * 2 + 1];
    const footY = Math.min(by, groundY);
    const bend = -f;
    ik2(tmpIK, J.hipA, J.kneeA, J.footA, bx + p[Ch.footA] * f * s, footY - p[Ch.liftA] * s, RIG.thigh * s, RIG.shin * s, bend);
    ik2(tmpIK, J.hipB, J.kneeB, J.footB, bx + p[Ch.footB] * f * s, footY - p[Ch.liftB] * s, RIG.thigh * s, RIG.shin * s, bend);
    for (let j = J.kneeA; j <= J.footB; j++) {
      out[j * 2] += (tmpIK[j * 2] - out[j * 2]) * plant;
      out[j * 2 + 1] += (tmpIK[j * 2 + 1] - out[j * 2 + 1]) * plant;
    }
  }

  // Whole-body spin about the hip (sign follows the facing direction).
  const spin = p[Ch.spin] * (f < 0 ? -1 : 1);
  if (spin !== 0) {
    const c = Math.cos(spin), sn = Math.sin(spin);
    for (let j = 1; j < JOINT_N; j++) {
      const dx = out[j * 2] - hipX, dy = out[j * 2 + 1] - hipY;
      out[j * 2] = hipX + dx * c - dy * sn;
      out[j * 2 + 1] = hipY + dx * sn + dy * c;
    }
  }
}

function limb(
  out: Float32Array, rootJ: number, midJ: number, endJ: number,
  up: number, low: number, l1: number, l2: number, f: number,
): void {
  const rx = out[rootJ * 2], ry = out[rootJ * 2 + 1];
  const mx = rx + Math.sin(up) * l1 * f;
  const my = ry + Math.cos(up) * l1;
  const a2 = up + low;
  out[midJ * 2] = mx; out[midJ * 2 + 1] = my;
  out[endJ * 2] = mx + Math.sin(a2) * l2 * f;
  out[endJ * 2 + 1] = my + Math.cos(a2) * l2;
}

/** Squash/stretch all joints about a pivot. */
export function squashJoints(out: Float32Array, px: number, py: number, sx: number, sy: number): void {
  if (sx === 1 && sy === 1) return;
  for (let j = 0; j < JOINT_N; j++) {
    out[j * 2] = px + (out[j * 2] - px) * sx;
    out[j * 2 + 1] = py + (out[j * 2 + 1] - py) * sy;
  }
}
