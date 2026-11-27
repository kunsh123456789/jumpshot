import type { World } from '../sim/world';
import { DRAW } from './drawStyle';
import { INK } from './ink';
import { WORLD } from '../data/tuning';

/**
 * Visuals for the third weapon batch, in the same hand-drawn ink language:
 * projectiles (ink blobs, paper planes, rocket fists, bubbles, ice shards),
 * erupting ground spikes, status effects on enemies (ice blocks, bubbles,
 * bleed drops, ink snares), chain-lightning arcs, thrown shield / yo-yo /
 * scythe, and the whip / lightning / ice / ink / scythe beam styles.
 */
let seed = 1;
const rnd = (): number => { seed = (Math.imul(seed, 1103515245) + 12345) | 0; return ((seed >>> 8) & 0xffffff) / 16777216; };
const TAU = Math.PI * 2;
const ICE = '#2436e6';
const col = (c: string): string => (DRAW.ink ? c : c === INK.ink ? '#e8eefc' : c);

export function drawExtraFx(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number): void {
  const X = w.wpn.x;
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  const ink = col(INK.ink), red = DRAW.ink ? INK.red : '#ff4a4a', paper = DRAW.ink ? INK.paper : '#05060c';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ---- status effects on enemies ----
  for (const e of w.enemies) {
    if (!e.alive) continue;
    const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha, s = e.scale;
    if (e.frozen > 0) {
      // ice block: a slanted outlined box with hatching
      ctx.strokeStyle = ICE; ctx.lineWidth = 2 * wpp + 0.6;
      const bw = 70 * s, bh = 150 * s;
      ctx.beginPath(); ctx.rect(ex - bw / 2, ey - bh, bw, bh); ctx.stroke();
      seed = e.id * 31;
      ctx.lineWidth = 1 * wpp + 0.3; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const yy = ey - bh * rnd(), xx = ex - bw / 2 + bw * rnd(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 10 * s, yy - 14 * s); }
      ctx.stroke();
    }
    if (e.bubble > 0) {
      const r = 70 * s, cy = ey - 62 * s;
      ctx.strokeStyle = ICE; ctx.lineWidth = 2 * wpp + 0.6;
      ctx.beginPath(); ctx.arc(ex, cy, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex - r * 0.35, cy - r * 0.4, r * 0.25, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    }
    if (e.bleed > 0 && ((step + e.id) % 3 === 0)) {
      ctx.fillStyle = red;
      seed = e.id * 7 + step;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(ex + (rnd() - 0.5) * 30 * s, ey - 40 * s - rnd() * 60 * s, 2.5 * s, 0, TAU); ctx.fill(); }
    }
    if (e.snare > 0) {
      ctx.strokeStyle = ink; ctx.lineWidth = 2 * wpp + 0.6;
      seed = e.id * 13 + step;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, r = 46 * s * (1 + (rnd() - 0.5) * 0.15); const x = ex + Math.cos(a) * r, y = ey - 6 + Math.sin(a) * r * 0.25; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  // ---- ground spikes ----
  for (const s of X.spikes) {
    if (!s.on || s.delay > 0) continue;
    const k = s.t < 4 ? s.t / 4 : 1 - (s.t - 4) / 12;
    const h = 80 * Math.max(0, k);
    if (DRAW.ink && s.move && s.move.id.startsWith('ic')) {
      // Pixel look, Ice (from the player's sketch): blue-outlined crystal shards, a zig-zag row that grows
      // taller the further it runs from the hero.
      const H = h * (0.75 + 0.32 * s.i), G0 = WORLD.groundY;
      ctx.fillStyle = paper; ctx.strokeStyle = ICE; ctx.lineWidth = 2.2 * wpp + 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x - 22, G0); ctx.lineTo(s.x - 16, G0 - H * 0.5); ctx.lineTo(s.x - 9, G0 - H * 0.42);
      ctx.lineTo(s.x - 1, G0 - H); ctx.lineTo(s.x + 9, G0 - H * 0.55); ctx.lineTo(s.x + 15, G0 - H * 0.66); ctx.lineTo(s.x + 22, G0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x - 1, G0 - H * 0.82); ctx.lineTo(s.x + 2, G0 - H * 0.35); ctx.stroke();
      continue;
    }
    ctx.fillStyle = ink;
    ctx.beginPath();
    for (const o of [-14, 0, 14]) { const hh = h * (o === 0 ? 1 : 0.65); ctx.moveTo(s.x + o - 9, WORLD.groundY); ctx.lineTo(s.x + o, WORLD.groundY - hh); ctx.lineTo(s.x + o + 9, WORLD.groundY); }
    ctx.fill();
  }
  // ---- projectiles ----
  for (const s of X.shots) {
    if (!s.on) continue;
    const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha, a = Math.atan2(s.vy, s.vx), r = s.radius;
    ctx.save(); ctx.translate(x, y);
    switch (s.kind) {
      case 'blob':
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-Math.cos(a) * r * 1.3, -Math.sin(a) * r * 1.3, r * 0.45, 0, TAU); ctx.fill();
        break;
      case 'plane':
        ctx.rotate(a); ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = 1.8 * wpp + 0.5;
        ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r, -r * 0.9); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 1.4, 0); ctx.lineTo(-r * 0.5, 0); ctx.stroke();
        break;
      case 'fist':
        ctx.rotate(a); ctx.strokeStyle = ink; ctx.fillStyle = paper; ctx.lineWidth = 2 * wpp + 0.6;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = red; ctx.beginPath();
        seed = step * 9 + s.hits[0];
        for (let i = 0; i < 5; i++) { const yy = (rnd() - 0.5) * r * 1.4; ctx.moveTo(-r, yy); ctx.lineTo(-r * (2.2 + rnd() * 1.5), yy * 1.3); }
        ctx.stroke();
        break;
      case 'bubble':
        ctx.strokeStyle = ICE; ctx.lineWidth = 2 * wpp + 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.3, Math.PI, Math.PI * 1.5); ctx.stroke();
        break;
      case 'shard':
        ctx.rotate(a); ctx.strokeStyle = ICE; ctx.fillStyle = paper; ctx.lineWidth = 2 * wpp + 0.5;
        ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(0, -r * 0.5); ctx.lineTo(-r, 0); ctx.lineTo(0, r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
    }
    ctx.restore();
  }
  // ---- chain lightning arcs ----
  ctx.strokeStyle = DRAW.ink ? INK.blue : '#9fd8ff'; ctx.lineWidth = 2.4 * wpp + 0.8;
  for (let i = 0; i < X.nArcs; i++) {
    const k = i * 5, x1 = X.arcs[k], y1 = X.arcs[k + 1], x2 = X.arcs[k + 2], y2 = X.arcs[k + 3];
    seed = (x1 | 0) * 31 + step * 7;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let q = 1; q < 7; q++) { const t = q / 7; ctx.lineTo(x1 + (x2 - x1) * t + (rnd() - 0.5) * 26, y1 + (y2 - y1) * t + (rnd() - 0.5) * 26); }
    ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

