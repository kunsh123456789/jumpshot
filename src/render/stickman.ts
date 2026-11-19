import { Ch, J, JOINT_N, POSE_N, computeJoints, ik2, lerpPose } from './rig';
import { SCARF_N, TRAIL_CAP } from './animator';
import type { Fighter } from '../sim/fighter';
import { TAU } from '../core/math';
import { ANIM, WORLD } from '../data/tuning';
import { settings } from '../core/settings';
import { effects } from './effects';
import { LIMB_BIT } from '../data/anims/types';

const jt = new Float32Array(JOINT_N * 2);
const pp = new Float32Array(POSE_N);
const sp = new Float32Array(POSE_N);
const sj = new Float32Array(JOINT_N * 2);
const sc = new Float32Array(SCARF_N * 2);
const shadeCache = new Map<string, string>();

export function shade(hex: string, k: number): string {
  const key = hex + k;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  v = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
  shadeCache.set(key, v);
  return v;
}

/**
 * Render-time skeleton: interpolate the authored pose between the last two
 * sim ticks (angles on the natural arc), run FK with the fighter's rig, then
 * IK the striking limb onto the target around contact.
 */
export function interpJoints(f: Fighter, alpha: number, time: number): Float32Array {
  const a = f.anim;
  lerpPose(a.prevPose, a.pose, alpha, pp);
  const bx = f.px + (f.x - f.px) * alpha;
  const by = f.py + (f.y - f.py) * alpha;
  const face = a.prevFace + (a.face - a.prevFace) * alpha;
  computeJoints(pp, bx, by, face, f.scale, WORLD.groundY, jt, a.rig);
  applyReach(f, alpha, face, jt);
  const victim = f.hitstop > 0 && (f.team === 'enemy' || f.state === 'hurt') && f.state !== 'dead';
  if (victim) {
    const v = Math.sin(time * TAU * ANIM.hitstopShakeHz) * ANIM.hitstopShakeAmp;
    const ox = v * (f.hitDirX || 1), oy = v * 0.4 * f.hitDirY;
    for (let i = 0; i < JOINT_N; i++) { jt[i * 2] += ox; jt[i * 2 + 1] += oy; }
  }
  return jt;
}

/** 2-bone IK of the striking limb onto the target at contact (after the authored pose). */
function applyReach(f: Fighter, alpha: number, face: number, out: Float32Array): void {
  const a = f.anim;
  const w = a.prevReachW + (a.reachW - a.prevReachW) * alpha;
  if (w <= 0.01 || !a.reachLimb || !f.hasLook) return;
  const R = a.rig, s = f.scale;
  let root: number, mid: number, end: number, l1: number, l2: number, bend: number;
  const limb = a.reachLimb;
  if (limb === LIMB_BIT.handA) { root = J.shA; mid = J.elbA; end = J.handA; l1 = R.upperArm; l2 = R.foreArm; bend = Math.sign(face) || 1; }
  else if (limb === LIMB_BIT.handB) { root = J.shB; mid = J.elbB; end = J.handB; l1 = R.upperArm; l2 = R.foreArm; bend = Math.sign(face) || 1; }
  else if (limb === LIMB_BIT.footA) { root = J.hipA; mid = J.kneeA; end = J.footA; l1 = R.thigh; l2 = R.shin; bend = -(Math.sign(face) || 1); }
  else { root = J.hipB; mid = J.kneeB; end = J.footB; l1 = R.thigh; l2 = R.shin; bend = -(Math.sign(face) || 1); }
  const st = (pp[Ch.stretch] || 1) * s;
  l1 *= st; l2 *= st;
  // aim at the near surface of the target, only if roughly within reach
  const rx = out[root * 2], ry = out[root * 2 + 1];
  // aim at the target's near surface, not its center
  let tx = f.lookX - Math.sign(face || 1) * 14 * s, ty = f.lookY + 30 * s;
  const dx = tx - rx, dy = ty - ry, d = Math.hypot(dx, dy);
  if (d > (l1 + l2) * 1.25 || d < 1) return;
  const inset = Math.min(d, (l1 + l2) * 0.98);
  tx = rx + (dx / d) * inset; ty = ry + (dy / d) * inset;
  const mx = out[mid * 2], my = out[mid * 2 + 1], ex = out[end * 2], ey = out[end * 2 + 1];
  ik2(out, root, mid, end, tx, ty, l1, l2, bend);
  const k = Math.min(1, w) * 0.85;
  out[mid * 2] = mx + (out[mid * 2] - mx) * k; out[mid * 2 + 1] = my + (out[mid * 2 + 1] - my) * k;
  out[end * 2] = ex + (out[end * 2] - ex) * k; out[end * 2 + 1] = ey + (out[end * 2 + 1] - ey) * k;
}

