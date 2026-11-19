import { J, JOINT_N, RIG } from './rig';
import { SCARF_N, TRAIL_N } from './animator';
import type { Fighter } from '../sim/fighter';
import { TAU } from '../core/math';
import { WORLD } from '../data/tuning';
import { settings } from '../core/settings';

const jt = new Float32Array(JOINT_N * 2);
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

/** Interpolate the fighter's joints for this render frame into `jt`. */
export function interpJoints(f: Fighter, alpha: number): Float32Array {
  const a = f.anim.prevJoints, b = f.anim.joints;
  const sx = f.anim.shakeX, sy = f.anim.shakeY;
  for (let i = 0; i < JOINT_N; i++) {
    jt[i * 2] = a[i * 2] + (b[i * 2] - a[i * 2]) * alpha + sx;
    jt[i * 2 + 1] = a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * alpha + sy;
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
  // Attacker ring: token holder / telegraphing enemy gets a pulsing red ring.
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
  seg(ctx, J.chest, J.elbB); seg(ctx, J.elbB, J.handB);
  seg(ctx, J.hip, J.kneeB); seg(ctx, J.kneeB, J.footB);
}
function frontLimbs(ctx: CanvasRenderingContext2D): void {
  seg(ctx, J.hip, J.kneeA); seg(ctx, J.kneeA, J.footA);
  seg(ctx, J.chest, J.elbA); seg(ctx, J.elbA, J.handA);
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number): void {
  interpJoints(f, alpha);
  const a = f.anim;
  const s = f.scale;
  const w = f.thickness * s;
  const headR = RIG.headR * s * (f.kind === 'brute' ? 1.1 : 1);
  const hx = jt[J.head * 2] + (a.prevHeadOX + (a.headOX - a.prevHeadOX) * alpha) * s;
  const hy = jt[J.head * 2 + 1] + (a.prevHeadOY + (a.headOY - a.prevHeadOY) * alpha) * s;
  const flashing = f.flash > 0 && !(settings.reduceFlashes && f.team === 'player');
  let fade = 1;
  if (f.state === 'dead') fade = Math.max(0, 1 - f.deadTimer / 36);
  if (f.team === 'player' && f.invuln > 0 && f.state !== 'dodge' && f.state !== 'move' && ((time * 20) | 0) % 2 === 0) fade = 0.45;
  ctx.globalAlpha = fade;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Scarf (behind body).
  if (a.hasScarf && a.scarfInit) {
    for (let i = 0; i < SCARF_N * 2; i++) sc[i] = a.scarfPrev[i] + (a.scarf[i] - a.scarfPrev[i]) * alpha;
    sc[0] = hx - f.facing * 7 * s; sc[1] = hy - 2 * s;
    ctx.strokeStyle = '#05060c';
    ctx.lineWidth = 9 * s;
    strokeScarf(ctx);
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 5 * s;
    strokeScarf(ctx);
  }

  // Telegraph glow.
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
  // Player aura while crit-buffed.
  if (f.team === 'player' && f.telegraph < 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * fade;
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = w + 12;
    ctx.beginPath(); torso(ctx); rearLimbs(ctx); frontLimbs(ctx); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
  }

  // Outline pass for readability on any background.
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
  // hand / foot nubs
  ctx.beginPath();
  ctx.arc(jt[J.handA * 2], jt[J.handA * 2 + 1], w * 0.75, 0, TAU);
  ctx.arc(jt[J.footA * 2], jt[J.footA * 2 + 1], w * 0.7, 0, TAU);
  ctx.fill();

  // Details.
  const fx = f.facing;
  if (f.team === 'player') {
    // headband
    ctx.strokeStyle = flashing ? '#fff' : f.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, headR - 1, -Math.PI * 0.95, -Math.PI * 0.05);
    ctx.stroke();
  } else {
    // eyes
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
    ctx.ellipse(sx, sy - 6, 9, 34, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a5ab8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - 34); ctx.lineTo(sx, sy + 22); ctx.stroke();
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

/** Motion-trail ribbon for the striking limb (additive glow). */
export function drawTrail(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number): void {
  const a = f.anim;
  if (a.trailCount < 2) return;
  const maxAge = 7;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  let prevX = 0, prevY = 0, has = false;
  const n = a.trailCount;
  // iterate oldest -> newest
  for (let i = n - 1; i >= 0; i--) {
    const idx = (a.trailHead - 1 - i + TRAIL_N * 2) % TRAIL_N;
    const age = a.trailAge[idx] + (1 - alpha);
    if (age > maxAge) { has = false; continue; }
    const x = a.trail[idx * 2], y = a.trail[idx * 2 + 1];
    if (has) {
      const k = 1 - age / maxAge;
      ctx.strokeStyle = a.trailColor;
      ctx.globalAlpha = k * 0.35;
      ctx.lineWidth = a.trailWidth * (0.6 + k * 1.6);
      ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = k * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = a.trailWidth * 0.35 * k + 1;
      ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(x, y); ctx.stroke();
    }
    prevX = x; prevY = y; has = true;
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
