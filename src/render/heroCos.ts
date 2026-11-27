import { HERO_LOOK } from '../data/hero';
import { STYLE, WORLD } from '../data/tuning';
import type { Fighter } from '../sim/fighter';
import { J, JOINT_N } from './rig';

/**
 * The hero's wardrobe for the Pixel look only (the player's standing rule: new visuals go to the main
 * Pixel style, never to the neon or interpolated renderers). Called from render/ink.ts:
 *  - femaleJoints: the Female body (narrower shoulders, wider hips) as a joint-copy tweak
 *  - drawHeroBack: neck and back items behind the body (scarves, capes, ribbon, backpack, wings)
 *  - drawHeroFront: hair, hand gear, Fists skins, footwear and badges over the body
 * Everything flutters from the hero's velocity and the drawing step, so it boils with the page and
 * needs no state. Render-only: nothing here touches the sim.
 */
export interface CosPal { ink: string; paper: string; red: string; blue: string; dither: string }
const TAU = Math.PI * 2;
const fj = new Float32Array(JOINT_N * 2);

const X = (j: Float32Array, k: number): number => j[k * 2];
const Y = (j: Float32Array, k: number): number => j[k * 2 + 1];

/** Female proportions: shoulders pulled in, hips pushed out (limbs follow their root joint). Returns a copy. */
export function femaleJoints(f: Fighter, j: Float32Array): Float32Array {
  if (f.kind !== 'player' || HERO_LOOK.body !== 'female') return j;
  fj.set(j);
  const s = f.scale;
  const move = (root: number, chain: number[], dx: number, dy: number) => { for (const q of [root, ...chain]) { fj[q * 2] += dx; fj[q * 2 + 1] += dy; } };
  // shoulders 35% closer to the chest line, and a touch lower
  for (const [sh, el, hd] of [[J.shA, J.elbA, J.handA], [J.shB, J.elbB, J.handB]]) {
    const dx = (X(j, J.chest) - X(j, sh)) * 0.35;
    move(sh, [el, hd], dx, 1.5 * s);
  }
  // hips: out sideways (the hip joints sit almost on the spine in profile, so add a fixed width too)
  const face = X(j, J.hipA) >= X(j, J.hipB) ? 1 : -1;
  for (const [hp, kn, ft, sd] of [[J.hipA, J.kneeA, J.footA, 1], [J.hipB, J.kneeB, J.footB, -1]]) {
    const dx = (X(j, hp) - X(j, J.hip)) * 0.8 + sd * face * 5 * s;
    move(hp, [], dx, 0);
    // knees follow halfway, feet stay planted
    fj[kn * 2] += dx * 0.5;
    void ft;
  }
  return fj;
}

/** Flutter: a per-drawing wobble (the Pixel look's boil) and how hard the hero is moving. */
function wind(f: Fighter, time: number): { step: number; back: number; sp: number; lift: number } {
  const step = Math.floor(time * 12);
  const face = f.anim.dFace || f.facing || 1;
  const back = Math.abs(f.vx) > 40 ? -Math.sign(f.vx) : -face;
  const sp = Math.min(1, Math.abs(f.vx) / 520);
  const lift = f.grounded ? 0 : Math.max(-1, Math.min(1, -f.vy / 900));
  return { step, back, sp, lift };
}
const wob = (step: number, i: number): number => Math.sin(step * 1.9 + i * 2.3);

