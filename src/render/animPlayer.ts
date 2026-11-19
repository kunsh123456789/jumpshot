import { ease } from '../core/math';
import { Ch, IS_ANGLE, POSE_N, angDelta } from './rig';
import type { AnimDef, EaseId, Key } from '../data/anims/types';
import { ANIM } from '../data/tuning';

const EASE: Record<EaseId, (t: number) => number> = {
  snapOut: ease.snapOut,
  snapIn: ease.snapIn,
  inOut: ease.inOutCubic,
  out: ease.outQuad,
  in: ease.inQuad,
  overshoot: ease.overshoot,
  hold: (t: number) => (t >= 1 ? 1 : 0),
};

/**
 * Staggered timing (hand-animated overlap): each channel group samples the
 * animation slightly AHEAD of (lead) or behind the clock. Hips lead, then the
 * torso, then the upper arms; the striking forearm/leg is exactly on time so
 * contact still lands on the authored frame; the head trails.
 */
const GROUP = new Int8Array(POSE_N); // 0 hips, 1 torso, 2 upper arm, 3 forearm, 4 legs, 5 head, 6 spin/stretch
for (const c of [Ch.rootX, Ch.rootY, Ch.plant, Ch.footA, Ch.footB, Ch.liftA, Ch.liftB]) GROUP[c] = 0;
for (const c of [Ch.lean, Ch.flex]) GROUP[c] = 1;
for (const c of [Ch.aU, Ch.bU]) GROUP[c] = 2;
for (const c of [Ch.aL, Ch.bL]) GROUP[c] = 3;
for (const c of [Ch.laU, Ch.laL, Ch.lbU, Ch.lbL]) GROUP[c] = 4;
GROUP[Ch.head] = 5;
GROUP[Ch.spin] = 6; GROUP[Ch.stretch] = 6;

export function leadFor(group: number, strike: AnimDef['strike']): number {
  switch (group) {
    case 0: return ANIM.leadHips;
    case 1: return ANIM.leadTorso;
    case 2: return strike === 'arm' ? ANIM.leadUpperArm : ANIM.leadTorso;
    case 3: return strike === 'arm' ? 0 : ANIM.leadUpperArm;
    case 4: return strike === 'leg' ? 0 : ANIM.leadHips;
    case 5: return -ANIM.lagHead;
    default: return 0;
  }
}

function seg(def: AnimDef, t: number): number {
  const ks = def.keys;
  let i = 0;
  while (i < ks.length - 1 && ks[i + 1].f <= t) i++;
  return i;
}

function sampleChannel(def: AnimDef, c: number, t: number): number {
  const ks = def.keys;
  if (ks.length === 1) return ks[0].pose[c];
  if (def.loop) {
    t = ((t % def.len) + def.len) % def.len;
  } else {
    if (t <= ks[0].f) return ks[0].pose[c];
    if (t >= ks[ks.length - 1].f) return ks[ks.length - 1].pose[c];
  }
  let a: Key, b: Key, span: number, local: number;
  const last = ks[ks.length - 1];
  if (def.loop && (t >= last.f || t < ks[0].f)) {
    // wrap segment: last key -> first key (+len)
    a = last; b = ks[0];
    span = def.len - last.f + ks[0].f;
    local = t >= last.f ? t - last.f : t + def.len - last.f;
  } else {
    const i = seg(def, t);
    a = ks[i]; b = ks[i + 1];
    span = b.f - a.f;
    local = t - a.f;
  }
  const k = span <= 0 ? 1 : EASE[a.hold ? 'hold' : b.e](Math.min(1, Math.max(0, local / span)));
  const va = a.pose[c], vb = b.pose[c];
  return IS_ANGLE[c] ? va + angDelta(va, vb) * k : va + (vb - va) * k;
}

/** Evaluate the pose at time t (frames, fractional ok), with staggered leads. */
export function evalAnim(def: AnimDef, t: number, out: Float32Array, stagger = true): void {
  for (let c = 0; c < POSE_N; c++) {
    let tc = t;
    if (stagger) {
      tc = t + leadFor(GROUP[c], def.strike);
      if (!def.loop) tc = Math.max(0, Math.min(def.len, tc));
    }
    out[c] = sampleChannel(def, c, tc);
  }
}

export interface AnimFlags { smear: number; trail: number; impact: boolean; reachW: number; snapping: boolean }

/** Flags active at time t (segment INTO the next key carries its smear/trail). */
export function animFlags(def: AnimDef, t: number, out: AnimFlags): void {
  out.smear = 0; out.trail = 0; out.impact = false; out.reachW = 0; out.snapping = false;
  const ks = def.keys;
  if (def.loop) t = ((t % def.len) + def.len) % def.len;
  for (let i = 1; i < ks.length; i++) {
    const a = ks[i - 1], b = ks[i];
    if (t >= a.f && t < b.f) {
      out.trail = b.trail | b.smear;
      out.snapping = b.e === 'snapIn' || b.e === 'snapOut' || b.e === 'hold' || a.hold || b.smear !== 0;
      break;
    }
  }
  // Smears only on the fastest frames: the last frame into a smear key and the key frame itself.
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    if (k.smear && t >= k.f - 1 && t < k.f + 1) { out.smear |= k.smear; out.snapping = true; }
  }
  if (def.contact >= 0) {
    const d = t - def.contact;
    out.impact = d >= -0.5 && d < 1.5;
    if (def.reach) out.reachW = d < -2 ? 0 : d < 0 ? 1 + d / 2 : d < 2 ? 1 : d < 5 ? 1 - (d - 2) / 3 : 0;
  }
}

/** Which keys were crossed between t0 and t1 (for sfx). Returns the key or null. */
export function crossedKey(def: AnimDef, t0: number, t1: number): Key | null {
  if (t1 <= t0) return null;
  for (const k of def.keys) {
    if (!k.sfx) continue;
    let kf = k.f;
    if (def.loop) {
      const base = Math.floor(t0 / def.len) * def.len;
      kf += base; if (kf <= t0) kf += def.len;
    }
    if (kf > t0 && kf <= t1) return k;
  }
  return null;
}