/** Thrown shield / yo-yo / scythe (the staff keeps its own drawing in weaponFx). */
export function drawToss(ctx: CanvasRenderingContext2D, w: World, ink: string, wpp: number, step: number): void {
  const ws = w.wpn, p = w.player, x = ws.tossX, y = ws.tossY, a = ws.tossSpin, s = p.scale;
  ctx.strokeStyle = ink; ctx.lineWidth = 2.4 * wpp + 0.7;
  if (ws.tossDraw === 'shield') {
    ctx.fillStyle = DRAW.ink ? INK.paper : '#05060c';
    ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 26 * s * Math.abs(Math.cos(a * 0.5)) + 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, TAU); ctx.stroke();
  } else if (ws.tossDraw === 'yoyo') {
    // string back to the hand
    const hx = p.x + p.facing * 24 * s, hy = p.y - 96 * s;
    ctx.lineWidth = 1 * wpp + 0.4;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x, y); ctx.stroke();
    ctx.lineWidth = 2.4 * wpp + 0.7;
    ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12 * s, y + Math.sin(a) * 12 * s); ctx.lineTo(x - Math.cos(a) * 12 * s, y - Math.sin(a) * 12 * s); ctx.stroke();
  } else {
    // scythe: pole + crescent blade, spinning, with a hatched crescent trail
    const L = 80 * s, cx = Math.cos(a), sy = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x - cx * L, y - sy * L); ctx.lineTo(x + cx * L, y + sy * L); ctx.stroke();
    const bx = x + cx * L, by = y + sy * L;
    ctx.beginPath(); ctx.arc(bx - sy * 30 * s, by + cx * 30 * s, 34 * s, a - 1.6, a + 0.2); ctx.stroke();
    seed = step * 17;
    ctx.lineWidth = 1.3 * wpp + 0.3; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const ang = a - rnd() * 1.2, r0 = L * 0.6, r1 = L * 1.05; ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); }
    ctx.stroke();
  }
}

