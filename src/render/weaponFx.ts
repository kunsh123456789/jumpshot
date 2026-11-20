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

  // ---- Rope: chain links along the verlet points (or a stretched arm for the long-arm grab) ----
  if (ws.ropeVisible && w.weapon.ropeStyle === 'arm') {
    const R = ws.rope;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const sx = px + p.facing * 14 * p.scale, sy = py - 100 * p.scale;
    // gif2 212-230: one long rubbery arm, drawn as the hero's own limb line, with a fist at the end
    ctx.strokeStyle = ink; ctx.lineWidth = 3.4 * wpp + 1;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    for (let i = 1; i < R.length; i++) ctx.lineTo(R[i].x, R[i].y);
    ctx.stroke();
    const ex = R[R.length - 1].x, ey = R[R.length - 1].y;
    ctx.fillStyle = DRAW.ink ? INK.paper : '#05060c';
    ctx.beginPath(); ctx.arc(ex, ey, 7 * p.scale, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (ws.ropeVisible) {
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

  // ---- Thrown weapon: the staff spinning end over end with two trailing crescents (gif2 54-58) ----
  if (ws.tossLeg) {
    const L = 84 * p.scale, a = ws.tossSpin, x = ws.tossX, y = ws.tossY;
    const cx = Math.cos(a), sy = Math.sin(a);
    ctx.strokeStyle = ink; ctx.lineWidth = 2.6 * wpp + 0.8;
    ctx.beginPath(); ctx.moveTo(x - cx * L, y - sy * L); ctx.lineTo(x + cx * L, y + sy * L); ctx.stroke();
    seed = step * 211 + 5;
    ctx.lineWidth = 1.5 * wpp + 0.4;
    ctx.beginPath();
    for (const end of [0, Math.PI]) {
      for (let i = 0; i < 12; i++) {
        const t = rnd(), ang = a + end - t * 1.1, r0 = L * (0.45 + rnd() * 0.25), r1 = L * (0.95 + rnd() * 0.12);
        ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 2.4 * wpp + 0.6;
    ctx.beginPath();
    for (const end of [0, Math.PI]) ctx.arc(x, y, L, a + end - 1.1, a + end);
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
    // Cursive loops along the beam (reference 76-82): a prolate cycloid, "eeee" written along the line,
    // with the phase advancing per drawing step so the loops crawl forward.
    ctx.strokeStyle = red; ctx.lineWidth = 1.8 * wpp + 0.6;
    ctx.beginPath();
    const pitch = Math.max(16, wd * 1.1), rad = wd * 0.62;
    const nPts = Math.min(900, Math.ceil((L / pitch) * 14));
    const ph = step * 1.7;
    for (let i = 0; i <= nPts; i++) {
      const s0 = (i / nPts) * L;
      const th = (s0 / pitch) * TAU + ph;
      const along = s0 + Math.cos(th) * rad * 0.9;
      const off = Math.sin(th) * rad * (0.85 + 0.15 * Math.sin(s0 * 0.05 + step));
      const px = x1 + (dx / L) * along + nx * off, py = y1 + (dy / L) * along + ny * off;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // debris flicked off the beam
    ctx.lineWidth = 1.4 * wpp + 0.4;
    ctx.beginPath();
    const nd = Math.min(18, Math.floor(L / 60));
    for (let i = 0; i < nd; i++) {
      const t = rnd(), side = rnd() < 0.5 ? -1 : 1, d = wd * (1.2 + rnd() * 2.2) * (1.4 - k);
      const bx = x1 + dx * t + nx * side * d, by = y1 + dy * t + ny * side * d;
      const a = rnd() * TAU, l = 3 + rnd() * 6;
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l);
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

// ------------------------------------------------------------ reference FX (second upload)
/**
 * Lightning (gif2 158-166): jagged bolts from the top of the page to a victim,
 * with a branch, held for a few drawings. Pooled.
 */
const MAXL = 6;
const bolts = Array.from({ length: MAXL }, () => ({ x: 0, y: 0, t: 0, life: 0, seed: 0 }));
export function lightning(x: number, y: number, seed: number): void {
  let b = bolts[0];
  for (const c of bolts) if (c.t >= c.life) { b = c; break; }
  b.x = x; b.y = y; b.t = 0; b.life = 0.28; b.seed = seed | 1;
}
/** White-crescent impact frame (gif2 322): drawn in ink on the world layer during the inverted frame, so it reads white on black. */
const cres = { x: 0, y: 0, dir: 1, t: 0, life: 0 };
export function crescentFlash(x: number, y: number, dir: number): void { cres.x = x; cres.y = y; cres.dir = dir || 1; cres.t = 0; cres.life = 0.16; }

export function updateRefFx(dt: number): void {
  for (const b of bolts) if (b.t < b.life) b.t += dt;
  if (cres.t < cres.life) cres.t += dt;
}

export function drawRefFx(ctx: CanvasRenderingContext2D, w: World, alpha: number, time: number, wpp: number, inverted: boolean): void {
  const ink = DRAW.ink ? INK.ink : '#e8eefc';
  const step = DRAW.stepped ? Math.floor((time * 60) / DRAW.stepTicks) : Math.floor(time * 30);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ---- lightning ----
  for (const b of bolts) {
    if (b.t >= b.life) continue;
    seed = b.seed + step * 17;
    const top = b.y - 760;
    ctx.strokeStyle = ink;
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass === 0 ? 5 : 2) * wpp + (pass === 0 ? 1.5 : 0.5);
      if (pass === 1) ctx.strokeStyle = DRAW.ink ? INK.paper : '#ffffff';
      ctx.beginPath();
      let x = b.x + (rnd() - 0.5) * 120, y = top;
      ctx.moveTo(x, y);
      const n = 11;
      let bx = 0, by = 0;
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        x = b.x + (rnd() - 0.5) * 90 * (1 - k) + (i === n ? 0 : (rnd() - 0.5) * 30);
        y = top + (b.y - top) * k;
        ctx.lineTo(x, y);
        if (i === 4) { bx = x; by = y; }
      }
      // one branch
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (rnd() - 0.5) * 140, by + 90);
      ctx.lineTo(bx + (rnd() - 0.5) * 200, by + 170);
      ctx.stroke();
      if (!DRAW.ink) break;
    }
  }
  // ---- whirlwind ball around the hero during whirl moves (gif2 122-124, 168-170) ----
  const p = w.player, m = p.state === 'move' ? p.move : null;
  if (m && m.fx?.whirl && p.moveFrame >= p.effStartup && p.moveFrame < p.effStartup + m.active) {
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    const cx = px, cy = py - 70 * p.scale, R = m.fx.whirl * p.scale;
    seed = (p.moveSerial * 977) ^ (step * 131);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6 * wpp + 0.5;
    ctx.beginPath();
    const rot = step * 1.3;
    for (let r = 0; r < 5; r++) {
      const rr = R * (0.45 + r * 0.13);
      const a0 = rot + r * 1.1 + rnd() * 0.5, a1 = a0 + 2.2 + rnd() * 1.2;
      for (let i = 0; i <= 10; i++) {
        const a = a0 + ((a1 - a0) * i) / 10, rj = rr * (1 + (rnd() - 0.5) * 0.08);
        const x = cx + Math.cos(a) * rj, y = cy + Math.sin(a) * rj * 0.62;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    // hatch on the leading edge
    for (let i = 0; i < 14; i++) {
      const a = rot + rnd() * TAU, r0 = R * (0.5 + rnd() * 0.3), r1 = r0 + R * 0.35;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.62);
      ctx.lineTo(cx + Math.cos(a + 0.25) * r1, cy + Math.sin(a + 0.25) * r1 * 0.62);
    }
    ctx.stroke();
  }
  // ---- white crescent (only during the inverted impact frame) ----
  if (inverted && cres.t < cres.life) {
    const R = 150, x = cres.x, y = cres.y, d = cres.dir;
    ctx.fillStyle = DRAW.ink ? INK.ink : '#000000';
    ctx.save();
    ctx.translate(x, y); ctx.scale(d, 1);
    ctx.beginPath();
    ctx.arc(0, 0, R, -Math.PI * 0.75, Math.PI * 0.75, false);
    ctx.arc(R * 0.42, -R * 0.12, R * 0.82, Math.PI * 0.68, -Math.PI * 0.68, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // a small spark at the horn
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; ctx.moveTo(x - d * R * 0.6 - Math.cos(a) * 16, y - R * 0.55 - Math.sin(a) * 16); ctx.lineTo(x - d * R * 0.6 + Math.cos(a) * 16, y - R * 0.55 + Math.sin(a) * 16); }
    ctx.stroke();
  }
  ctx.restore();
}
