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

// ======================================================================= Hand-Drawn drawing schedule
/**
 * One drawing in a Hand-Drawn schedule: an authored key, a generated
 * in-between (pose = key a -> key a+1 at param s), or a full-rate ("ones")
 * segment. seg: 0 other, 1 anticipation, 2 strike (into contact), 3 follow-through.
 */
export interface Drawing { t: number; kind: 0 | 1 | 2; a: number; s: number; stretch: number; seg: number; fast: boolean }

/** Current Hand-Drawn smoothness (set from settings by drawStyle). */
export const SMOOTH = { level: 1, bonus: 1, strikeOnes: false };

/** What the last evalAnimStepped call drew (for the animator's smear logic). */
export const lastDrawing = { kind: 0, key: 0, seg: 0, fast: false, idx: 0 };

function samePose(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-3) return false;
  return true;
}

/** Ease biased toward the extremes: in-betweens bunch up near the keys, fast through the middle. */
const nearKeys = (u: number) => u * u * (3 - 2 * u);
/** Strike: accelerate out of the anticipation into the hit. */
const accel = (u: number) => Math.pow(u, 1.7);
/** Follow-through: overshoot past the follow pose, then settle onto it. */
const overshoot = (u: number) => { const c1 = 1.4, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; };

/**
 * Build the drawing schedule: every authored key is a drawing; moving
 * segments of attack-like animations get generated in-betweens (authored
 * `inbetween` + per-animation `inbetweens` + the Attack Smoothness bonus),
 * never more than one per tick and never touching a contact key's start, so
 * the contact drawing lands on its exact frame. Segments next to authored
 * breakdowns get none.
 */
export function buildSchedule(def: AnimDef, bonusIn: number, strikeOnes: boolean, attackish: boolean): Drawing[] {
  const ks = def.keys, n = ks.length, out: Drawing[] = [];
  const C = def.contact;
  const bonus = attackish ? bonusIn + (def.spec.inbetweens ?? 0) : 0;
  let followDone = false;
  for (let i = 0; i < n; i++) {
    const k = ks[i];
    const last = i === n - 1;
    out.push({ t: k.f, kind: 0, a: i, s: 0, stretch: 1, seg: 0, fast: false });
    if (last && !def.loop) break;
    const nk = last ? ks[0] : ks[i + 1];
    const nf = last ? def.len + ks[0].f : nk.f;
    const span = nf - k.f;
    if (span < 2 || samePose(k.pose, nk.pose)) continue;
    let seg = 0;
    if (C >= 0) {
      if (nk.impact) seg = 2;
      else if (k.f < C) seg = 1;
      else if (!followDone) { seg = 3; followDone = true; }
    }
    if (k.ones) { out.push({ t: k.f + 1, kind: 2, a: i, s: 0, stretch: 1, seg, fast: seg === 2 }); continue; }
    if (k.breakdown || nk.breakdown) continue;
    let m = k.inb + (seg === 0 && C >= 0 ? 0 : bonus);
    if (seg === 2 && strikeOnes && bonus > 0) { out.push({ t: k.f + 1, kind: 2, a: i, s: 0, stretch: 1, seg, fast: true }); continue; }
    m = Math.min(m, span - 1);
    for (let j = 1; j <= m; j++) {
      const u = j / (m + 1);
      const s = seg === 2 ? accel(u) : seg === 3 ? overshoot(u) : nearKeys(u);
      const fast = seg === 2 && j === m;
      out.push({ t: k.f + Math.round(span * u), kind: 1, a: i, s, stretch: fast ? 1.08 : 1, seg, fast });
    }
  }
  // de-dup equal times (short spans), keep the later (more advanced) drawing
  const ded: Drawing[] = [];
  for (const d of out) { if (ded.length && ded[ded.length - 1].t === d.t && d.kind !== 0) continue; if (ded.length && ded[ded.length - 1].t === d.t) ded.pop(); ded.push(d); }
  return ded;
}

let schedAttackish: (def: AnimDef) => boolean = (def) => def.contact >= 0;
/** Set by drawStyle: which animations get attack in-betweens. */
export function setAttackish(fn: (def: AnimDef) => boolean): void { schedAttackish = fn; }

export function scheduleFor(def: AnimDef): Drawing[] {
  const lv = SMOOTH.level;
  if (!def.sched) def.sched = [];
  let sc = def.sched[lv] as Drawing[] | undefined;
  if (!sc) { sc = buildSchedule(def, SMOOTH.bonus, SMOOTH.strikeOnes, schedAttackish(def)); def.sched[lv] = sc; }
  return sc;
}

const ibA = new Float32Array(32);
/**
 * Hand-Drawn playback: the drawing on screen at time t (no interpolation
 * between drawings; generated in-betweens are drawings too). Returns an id
 * that changes exactly when the drawing does.
 */
export function evalAnimStepped(def: AnimDef, t: number, out: Float32Array): number {
  const ks = def.keys;
  if (ks.length === 1) { out.set(ks[0].pose); lastDrawing.kind = 0; lastDrawing.key = 0; lastDrawing.seg = 0; lastDrawing.fast = false; lastDrawing.idx = 0; return 0; }
  const sc = scheduleFor(def);
  let tt = t;
  if (def.loop) tt = ((t % def.len) + def.len) % def.len;
  let lo = 0, hi = sc.length - 1;
  if (tt < sc[0].t) lo = def.loop ? sc.length - 1 : 0;
  else {
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sc[m].t <= tt) lo = m; else hi = m - 1; }
  }
  const d = sc[lo];
  lastDrawing.kind = d.kind; lastDrawing.key = d.a; lastDrawing.seg = d.seg; lastDrawing.fast = d.fast; lastDrawing.idx = lo;
  if (d.kind === 0) { out.set(ks[d.a].pose); return lo * 64; }
  if (d.kind === 2) {
    evalAnim(def, t, out, false);
    return lo * 64 + 1 + Math.min(62, Math.max(0, Math.floor(tt - d.t)));
  }
  const A = ks[d.a].pose, B = ks[(d.a + 1) % ks.length].pose;
  for (let c = 0; c < POSE_N; c++) {
    const va = A[c], vb = B[c];
    ibA[c] = IS_ANGLE[c] ? va + angDelta(va, vb) * d.s : va + (vb - va) * d.s;
  }
  ibA[Ch.stretch] *= d.stretch;
  for (let c = 0; c < POSE_N; c++) out[c] = ibA[c];
  return lo * 64;
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
