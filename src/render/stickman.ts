import { J, JOINT_N, POSE_N, RIG, computeJoints, lerpPose, squashJoints } from './rig';
import { SCARF_N, TRAIL_CAP } from './animator';
import type { Fighter } from '../sim/fighter';
import { TAU } from '../core/math';
import { ANIM, WORLD } from '../data/tuning';
import { settings } from '../core/settings';
import { effects } from './effects';

const jt = new Float32Array(JOINT_N * 2);
const pp = new Float32Array(POSE_N);
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
 * Render-time skeleton: interpolate the pose CHANNELS (angles along the
 * shortest arc), the feet position, the facing turn and the squash between
 * the last two sim ticks, then run FK. Limbs therefore sweep along true arcs
 * at any refresh rate. Hit-stop victims get a smooth high-frequency vibration.
 */
export function interpJoints(f: Fighter, alpha: number, time: number): Float32Array {
  const a = f.anim;
  lerpPose(a.prevPose, a.pose, alpha, pp);
  const bx = f.px + (f.x - f.px) * alpha;
  const by = f.py + (f.y - f.py) * alpha;
  const face = a.prevFace + (a.face - a.prevFace) * alpha;
  computeJoints(pp, bx, by, face, f.scale, WORLD.groundY, jt);
  const sqx = a.prevSqX + (a.sqX - a.prevSqX) * alpha;
  const sqy = a.prevSqY + (a.sqY - a.prevSqY) * alpha;
  const airborne = by < WORLD.groundY - 2;
  squashJoints(jt, airborne ? jt[J.hip * 2] : bx, airborne ? jt[J.hip * 2 + 1] : by, sqx, sqy);
  const victim = f.hitstop > 0 && (f.team === 'enemy' || f.state === 'hurt') && f.state !== 'dead';
  if (victim) {
    const v = Math.sin(time * TAU * ANIM.hitstopShakeHz) * ANIM.hitstopShakeAmp;
    const ox = v * (f.hitDirX || 1), oy = v * 0.4 * f.hitDirY;
    for (let i = 0; i < JOINT_N; i++) { jt[i * 2] += ox; jt[i * 2 + 1] += oy; }
  }
  return jt;
}

