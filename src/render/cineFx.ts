import type { World } from '../sim/world';
import { DRAW } from './drawStyle';
import { INK } from './ink';
import { WORLD } from '../data/tuning';
import { J } from './rig';
import { settings } from '../core/settings';

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
  // ---- freeze bubble (Special activation / picker / trace) ----
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
  // ---- Ice Spear finisher (Pixel look only): a black shaft through both of the hero's hands, a crystal ice head ----
  if (v.spear && DRAW.ink) {
    const hp = w.player, jt = hp.anim.joints, d = hp.facing || 1;
    const ax = jt[J.handA * 2], ay = jt[J.handA * 2 + 1], bx = jt[J.handB * 2], by = jt[J.handB * 2 + 1];
    const y = (ay + by) / 2;
    const back = d > 0 ? Math.min(ax, bx) : Math.max(ax, bx);
    const x1 = back - d * 95, x2 = v.spear.x2;
    sd = 1301 + step * 5;
    // the shaft: a strong ink line with grip wraps where the hands hold it
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 3.4 * wpp + 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y + (rnd() - 0.5)); ctx.lineTo(x2 - d * 40, y + (rnd() - 0.5)); ctx.stroke();
    ctx.lineWidth = 2 * wpp + 0.6; ctx.beginPath();
    for (const hx of [ax, bx]) { ctx.moveTo(hx - 3, y - 6); ctx.lineTo(hx + 3, y + 6); }
    ctx.stroke();
    // the head: a long ice crystal (paper inside, blue outline and facets) with a few frost chips
    const L = 48, Wd = 15, tipX = x2, bx2 = x2 - d * L, sx = x2 - d * L * 0.62;
    ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.blue; ctx.lineWidth = 2.8 * wpp + 0.8;
    ctx.beginPath(); ctx.moveTo(tipX, y); ctx.lineTo(sx, y - Wd); ctx.lineTo(bx2, y - 4); ctx.lineTo(bx2, y + 4); ctx.lineTo(sx, y + Wd); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath();
    ctx.moveTo(bx2, y); ctx.lineTo(tipX - d * 4, y); ctx.moveTo(sx, y - Wd); ctx.lineTo(sx + d * 10, y); ctx.lineTo(sx, y + Wd);
    for (let n = 0; n < 3; n++) { const cx = tipX - d * (8 + rnd() * 30), cy = y + (rnd() - 0.5) * 34; ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3); }
    ctx.stroke();
  }
  // ---- weapon Specials (pass 9) ----
  if (v.crack) {
    // the floor splitting both ways: a jagged rift with slabs lifting along it
    const G = WORLD.groundY, cr = v.crack;
    sd = 919 + step * 3;
    ctx.strokeStyle = ink; ctx.lineWidth = 4 * wpp + 1;
    for (const dir of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(cr.x, G);
      let x = cr.x;
      while ((x - cr.x) * dir < cr.len) { x += dir * (22 + rnd() * 26); ctx.lineTo(x, G + 2 + (rnd() - 0.5) * 12); }
      ctx.stroke();
      ctx.fillStyle = ink;
      for (let d = 60; d < cr.len; d += 110) {
        const sx = cr.x + dir * d, h = 18 + ((d * 7) % 23);
        ctx.beginPath(); ctx.moveTo(sx - 24, G); ctx.lineTo(sx - 16, G - h); ctx.lineTo(sx + 18, G - h * 0.7); ctx.lineTo(sx + 26, G); ctx.closePath(); ctx.fill();
      }
    }
  }
  if (v.freeze > 0) {
    // the screen freezing over: an icy haze, and every caught enemy locked in a block of ice
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(170, 228, 255, ${0.32 * v.freeze})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    for (const e of c.group) {
      if (e.state !== 'cine') continue;
      const hw = 46 * e.scale, top = e.y - 200 * e.scale;
      ctx.globalAlpha = 0.55 * v.freeze; ctx.fillStyle = '#cdf3ff';
      ctx.fillRect(e.x - hw, top, hw * 2, e.y - top);
      ctx.globalAlpha = v.freeze; ctx.strokeStyle = '#2a9be0'; ctx.lineWidth = 2.4 * wpp + 0.6;
      ctx.strokeRect(e.x - hw, top, hw * 2, e.y - top);
      ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(e.x - hw * 0.6, top + 14); ctx.lineTo(e.x - hw * 0.2, top + 50); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (v.scythe) {
    // the giant shadow scythe: a black crescent blade with a purple edge, sweeping around its pivot
    // A giant scythe: a crescent blade (thick in the middle, tapering to points) at the end of a long
    // handle from the hero, its leading edge at angle a; purple cutting edge and motion streaks behind.
    const s = v.scythe, back = Math.sign(Math.cos(s.a)) >= 0 ? -1 : 1, a0 = s.a + back * 0.55;
    const N = 18, W = 120;
    ctx.fillStyle = 'rgba(14, 6, 22, 0.9)';
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const t = k / N, a = a0 + (s.a - a0) * t; ctx.lineTo(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r); }
    for (let k = N; k >= 0; k--) { const t = k / N, a = a0 + (s.a - a0) * t, r = s.r - W * Math.sin(Math.PI * t) * (0.6 + 0.4 * t); ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#9b5cff'; ctx.lineWidth = 5 * wpp + 1.5;
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const t = k / N, a = a0 + (s.a - a0) * t; ctx.lineTo(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r); }
    ctx.stroke();
    // the handle: from the hero to the blade's heel
    ctx.strokeStyle = 'rgba(14, 6, 22, 0.9)'; ctx.lineWidth = 12 * wpp + 3;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(a0) * (s.r - 30), s.y + Math.sin(a0) * (s.r - 30)); ctx.stroke();
    // motion streaks trailing the cutting edge
    ctx.strokeStyle = 'rgba(155, 92, 255, 0.4)'; ctx.lineWidth = 2.4 * wpp + 0.6;
    ctx.beginPath();
    for (let k = 1; k <= 3; k++) { const r = s.r - k * 34, aa = s.a + back * 0.55; ctx.moveTo(s.x + Math.cos(s.a) * r, s.y + Math.sin(s.a) * r); ctx.arc(s.x, s.y, r, s.a, aa + back * 0.35 * k, back > 0); }
    ctx.stroke();
  }
  if (v.marks.length) {
    // Blade Storm: slashes hanging in stopped time
    for (let i = 0; i + 2 < v.marks.length; i += 3) {
      const x = v.marks[i], y = v.marks[i + 1], a = v.marks[i + 2], L = 70;
      const dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      ctx.strokeStyle = '#e22424'; ctx.lineWidth = 6 * wpp + 1.5;
      ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * wpp + 0.5;
      ctx.beginPath(); ctx.moveTo(x - dx * 0.8, y - dy * 0.8); ctx.lineTo(x + dx * 0.8, y + dy * 0.8); ctx.stroke();
    }
  }
  if (DRAW.ink) drawIceFinisher(ctx, v, step, wpp);
  if (DRAW.ink && v.lash) drawLash(ctx, v.lash, step, wpp);
  void WORLD;
  ctx.restore();
}

