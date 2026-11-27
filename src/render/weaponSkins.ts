import { HERO_LOOK, type SkinWeapon } from '../data/hero';
import { staffLine } from '../data/weapons/staff';
import type { Fighter } from '../sim/fighter';
import { INK } from './ink';
import { J } from './rig';

/**
 * Weapon skins (Pixel look only): alternative drawings of the held Staff, Laser Blaster and Hook.
 * The Fists skins are gloves, drawn with the hero's hands (render/heroCos.ts). Same grip geometry as
 * each weapon's own `held` drawing; render-only. Returns false when the default drawing should be used.
 */
const TAU = Math.PI * 2;
const l6 = new Float32Array(6);
let sd = 1;
const rnd = (): number => { sd = (Math.imul(sd, 1103515245) + 12345) | 0; return ((sd >>> 8) & 0xffffff) / 16777216; };

/** A thick stick: ink outline with a paper (or colour) core. */
function stick(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, core: string): void {
  ctx.strokeStyle = INK.ink; ctx.lineWidth = w + 2.4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = core; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

export function drawWeaponSkin(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, wpp: number, time: number): boolean {
  const wid = f.weapon as SkinWeapon;
  if (wid !== 'staff' && wid !== 'laser' && wid !== 'hook') return false;
  const skin = HERO_LOOK.skins[wid];
  if (!skin || skin === 'default') return false;
  const s = f.scale, step = Math.floor(time * 12);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (wid === 'staff') {
    const cur = f.anim.cur;
    if (f.weaponOut || (cur && (cur.id === 'st_vault' || cur.id === 'st_vaultH'))) { ctx.restore(); return f.weaponOut; }
    staffLine(j, s, l6);
    const tx = l6[2], ty = l6[3], bx = l6[4], by = l6[5], dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const W = 3.2 * wpp + 1.2;
    switch (skin) {
      case 'bamboo': {
        stick(ctx, bx, by, tx, ty, W, INK.paper);
        ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.4 * wpp + 0.3; ctx.beginPath();
        for (let k = 0.12; k < 1; k += 0.19) { const px = bx + dx * k, py = by + dy * k; ctx.moveTo(px + nx * W * 0.9, py + ny * W * 0.9); ctx.lineTo(px - nx * W * 0.9, py - ny * W * 0.9); }
        ctx.stroke();
        ctx.fillStyle = INK.blue; ctx.beginPath(); ctx.ellipse(tx - ux * 10 * s + nx * 7 * s, ty - uy * 10 * s + ny * 7 * s, 7 * s, 2.6 * s, Math.atan2(uy, ux) + 0.6, 0, TAU); ctx.fill();
        break;
      }
      case 'bone': {
        stick(ctx, bx, by, tx, ty, W, INK.paper);
        ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.8 * wpp + 0.4;
        for (const [ex, ey] of [[tx, ty], [bx, by]]) for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(ex + nx * k * 4 * s, ey + ny * k * 4 * s, 4.6 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'candy': {
        // straight cane with a hook at the tip, red stripes
        stick(ctx, bx, by, tx, ty, W, INK.paper);
        const hx = tx + nx * 12 * s, hy = ty + ny * 12 * s;
        ctx.strokeStyle = INK.ink; ctx.lineWidth = W + 2.4; ctx.beginPath(); ctx.arc(hx, hy, 12 * s, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, uy * nx - ux * ny > 0); ctx.stroke();
        ctx.strokeStyle = INK.paper; ctx.lineWidth = W; ctx.stroke();
        ctx.strokeStyle = INK.red; ctx.lineWidth = 2 * wpp + 0.6; ctx.beginPath();
        for (let k = 0.05; k < 1; k += 0.09) { const px = bx + dx * k, py = by + dy * k; ctx.moveTo(px + nx * W * 0.45 - ux * 3 * s, py + ny * W * 0.45 - uy * 3 * s); ctx.lineTo(px - nx * W * 0.45 + ux * 3 * s, py - ny * W * 0.45 + uy * 3 * s); }
        ctx.stroke();
        break;
      }
      case 'glow': {
        ctx.strokeStyle = INK.blue; ctx.lineWidth = W + 4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = INK.paper; ctx.lineWidth = W * 0.6; ctx.stroke();
        sd = 31 + step * 7; ctx.strokeStyle = INK.blue; ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const k = rnd(), sd2 = rnd() < 0.5 ? 1 : -1, px = bx + dx * k, py = by + dy * k; ctx.moveTo(px + nx * sd2 * 6 * s, py + ny * sd2 * 6 * s); ctx.lineTo(px + nx * sd2 * 11 * s, py + ny * sd2 * 11 * s); }
        ctx.stroke();
        const gx = l6[0], gy = l6[1]; stick(ctx, gx - ux * 14 * s, gy - uy * 14 * s, gx + ux * 14 * s, gy + uy * 14 * s, W + 1, INK.ink);
        break;
      }
      case 'brush': case 'broom': {
        stick(ctx, bx, by, tx, ty, W * 0.8, skin === 'broom' ? INK.paper : INK.ink);
        const e = 26 * s, ex = tx + ux * e, ey = ty + uy * e;
        if (skin === 'brush') {
          ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6 * wpp + 0.3;
          ctx.fillStyle = INK.red; ctx.beginPath();
          ctx.moveTo(tx + nx * 5 * s, ty + ny * 5 * s); ctx.quadraticCurveTo(ex + nx * 6 * s, ey + ny * 6 * s, ex + ux * 6 * s, ey + uy * 6 * s);
          ctx.quadraticCurveTo(ex - nx * 6 * s, ey - ny * 6 * s, tx - nx * 5 * s, ty - ny * 5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
          stick(ctx, tx - ux * 4 * s, ty - uy * 4 * s, tx + ux * 3 * s, ty + uy * 3 * s, W + 2, INK.paper);
        } else {
          ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.8 * wpp + 0.4;
          ctx.beginPath(); ctx.moveTo(tx + nx * 4 * s, ty + ny * 4 * s); ctx.lineTo(ex + nx * 14 * s, ey + ny * 14 * s); ctx.lineTo(ex - nx * 14 * s, ey - ny * 14 * s); ctx.lineTo(tx - nx * 4 * s, ty - ny * 4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
          for (let k = -0.7; k <= 0.71; k += 0.35) { ctx.moveTo(tx + nx * k * 4 * s, ty + ny * k * 4 * s); ctx.lineTo(ex + nx * k * 13 * s, ey + ny * k * 13 * s); }
          ctx.stroke();
          ctx.strokeStyle = INK.red; ctx.lineWidth = 2.2 * wpp + 0.4; ctx.beginPath(); ctx.moveTo(tx + ux * 5 * s + nx * 6 * s, ty + uy * 5 * s + ny * 6 * s); ctx.lineTo(tx + ux * 5 * s - nx * 6 * s, ty + uy * 5 * s - ny * 6 * s); ctx.stroke();
        }
        break;
      }
    }
    ctx.restore(); return true;
  }
  // laser and hook: held in the lead hand, along the forearm
  const hx = j[J.handA * 2], hy = j[J.handA * 2 + 1];
  let dx = hx - j[J.elbA * 2], dy = hy - j[J.elbA * 2 + 1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const nx = -dy, ny = dx, P = (a: number, b: number): [number, number] => [hx + dx * a * s + nx * b * s, hy + dy * a * s + ny * b * s];
  const poly = (pts: [number, number][], fill: string | null) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); };
  ctx.strokeStyle = INK.ink; ctx.lineWidth = 2 * wpp + 0.5;
  if (wid === 'laser') {
    switch (skin) {
      case 'toy': {
        poly([P(-8, 7), P(14, 7), P(18, 3), P(18, -4), P(14, -7), P(-8, -7)], INK.paper);
        ctx.fillStyle = INK.blue; ctx.beginPath(); const [cx, cy] = P(3, -7); ctx.arc(cx, cy, 5 * s, Math.atan2(-ny, -nx) - Math.PI / 2, Math.atan2(-ny, -nx) + Math.PI / 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = INK.red; ctx.lineWidth = 2.4 * wpp + 0.5; ctx.beginPath();
        for (const a of [22, 27, 32]) { const [x, y] = P(a, 0); ctx.moveTo(x + nx * 3.5 * s, y + ny * 3.5 * s); ctx.lineTo(x - nx * 3.5 * s, y - ny * 3.5 * s); }
        ctx.stroke();
        break;
      }
      case 'banana': {
        ctx.fillStyle = INK.paper; ctx.beginPath();
        const [a1, a2] = P(-10, 2), [b1, b2] = P(26, 2), [c1, c2] = P(8, 13), [d1, d2] = P(8, 4);
        ctx.moveTo(a1, a2); ctx.quadraticCurveTo(c1, c2, b1, b2); ctx.quadraticCurveTo(d1, d2, a1, a2); ctx.closePath(); ctx.fill(); ctx.stroke();
        const [e1, e2] = P(30, 0); ctx.beginPath(); ctx.moveTo(b1, b2); ctx.lineTo(e1, e2); ctx.stroke();
        ctx.fillStyle = INK.ink; const [g1, g2] = P(-10, 2); ctx.beginPath(); ctx.arc(g1, g2, 2 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'cannon': {
        poly([P(-10, 8), P(24, 9), P(24, -9), P(-10, -8)], INK.ink);
        poly([P(24, 12), P(30, 12), P(30, -12), P(24, -12)], INK.paper);
        ctx.fillStyle = INK.red; const [r1, r2] = P(0, 0); ctx.beginPath(); ctx.arc(r1, r2, 3 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'scrB': case 'scrR': case 'scrG': {
        // a gun drawn as a fast scribble in one colour (green has no ink in the 4-colour page: pencil gray)
        const col = skin === 'scrB' ? INK.blue : skin === 'scrR' ? INK.red : INK.dither;
        sd = 77 + step * 13; ctx.strokeStyle = col; ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath();
        const out: [number, number][] = [[-8, 6], [20, 6], [20, -5], [-8, -5], [-8, 6], [-4, 14], [2, 14], [4, 6]];
        for (let pass = 0; pass < 2; pass++) out.forEach(([a, b], i) => { const [x, y] = P(a + (rnd() - 0.5) * 3, b + (rnd() - 0.5) * 3); if (i || pass) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        for (let i = 0; i < 6; i++) { const [x, y] = P(-6 + rnd() * 24, -4 + rnd() * 8); const [x2, y2] = P(-6 + rnd() * 24, -4 + rnd() * 8); ctx.moveTo(x, y); ctx.lineTo(x2, y2); }
        ctx.stroke();
        break;
      }
    }
  } else {
    switch (skin) {
      case 'pirate': {
        ctx.lineWidth = 3.2 * wpp + 0.6; ctx.beginPath();
        const [a1, a2] = P(-2, 0), [b1, b2] = P(12, 0), [c1, c2] = P(22, 8), [d1, d2] = P(14, 12);
        ctx.moveTo(a1, a2); ctx.lineTo(b1, b2); ctx.bezierCurveTo(c1 + dx * 4 * s, c2 + dy * 4 * s, c1 - nx * 0 * s, c2, d1, d2); ctx.stroke();
        ctx.lineWidth = 2 * wpp + 0.5; poly([P(-8, 6), P(0, 6), P(0, -6), P(-8, -6)], INK.ink);
        break;
      }
      case 'chain': {
        ctx.lineWidth = 1.6 * wpp + 0.4;
        for (let i = 0; i < 5; i++) { const [x, y] = P(2 + i * 6, (i % 2) * 0.5); ctx.beginPath(); ctx.ellipse(x, y, 3.6 * s, (i % 2 ? 1.4 : 2.6) * s, Math.atan2(dy, dx), 0, TAU); ctx.stroke(); }
        break;
      }
      case 'rod': {
        // a fishing rod angled up from the hand, line and a red bobber hanging off the tip
        const tx = hx + dx * 10 * s - 0.5 * 0, ty = hy - 70 * s, ex = hx + dx * 46 * s;
        ctx.lineWidth = 2.2 * wpp + 0.5; ctx.beginPath(); ctx.moveTo(hx - dx * 6 * s, hy + 4 * s); ctx.lineTo(ex, ty); ctx.stroke();
        ctx.fillStyle = INK.paper; ctx.beginPath(); ctx.arc(hx + dx * 4 * s, hy - 6 * s, 3.6 * s, 0, TAU); ctx.fill(); ctx.stroke();
        const by = ty + 34 * s + Math.sin(step * 1.7) * 2 * s;
        ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath(); ctx.moveTo(ex, ty); ctx.lineTo(ex, by); ctx.stroke();
        ctx.fillStyle = INK.red; ctx.beginPath(); ctx.arc(ex, by + 3 * s, 3.4 * s, 0, TAU); ctx.fill(); ctx.stroke();
        void tx;
        break;
      }
      case 'anchor': {
        ctx.lineWidth = 1.6 * wpp + 0.4;
        const [r1, r2] = P(0, 0); ctx.beginPath(); ctx.ellipse(r1, r2, 6 * s, 4 * s, 0, 0, TAU); ctx.ellipse(r1, r2 + 1.5 * s, 4.5 * s, 3 * s, 0, 0, TAU); ctx.stroke();
        const ax = hx + dx * 8 * s, ay = hy + 14 * s;
        ctx.beginPath(); ctx.moveTo(r1, r2 + 4 * s); ctx.lineTo(ax, ay - 7 * s); ctx.stroke();
        ctx.lineWidth = 2.2 * wpp + 0.5; ctx.beginPath();
        ctx.moveTo(ax, ay - 7 * s); ctx.lineTo(ax, ay + 5 * s); ctx.moveTo(ax - 4 * s, ay - 4 * s); ctx.lineTo(ax + 4 * s, ay - 4 * s);
        ctx.moveTo(ax - 6 * s, ay + 1 * s); ctx.quadraticCurveTo(ax, ay + 9 * s, ax + 6 * s, ay + 1 * s);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(ax, ay - 8.5 * s, 1.8 * s, 0, TAU); ctx.stroke();
        break;
      }
    }
  }
  ctx.restore();
  return true;
}