export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number): void {
  const x = f.px + (f.x - f.px) * alpha;
  const y = f.py + (f.y - f.py) * alpha;
  const h = Math.max(0, WORLD.groundY - y);
  const k = Math.max(0.25, 1 - h / 500);
  const w = 34 * f.scale * k;
  ctx.globalAlpha = 0.45 * k;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, WORLD.groundY + 2, w, w * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (f.team === 'enemy' && f.alive && (f.hasToken || f.state === 'windup')) {
    const pulse = f.state === 'windup' ? 0.6 + 0.4 * Math.sin(time * 30) : 0.45;
    ctx.strokeStyle = f.state === 'windup' ? '#ff2a2a' : '#ff6a5a';
    ctx.globalAlpha = pulse;
    ctx.lineWidth = f.state === 'windup' ? 4 : 2;
    ctx.beginPath();
    ctx.ellipse(x, WORLD.groundY + 2, w * 1.35 + 6, (w * 1.35 + 6) * 0.26, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (f.team === 'player') {
    ctx.strokeStyle = '#7fe8ff';
    ctx.globalAlpha = 0.35 * k;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, WORLD.groundY + 2, w * 1.3 + 4, (w * 1.3 + 4) * 0.26, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function seg(ctx: CanvasRenderingContext2D, a: number, b: number): void {
  ctx.moveTo(jt[a * 2], jt[a * 2 + 1]);
  ctx.lineTo(jt[b * 2], jt[b * 2 + 1]);
}
function torso(ctx: CanvasRenderingContext2D): void {
  ctx.moveTo(jt[J.hip * 2], jt[J.hip * 2 + 1]);
  ctx.quadraticCurveTo(jt[J.spineC * 2], jt[J.spineC * 2 + 1], jt[J.chest * 2], jt[J.chest * 2 + 1]);
  ctx.lineTo(jt[J.neck * 2], jt[J.neck * 2 + 1]);
}
function rearLimbs(ctx: CanvasRenderingContext2D): void {
  seg(ctx, J.chest, J.shB); seg(ctx, J.shB, J.elbB); seg(ctx, J.elbB, J.handB);
  seg(ctx, J.hip, J.hipB); seg(ctx, J.hipB, J.kneeB); seg(ctx, J.kneeB, J.footB);
}
function frontLimbs(ctx: CanvasRenderingContext2D): void {
  seg(ctx, J.hip, J.hipA); seg(ctx, J.hipA, J.kneeA); seg(ctx, J.kneeA, J.footA);
  seg(ctx, J.chest, J.shA); seg(ctx, J.shA, J.elbA); seg(ctx, J.elbA, J.handA);
}

/** Draw a fighter; also samples its render-rate motion trail and afterimages. */
export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, dt: number): void {
  interpJoints(f, alpha, time);
  const a = f.anim;
  if (a.trailActive) a.pushTrail(jt[a.trailJoint * 2], jt[a.trailJoint * 2 + 1], time);
  if (a.ghostTime > 0) {
    a.ghostTime -= dt;
    a.ghostAcc += dt;
    if (a.ghostAcc >= ANIM.ghostInterval) {
      a.ghostAcc = 0;
      effects.afterimage(jt, f.team === 'player' ? '#7fe8ff' : f.color, f.thickness, f.scale);
    }
  }
  const s = f.scale;
  const w = f.thickness * s;
  const headR = RIG.headR * s * (f.kind === 'brute' ? 1.1 : 1);
  const hx = jt[J.head * 2] + (a.prevHeadOX + (a.headOX - a.prevHeadOX) * alpha) * s;
  const hy = jt[J.head * 2 + 1] + (a.prevHeadOY + (a.headOY - a.prevHeadOY) * alpha) * s;
  const face = a.prevFace + (a.face - a.prevFace) * alpha;
  const flashing = f.flash > 0 && !(settings.reduceFlashes && f.team === 'player');
  let fade = 1;
  if (f.state === 'dead') fade = Math.max(0, 1 - (f.deadTimer + alpha) / 36);
  if (f.team === 'player' && f.invuln > 0 && f.state !== 'dodge' && f.state !== 'move') fade = 0.6 + 0.35 * Math.cos(time * 40);
  ctx.globalAlpha = fade;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Scarf (behind body).
  if (a.hasScarf && a.scarfInit) {
    for (let i = 0; i < SCARF_N * 2; i++) sc[i] = a.scarfPrev[i] + (a.scarf[i] - a.scarfPrev[i]) * alpha;
    sc[0] = hx - face * 7 * s; sc[1] = hy - 2 * s;
    ctx.strokeStyle = '#05060c';
    ctx.lineWidth = 9 * s;
    strokeScarf(ctx);
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 5 * s;
    strokeScarf(ctx);
  }

  if (f.state === 'windup' || f.telegraph > 0) {
    const p = 0.45 + 0.35 * Math.sin(time * 40);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p * fade;
    ctx.strokeStyle = '#ff2020';
    ctx.lineWidth = w + 16 * s;
    ctx.beginPath(); torso(ctx); rearLimbs(ctx); frontLimbs(ctx); ctx.stroke();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(hx, hy, headR + 8 * s, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
  }
  if (f.team === 'player' && f.telegraph < 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * fade;
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = w + 12;
    ctx.beginPath(); torso(ctx); rearLimbs(ctx); frontLimbs(ctx); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
  }

  ctx.strokeStyle = '#05060c';
  ctx.lineWidth = w + 5;
  ctx.beginPath(); torso(ctx); rearLimbs(ctx); frontLimbs(ctx); ctx.stroke();
  ctx.fillStyle = '#05060c';
  ctx.beginPath(); ctx.arc(hx, hy, headR + 2.5, 0, TAU); ctx.fill();

  const main = flashing ? '#ffffff' : f.color;
  const rear = flashing ? '#ffffff' : shade(f.color, 0.62);
  ctx.strokeStyle = rear;
  ctx.lineWidth = w * 0.92;
  ctx.beginPath(); rearLimbs(ctx); ctx.stroke();
  ctx.strokeStyle = main;
  ctx.lineWidth = w;
  ctx.beginPath(); torso(ctx); frontLimbs(ctx); ctx.stroke();
  ctx.fillStyle = main;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.arc(jt[J.handA * 2], jt[J.handA * 2 + 1], w * 0.75, 0, TAU);
  ctx.arc(jt[J.footA * 2], jt[J.footA * 2 + 1], w * 0.7, 0, TAU);
  ctx.fill();

  const fx = face;
  if (f.team === 'player') {
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, headR - 1, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.stroke();
  } else {
    ctx.fillStyle = flashing ? '#fff' : '#05060c';
    ctx.beginPath();
    ctx.arc(hx + fx * headR * 0.45, hy - headR * 0.1, Math.max(1.6, headR * 0.16), 0, TAU);
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
      ctx.beginPath(); ctx.arc(hx, hy, headR - 1, -Math.PI * 0.95, -Math.PI * 0.05); ctx.stroke();
    } else if (f.kind === 'brute') {
      ctx.fillStyle = flashing ? '#fff' : f.accent;
      ctx.fillRect(hx - headR, hy - headR * 0.25, headR * 2, headR * 0.35);
    }
  }
  if (f.kind === 'shield' && f.guardBroken <= 0 && f.alive) {
    const sx = jt[J.handA * 2] + fx * 4, sy = jt[J.handA * 2 + 1];
    ctx.fillStyle = f.blockFlash > 0 ? '#ffffff' : '#9fb8ff';
    ctx.strokeStyle = '#05060c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6, 9 * Math.max(0.3, Math.abs(fx)), 34, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
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

// Scratch buffers for the smoothed ribbon.
const RB = TRAIL_CAP * 3;
const rx = new Float32Array(RB), ry = new Float32Array(RB), rk = new Float32Array(RB);
const lx = new Float32Array(RB), ly = new Float32Array(RB), qx = new Float32Array(RB), qy = new Float32Array(RB);

/**
 * Motion-trail ribbon. Samples are taken every render frame from the
 * interpolated skeleton, Catmull-Rom smoothed, and drawn as a tapered quad
 * strip with eased alpha falloff (additive glow + white core).
 */
export function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter, time: number): void {
  const a = f.anim;
  const life = ANIM.trailLife;
  // Gather live samples oldest -> newest.
  let n = 0;
  const px: number[] = gatherX, py: number[] = gatherY, pk: number[] = gatherK;
  for (let i = a.trailCount - 1; i >= 0; i--) {
    const idx = (a.trailHead - 1 - i + TRAIL_CAP * 2) % TRAIL_CAP;
    const age = time - a.trailT[idx];
    if (age < 0 || age > life) continue;
    px[n] = a.trailX[idx]; py[n] = a.trailY[idx]; pk[n] = 1 - age / life; n++;
  }
  if (n < 2) return;
  // Catmull-Rom subdivision (3 points per span).
  let m = 0;
  for (let i = 0; i < n - 1; i++) {
    const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
    for (let s = 0; s < 3; s++) {
      const t = s / 3, t2 = t * t, t3 = t2 * t;
      const c0 = -0.5 * t3 + t2 - 0.5 * t, c1 = 1.5 * t3 - 2.5 * t2 + 1, c2 = -1.5 * t3 + 2 * t2 + 0.5 * t, c3 = 0.5 * t3 - 0.5 * t2;
      rx[m] = px[i0] * c0 + px[i] * c1 + px[i + 1] * c2 + px[i3] * c3;
      ry[m] = py[i0] * c0 + py[i] * c1 + py[i + 1] * c2 + py[i3] * c3;
      rk[m] = pk[i] + (pk[i + 1] - pk[i]) * t;
      m++;
    }
  }
  rx[m] = px[n - 1]; ry[m] = py[n - 1]; rk[m] = pk[n - 1]; m++;
  // Edges.
  for (let i = 0; i < m; i++) {
    const j0 = Math.max(0, i - 1), j1 = Math.min(m - 1, i + 1);
    let dx = rx[j1] - rx[j0], dy = ry[j1] - ry[j0];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    const k = rk[i];
    const hw = a.trailWidth * (0.15 + 0.95 * k * k) * 0.5;
    lx[i] = rx[i] - dy * hw; ly[i] = ry[i] + dx * hw;
    qx[i] = rx[i] + dy * hw; qy[i] = ry[i] - dx * hw;
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? a.trailColor : '#ffffff';
    const widen = pass === 0 ? 1.7 : 0.45;
    for (let i = 0; i < m - 1; i++) {
      const k = (rk[i] + rk[i + 1]) * 0.5;
      ctx.globalAlpha = pass === 0 ? k * k * 0.5 : k * k * 0.95;
      const cx0 = rx[i], cy0 = ry[i], cx1 = rx[i + 1], cy1 = ry[i + 1];
      ctx.beginPath();
      ctx.moveTo(cx0 + (lx[i] - cx0) * widen, cy0 + (ly[i] - cy0) * widen);
      ctx.lineTo(cx1 + (lx[i + 1] - cx1) * widen, cy1 + (ly[i + 1] - cy1) * widen);
      ctx.lineTo(cx1 + (qx[i + 1] - cx1) * widen, cy1 + (qy[i + 1] - cy1) * widen);
      ctx.lineTo(cx0 + (qx[i] - cx0) * widen, cy0 + (qy[i] - cy0) * widen);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
const gatherX: number[] = new Array(TRAIL_CAP).fill(0);
const gatherY: number[] = new Array(TRAIL_CAP).fill(0);
const gatherK: number[] = new Array(TRAIL_CAP).fill(0);
