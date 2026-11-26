import type { World } from '../sim/world';
import { DRAW } from './drawStyle';
import { INK } from './ink';
import { WORLD } from '../data/tuning';
import { V2 } from '../data/weapons/tuning';

/**
 * The reworked movesets' world visuals (sim/moveset2.ts state): floor shockwaves,
 * ice patches and walls, smoke puffs and pending dagger cuts, souls, doom skulls,
 * grave hands, tie ropes and the fists' fury aura. Seeded jitter per drawing step so
 * it boils with the page.
 */
let sd = 1;
const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;
const TAU = Math.PI * 2;

export function drawMoveset2Fx(ctx: CanvasRenderingContext2D, w: World, time: number, wpp: number): void {
  const v = w.v2;
  const ink = DRAW.ink ? INK.ink : '#e8eefc';
  const G = WORLD.groundY;
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ---- ice patches: a glossy pale-blue sheet on the floor with glints ----
  for (const p of v.patches) {
    if (!p.on) continue;
    const a = Math.min(1, p.t / 30);
    sd = 211 + Math.floor(p.x) + step;
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = '#bfeeff';
    ctx.beginPath(); ctx.ellipse(p.x, G + 4, p.r, 12, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9 * a;
    ctx.strokeStyle = '#3fb8ff'; ctx.lineWidth = 1.6 * wpp + 0.5;
    ctx.beginPath(); ctx.ellipse(p.x, G + 4, p.r, 12, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * wpp + 0.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const x = p.x + (rnd() - 0.5) * p.r * 1.6; ctx.moveTo(x, G + 1); ctx.lineTo(x + 18, G - 2); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // ---- ice walls ----
  for (const wl of v.walls) {
    if (!wl.on) continue;
    const a = Math.min(1, wl.t / 20), rise = Math.min(1, (wl.max - wl.t) / 8);
    const h = 230 * rise;
    ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#cdf3ff';
    ctx.beginPath(); ctx.moveTo(wl.x - 26, G); ctx.lineTo(wl.x - 20, G - h); ctx.lineTo(wl.x + 4, G - h - 22); ctx.lineTo(wl.x + 26, G - h * 0.9); ctx.lineTo(wl.x + 24, G); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = a; ctx.strokeStyle = '#2a9be0'; ctx.lineWidth = 2.2 * wpp + 0.6; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(wl.x - 10, G - h * 0.2); ctx.lineTo(wl.x - 4, G - h * 0.8); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // ---- floor shockwaves: a rolling crest with a crack trailing behind ----
  for (const wv of v.waves) {
    if (!wv.on) continue;
    sd = 401 + wv.t + Math.floor(wv.x);
    const crest = 34 + Math.sin(wv.t * 0.6) * 6;
    ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 4 * wpp + 1;
    ctx.beginPath();
    ctx.moveTo(wv.x - wv.dir * 40, G);
    ctx.quadraticCurveTo(wv.x - wv.dir * 10, G - crest, wv.x + wv.dir * 14, G);
    ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = 2 * wpp + 0.6;
    ctx.beginPath();
    let x = wv.x - wv.dir * 30;
    ctx.moveTo(x, G + 2);
    for (let i = 0; i < 5; i++) { x -= wv.dir * (16 + rnd() * 14); ctx.lineTo(x, G + 2 + (rnd() - 0.5) * 8); }
    ctx.stroke();
    // flying grit
    ctx.fillStyle = ink;
    for (let i = 0; i < 3; i++) ctx.fillRect(wv.x + (rnd() - 0.5) * 30, G - 8 - rnd() * 30, 4, 4);
  }
  // ---- tie ropes between bound enemies ----
  for (const t of v.ties) {
    if (!t.on || !t.a || !t.b) continue;
    sd = 97 + step;
    ctx.strokeStyle = ink; ctx.lineWidth = 2 * wpp + 0.6;
    ctx.beginPath(); ctx.moveTo(t.a.cx, t.a.cy);
    for (let k = 1; k <= 6; k++) { const q = k / 6; ctx.lineTo(t.a.cx + (t.b.cx - t.a.cx) * q + (rnd() - 0.5) * 6, t.a.cy + (t.b.cy - t.a.cy) * q + Math.sin(q * Math.PI) * 26 + (rnd() - 0.5) * 6); }
    ctx.stroke();
  }
  // ---- enemies: grave hands, doom skulls, pending cuts ----
  for (const e of w.enemies) {
    if (!e.alive) continue;
    if (e.grave > 0) {
      sd = 31 + e.id * 7 + step;
      ctx.strokeStyle = '#3a1450'; ctx.lineWidth = 3 * wpp + 0.8;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        const bx = e.x + s * 16 * e.scale;
        ctx.moveTo(bx, G); ctx.lineTo(bx + s * 4, G - 40 * e.scale);
        for (let f = -1; f <= 1; f++) { ctx.moveTo(bx + s * 4, G - 40 * e.scale); ctx.lineTo(bx + s * 4 + f * 8, G - 52 * e.scale + rnd() * 4); }
      }
      ctx.stroke();
    }
    const marks = e.doomT > 0 ? 3 : e.doom;
    if (marks > 0) {
      const y = e.y - 190 * e.scale, flash = e.doomT > 0 && (step & 1);
      for (let i = 0; i < marks; i++) drawSkull(ctx, e.x + (i - (marks - 1) / 2) * 20, y, 7, flash ? '#ff2e88' : '#7a2aa8', wpp);
    }
  }
  for (const q of v.pending) {
    if (!q.on || !q.v) continue;
    const e = q.v;
    ctx.strokeStyle = '#e22424'; ctx.lineWidth = 2.2 * wpp + 0.5;
    ctx.beginPath(); ctx.moveTo(e.cx - 26, e.cy - 30); ctx.lineTo(e.cx + 26, e.cy + 26); ctx.stroke();
  }
  // ---- smoke puffs ----
  for (let i = 0; i < v.nPuffs; i++) {
    const x = v.puffs[i * 3], y = v.puffs[i * 3 + 1], t = Math.abs(v.puffs[i * 3 + 2]);
    if (v.puffs[i * 3 + 2] < 0) continue; // cut markers draw as slashes above
    sd = 71 + i * 13;
    const k = t / 30;
    ctx.globalAlpha = 0.75 * (1 - k);
    ctx.fillStyle = '#6a6a78';
    for (let b = 0; b < 6; b++) { const a = (b / 6) * TAU + rnd(); const r = (20 + k * 50) * (0.6 + rnd() * 0.5); ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 16 + k * 18, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // ---- souls: purple ghost wisps flying to the hero ----
  for (const s of v.souls) {
    if (!s.on) continue;
    ctx.fillStyle = '#9b5cff'; ctx.strokeStyle = '#3a1450'; ctx.lineWidth = 1.6 * wpp + 0.4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 11, Math.PI, 0); ctx.lineTo(s.x + 11, s.y + 10);
    for (let k = 0; k < 4; k++) ctx.lineTo(s.x + 11 - (k + 0.5) * 5.5, s.y + (k % 2 ? 10 : 4));
    ctx.lineTo(s.x - 11, s.y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 5, s.y - 3, 3, 3); ctx.fillRect(s.x + 2, s.y - 3, 3, 3);
  }
  // ---- fury aura on the hero ----
  const p = w.player;
  if (w.weapon.passive?.fury && v.furyT > 0 && p.alive) {
    sd = 53 + step;
    const k = Math.min(1, v.furyT / 40);
    ctx.strokeStyle = '#ff3b1f'; ctx.lineWidth = 2.4 * wpp + 0.6; ctx.globalAlpha = 0.85 * k;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6; const r0 = 50 + rnd() * 20, r1 = r0 + 22 + rnd() * 26; ctx.moveTo(p.cx + Math.cos(a) * r0, p.cy + Math.sin(a) * r0 * 1.3); ctx.lineTo(p.cx + Math.cos(a) * r1, p.cy + Math.sin(a) * r1 * 1.3); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (w.weapon.passive?.fury && v.fury > 0 && p.alive) {
    // the filling fury gauge: a thin bar under the hero
    ctx.fillStyle = '#3a4566'; ctx.fillRect(p.x - 30, G + 14, 60, 4);
    ctx.fillStyle = '#ff3b1f'; ctx.fillRect(p.x - 30, G + 14, 60 * v.fury, 4);
  }
  void V2;
  ctx.restore();
}

function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, wpp: number): void {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillRect(x - r * 0.6, y + r * 0.6, r * 1.2, r * 0.6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - r * 0.55, y - r * 0.2, r * 0.4, r * 0.4); ctx.fillRect(x + r * 0.15, y - r * 0.2, r * 0.4, r * 0.4);
  void wpp;
}
