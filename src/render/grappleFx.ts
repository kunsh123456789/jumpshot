import type { World } from '../sim/world';
import { ROOF_Y, WALL_FACE_L, WALL_FACE_R } from '../sim/grapple';
import { GRAPPLE } from '../data/weapons/tuning';
import { WORLD } from '../data/tuning';
import { DRAW } from './drawStyle';
import { INK } from './ink';

/**
 * Grappling hook mobility visuals (hook, New moveset): the roof girder and wall faces the
 * hook bites into, the taut rope from the hands to the claw, and fading bite marks.
 * Seeded jitter per drawing step so the lines boil with the page.
 */
let sd = 1;
const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;

export function drawGrappleFx(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number): void {
  if (!w.weapon.passive?.grapple) return;
  const ink = DRAW.ink ? INK.ink : '#e8eefc';
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ---- the roof: a sketched steel girder (two rails and a zigzag truss) ----
  const x0 = -200, x1 = WORLD.arenaW + 200, R = ROOF_Y, H = 16;
  // pencil-gray, thin: scenery the hook bites into, not a second floor
  ctx.globalAlpha = DRAW.ink ? 1 : 0.4;
  ctx.strokeStyle = DRAW.ink ? INK.gray : ink; ctx.lineWidth = 1.2 * wpp + 0.4;
  ctx.beginPath();
  ctx.moveTo(x0, R); ctx.lineTo(x1, R);
  ctx.moveTo(x0, R - H); ctx.lineTo(x1, R - H);
  for (let x = x0, k = 0; x < x1; x += 46, k++) { ctx.moveTo(x, k & 1 ? R : R - H); ctx.lineTo(x + 46, k & 1 ? R - H : R); }
  ctx.stroke();
  // ---- the walls: the faces the hook bites into, with hatching behind them ----
  ctx.lineWidth = 1.2 * wpp + 0.4;
  ctx.beginPath();
  for (const [fx, out] of [[WALL_FACE_L, -1], [WALL_FACE_R, 1]] as const) {
    ctx.moveTo(fx, R); ctx.lineTo(fx, WORLD.groundY);
    for (let y = R + 10; y < WORLD.groundY; y += 26) { ctx.moveTo(fx, y); ctx.lineTo(fx + out * 14, y - 12); }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ---- fading bite marks: little cracks where a rope was ----
  const g = w.grapple;
  ctx.lineWidth = 1.6 * wpp + 0.5;
  for (const m of g.marks) {
    if (m.t <= 0) continue;
    ctx.globalAlpha = Math.min(1, m.t / 30) * 0.8;
    bite(ctx, m.x, m.y, m.wall ? (m.x < WORLD.arenaW / 2 ? 0 : Math.PI) : -Math.PI / 2, 0.8, ink, wpp, 17 + Math.floor(m.x));
  }
  ctx.globalAlpha = 1;

  // ---- the live rope ----
  const p = w.player;
  if (g.active && (p.state === 'swing' || p.state === 'cling')) {
    const s = p.scale;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const hipX = px, hipY = py - GRAPPLE.hipH * s;
    let hx: number, hy: number;
    if (g.phase === 'cling') {
      // hand flat on the wall: a short strand and the claw beside it
      hx = g.ax; hy = hipY - 58 * s;
      ctx.strokeStyle = ink; ctx.lineWidth = 1.8 * wpp + 0.6;
      bite(ctx, g.ax, hy - 6, g.side < 0 ? 0 : Math.PI, 1, ink, wpp, 5 + step);
    } else {
      if (g.phase === 'zip') {
        const dx = g.ax - hipX, dy = g.ay - hipY, d = Math.hypot(dx, dy) || 1;
        hx = hipX + (dx / d) * 64 * s; hy = hipY - 30 * s + (dy / d) * 34 * s;
      } else {
        hx = hipX + Math.sin(g.spin) * GRAPPLE.handOff * s; hy = hipY - Math.cos(g.spin) * GRAPPLE.handOff * s;
      }
      // the claw flies out over the first frames
      const k = g.shot;
      const tx = hx + (g.ax - hx) * k, ty = hy + (g.ay - hy) * k;
      sd = 131 + step * 7;
      const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      ctx.strokeStyle = ink; ctx.lineWidth = 2 * wpp + 0.7;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      // taut once it bites; a little wobble while it is flying
      const segs = 7, wob = k < 1 ? 7 : 1.6;
      for (let i = 1; i <= segs; i++) {
        const q = i / segs;
        const j = i === segs ? 0 : (rnd() - 0.5) * wob * Math.sin(q * Math.PI) * 2;
        ctx.lineTo(hx + dx * q + nx * j, hy + dy * q + ny * j);
      }
      ctx.stroke();
      // a second faint strand: reads as a twisted cord
      ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2 * wpp + 0.4;
      ctx.beginPath(); ctx.moveTo(hx + nx * 2, hy + ny * 2); ctx.lineTo(tx + nx * 2, ty + ny * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      const ang = Math.atan2(dy, dx);
      if (k >= 1) bite(ctx, g.ax, g.ay, ang, 1, ink, wpp, 3 + step);
      else claw(ctx, tx, ty, ang, ink, wpp);
    }
    void hx; void hy;
  }
  ctx.restore();
}

/** The claw in flight: three prongs pointing along the rope. */
function claw(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, ink: string, wpp: number): void {
  ctx.strokeStyle = ink; ctx.lineWidth = 2.4 * wpp + 0.8;
  ctx.beginPath();
  for (const o of [-0.7, 0, 0.7]) {
    ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
    ctx.lineTo(x + Math.cos(a + o) * 12, y + Math.sin(a + o) * 12);
  }
  ctx.stroke();
}

/** The claw bitten into a surface: prongs splayed into it and a few cracks around. */
function bite(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, k: number, ink: string, wpp: number, seed: number): void {
  sd = seed;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.2 * wpp + 0.7;
  ctx.beginPath();
  for (const o of [-1.0, 0, 1.0]) { ctx.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a + o) * 11 * k, y + Math.sin(a + o) * 11 * k); }
  ctx.stroke();
  ctx.lineWidth = 1.4 * wpp + 0.4;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const b = a + Math.PI / 2 + (i - 1.5) * 0.9 + (rnd() - 0.5) * 0.4;
    const r0 = 8, r1 = (16 + rnd() * 10) * k;
    ctx.moveTo(x + Math.cos(b) * r0, y + Math.sin(b) * r0);
    ctx.lineTo(x + Math.cos(b) * r1, y + Math.sin(b) * r1);
  }
  ctx.stroke();
}
