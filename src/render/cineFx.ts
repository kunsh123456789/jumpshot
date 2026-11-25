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
  // ---- laser Special blast: white core, ragged flame edge, ink streaks on everyone caught ----
  if (v.beam && v.beam.style === 'blast') drawBlast(ctx, w, v.beam, c.group, step, wpp, c.p.facing);
  // ---- mega-beam: a thick ink band with scribbled edges and a paper core ----
  else if (v.beam) {
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

/**
 * The laser Special's beam (pass 9, after the user's reference): a fat white core inside a thin,
 * ragged, flickering flame edge (red for the laser; ice / ray gun / brush / thunder have their own
 * tone), a rounded cap at the fist and a streaky end. Enemies caught in it get black ink streaks
 * dragged along the beam, as if they're being blasted apart. While charging (t < 0) it's an orb.
 */
function drawBlast(ctx: CanvasRenderingContext2D, w: World, b: { x1: number; y1: number; x2: number; w: number; tone?: string; t?: number }, group: { x: number; cx: number; cy: number; scale: number; state: string }[], step: number, wpp: number, facing: number): void {
  const tone = b.tone ?? '#ff2a1f';
  const len = Math.abs(b.x2 - b.x1), dir = Math.sign(b.x2 - b.x1) || facing, y = b.y1, W = b.w;
  if (len < 4) {
    // charging orb: a ragged flame ring around a white ball
    sd = 1301 + step * 5;
    for (const [col, R, jag] of [[tone, W * 1.25, 0.22], ['#ffffff', W * 0.85, 0.08]] as [string, number, number][]) {
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, r = R * (1 + (rnd() - 0.5) * jag * 2); ctx.lineTo(b.x1 + Math.cos(a) * r, y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    return;
  }
  sd = 1409 + step * 7;
  const X = (u: number) => b.x1 + dir * u;
  const N = Math.max(10, Math.floor(len / 16));
  const cap = Math.min(len * 0.5, W * 1.1);
  const prof = (u: number) => (u < cap ? Math.sqrt(Math.max(0, 1 - ((cap - u) / cap) ** 2)) : 1);   // rounded cap at the fist
  // outer flame edge: jittered, with flame tongues licking out
  const top: number[] = [], bot: number[] = [];
  for (let k = 0; k <= N; k++) {
    const u = (k / N) * len, p = prof(u);
    top.push(W * p * (1 + (rnd() - 0.5) * 0.14) + (rnd() < 0.2 ? W * (0.12 + rnd() * 0.32) * p : 0));
    bot.push(W * p * (1 + (rnd() - 0.5) * 0.14) + (rnd() < 0.2 ? W * (0.12 + rnd() * 0.32) * p : 0));
  }
  const outline = (scale: number, endJag: number) => {
    ctx.beginPath(); ctx.moveTo(X(0), y);
    for (let k = 0; k <= N; k++) ctx.lineTo(X((k / N) * len), y - top[k] * scale);
    // ragged, streaky end
    for (let j = 1; j < 6; j++) ctx.lineTo(X(len + (rnd() - 0.3) * endJag), y - W * scale + (2 * W * scale * j) / 6);
    for (let k = N; k >= 0; k--) ctx.lineTo(X((k / N) * len), y + bot[k] * scale);
    ctx.closePath();
  };
  // soft tinted glow so the white core reads on a white / cream page, then the flame band, then the core
  ctx.globalAlpha = 0.22; ctx.fillStyle = tone; outline(1.35, 60); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = tone; outline(1, 40); ctx.fill();
  ctx.fillStyle = '#ffffff'; outline(0.7, 26); ctx.fill();
  // a few white speed streaks inside the core and flame wisps off the edges
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(2, W * 0.08);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const u = cap + rnd() * Math.max(1, len - cap), yy = y + (rnd() - 0.5) * W * 1.2; ctx.moveTo(X(u), yy); ctx.lineTo(X(u + 60 + rnd() * 120), yy); }
  ctx.stroke();
  ctx.strokeStyle = tone; ctx.lineWidth = 1.8 * wpp + 0.6;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const u = cap + rnd() * Math.max(1, len - cap), s = rnd() < 0.5 ? -1 : 1, yy = y + s * W * (1.05 + rnd() * 0.25); ctx.moveTo(X(u), yy); ctx.lineTo(X(u + 14 + rnd() * 26), yy + s * (4 + rnd() * 10)); }
  ctx.stroke();
  // victims: black ink streaks dragged along the beam (they're being blasted apart)
  ctx.strokeStyle = '#111111';
  for (const e of group) {
    if (e.state !== 'cine') continue;
    const along = (e.x - b.x1) * dir;
    if (along < -30 || along > len || Math.abs(e.cy - y) > W + 50 * e.scale) continue;
    for (let i = 0; i < 5; i++) {
      const yy = e.cy + (i / 4 - 0.5) * 80 * e.scale + (rnd() - 0.5) * 10, x0 = e.x + dir * (rnd() * 10 * e.scale), L = (50 + rnd() * 110) * e.scale;
      ctx.lineWidth = (2.5 + rnd() * 3) * e.scale;
      ctx.beginPath(); ctx.moveTo(x0, yy);
      for (let q = 1; q <= 5; q++) ctx.lineTo(x0 + (dir * L * q) / 5, yy + Math.sin(q * 1.7 + i) * 3 * e.scale);
      ctx.stroke();
    }
  }
  void w;
}