/**
 * The whip finisher's lash (the player's sketch): a black cord rising from the hand and dropping onto the
 * target in an arc, a crack burst at the tip; the last big crack is thicker with a longer burst.
 */
function drawLash(ctx: CanvasRenderingContext2D, l: NonNullable<NonNullable<World['cine']['ctx']>['vis']['lash']>, step: number, wpp: number): void {
  const dx = l.x2 - l.x1, rise = 60 + Math.abs(dx) * 0.25;
  const c1x = l.x1 + dx * 0.15, c1y = l.y1 - rise * 1.2, c2x = l.x1 + dx * 0.6, c2y = l.y1 - rise;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK.ink; ctx.lineWidth = (l.big ? 3.6 : 2.4) * wpp + 0.6;
  ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.bezierCurveTo(c1x, c1y, c2x, c2y, l.x2, l.y2); ctx.stroke();
  if (l.t <= (l.big ? 4 : 1)) {
    sd = 707 + step; ctx.lineWidth = (l.big ? 2.6 : 1.8) * wpp + 0.4; ctx.beginPath();
    const n = l.big ? 12 : 7, R = l.big ? 46 : 24;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rnd() * 0.4, r0 = 5 + rnd() * 4, r1 = R * (0.6 + rnd() * 0.5); ctx.moveTo(l.x2 + Math.cos(a) * r0, l.y2 + Math.sin(a) * r0); ctx.lineTo(l.x2 + Math.cos(a) * r1, l.y2 + Math.sin(a) * r1); }
    ctx.stroke();
    ctx.strokeStyle = INK.red; ctx.lineWidth = 1.4 * wpp + 0.3; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = rnd() * TAU, r1 = R * 0.7; ctx.moveTo(l.x2, l.y2); ctx.lineTo(l.x2 + Math.cos(a) * r1, l.y2 + Math.sin(a) * r1); }
    ctx.stroke();
  }
  ctx.restore();
}