/** Non-laser beams: whip lash, lightning bolt, ice lance, ink stroke, scythe reach. */
export function drawStyledBeam(ctx: CanvasRenderingContext2D, w: World, ink: string, wpp: number, step: number): void {
  const ws = w.wpn;
  const k = ws.beamT / ws.beamMax;
  const x1 = ws.beamX1, y1 = ws.beamY1, x2 = ws.beamX2, y2 = ws.beamY2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  seed = step * 53 + 1;
  if (ws.beamStyle === 'whip' || ws.beamStyle === 'scythe') {
    // a lashing rope: wavy, thick at the handle, with a crack at the tip
    ctx.strokeStyle = ink; ctx.lineWidth = 3 * wpp + 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    const amp = 18 * k;
    for (let i = 1; i <= 16; i++) { const t = i / 16, wv = Math.sin(t * Math.PI * 3 + step) * amp * (1 - t); ctx.lineTo(x1 + dx * t + nx * wv, y1 + dy * t + ny * wv); }
    ctx.stroke();
    ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath();
    for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = 6 + rnd() * 14; ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.cos(a) * r, y2 + Math.sin(a) * r); }
    ctx.stroke();
    if (ws.beamStyle === 'scythe') { ctx.lineWidth = 2.4 * wpp + 0.7; ctx.beginPath(); ctx.arc(x2 - nx * 26, y2 - ny * 26, 30, Math.atan2(ny, nx) - 1.5, Math.atan2(ny, nx) + 0.3); ctx.stroke(); }
  } else if (ws.beamStyle === 'lightning') {
    ctx.strokeStyle = DRAW.ink ? INK.blue : '#9fd8ff';
    for (const lw of [4.5, 1.8]) {
      ctx.lineWidth = lw * wpp + 0.8; ctx.beginPath(); ctx.moveTo(x1, y1);
      seed = step * 53 + 1;
      for (let i = 1; i < 10; i++) { const t = i / 10, j = (rnd() - 0.5) * 40 * k; ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j); }
      ctx.lineTo(x2, y2); ctx.stroke();
      if (DRAW.ink) ctx.strokeStyle = INK.paper;
    }
  } else if (ws.beamStyle === 'ice') {
    ctx.strokeStyle = ICE; ctx.lineWidth = ws.beamW * 0.3 * (0.5 + 0.5 * k); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath();
    for (let i = 0; i < 9; i++) { const t = rnd(), sx = x1 + dx * t, sy = y1 + dy * t, o = (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 14); ctx.moveTo(sx, sy); ctx.lineTo(sx + nx * o + dx / L * 8, sy + ny * o + dy / L * 8); }
    ctx.stroke();
  } else {
    // ink: a thick brush stroke that dries (thins) over the flash
    ctx.strokeStyle = ink; ctx.lineWidth = ws.beamW * (0.25 + 0.6 * k);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + nx * 20, (y1 + y2) / 2 + ny * 20, x2, y2); ctx.stroke();
  }
}
