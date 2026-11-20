import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import { weaponById } from '../data/weapons';
import { DRAW } from './drawStyle';
import { INK } from './ink';

/**
 * Weapon visuals in world space (revision pass 7), shared by every look:
 *  - the grappling-hook rope: a verlet rope drawn as a sketchy chain of short
 *    stepped strokes (re-jittered per drawing step), with a claw at the end
 *  - laser beams: scribble beams (looping red lines around a straight core)
 *    that thin out over a few frames
 *  - overheat steam doodles over the hero
 * The held object itself is drawn by the weapon's own `held` routine (heldWeapon).
 */
let seed = 1;
const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) | 0; return ((seed >>> 8) & 0xffffff) / 16777216; };
const TAU = Math.PI * 2;

/** The equipped weapon in the hero's hands (called from the fighter renderers). */
export function heldWeapon(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number): void {
  if (f.team !== 'player' || f.state === 'ko') return;
  const wd = weaponById(f.weapon);
  if (wd.held) wd.held(ctx, f, j, col, wpp);
}

export function drawWeaponFx(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number): void {
  const ws = w.wpn;
  const p = w.player;
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  const ink = DRAW.ink ? INK.ink : '#e8eefc';
  const red = DRAW.ink ? INK.red : '#ff4a4a';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ---- Rope: chain links along the verlet points ----
  if (ws.ropeVisible) {
    const R = ws.rope;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const hx = px + p.facing * 24 * p.scale, hy = py - 96 * p.scale;
    seed = step * 131 + 7;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6 * wpp + 0.6;
    ctx.beginPath();
    let lx = hx, ly = hy;
    for (let i = 1; i < R.length; i++) {
      const x = R[i].x, y = R[i].y;
      // two overlapping strokes per segment = a sketched chain
      ctx.moveTo(lx + (rnd() - 0.5) * 2, ly + (rnd() - 0.5) * 2); ctx.lineTo(x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2);
      const mx = (lx + x) / 2, my = (ly + y) / 2, dx = x - lx, dy = y - ly, L = Math.hypot(dx, dy) || 1;
      ctx.moveTo(mx - (dy / L) * 3, my + (dx / L) * 3); ctx.lineTo(mx + (dy / L) * 3, my - (dx / L) * 3);
      lx = x; ly = y;
    }
    ctx.stroke();
    // claw
    const ax = R[R.length - 1].x, ay = R[R.length - 1].y;
    const pv = R[R.length - 2];
    const a = Math.atan2(ay - pv.y, ax - pv.x);
    ctx.lineWidth = 2.4 * wpp + 0.8;
    ctx.beginPath();
    ctx.moveTo(ax - Math.cos(a) * 8, ay - Math.sin(a) * 8); ctx.lineTo(ax, ay);
    for (const s of [-1, 1]) {
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + Math.cos(a + s * 0.9) * 10, ay + Math.sin(a + s * 0.9) * 10, ax + Math.cos(a + s * 2.2) * 9, ay + Math.sin(a + s * 2.2) * 9);
    }
    ctx.stroke();
  }

  // ---- Beam ----
  if (ws.beamT > 0) {
    const k = ws.beamT / ws.beamMax;
    const x1 = ws.beamX1, y1 = ws.beamY1, x2 = ws.beamX2, y2 = ws.beamY2;
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const wd = ws.beamW * (0.35 + 0.65 * k);
    seed = step * 977 + 3;
    // core
    ctx.strokeStyle = red; ctx.lineWidth = Math.max(2, wd * 0.45);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (DRAW.ink) { ctx.strokeStyle = INK.paper; ctx.lineWidth = Math.max(1, wd * 0.14); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    // scribble loops around the core
    ctx.strokeStyle = red; ctx.lineWidth = 1.6 * wpp + 0.6;
    ctx.beginPath();
    const loops = Math.max(4, Math.floor(L / 34));
    for (let i = 0; i < loops; i++) {
      const t0 = i / loops, t1 = (i + 1) / loops;
      const r = wd * (0.5 + rnd() * 0.5);
      const cx = x1 + dx * (t0 + t1) / 2, cy = y1 + dy * (t0 + t1) / 2;
      ctx.moveTo(x1 + dx * t0 + nx * r * 0.2, y1 + dy * t0 + ny * r * 0.2);
      ctx.quadraticCurveTo(cx + nx * r, cy + ny * r, x1 + dx * t1 - nx * r * 0.3, y1 + dy * t1 - ny * r * 0.3);
      ctx.quadraticCurveTo(cx - nx * r, cy - ny * r, x1 + dx * t0 + nx * r * 0.2, y1 + dy * t0 + ny * r * 0.2);
    }
    ctx.stroke();
    // reflected segment (stretch-goal flag)
    if (!Number.isNaN(ws.beamX3)) {
      ctx.lineWidth = Math.max(2, wd * 0.45);
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(ws.beamX3, ws.beamY3); ctx.stroke();
      ctx.lineWidth = 1.6 * wpp + 0.6;
    }
    // muzzle and end bursts
    ctx.beginPath();
    for (const [bx, by, rr] of [[x1, y1, wd * 0.9], [x2, y2, wd * 1.3]] as [number, number, number][]) {
      for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU, r0 = rr * 0.3, r1 = rr * (0.8 + rnd() * 0.6);
        ctx.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0); ctx.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1);
      }
    }
    ctx.stroke();
  }

  // ---- Overheat steam ----
  if (ws.overheat > 0) {
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const hx = px + p.facing * 30 * p.scale, hy = py - 110 * p.scale;
    seed = step * 61 + 11;
    ctx.strokeStyle = DRAW.ink ? INK.ink : '#cfd6e6'; ctx.lineWidth = 1.4 * wpp + 0.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ox = hx + (i - 1) * 9 + (rnd() - 0.5) * 4, rise = ((step + i * 2) % 6) * 6;
      ctx.moveTo(ox, hy - rise);
      ctx.bezierCurveTo(ox + 7, hy - rise - 8, ox - 7, hy - rise - 14, ox + 2, hy - rise - 24);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Plain heat bar for heat-limited weapons (laser), drawn by both HUDs under the super meter.
 * TODO(ui-pass): placeholder styling.
 */
export function drawHeatBar(ctx: CanvasRenderingContext2D, w: World, x: number, y: number, width: number, h: number, u: number, ink: string, font: string): void {
  if (!w.weapon.heat) return;
  const ws = w.wpn;
  const over = ws.overheat > 0;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ink;
  ctx.strokeRect(x, y, width, h);
  ctx.fillStyle = over ? '#e22424' : ws.heat > 0.7 ? '#e8822a' : ink;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * (over ? ws.overheat / Math.max(1, w.weapon.heat.overheatSec * 60) : ws.heat)), h - 2);
  ctx.font = `${Math.round(11 * u)}px ${font}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = over ? '#e22424' : ink;
  ctx.fillText(over ? 'OVERHEAT' : 'heat', x + width + 6 * u, y + h / 2);
  ctx.restore();
}