export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number): void {
  const x = f.px + (f.x - f.px) * alpha;
  const y = f.py + (f.y - f.py) * alpha;
  const h = Math.max(0, WORLD.groundY - y);
  const k = Math.max(0.25, 1 - h / 500);
  const w = 30 * f.scale * k;
  ctx.globalAlpha = 0.4 * k;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, WORLD.groundY + 2, w, w * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (f.team === 'enemy' && f.alive && (f.hasToken || f.state === 'windup')) {
    const pulse = f.state === 'windup' ? 0.6 + 0.4 * Math.sin(time * 30) : 0.45;
    ctx.strokeStyle = f.state === 'windup' ? '#ff2a2a' : '#ff6a5a';
    ctx.globalAlpha = pulse;
    ctx.lineWidth = f.state === 'windup' ? 4 : 2;
    ctx.beginPath();
    ctx.ellipse(x, WORLD.groundY + 2, w * 1.4 + 6, (w * 1.4 + 6) * 0.24, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function seg(ctx: CanvasRenderingContext2D, j: Float32Array, a: number, b: number): void {
  ctx.moveTo(j[a * 2], j[a * 2 + 1]);
  ctx.lineTo(j[b * 2], j[b * 2 + 1]);
}
/** The whole figure as one path: torso curve, shoulders/hips, all four limbs. */
function body(ctx: CanvasRenderingContext2D, j: Float32Array): void {
  ctx.moveTo(j[J.hip * 2], j[J.hip * 2 + 1]);
  ctx.quadraticCurveTo(j[J.spineC * 2], j[J.spineC * 2 + 1], j[J.chest * 2], j[J.chest * 2 + 1]);
  ctx.lineTo(j[J.neck * 2], j[J.neck * 2 + 1]);
  seg(ctx, j, J.chest, J.shB); seg(ctx, j, J.shB, J.elbB); ctx.lineTo(j[J.handB * 2], j[J.handB * 2 + 1]);
  seg(ctx, j, J.hip, J.hipB); seg(ctx, j, J.hipB, J.kneeB); ctx.lineTo(j[J.footB * 2], j[J.footB * 2 + 1]);
  seg(ctx, j, J.hip, J.hipA); seg(ctx, j, J.hipA, J.kneeA); ctx.lineTo(j[J.footA * 2], j[J.footA * 2 + 1]);
  seg(ctx, j, J.chest, J.shA); seg(ctx, j, J.shA, J.elbA); ctx.lineTo(j[J.handA * 2], j[J.handA * 2 + 1]);
}

/** Draw a fighter: reflection, scarf, smears, then the figure in one color with round caps. */
export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, dt: number): void {
  interpJoints(f, alpha, time);
  const a = f.anim;
  if (a.trailActive) a.pushTrail(jt[a.trailJoint * 2], jt[a.trailJoint * 2 + 1], time);
  if (a.ghostTime > 0) {
    a.ghostTime -= dt;
    a.ghostAcc += dt;
    if (a.ghostAcc >= ANIM.ghostInterval) {
      a.ghostAcc = 0;
      effects.afterimage(jt, f.team === 'player' ? '#9fe8ff' : f.color, f.thickness * ANIM.lineScale, f.scale);
    }
  }
  const s = f.scale;
  const w = f.thickness * s * ANIM.lineScale;
  const headR = a.rig.headR * s;
  const hx = jt[J.head * 2], hy = jt[J.head * 2 + 1];
  const face = a.prevFace + (a.face - a.prevFace) * alpha;
  const flashing = f.flash > 0 && !(settings.reduceFlashes && f.team === 'player');
  let fade = 1;
  if (f.state === 'dead') fade = Math.max(0, 1 - (f.deadTimer + alpha) / 36);
  if (f.team === 'player' && f.invuln > 0 && f.state !== 'dodge' && f.state !== 'move') fade = 0.6 + 0.35 * Math.cos(time * 40);
  const col = flashing ? '#ffffff' : f.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Ground reflection (faint, squashed, fades with height).
  const by = f.py + (f.y - f.py) * alpha;
  const hk = Math.max(0, 1 - (WORLD.groundY - by) / 220);
  if (hk > 0.02) {
    const G = WORLD.groundY, q = ANIM.reflectSquash;
    for (let i = 0; i < JOINT_N; i++) sj[i * 2] = jt[i * 2], sj[i * 2 + 1] = G + (G - jt[i * 2 + 1]) * q;
    ctx.globalAlpha = ANIM.reflectAlpha * hk * fade;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = w * 0.8;
    ctx.beginPath(); body(ctx, sj); ctx.stroke();
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.ellipse(sj[J.head * 2], sj[J.head * 2 + 1], headR, headR * q, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = fade;

  // Scarf ribbon (behind the body).
  if (a.hasScarf && a.scarfInit) {
    for (let i = 0; i < SCARF_N * 2; i++) sc[i] = a.scarfPrev[i] + (a.scarf[i] - a.scarfPrev[i]) * alpha;
    sc[0] = hx - face * 7 * s; sc[1] = hy - 2 * s;
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 5 * s;
    strokeScarf(ctx);
  }

  // Telegraph glow (enemy wind-up): readability over style here.
  if (f.state === 'windup' || f.telegraph > 0) {
    const p = 0.4 + 0.35 * Math.sin(time * 40);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p * fade;
    ctx.strokeStyle = '#ff2020';
    ctx.lineWidth = w + 14 * s;
    ctx.beginPath(); body(ctx, jt); ctx.stroke();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(hx, hy, headR + 7 * s, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
  }
  if (f.team === 'player' && f.telegraph < 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * fade;
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = w + 10;
    ctx.beginPath(); body(ctx, jt); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
  }

  // Smears on the fastest frames: the swept area of the limb.
  if (a.smear) drawSmears(ctx, f, alpha, col, w, fade);

  // The figure: one color, uniform round-cap lines, no outline.
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); body(ctx, jt); ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
  // hip joint
  ctx.beginPath(); ctx.arc(jt[J.hip * 2], jt[J.hip * 2 + 1], w * 0.62, 0, TAU); ctx.fill();

  // Minimal details.
  if (f.team === 'player') {
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.arc(hx, hy, headR * 0.82, -Math.PI * 0.92, -Math.PI * 0.08);
    ctx.stroke();
  } else {
    ctx.fillStyle = flashing ? '#fff' : '#06070d';
    ctx.beginPath();
    ctx.arc(hx + face * headR * 0.45, hy - headR * 0.1, Math.max(1.6, headR * 0.15), 0, TAU);
    ctx.fill();
    if (f.kind === 'boss') {
      ctx.strokeStyle = flashing ? '#fff' : f.accent;
      ctx.lineWidth = 4 * s * 0.6;
      ctx.beginPath();
      ctx.moveTo(hx - headR * 0.6, hy - headR * 0.7); ctx.lineTo(hx - headR * 0.9, hy - headR * 1.6);
      ctx.moveTo(hx + headR * 0.6, hy - headR * 0.7); ctx.lineTo(hx + headR * 0.9, hy - headR * 1.6);
      ctx.stroke();
    } else if (f.kind === 'elite') {
      ctx.strokeStyle = f.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx, hy, headR * 0.82, -Math.PI * 0.92, -Math.PI * 0.08); ctx.stroke();
    }
  }
  if (f.kind === 'shield' && f.guardBroken <= 0 && f.alive) {
    const sx = jt[J.handA * 2] + face * 4, sy = jt[J.handA * 2 + 1];
    ctx.fillStyle = f.blockFlash > 0 ? '#ffffff' : '#9fb8ff';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6, 8 * Math.max(0.3, Math.abs(face)), 34, 0, 0, TAU);
    ctx.fill();
  }
  if (f.state === 'stunned' || f.dizzy > 0) {
    ctx.fillStyle = '#ffe14a';
    for (let i = 0; i < 3; i++) {
      const ang = time * 6 + (i * TAU) / 3;
      const px = hx + Math.cos(ang) * headR * 1.6, py = hy - headR * 1.4 + Math.sin(ang) * headR * 0.4;
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Smear scratch: up to 9 samples of (end, mid) positions.
const SM = 9;
const sEx = new Float32Array(SM), sEy = new Float32Array(SM), sMx = new Float32Array(SM), sMy = new Float32Array(SM);
const LIMB_J: [number, number, number][] = [[1, J.handA, J.elbA], [2, J.handB, J.elbB], [4, J.footA, J.kneeA], [8, J.footB, J.kneeB]];

/**
 * Smear frame: sample the skeleton between the pose two ticks ago and now,
 * and fill the area swept by the limb (end joint = outer edge, mid joint =
 * inner edge) as a tapered crescent, opaque near the limb and fading behind.
 */
function drawSmears(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, col: string, w: number, fade: number): void {
  const a = f.anim;
  const n = Math.min(SM, ANIM.smearSamples + 1);
  const bx1 = f.px + (f.x - f.px) * alpha, by1 = f.py + (f.y - f.py) * alpha;
  // Body-local smear: only the limb's own swing, never the body's translation.
  const bx0 = bx1, by0 = by1;
  for (const [bit, endJ, midJ] of LIMB_J) {
    if (!(a.smear & bit)) continue;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      lerpPose(a.prev2Pose, pp, k, sp);
      computeJoints(sp, bx0 + (bx1 - bx0) * k, by0 + (by1 - by0) * k, a.face, f.scale, WORLD.groundY, sj, a.rig);
      sEx[i] = sj[endJ * 2]; sEy[i] = sj[endJ * 2 + 1];
      sMx[i] = sj[midJ * 2]; sMy[i] = sj[midJ * 2 + 1];
    }
    // snap the newest sample onto the drawn limb (includes IK reach)
    sEx[n - 1] = jt[endJ * 2]; sEy[n - 1] = jt[endJ * 2 + 1]; sMx[n - 1] = jt[midJ * 2]; sMy[n - 1] = jt[midJ * 2 + 1];
    ctx.fillStyle = col;
    for (let pass = 0; pass < 2; pass++) {
      const from = pass === 0 ? 0 : Math.floor((n - 1) / 2);
      ctx.globalAlpha = (pass === 0 ? ANIM.smearTailAlpha : ANIM.smearAlpha) * fade;
      ctx.beginPath();
      ctx.moveTo(sEx[from], sEy[from]);
      for (let i = from + 1; i < n; i++) ctx.lineTo(sEx[i], sEy[i]);
      for (let i = n - 1; i >= from; i--) ctx.lineTo(sMx[i], sMy[i]);
      ctx.closePath();
      ctx.fill();
    }
    // a thick rounded leading edge sells the speed
    ctx.globalAlpha = ANIM.smearAlpha * fade;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * 1.15;
    ctx.beginPath();
    ctx.moveTo(sEx[Math.floor(n / 2)], sEy[Math.floor(n / 2)]);
    for (let i = Math.floor(n / 2) + 1; i < n; i++) ctx.lineTo(sEx[i], sEy[i]);
    ctx.stroke();
  }
  ctx.globalAlpha = fade;
}

function strokeScarf(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(sc[0], sc[1]);
  for (let i = 1; i < SCARF_N - 1; i++) {
    const mx = (sc[i * 2] + sc[(i + 1) * 2]) / 2, my = (sc[i * 2 + 1] + sc[(i + 1) * 2 + 1]) / 2;
    ctx.quadraticCurveTo(sc[i * 2], sc[i * 2 + 1], mx, my);
  }
  ctx.lineTo(sc[(SCARF_N - 1) * 2], sc[(SCARF_N - 1) * 2 + 1]);
  ctx.stroke();
}

// Scratch buffers for the trail ribbon.
const RB = TRAIL_CAP * 3;
const rx = new Float32Array(RB), ry = new Float32Array(RB), rk = new Float32Array(RB);
const lx = new Float32Array(RB), ly = new Float32Array(RB), qx = new Float32Array(RB), qy = new Float32Array(RB);
const gatherX = new Float32Array(TRAIL_CAP), gatherY = new Float32Array(TRAIL_CAP), gatherK = new Float32Array(TRAIL_CAP);

/** Short tapered glow ribbon behind the striking limb (render-rate samples, Catmull-Rom). */
export function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter, time: number): void {
  const a = f.anim;
  const life = ANIM.trailLife;
  let n = 0;
  for (let i = a.trailCount - 1; i >= 0; i--) {
    const idx = (a.trailHead - 1 - i + TRAIL_CAP * 2) % TRAIL_CAP;
    const age = time - a.trailT[idx];
    if (age < 0 || age > life) continue;
    gatherX[n] = a.trailX[idx]; gatherY[n] = a.trailY[idx]; gatherK[n] = 1 - age / life; n++;
  }
  if (n < 2) return;
  let m = 0;
  for (let i = 0; i < n - 1; i++) {
    const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
    for (let s = 0; s < 3; s++) {
      const t = s / 3, t2 = t * t, t3 = t2 * t;
      const c0 = -0.5 * t3 + t2 - 0.5 * t, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * t, c3 = 0.5 * t3 - 0.5 * t2;
      rx[m] = gatherX[i0] * c0 + gatherX[i] * c1 + gatherX[i + 1] * c2 + gatherX[i3] * c3;
      ry[m] = gatherY[i0] * c0 + gatherY[i] * c1 + gatherY[i + 1] * c2 + gatherY[i3] * c3;
      rk[m] = gatherK[i] + (gatherK[i + 1] - gatherK[i]) * t;
      m++;
    }
  }
  rx[m] = gatherX[n - 1]; ry[m] = gatherY[n - 1]; rk[m] = gatherK[n - 1]; m++;
  for (let i = 0; i < m; i++) {
    const j0 = Math.max(0, i - 1), j1 = Math.min(m - 1, i + 1);
    let dx = rx[j1] - rx[j0], dy = ry[j1] - ry[j0];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    const hw = a.trailWidth * (0.15 + 0.95 * rk[i] * rk[i]) * 0.5;
    lx[i] = rx[i] - dy * hw; ly[i] = ry[i] + dx * hw;
    qx[i] = rx[i] + dy * hw; qy[i] = ry[i] - dx * hw;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = a.trailColor;
  for (let i = 0; i < m - 1; i++) {
    const k = (rk[i] + rk[i + 1]) * 0.5;
    ctx.globalAlpha = k * k * 0.45;
    ctx.beginPath();
    ctx.moveTo(lx[i], ly[i]); ctx.lineTo(lx[i + 1], ly[i + 1]); ctx.lineTo(qx[i + 1], qy[i + 1]); ctx.lineTo(qx[i], qy[i]);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