/** A flowing strip (scarf tail / ribbon) from (x, y): n segments trailing behind. */
function tail(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, n: number, back: number, sp: number, lift: number, step: number, amp: number, droop: number): void {
  ctx.beginPath(); ctx.moveTo(x, y);
  const seg = len / n;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const px = x + back * seg * i * (0.45 + 0.55 * sp);
    const py = y + seg * i * droop * (1 - sp * 0.8) - lift * seg * i * 0.5 + wob(step, i) * amp * k;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

export function drawHeroBack(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, headR: number, time: number, wpp: number, pal: CosPal): void {
  const b = HERO_LOOK.back;
  const female = HERO_LOOK.body === 'female';
  if (b === 'none' && !female) return;
  const s = f.scale, w = wind(f, time);
  const nx = X(j, J.neck), ny = Y(j, J.neck), cx = X(j, J.chest), cy = Y(j, J.chest), hx = X(j, J.hip), hy = Y(j, J.hip);
  const headX = X(j, J.head), headY = Y(j, J.head);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = 2.2 * wpp + 0.4;
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink;
  // Female: a ponytail swinging behind the head (drawn first so the head outline covers its root).
  if (female) {
    const tx = headX + w.back * headR * 0.9, ty = headY - headR * 0.35;
    const ex = tx + w.back * headR * (1.3 + w.sp * 0.9), ey = ty + headR * (1.4 - w.sp * 0.9 - w.lift * 0.6) + wob(w.step, 1) * headR * 0.25;
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(tx, ty - headR * 0.35);
    ctx.quadraticCurveTo(ex + w.back * headR * 0.2, ty - headR * 0.2, ex, ey);
    ctx.quadraticCurveTo(tx + w.back * headR * 0.2, ey - headR * 0.2, tx, ty + headR * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(tx, ty, headR * 0.28, 0, TAU); ctx.fill();
  }
  switch (b) {
    case 'scarf': case 'ninja': {
      const col = b === 'scarf' ? pal.red : pal.ink;
      ctx.strokeStyle = col; ctx.lineWidth = (b === 'scarf' ? 4 : 3.4) * wpp + 0.6;
      ctx.beginPath(); ctx.moveTo(nx - 6 * s, ny + 2 * s); ctx.lineTo(nx + 6 * s, ny + 3 * s); ctx.stroke();
      const len = (b === 'scarf' ? 46 : 84) * s;
      tail(ctx, nx + w.back * 3 * s, ny + 3 * s, len, b === 'scarf' ? 3 : 6, w.back, w.sp, w.lift, w.step, 5 * s, 0.9);
      if (b === 'ninja') { ctx.lineWidth = 2.6 * wpp + 0.4; tail(ctx, nx + w.back * 3 * s, ny + 5 * s, len * 0.8, 5, w.back, w.sp, w.lift, w.step + 3, 6 * s, 1.1); }
      break;
    }
    case 'ribbon': {
      ctx.strokeStyle = pal.red; ctx.lineWidth = 1.8 * wpp + 0.4;
      ctx.beginPath(); ctx.arc(nx, ny + 2 * s, 4 * s, 0, TAU); ctx.stroke();
      tail(ctx, nx + w.back * 3 * s, ny + 3 * s, 110 * s, 10, w.back, w.sp, w.lift, w.step, 12 * s, 0.6);
      break;
    }
    case 'cape': case 'tattered': case 'page': {
      // top at the shoulders, hem trailing behind at hip / knee height
      const swing = (28 + 50 * w.sp) * s;
      const hemY = Math.min(WORLD.groundY - 4, hy + 28 * s - w.sp * 30 * s - w.lift * 32 * s);
      const fx0 = hx + w.back * 4 * s, bx0 = hx + w.back * swing + wob(w.step, 2) * 3 * s;
      ctx.fillStyle = b === 'page' ? pal.paper : pal.red;
      ctx.beginPath();
      ctx.moveTo(nx - w.back * 4 * s, ny + 1 * s);
      ctx.lineTo(nx + w.back * 10 * s, ny + 2 * s);
      ctx.quadraticCurveTo(cx + w.back * (10 + swing * 0.4), cy, bx0, hemY + wob(w.step, 3) * 4 * s);
      if (b === 'tattered') {
        for (let i = 1; i <= 5; i++) { const k = i / 5; ctx.lineTo(bx0 + (fx0 - bx0) * (k - 0.1), hemY - (i % 2 ? 10 : 0) * s + wob(w.step, i) * 2 * s); }
      }
      ctx.lineTo(fx0, hemY - 6 * s);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (b === 'page') {
        // notebook page: blue rules and a red margin
        ctx.save(); ctx.clip();
        ctx.strokeStyle = pal.blue; ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
        for (let yy = ny + 10 * s; yy < hemY; yy += 9 * s) { ctx.moveTo(Math.min(nx, bx0) - 80 * s, yy); ctx.lineTo(Math.max(nx, bx0) + 80 * s, yy); }
        ctx.stroke();
        ctx.strokeStyle = pal.red; ctx.beginPath(); ctx.moveTo(nx + w.back * 10 * s, ny); ctx.lineTo(fx0 + w.back * 14 * s, hemY + 10 * s); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'backpack': {
      const bx = (nx + cx) / 2 + w.back * 9 * s, by = (ny + cy) / 2 + 4 * s;
      ctx.fillStyle = pal.paper;
      ctx.beginPath(); ctx.rect(bx - 7 * s, by - 10 * s, 14 * s, 22 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(bx - 5 * s, by + 2 * s, 10 * s, 7 * s); ctx.stroke();
      ctx.strokeStyle = pal.blue; ctx.beginPath(); ctx.moveTo(bx - w.back * 7 * s, by - 8 * s); ctx.lineTo(nx, ny + 4 * s); ctx.stroke();
      break;
    }
    case 'wings': {
      // line-art wings off the upper back; they flap while airborne
      const rx = (nx + cx) / 2 + w.back * 4 * s, ry = (ny + cy) / 2;
      const flap = f.grounded ? 0.1 : Math.sin(w.step * 1.6) * 0.5;
      ctx.fillStyle = pal.paper; ctx.lineWidth = 1.8 * wpp + 0.4;
      for (const [sz, off] of [[1, 0], [0.8, 0.35]] as [number, number][]) {
        const ang = 0.75 + off + flap, L = 64 * s * sz;
        const tx = rx + w.back * Math.cos(ang) * L, ty = ry - Math.sin(ang) * L;
        ctx.beginPath(); ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + w.back * L * 0.2, ty - 6 * s, tx, ty);
        // scalloped trailing edge: three feathers back to the root
        for (let i = 1; i <= 3; i++) { const k = i / 3; ctx.quadraticCurveTo(tx + (rx - tx) * (k - 0.2) + w.back * 10 * s, ty + (ry + 14 * s - ty) * (k - 0.1) + 10 * s, tx + (rx - tx) * k, ty + (ry - ty) * k + 6 * s * (1 - k)); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/** A five-point star. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}

export function drawHeroFront(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, time: number, wpp: number, pal: CosPal): void {
  const L = HERO_LOOK, s = f.scale, w = wind(f, time), face = f.anim.dFace || f.facing || 1;
  const fistSkin = f.weapon === 'fists' ? L.skins.fists : 'default';
  if (L.hands === 'none' && L.feet === 'none' && L.badge === 'none' && fistSkin === 'default') return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = 2 * wpp + 0.4;
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  // ---- hands (general gear, then the Fists weapon skins over them) ----
  for (const [hand, elbow] of [[J.handA, J.elbA], [J.handB, J.elbB]] as const) {
    const x = X(j, hand), y = Y(j, hand), ex = X(j, elbow), ey = Y(j, elbow);
    const dx0 = x - ex, dy0 = y - ey, ln = Math.hypot(dx0, dy0) || 1, dx = dx0 / ln, dy = dy0 / ln, nx = -dy, ny = dx;
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
    switch (L.hands) {
      case 'fingerless': {
        ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(x - dx * 1.5 * s, y - dy * 1.5 * s, 4.2 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = pal.paper; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
        for (const k of [-1.6, 0, 1.6]) { ctx.moveTo(x + nx * k * s + dx * 1 * s, y + ny * k * s + dy * 1 * s); ctx.lineTo(x + nx * k * s + dx * 2.6 * s, y + ny * k * s + dy * 2.6 * s); }
        ctx.stroke();
        break;
      }
      case 'spiked': {
        ctx.beginPath(); ctx.arc(x, y, 4.6 * s, 0, TAU); ctx.fill();
        ctx.beginPath();
        for (const k of [0.55, 0.75]) { const px = ex + dx0 * k, py = ey + dy0 * k; ctx.moveTo(px + nx * 3 * s, py + ny * 3 * s); ctx.lineTo(px + nx * 8 * s, py + ny * 8 * s); ctx.moveTo(px - nx * 3 * s, py - ny * 3 * s); ctx.lineTo(px - nx * 8 * s, py - ny * 8 * s); }
        ctx.moveTo(x + dx * 4 * s, y + dy * 4 * s); ctx.lineTo(x + dx * 9 * s, y + dy * 9 * s);
        ctx.stroke();
        ctx.lineWidth = 3.4 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(ex + dx0 * 0.5, ey + dy0 * 0.5); ctx.lineTo(ex + dx0 * 0.85, ey + dy0 * 0.85); ctx.stroke();
        break;
      }
      case 'glowband': {
        const px = ex + dx0 * 0.78, py = ey + dy0 * 0.78;
        ctx.strokeStyle = pal.blue; ctx.lineWidth = 3.2 * wpp + 0.6;
        ctx.beginPath(); ctx.moveTo(px + nx * 5 * s, py + ny * 5 * s); ctx.lineTo(px - nx * 5 * s, py - ny * 5 * s); ctx.stroke();
        ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + (w.step % 4) * 0.4, r0 = 7 * s, r1 = 10.5 * s; ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); }
        ctx.stroke();
        break;
      }
      case 'brass': {
        ctx.fillStyle = pal.paper; ctx.lineWidth = 1.4 * wpp + 0.3;
        for (const k of [-1, 0, 1]) { const qx = x + dx * 3.5 * s + nx * k * 2.8 * s, qy = y + dy * 3.5 * s + ny * k * 2.8 * s; ctx.beginPath(); ctx.arc(qx, qy, 1.9 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'flaming': {
        ctx.fillStyle = pal.red; ctx.beginPath();
        const n = 5;
        ctx.moveTo(x + nx * 5 * s, y + ny * 5 * s);
        for (let i = 0; i <= n; i++) {
          const k = i / n - 0.5, hgt = (10 + ((w.step + i * 3) % 4) * 3) * s;
          ctx.lineTo(x + nx * k * 10 * s, y + ny * k * 10 * s - hgt * (i % 2 ? 1 : 0.45));
        }
        ctx.lineTo(x - nx * 5 * s, y - ny * 5 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(x, y, 3.6 * s, 0, TAU); ctx.fill();
        break;
      }
    }
    // Fists skins (the weapon's own look; drawn over the general hand gear)
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink;
    switch (fistSkin) {
      case 'boxing': {
        ctx.fillStyle = pal.red; ctx.beginPath(); ctx.arc(x + dx * 2 * s, y + dy * 2 * s, 9.5 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.rect(x - dx * 6 * s - 4 * s, y - dy * 6 * s - 4 * s, 8 * s, 8 * s); ctx.fill(); ctx.stroke();
        break;
      }
      case 'oven': {
        const ox = x + dx * 3 * s, oy = y + dy * 3 * s;
        ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.ellipse(ox, oy, 8.5 * s, 6.5 * s, Math.atan2(dy, dx), 0, TAU); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip(); ctx.strokeStyle = pal.blue; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
        for (let k = -9; k <= 9; k += 4) { ctx.moveTo(ox + k * s, oy - 9 * s); ctx.lineTo(ox + k * s, oy + 9 * s); ctx.moveTo(ox - 9 * s, oy + k * s); ctx.lineTo(ox + 9 * s, oy + k * s); }
        ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.arc(ox + nx * 6 * s, oy + ny * 6 * s, 2.6 * s, 0, TAU); ctx.stroke();
        break;
      }
      case 'lobster': {
        const ox = x + dx * 2 * s, oy = y + dy * 2 * s, open = 0.35 + 0.15 * Math.sin(w.step * 2);
        ctx.fillStyle = pal.red;
        for (const sd of [1, -1]) {
          const a = Math.atan2(dy, dx) + sd * open;
          ctx.beginPath(); ctx.moveTo(ox, oy);
          ctx.quadraticCurveTo(ox + Math.cos(a + sd * 0.6) * 9 * s, oy + Math.sin(a + sd * 0.6) * 9 * s, ox + Math.cos(a) * 13 * s, oy + Math.sin(a) * 13 * s);
          ctx.quadraticCurveTo(ox + Math.cos(a) * 6 * s, oy + Math.sin(a) * 6 * s, ox, oy);
          ctx.fill(); ctx.stroke();
        }
        break;
      }
      case 'foam': {
        // a giant foam "#1" hand: big mitt with the index finger up
        const ox = x + dx * 4 * s, oy = y + dy * 4 * s;
        ctx.fillStyle = pal.paper;
        ctx.beginPath(); ctx.arc(ox, oy, 9 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(ox - 2.6 * s, oy - 21 * s, 5.2 * s, 14 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pal.blue; ctx.font = `bold ${Math.round(7 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('#1', ox, oy + 1 * s);
        break;
      }
    }
  }
  // ---- feet ----
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  if (L.feet !== 'none') {
    for (const [foot, knee] of [[J.footA, J.kneeA], [J.footB, J.kneeB]] as const) {
      const x = X(j, foot), y = Y(j, foot), kx = X(j, knee), ky = Y(j, knee);
      const dx = x - kx, dy = y - ky;
      switch (L.feet) {
        case 'sneakers': case 'rocket': {
          ctx.fillStyle = L.feet === 'rocket' ? pal.paper : pal.ink;
          ctx.beginPath(); ctx.moveTo(x - face * 4 * s, y + 2 * s); ctx.lineTo(x - face * 4 * s, y - 4 * s); ctx.quadraticCurveTo(x + face * 8 * s, y - 4 * s, x + face * 10 * s, y + 2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (L.feet === 'sneakers') { ctx.strokeStyle = pal.paper; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath(); ctx.moveTo(x - face * 3 * s, y + 0.5 * s); ctx.lineTo(x + face * 9 * s, y + 0.5 * s); ctx.stroke(); ctx.strokeStyle = pal.ink; ctx.lineWidth = lw; }
          else if (!f.grounded || Math.abs(f.vx) > 200) {
            ctx.fillStyle = pal.red; ctx.beginPath();
            const fl = (8 + (w.step % 3) * 4) * s;
            ctx.moveTo(x - face * 4 * s, y + 3 * s); ctx.lineTo(x - face * 9 * s, y + 3 * s + fl * 0.6); ctx.lineTo(x - face * 2 * s, y + 3 * s + fl * 0.3); ctx.lineTo(x + face * 1 * s, y + 3 * s + fl); ctx.lineTo(x + face * 4 * s, y + 3 * s);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'boots': {
          ctx.lineWidth = 5.5 * wpp + 1; ctx.beginPath(); ctx.moveTo(x - dx * 0.4, y - dy * 0.4); ctx.lineTo(x, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - face * 3 * s, y + 1 * s); ctx.lineTo(x + face * 8 * s, y + 1 * s); ctx.stroke();
          ctx.lineWidth = lw;
          break;
        }
        case 'bandaged': {
          ctx.lineWidth = 1.3 * wpp + 0.3; ctx.beginPath();
          const nx = -dy / (Math.hypot(dx, dy) || 1), ny = dx / (Math.hypot(dx, dy) || 1);
          for (const k of [0.62, 0.74, 0.86, 0.98]) { const px = kx + dx * k, py = ky + dy * k; ctx.moveTo(px + nx * 4 * s, py + ny * 4 * s - 1.5 * s); ctx.lineTo(px - nx * 4 * s, py - ny * 4 * s + 1.5 * s); }
          ctx.stroke(); ctx.lineWidth = lw;
          break;
        }
        case 'flipflops': {
          // the sole lags behind the foot and flops when walking or in the air
          const flop = !f.grounded ? 0.5 : Math.abs(f.vx) > 60 ? 0.35 * Math.sin(w.step * 2.2 + foot) : 0;
          const a = flop * -face;
          ctx.strokeStyle = pal.blue; ctx.lineWidth = 2.6 * wpp + 0.4; ctx.beginPath();
          ctx.moveTo(x - face * 5 * s, y + 2 * s); ctx.lineTo(x - face * 5 * s + Math.cos(a) * face * 15 * s, y + 2 * s + Math.sin(a) * 15 * s); ctx.stroke();
          ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath(); ctx.moveTo(x + face * 2 * s, y + 1 * s); ctx.lineTo(x, y - 3 * s); ctx.stroke();
          ctx.lineWidth = lw;
          break;
        }
      }
    }
  }
  // ---- belts and badges ----
  if (L.badge !== 'none') {
    const hx = X(j, J.hip), hy = Y(j, J.hip), cx = X(j, J.chest), cy = Y(j, J.chest), nx0 = X(j, J.neck), ny0 = Y(j, J.neck);
    if (L.badge === 'belt') {
      ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(hx - 7 * s, hy - 3 * s); ctx.lineTo(hx + 7 * s, hy - 3 * s); ctx.stroke();
      ctx.fillStyle = pal.red; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.ellipse(hx + face * 3 * s, hy - 3 * s, 9 * s, 7 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.paper; star(ctx, hx + face * 3 * s, hy - 3 * s, 4.5 * s); ctx.fill();
    } else {
      const bx = cx + (nx0 - cx) * 0.45 + face * 4 * s, by = cy + (ny0 - cy) * 0.45;
      if (L.badge === 'sheriff') { ctx.fillStyle = pal.paper; star(ctx, bx, by, 8.5 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(bx, by, 1.4 * s, 0, TAU); ctx.fill(); }
      else {
        const r = STYLE.ranks[Math.max(0, Math.min(STYLE.ranks.length - 1, L.rank))];
        ctx.fillStyle = L.rank >= 4 ? pal.red : pal.paper; ctx.beginPath(); ctx.arc(bx, by, 9 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.rank >= 4 ? pal.paper : pal.ink; ctx.font = `bold ${Math.round((r.length > 1 ? 7 : 11) * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r, bx, by + 0.5 * s);
      }
    }
  }
  ctx.restore();
}