/** Chunk layout over a standing body (dx, dy from the feet in body units, half-width, half-height). */
const CHUNKS = [[0, -182, 28, 26], [0, -128, 30, 36], [-40, -132, 16, 34], [40, -132, 16, 34], [-16, -46, 18, 44], [16, -46, 18, 44]];

/**
 * Ice Special finisher (Pixel look, from the player's sketch + reference clip frame 62): blue-outlined ice
 * chunks locking every body part, a full black impact frame with white wedges and red streaks bursting
 * from the shatter point, then the chunks flying apart as shards.
 */
function drawIceFinisher(ctx: CanvasRenderingContext2D, v: NonNullable<World['cine']['ctx']>['vis'], step: number, wpp: number): void {
  if (v.encase.length) {
    ctx.strokeStyle = INK.blue; ctx.lineWidth = 2.4 * wpp + 0.6;
    for (const b of v.encase) {
      if (b.k <= 0) continue;
      sd = 401 + Math.floor(b.x) + step;
      for (const [dx, dy, hw, hh] of CHUNKS) {
        const cx = b.x + dx * b.s, cy = b.y + dy * b.s, rx = hw * b.s * b.k + 4, ry = hh * b.s * b.k + 4;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + 0.3, j = 0.86 + rnd() * 0.22;
          const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - rx * 0.5, cy - ry * 0.55); ctx.lineTo(cx - rx * 0.2, cy - ry * 0.15); ctx.stroke();
      }
    }
  }
  if (v.impact) {
    const t = v.impact.t, m = ctx.getTransform();
    const sx = m.a * v.impact.x + m.c * v.impact.y + m.e, sy = m.b * v.impact.x + m.d * v.impact.y + m.f;
    const W = ctx.canvas.width, H = ctx.canvas.height, R = Math.hypot(W, H);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (t < 4 && !settings.reduceFlashes) { ctx.fillStyle = INK.ink; ctx.fillRect(0, 0, W, H); }
    sd = 77 + step;
    ctx.fillStyle = INK.paper;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rnd() * 0.3, wd = 0.03 + rnd() * 0.05, r0 = 30 + rnd() * 70 + t * 30;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
      ctx.lineTo(sx + Math.cos(a - wd) * R, sy + Math.sin(a - wd) * R); ctx.lineTo(sx + Math.cos(a + wd) * R, sy + Math.sin(a + wd) * R);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = INK.red; ctx.lineWidth = 4 * wpp + 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU, r0 = 60 + rnd() * 80;
      ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0); ctx.lineTo(sx + Math.cos(a) * R * 0.6, sy + Math.sin(a) * R * 0.6);
    }
    ctx.stroke();
    ctx.restore();
  }
  const s = v.shards;
  if (s.length) {
    ctx.fillStyle = INK.paper; ctx.strokeStyle = INK.blue; ctx.lineWidth = 2.2 * wpp + 0.5;
    for (let i = 0; i < s.length; i += 7) {
      const x = s[i], y = s[i + 1], a = s[i + 4], r = s[i + 6];
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + 2.3) * r * 0.6, y + Math.sin(a + 2.3) * r * 0.6);
      ctx.lineTo(x + Math.cos(a + 3.9) * r * 0.75, y + Math.sin(a + 3.9) * r * 0.75);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
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
