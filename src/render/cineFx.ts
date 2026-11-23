import type { World } from '../sim/world';
import { DRAW } from './drawStyle';
import { INK } from './ink';
import { WORLD } from '../data/tuning';

/**
 * Cinematic visuals (pass 8): the persistent shapes a finisher / Special script
 * keeps on screen (sim/cine.ts CineVisual): scribbled mega-beams, ropes to each
 * caught enemy, the Cyclone's tornado, the X-slash flash lines and the Special's
 * freeze bubble. Drawn on the world layer in ink, re-jittered per drawing step
 * (seeded), so they boil like the rest of the page.
 */
let sd = 1;
const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;
const TAU = Math.PI * 2;

export function drawCineFx(ctx: CanvasRenderingContext2D, w: World, _alpha: number, time: number, wpp: number): void {
  const c = w.cine.ctx;
  const sp = w.special;
  const ink = DRAW.ink ? INK.ink : '#e8eefc';
  const paperCol = DRAW.ink ? INK.paper : '#05060c';
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ---- freeze bubble (Special activation / trace / QTE) ----
  const bub = sp.bubble ?? c?.vis.bubble ?? null;
  if (bub) {
    sd = 991 + step * 7;
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2 * wpp + 0.6;
    ctx.beginPath();
    for (let r = 0; r < 2; r++) {
      const R = bub.r * (1 - r * 0.06);
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, rr = R * (1 + (rnd() - 0.5) * 0.025); const x = bub.x + Math.cos(a) * rr, y = bub.y + Math.sin(a) * rr * 0.8; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.lineWidth = 1.2 * wpp + 0.4;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) { const a = rnd() * TAU, r0 = bub.r * (0.86 + rnd() * 0.08); ctx.moveTo(bub.x + Math.cos(a) * r0, bub.y + Math.sin(a) * r0 * 0.8); ctx.lineTo(bub.x + Math.cos(a + 0.12) * bub.r, bub.y + Math.sin(a + 0.12) * bub.r * 0.8); }
    ctx.stroke();
  }
  if (!c) { ctx.restore(); return; }
  const v = c.vis;
  // ---- ropes ----
  if (v.ropes.length) {
    sd = 313 + step * 11;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.8 * wpp + 0.6;
    ctx.beginPath();
    for (let i = 0; i + 3 < v.ropes.length; i += 4) {
      const x1 = v.ropes[i], y1 = v.ropes[i + 1], x2 = v.ropes[i + 2], y2 = v.ropes[i + 3];
      ctx.moveTo(x1, y1);
      const n = 6;
      for (let k = 1; k <= n; k++) { const t = k / n; ctx.lineTo(x1 + (x2 - x1) * t + (k < n ? (rnd() - 0.5) * 6 : 0), y1 + (y2 - y1) * t + (k < n ? (rnd() - 0.5) * 6 + Math.sin(t * Math.PI) * 10 : 0)); }
    }
    ctx.stroke();
  }
  // ---- mega-beam: a thick ink band with scribbled edges and a paper core ----
  if (v.beam) {
    const b = v.beam;
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    sd = 727 + step * 13;
    ctx.fillStyle = ink;
    ctx.beginPath();
    const n = 18;
    for (let k = 0; k <= n; k++) { const t = k / n, hw = b.w * (0.85 + rnd() * 0.3) * (k === 0 ? 0.5 : 1); ctx.lineTo(b.x1 + dx * t + nx * hw, b.y1 + dy * t + ny * hw); }
    for (let k = n; k >= 0; k--) { const t = k / n, hw = b.w * (0.85 + rnd() * 0.3) * (k === 0 ? 0.5 : 1); ctx.lineTo(b.x1 + dx * t - nx * hw, b.y1 + dy * t - ny * hw); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = paperCol; ctx.lineWidth = Math.max(2, b.w * 0.3);
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4 * wpp + 0.4;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const t = rnd(), s = (rnd() < 0.5 ? 1 : -1) * b.w * (1.2 + rnd() * 0.8); const x = b.x1 + dx * t, y = b.y1 + dy * t; ctx.moveTo(x + nx * b.w * Math.sign(s), y + ny * b.w * Math.sign(s)); ctx.lineTo(x + nx * s + dx / L * 20, y + ny * s + dy / L * 20); }
    ctx.stroke();
  }
  // ---- tornado: stacked scribbled ellipses, widening upward ----
  if (v.tornado) {
    const t = v.tornado;
    sd = 557 + step * 17;
    ctx.strokeStyle = ink; ctx.lineWidth = 1.8 * wpp + 0.5;
    ctx.beginPath();
    const rings = 9;
    for (let r = 0; r < rings; r++) {
      const k = r / (rings - 1), y = t.y - k * t.h, R = t.r * (0.35 + k * 0.9), a0 = step * 1.7 + r * 0.9;
      for (let i = 0; i <= 14; i++) { const a = a0 + (i / 14) * (TAU * 0.8), x = t.x + Math.cos(a) * R * (1 + (rnd() - 0.5) * 0.12), yy = y + Math.sin(a) * R * 0.22; if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
    }
    for (let i = 0; i < 16; i++) { const k = rnd(), y = t.y - k * t.h, R = t.r * (0.35 + k * 0.9) * 1.1, a = rnd() * TAU; ctx.moveTo(t.x + Math.cos(a) * R, y); ctx.lineTo(t.x + Math.cos(a + 0.5) * R * 1.25, y - 14); }
    ctx.stroke();
  }
  // ---- X-slash flash lines ----
  for (const s of v.slash) {
    const k = Math.min(1, s.t / 30);
    ctx.strokeStyle = ink; ctx.lineWidth = (10 * k + 2) * wpp;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    ctx.strokeStyle = paperCol; ctx.lineWidth = (4 * k + 1) * wpp;
    ctx.beginPath(); ctx.moveTo(s.x1 + (s.x2 - s.x1) * 0.1, s.y1 + (s.y2 - s.y1) * 0.1); ctx.lineTo(s.x2 - (s.x2 - s.x1) * 0.1, s.y2 - (s.y2 - s.y1) * 0.1); ctx.stroke();
  }
  void WORLD;
  ctx.restore();
}
