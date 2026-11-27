import { HERO_LOOK, colorHex, type ColorId, type ColorSlot } from '../data/hero';
import { STYLE, WORLD } from '../data/tuning';
import type { Fighter } from '../sim/fighter';
import { J, JOINT_N } from './rig';
import { INKLOOK } from '../data/inkLook';

const INK_RED = '#e22424', INK_PAPER = '#ffffff', INK_BLACK = '#000000';
const HEX = (id: ColorId): string | null => colorHex(id);
/** The player's colour for a slot, or `base` when the slot is on Default. */
export function tint(slot: ColorSlot, base: string): string { return HEX(HERO_LOOK.colors[slot]) ?? base; }
type PalKey = 'ink' | 'paper' | 'red' | 'blue';
/** A palette whose `main` entry (the item's own main colour) is swapped for the slot's chosen colour. */
export function slotPal<P extends { ink: string; paper: string; red: string; blue: string }>(pal: P, slot: ColorSlot, main: PalKey): P {
  const c = HEX(HERO_LOOK.colors[slot]);
  return c ? { ...pal, [main]: c } : pal;
}
/** Main colour of each item (the part the slot colour replaces). */
const MAIN_BACK: Record<string, PalKey> = { scarf: 'red', ninja: 'ink', cape: 'red', tattered: 'red', page: 'paper', ribbon: 'red', backpack: 'paper', wings: 'paper', butterfly: 'paper', devil: 'red' };
const MAIN_HANDS: Record<string, PalKey> = { wraps: 'red', mitts: 'ink', fingerless: 'ink', spiked: 'ink', glowband: 'blue', brass: 'paper', flaming: 'red', paws: 'paper' };
const MAIN_FIST: Record<string, PalKey> = { boxing: 'red', oven: 'paper', lobster: 'red', foam: 'paper' };
const MAIN_GEAR: Record<string, PalKey> = { cap: 'red', tophat: 'ink', crown: 'red', halo: 'blue', ears: 'ink', goggles: 'ink', horns: 'red', flower: 'red' };
const MAIN_LEGS: Record<string, PalKey> = { bandaged: 'ink', warmers: 'paper', socks: 'paper' };
const MAIN_SHOES: Record<string, PalKey> = { sneakers: 'ink', boots: 'ink', rocket: 'paper', flipflops: 'blue' };
const MAIN_BADGE: Record<string, PalKey> = { belt: 'red', sheriff: 'paper', rank: 'paper' };
/** Palettes for the shared headgear / hand-gear drawer (render/heroGear.ts), with the player's colours. */
export function gearPals<P extends { ink: string; paper: string; red: string; blue: string }>(pal: P): { gear: P; hands: P } {
  return { gear: slotPal(pal, 'headgear', MAIN_GEAR[HERO_LOOK.headgear] ?? 'red'), hands: slotPal(pal, 'hands', MAIN_HANDS[HERO_LOOK.hands] ?? 'red') };
}
/** Fill, plus an ink outline when the fill is white (white hair would vanish into the page). */
function hfill(ctx: CanvasRenderingContext2D): void {
  ctx.fill();
  if (ctx.fillStyle === INK_PAPER) { const st = ctx.strokeStyle, lw = ctx.lineWidth; ctx.strokeStyle = INK_BLACK; ctx.lineWidth = Math.max(lw, 1.4); ctx.stroke(); ctx.strokeStyle = st; ctx.lineWidth = lw; }
}

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

/** Female proportions: shoulders pulled in, hips pushed out (limbs follow their root joint), longer legs. Render-only. Returns a copy. */
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
  // slightly taller, all in the legs: everything above the knees rises, the knees half as much, the feet stay put
  const up = 6 * s;
  for (let q = 0; q < JOINT_N; q++) {
    if (q === J.footA || q === J.footB) continue;
    fj[q * 2 + 1] -= q === J.kneeA || q === J.kneeB ? up * 0.5 : up;
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
  const hair = HERO_LOOK.hair;
  if (b === 'none' && hair === 'none') return;
  const s = f.scale, w = wind(f, time);
  const nx = X(j, J.neck), ny = Y(j, J.neck), cx = X(j, J.chest), cy = Y(j, J.chest), hx = X(j, J.hip), hy = Y(j, J.hip);
  const headX = X(j, J.head), headY = Y(j, J.head);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = 2.2 * wpp + 0.4;
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink;
  const bp = slotPal(pal, 'back', MAIN_BACK[b] ?? 'red');
  switch (b) {
    case 'scarf': case 'ninja': {
      const col = b === 'scarf' ? bp.red : bp.ink;
      ctx.strokeStyle = col; ctx.lineWidth = (b === 'scarf' ? 4 : 3.4) * wpp + 0.6;
      ctx.beginPath(); ctx.moveTo(nx - 6 * s, ny + 2 * s); ctx.lineTo(nx + 6 * s, ny + 3 * s); ctx.stroke();
      const len = (b === 'scarf' ? 46 : 84) * s;
      tail(ctx, nx + w.back * 3 * s, ny + 3 * s, len, b === 'scarf' ? 3 : 6, w.back, w.sp, w.lift, w.step, 5 * s, 0.9);
      if (b === 'ninja') { ctx.lineWidth = 2.6 * wpp + 0.4; tail(ctx, nx + w.back * 3 * s, ny + 5 * s, len * 0.8, 5, w.back, w.sp, w.lift, w.step + 3, 6 * s, 1.1); }
      break;
    }
    case 'ribbon': {
      ctx.strokeStyle = bp.red; ctx.lineWidth = 1.8 * wpp + 0.4;
      ctx.beginPath(); ctx.arc(nx, ny + 2 * s, 4 * s, 0, TAU); ctx.stroke();
      tail(ctx, nx + w.back * 3 * s, ny + 3 * s, 110 * s, 10, w.back, w.sp, w.lift, w.step, 12 * s, 0.6);
      break;
    }
    case 'cape': case 'tattered': case 'page': {
      // top at the shoulders, hem trailing behind at hip / knee height
      const swing = (28 + 50 * w.sp) * s;
      const hemY = Math.min(WORLD.groundY - 4, hy + 28 * s - w.sp * 30 * s - w.lift * 32 * s);
      const fx0 = hx + w.back * 4 * s, bx0 = hx + w.back * swing + wob(w.step, 2) * 3 * s;
      ctx.fillStyle = b === 'page' ? bp.paper : bp.red;
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
        ctx.strokeStyle = bp.blue; ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
        for (let yy = ny + 10 * s; yy < hemY; yy += 9 * s) { ctx.moveTo(Math.min(nx, bx0) - 80 * s, yy); ctx.lineTo(Math.max(nx, bx0) + 80 * s, yy); }
        ctx.stroke();
        ctx.strokeStyle = bp.red; ctx.beginPath(); ctx.moveTo(nx + w.back * 10 * s, ny); ctx.lineTo(fx0 + w.back * 14 * s, hemY + 10 * s); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'backpack': {
      const bx = (nx + cx) / 2 + w.back * 9 * s, by = (ny + cy) / 2 + 4 * s;
      ctx.fillStyle = bp.paper;
      ctx.beginPath(); ctx.rect(bx - 7 * s, by - 10 * s, 14 * s, 22 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(bx - 5 * s, by + 2 * s, 10 * s, 7 * s); ctx.stroke();
      ctx.strokeStyle = bp.blue; ctx.beginPath(); ctx.moveTo(bx - w.back * 7 * s, by - 8 * s); ctx.lineTo(nx, ny + 4 * s); ctx.stroke();
      break;
    }
    case 'wings': {
      // line-art wings off the upper back; they flap while airborne
      const rx = (nx + cx) / 2 + w.back * 4 * s, ry = (ny + cy) / 2;
      const flap = f.grounded ? 0.1 : Math.sin(w.step * 1.6) * 0.5;
      ctx.fillStyle = bp.paper; ctx.lineWidth = 1.8 * wpp + 0.4;
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
    case 'butterfly': {
      // two lobed wings off the upper back (big upper, small lower), red spots; they flutter when airborne
      const rx = (nx + cx) / 2 + w.back * 3 * s, ry = (ny + cy) / 2 + 2 * s;
      const flap = f.grounded ? 0 : Math.sin(w.step * 2.2) * 0.35;
      ctx.fillStyle = bp.paper; ctx.lineWidth = 1.8 * wpp + 0.4;
            for (const [ang, L, wd] of [[0.85 + flap, 50, 0.36], [-0.75 - flap * 0.5, 32, 0.4]] as [number, number, number][]) {
        const tx = rx + w.back * Math.cos(ang) * L * s, ty = ry - Math.sin(ang) * L * s;
        const mx = (rx + tx) / 2, my = (ry + ty) / 2, ux = (tx - rx) / (L * s), uy = (ty - ry) / (L * s), px = -uy * L * s * wd, py = ux * L * s * wd;
        // a teardrop that is fattest near its outer end, like a butterfly's wing
        ctx.beginPath(); ctx.moveTo(rx, ry);
        ctx.bezierCurveTo(mx + px * 0.6, my + py * 0.6, tx + px * 1.1, ty + py * 1.1, tx, ty);
        ctx.bezierCurveTo(tx - px * 1.1, ty - py * 1.1, mx - px * 0.6, my - py * 0.6, rx, ry);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = bp.red; ctx.beginPath(); ctx.arc(rx + (tx - rx) * 0.72, ry + (ty - ry) * 0.72, L * s * 0.11, 0, TAU); ctx.fill(); ctx.fillStyle = bp.paper;
      }
      break;
    }
    case 'devil': {
      // a thin S-curved tail from the hips with a red spade tip; it sways
      const sw = wob(w.step, 4) * 4 * s, k = w.back;
      const ex = hx + k * (30 + 14 * w.sp) * s, ey = hy - (6 + 10 * w.sp) * s + sw;
      ctx.lineWidth = 1.8 * wpp + 0.4; ctx.beginPath(); ctx.moveTo(hx + k * 3 * s, hy);
      ctx.bezierCurveTo(hx + k * 14 * s, hy + 18 * s, hx + k * 22 * s, hy - 18 * s + sw, ex, ey);
      ctx.stroke();
      const a = Math.atan2(ey - (hy - 18 * s + sw), ex - (hx + k * 22 * s));
      ctx.fillStyle = bp.red; ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 9 * s, ey + Math.sin(a) * 9 * s);
      ctx.lineTo(ex + Math.cos(a + 2.2) * 6 * s, ey + Math.sin(a + 2.2) * 6 * s);
      ctx.lineTo(ex - Math.cos(a) * 1.5 * s, ey - Math.sin(a) * 1.5 * s);
      ctx.lineTo(ex + Math.cos(a - 2.2) * 6 * s, ey + Math.sin(a - 2.2) * 6 * s);
      ctx.closePath(); ctx.fill();
      break;
    }
  }
  // Hair behind the head, over any cape or scarf (the head outline is drawn later and covers its roots), for either body.
  const hp = slotPal(pal, 'hair', 'ink');
  if (hair !== 'none' && hair !== 'ponytail') drawHair(ctx, headX, headY, headR, w, hp);
  if (hair === 'ponytail') {
    const tx = headX + w.back * headR * 0.9, ty = headY - headR * 0.35;
    const ex = tx + w.back * headR * (1.3 + w.sp * 0.9), ey = ty + headR * (1.4 - w.sp * 0.9 - w.lift * 0.6) + wob(w.step, 1) * headR * 0.25;
    ctx.fillStyle = hp.ink;
    ctx.beginPath();
    ctx.moveTo(tx, ty - headR * 0.35);
    ctx.quadraticCurveTo(ex + w.back * headR * 0.2, ty - headR * 0.2, ex, ey);
    ctx.quadraticCurveTo(tx + w.back * headR * 0.2, ey - headR * 0.2, tx, ty + headR * 0.3);
    ctx.closePath(); hfill(ctx);
    ctx.beginPath(); ctx.arc(tx, ty, headR * 0.28, 0, TAU); hfill(ctx);
  }
  ctx.restore();
}

/** Female hair behind the head (the ponytail is drawn inline above): long wavy hair or space buns. */
function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, w: { step: number; back: number; sp: number; lift: number }, pal: CosPal): void {
  const bk = w.back;
  ctx.fillStyle = pal.ink;
  if (HERO_LOOK.hair === 'buns') {
    for (const ox of [-0.75, 0.75]) { ctx.beginPath(); ctx.arc(x + ox * r, y - 0.95 * r, r * 0.52, 0, TAU); hfill(ctx); }
    return;
  }
  if (HERO_LOOK.hair === 'messybun') {
    // a lumpy bun high at the back with loose strands poking out and a wisp at the nape
    const bx = x + bk * r * 0.55, by = y - r * 1.05;
    for (const [ox, oy, rr] of [[0, 0, 0.5], [bk * 0.3, 0.12, 0.36], [-bk * 0.2, -0.2, 0.34], [bk * 0.1, -0.3, 0.3]]) { ctx.beginPath(); ctx.arc(bx + ox * r, by + oy * r, rr * r, 0, TAU); hfill(ctx); }
    ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath();
    ctx.moveTo(bx + bk * r * 0.3, by - r * 0.3); ctx.quadraticCurveTo(bx + bk * r * 0.8, by - r * 0.7, bx + bk * r * 0.9, by - r * 0.35);
    ctx.moveTo(bx - bk * r * 0.1, by - r * 0.45); ctx.quadraticCurveTo(bx, by - r * 0.95, bx + bk * r * 0.25, by - r * 0.9);
    ctx.moveTo(x + bk * r * 0.85, y + r * 0.3); ctx.quadraticCurveTo(x + bk * r * 1.1, y + r * 0.8 + wob(w.step, 3) * r * 0.1, x + bk * r * 0.85, y + r * 1.1);
    ctx.stroke();
    return;
  }
  if (HERO_LOOK.hair === 'afro') {
    // a big round afro: a bumpy ring of curls round the head (the head is drawn over its middle)
    const cx = x + bk * r * 0.12, cy = y - r * 0.3, R = r * 1.45;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.95, 0, TAU); hfill(ctx);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.95, r * 0.36, 0, TAU); hfill(ctx); }
    return;
  }
  if (HERO_LOOK.hair === 'bangs') {
    // long straight hair down the back (the blunt fringe is drawn in front of the head)
    const L = r * (3.0 - w.sp * 1.2 - w.lift * 0.8), ex = x + bk * r * (1.1 + w.sp * 2.2), ey = y + L;
    ctx.beginPath();
    ctx.moveTo(x - bk * r * 0.3, y - r * 1.2);
    ctx.quadraticCurveTo(x + bk * r * 1.7, y - r * 1.1, x + bk * r * 1.4, y + r * 0.4);
    ctx.lineTo(ex + bk * r * 0.2, ey);
    ctx.lineTo(ex - bk * r * 0.7, ey - r * 0.1);
    ctx.quadraticCurveTo(x + bk * r * 0.5, y + r * 0.8, x + bk * r * 0.1, y);
    ctx.closePath(); hfill(ctx);
    return;
  }
  // long wavy hair to mid-back: a wavy outer edge that streams back in a run and lifts in the air
  const L = r * (3.1 - w.sp * 1.2 - w.lift * 0.8), ex = x + bk * r * (1.0 + w.sp * 2.2), ey = y + L;
  ctx.beginPath();
  ctx.moveTo(x - bk * r * 0.3, y - r * 1.2);
  ctx.quadraticCurveTo(x + bk * r * 1.9, y - r * 1.2, x + bk * r * 1.55, y + r * 0.2);
  const n = 5;
  for (let i = 1; i <= n; i++) {
    const k = i / n, px = x + bk * r * 1.55 + (ex - x - bk * r * 1.55) * k, py = y + r * 0.2 + (ey - y - r * 0.2) * k;
    ctx.quadraticCurveTo(px + bk * r * 0.45 * (i % 2 ? 1 : -1), py - r * 0.25, px + wob(w.step, i) * r * 0.08, py);
  }
  ctx.quadraticCurveTo(ex - bk * r * 0.6, ey - r * 0.6, x + bk * r * 0.35, y + r * 0.9);
  ctx.quadraticCurveTo(x + bk * r * 0.2, y + r * 0.3, x + bk * r * 0.1, y);
  ctx.closePath(); hfill(ctx);
}

/** The Flower (headgear): a five-petal flower over the ear. */
function drawHeadFlower(ctx: CanvasRenderingContext2D, x0: number, y0: number, r: number, face: number, wpp: number): void {
  const bx = x0 - face * r * 0.55, by = y0 - r * 0.8;
  ctx.save();
  ctx.fillStyle = tint('headgear', INK_RED); ctx.strokeStyle = INK_BLACK; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * r * 0.28, by + Math.sin(a) * r * 0.28, r * 0.22, 0, TAU); hfill(ctx); }
  ctx.fillStyle = ctx.fillStyle === INK_PAPER ? INK_RED : INK_PAPER; ctx.beginPath(); ctx.arc(bx, by, r * 0.14, 0, TAU); ctx.fill();
  void wpp;
  ctx.restore();
}

/** Hair in front of the head: the wavy hair's swept fringe and the blunt bangs (either body). */
function drawHairFront(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, pal: CosPal): void {
  const s = f.scale, face = f.anim.dFace || f.facing || 1;
  const r = f.anim.rig.headR * s * INKLOOK.headScale, x0 = X(j, J.head), y0 = Y(j, J.head);
  pal = slotPal(pal, 'hair', 'ink');
  if (HERO_LOOK.hair === 'bangs') {
    // a blunt-cut fringe straight across the forehead
    ctx.fillStyle = pal.ink; ctx.beginPath();
    ctx.arc(x0, y0, r * 1.02, Math.PI * 1.2, Math.PI * 1.8);
    ctx.lineTo(x0 + r * 0.62, y0 - r * 0.55); ctx.lineTo(x0 - r * 0.62, y0 - r * 0.55);
    ctx.closePath(); hfill(ctx);
  }
  if (HERO_LOOK.hair === 'wavy') {
    ctx.fillStyle = pal.ink; ctx.beginPath();
    ctx.moveTo(x0 - face * r * 0.35, y0 - r * 0.95);
    ctx.quadraticCurveTo(x0 + face * r * 0.55, y0 - r * 1.15, x0 + face * r * 0.88, y0 - r * 0.45);
    ctx.quadraticCurveTo(x0 + face * r * 0.45, y0 - r * 0.78, x0 - face * r * 0.35, y0 - r * 0.95);
    ctx.closePath(); hfill(ctx);
  }
}


/** Hair bow: a two-loop bow with a knot, high at the back of the head (colour: the Bow slot, red by default). */
function drawBow(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, wpp: number): void {
  const r = f.anim.rig.headR * f.scale * INKLOOK.headScale, x0 = X(j, J.head), y0 = Y(j, J.head), face = f.anim.dFace || f.facing || 1;
  const big = HERO_LOOK.hair === 'afro' ? 1.5 : 1;
  const bx = x0 - face * r * 0.5 * big, by = y0 - r * 0.95 * big;
  ctx.fillStyle = tint('bow', INK_RED); ctx.strokeStyle = INK_BLACK; ctx.lineWidth = 1 * wpp + 0.3;
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + sd * r * 0.5, by - r * 0.75, bx + sd * r * 0.95, by - r * 0.35);
    ctx.quadraticCurveTo(bx + sd * r * 0.85, by + r * 0.3, bx, by);
    ctx.closePath(); hfill(ctx);
  }
  ctx.fillStyle = ctx.fillStyle === INK_PAPER ? INK_RED : INK_PAPER; ctx.beginPath(); ctx.arc(bx, by, r * 0.14, 0, TAU); ctx.fill();
}

/** Devil horns: two small red horns curving up and out of the top of the head. */
function drawHorns(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, wpp: number, pal: CosPal): void {
  const r = f.anim.rig.headR * f.scale * INKLOOK.headScale, x0 = X(j, J.head), y0 = Y(j, J.head);
  ctx.fillStyle = tint('headgear', pal.red); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * wpp + 0.3; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) {
    const bx = x0 + sd * r * 0.5, by = y0 - r * 0.82;
    ctx.beginPath();
    ctx.moveTo(bx - sd * r * 0.28, by + r * 0.1);
    ctx.quadraticCurveTo(bx + sd * r * 0.1, by - r * 0.35, bx + sd * r * 0.45, by - r * 0.85);
    ctx.quadraticCurveTo(bx + sd * r * 0.45, by - r * 0.2, bx + sd * r * 0.3, by + r * 0.15);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
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
  if (f.kind !== 'player') return;
  if (L.hair === 'wavy' || L.hair === 'bangs') { ctx.save(); drawHairFront(ctx, f, j, pal); ctx.restore(); }
  if (L.bow === 'bow') { ctx.save(); drawBow(ctx, f, j, wpp); ctx.restore(); }
  if (L.headgear === 'horns') { ctx.save(); drawHorns(ctx, f, j, wpp, pal); ctx.restore(); }
  if (L.headgear === 'flower') drawHeadFlower(ctx, X(j, J.head), Y(j, J.head), f.anim.rig.headR * s * INKLOOK.headScale, face, wpp);
  if (L.hands === 'none' && L.arms === 'none' && L.shoes === 'none' && L.legs === 'none' && L.badge === 'none' && fistSkin === 'default') return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = 2 * wpp + 0.4;
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  // ---- hands (general gear, then the Fists weapon skins over them) ----
  for (const [hand, elbow] of [[J.handA, J.elbA], [J.handB, J.elbB]] as const) {
    const x = X(j, hand), y = Y(j, hand), ex = X(j, elbow), ey = Y(j, elbow);
    const dx0 = x - ex, dy0 = y - ey, ln = Math.hypot(dx0, dy0) || 1, dx = dx0 / ln, dy = dy0 / ln, nx = -dy, ny = dx;
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
    if (L.arms === 'warmers') {
      // bunched, ribbed sleeves over the forearms
      const apl = slotPal(pal, 'arms', 'paper'), wd = 4.6 * s;
      const ax = ex + dx0 * 0.22, ay = ey + dy0 * 0.22, bx = ex + dx0 * 0.86, by = ey + dy0 * 0.86;
      ctx.fillStyle = apl.paper; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * wpp + 0.4; ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const t = i / 4, bul = wd * (1 + (i % 2) * 0.25); ctx.lineTo(ax + (bx - ax) * t + nx * bul, ay + (by - ay) * t + ny * bul); }
      for (let i = 4; i >= 0; i--) { const t = i / 4, bul = wd * (1 + (i % 2) * 0.25); ctx.lineTo(ax + (bx - ax) * t - nx * bul, ay + (by - ay) * t - ny * bul); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
      for (let t = 0.25; t < 0.95; t += 0.25) { const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t; ctx.moveTo(mx + nx * wd, my + ny * wd); ctx.lineTo(mx - nx * wd, my - ny * wd); }
      ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
    }
    const hpl = slotPal(pal, 'hands', MAIN_HANDS[L.hands] ?? 'ink');
    switch (L.hands) {
      case 'paws': {
        // cat paws: a round mitt with three toe bumps and red beans
        const ox = x + dx * 2 * s, oy = y + dy * 2 * s;
        ctx.fillStyle = hpl.paper; ctx.strokeStyle = hpl.ink; ctx.lineWidth = 1.6 * wpp + 0.4;
        ctx.beginPath(); ctx.arc(ox, oy, 6.5 * s, 0, TAU); ctx.fill(); ctx.stroke();
        for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.arc(ox + dx * 5.5 * s + nx * k * 3.6 * s, oy + dy * 5.5 * s + ny * k * 3.6 * s, 2.4 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = hpl.paper === INK_RED ? INK_PAPER : INK_RED;
        ctx.beginPath(); ctx.arc(ox, oy, 2.6 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'fingerless': {
        ctx.fillStyle = hpl.ink; ctx.beginPath(); ctx.arc(x - dx * 1.5 * s, y - dy * 1.5 * s, 4.2 * s, 0, TAU); ctx.fill();
        ctx.strokeStyle = hpl.paper; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
        for (const k of [-1.6, 0, 1.6]) { ctx.moveTo(x + nx * k * s + dx * 1 * s, y + ny * k * s + dy * 1 * s); ctx.lineTo(x + nx * k * s + dx * 2.6 * s, y + ny * k * s + dy * 2.6 * s); }
        ctx.stroke();
        break;
      }
      case 'spiked': {
        ctx.fillStyle = hpl.ink; ctx.strokeStyle = hpl.ink; ctx.beginPath(); ctx.arc(x, y, 4.6 * s, 0, TAU); ctx.fill();
        ctx.beginPath();
        for (const k of [0.55, 0.75]) { const px = ex + dx0 * k, py = ey + dy0 * k; ctx.moveTo(px + nx * 3 * s, py + ny * 3 * s); ctx.lineTo(px + nx * 8 * s, py + ny * 8 * s); ctx.moveTo(px - nx * 3 * s, py - ny * 3 * s); ctx.lineTo(px - nx * 8 * s, py - ny * 8 * s); }
        ctx.moveTo(x + dx * 4 * s, y + dy * 4 * s); ctx.lineTo(x + dx * 9 * s, y + dy * 9 * s);
        ctx.stroke();
        ctx.lineWidth = 3.4 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(ex + dx0 * 0.5, ey + dy0 * 0.5); ctx.lineTo(ex + dx0 * 0.85, ey + dy0 * 0.85); ctx.stroke();
        break;
      }
      case 'glowband': {
        const px = ex + dx0 * 0.78, py = ey + dy0 * 0.78;
        ctx.strokeStyle = hpl.blue; ctx.lineWidth = 3.2 * wpp + 0.6;
        ctx.beginPath(); ctx.moveTo(px + nx * 5 * s, py + ny * 5 * s); ctx.lineTo(px - nx * 5 * s, py - ny * 5 * s); ctx.stroke();
        ctx.lineWidth = 1.2 * wpp + 0.2; ctx.beginPath();
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + (w.step % 4) * 0.4, r0 = 7 * s, r1 = 10.5 * s; ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); }
        ctx.stroke();
        break;
      }
      case 'brass': {
        ctx.fillStyle = hpl.paper; ctx.lineWidth = 1.4 * wpp + 0.3;
        for (const k of [-1, 0, 1]) { const qx = x + dx * 3.5 * s + nx * k * 2.8 * s, qy = y + dy * 3.5 * s + ny * k * 2.8 * s; ctx.beginPath(); ctx.arc(qx, qy, 1.9 * s, 0, TAU); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'flaming': {
        ctx.fillStyle = hpl.red; ctx.beginPath();
        const n = 5;
        ctx.moveTo(x + nx * 5 * s, y + ny * 5 * s);
        for (let i = 0; i <= n; i++) {
          const k = i / n - 0.5, hgt = (10 + ((w.step + i * 3) % 4) * 3) * s;
          ctx.lineTo(x + nx * k * 10 * s, y + ny * k * 10 * s - hgt * (i % 2 ? 1 : 0.45));
        }
        ctx.lineTo(x - nx * 5 * s, y - ny * 5 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hpl.ink; ctx.beginPath(); ctx.arc(x, y, 3.6 * s, 0, TAU); ctx.fill();
        break;
      }
    }
    // Fists skins (the weapon's own look; drawn over the general hand gear)
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink;
    const fpl = slotPal(pal, 'skin', MAIN_FIST[fistSkin] ?? 'red');
    switch (fistSkin) {
      case 'boxing': {
        ctx.fillStyle = fpl.red; ctx.beginPath(); ctx.arc(x + dx * 2 * s, y + dy * 2 * s, 9.5 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = fpl.paper; ctx.beginPath(); ctx.rect(x - dx * 6 * s - 4 * s, y - dy * 6 * s - 4 * s, 8 * s, 8 * s); ctx.fill(); ctx.stroke();
        break;
      }
      case 'oven': {
        const ox = x + dx * 3 * s, oy = y + dy * 3 * s;
        ctx.fillStyle = fpl.paper; ctx.beginPath(); ctx.ellipse(ox, oy, 8.5 * s, 6.5 * s, Math.atan2(dy, dx), 0, TAU); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip(); ctx.strokeStyle = fpl.blue; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath();
        for (let k = -9; k <= 9; k += 4) { ctx.moveTo(ox + k * s, oy - 9 * s); ctx.lineTo(ox + k * s, oy + 9 * s); ctx.moveTo(ox - 9 * s, oy + k * s); ctx.lineTo(ox + 9 * s, oy + k * s); }
        ctx.stroke(); ctx.restore();
        ctx.beginPath(); ctx.arc(ox + nx * 6 * s, oy + ny * 6 * s, 2.6 * s, 0, TAU); ctx.stroke();
        break;
      }
      case 'lobster': {
        const ox = x + dx * 2 * s, oy = y + dy * 2 * s, open = 0.35 + 0.15 * Math.sin(w.step * 2);
        ctx.fillStyle = fpl.red;
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
        ctx.fillStyle = fpl.paper;
        ctx.beginPath(); ctx.arc(ox, oy, 9 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(ox - 2.6 * s, oy - 21 * s, 5.2 * s, 14 * s); ctx.fill(); ctx.stroke();
        ctx.fillStyle = fpl.blue; ctx.font = `bold ${Math.round(7 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('#1', ox, oy + 1 * s);
        break;
      }
    }
  }
  // ---- legs (under the shoes), then shoes ----
  ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
  const lpl = slotPal(pal, 'legs', MAIN_LEGS[L.legs] ?? 'paper'), spl = slotPal(pal, 'shoes', MAIN_SHOES[L.shoes] ?? 'ink');
  for (const [foot, knee] of [[J.footA, J.kneeA], [J.footB, J.kneeB]] as const) {
    const x = X(j, foot), y = Y(j, foot), kx = X(j, knee), ky = Y(j, knee);
    const dx = x - kx, dy = y - ky;
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
    switch (L.legs) {
        case 'warmers': case 'socks': {
          // a thick paper sleeve on the lower leg: ribbed and bunched (warmers) or a straight knee-high sock with red stripes
          const k0 = L.legs === 'socks' ? 0.12 : 0.3, k1 = L.legs === 'socks' ? 1.0 : 0.92;
          const ax = kx + dx * k0, ay = ky + dy * k0, bx = kx + dx * k1, by = ky + dy * k1;
          const ln = Math.hypot(dx, dy) || 1, px = -dy / ln, py = dx / ln, wd = (L.legs === 'socks' ? 3.6 : 4.8) * s;
          ctx.fillStyle = lpl.paper; ctx.lineWidth = 1.6 * wpp + 0.4; ctx.beginPath();
          if (L.legs === 'warmers') {
            // bunched: a wavy outline
            for (let i = 0; i <= 4; i++) { const t = i / 4, bul = wd * (1 + (i % 2) * 0.25); ctx.lineTo(ax + (bx - ax) * t + px * bul, ay + (by - ay) * t + py * bul); }
            for (let i = 4; i >= 0; i--) { const t = i / 4, bul = wd * (1 + (i % 2) * 0.25); ctx.lineTo(ax + (bx - ax) * t - px * bul, ay + (by - ay) * t - py * bul); }
          } else {
            ctx.moveTo(ax + px * wd, ay + py * wd); ctx.lineTo(bx + px * wd, by + py * wd); ctx.lineTo(bx - px * wd, by - py * wd); ctx.lineTo(ax - px * wd, ay - py * wd);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.beginPath();
          if (L.legs === 'warmers') {
            ctx.lineWidth = 1 * wpp + 0.2;
            for (let t = 0.2; t < 0.95; t += 0.2) { const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t; ctx.moveTo(mx + px * wd, my + py * wd); ctx.lineTo(mx - px * wd, my - py * wd); }
            ctx.stroke();
          } else {
            ctx.strokeStyle = lpl.paper === INK_RED ? INK_PAPER : lpl.red; ctx.lineWidth = 1.8 * wpp + 0.3;
            for (const t of [0.08, 0.2]) { const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t; ctx.moveTo(mx + px * wd, my + py * wd); ctx.lineTo(mx - px * wd, my - py * wd); }
            ctx.stroke(); ctx.strokeStyle = lpl.ink;
          }
          ctx.lineWidth = lw;
          break;
        }
        case 'bandaged': {
          ctx.strokeStyle = lpl.ink; ctx.lineWidth = 1.3 * wpp + 0.3; ctx.beginPath();
          const nx = -dy / (Math.hypot(dx, dy) || 1), ny = dx / (Math.hypot(dx, dy) || 1);
          for (const k of [0.62, 0.74, 0.86, 0.98]) { const px = kx + dx * k, py = ky + dy * k; ctx.moveTo(px + nx * 4 * s, py + ny * 4 * s - 1.5 * s); ctx.lineTo(px - nx * 4 * s, py - ny * 4 * s + 1.5 * s); }
          ctx.stroke(); ctx.lineWidth = lw;
          break;
        }
    }
    ctx.lineWidth = lw; ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink;
    switch (L.shoes) {
        case 'sneakers': case 'rocket': {
          ctx.fillStyle = L.shoes === 'rocket' ? spl.paper : spl.ink;
          ctx.beginPath(); ctx.moveTo(x - face * 4 * s, y + 2 * s); ctx.lineTo(x - face * 4 * s, y - 4 * s); ctx.quadraticCurveTo(x + face * 8 * s, y - 4 * s, x + face * 10 * s, y + 2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (L.shoes === 'sneakers') { ctx.strokeStyle = spl.paper; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath(); ctx.moveTo(x - face * 3 * s, y + 0.5 * s); ctx.lineTo(x + face * 9 * s, y + 0.5 * s); ctx.stroke(); ctx.strokeStyle = spl.ink; ctx.lineWidth = lw; }
          else if (!f.grounded || Math.abs(f.vx) > 200) {
            ctx.fillStyle = spl.red; ctx.beginPath();
            const fl = (8 + (w.step % 3) * 4) * s;
            ctx.moveTo(x - face * 4 * s, y + 3 * s); ctx.lineTo(x - face * 9 * s, y + 3 * s + fl * 0.6); ctx.lineTo(x - face * 2 * s, y + 3 * s + fl * 0.3); ctx.lineTo(x + face * 1 * s, y + 3 * s + fl); ctx.lineTo(x + face * 4 * s, y + 3 * s);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'boots': {
          ctx.strokeStyle = spl.ink; ctx.lineWidth = 5.5 * wpp + 1; ctx.beginPath(); ctx.moveTo(x - dx * 0.4, y - dy * 0.4); ctx.lineTo(x, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - face * 3 * s, y + 1 * s); ctx.lineTo(x + face * 8 * s, y + 1 * s); ctx.stroke();
          ctx.lineWidth = lw;
          break;
        }
        case 'flipflops': {
          // the sole lags behind the foot and flops when walking or in the air
          const flop = !f.grounded ? 0.5 : Math.abs(f.vx) > 60 ? 0.35 * Math.sin(w.step * 2.2 + foot) : 0;
          const a = flop * -face;
          ctx.strokeStyle = spl.blue; ctx.lineWidth = 2.6 * wpp + 0.4; ctx.beginPath();
          ctx.moveTo(x - face * 5 * s, y + 2 * s); ctx.lineTo(x - face * 5 * s + Math.cos(a) * face * 15 * s, y + 2 * s + Math.sin(a) * 15 * s); ctx.stroke();
          ctx.strokeStyle = spl.ink; ctx.lineWidth = 1 * wpp + 0.2; ctx.beginPath(); ctx.moveTo(x + face * 2 * s, y + 1 * s); ctx.lineTo(x, y - 3 * s); ctx.stroke();
          ctx.lineWidth = lw;
          break;
        }
    }
  }
  // ---- belts and badges ----
  if (L.badge !== 'none') {
    const bpl = slotPal(pal, 'badge', MAIN_BADGE[L.badge] ?? 'paper');
    const hx = X(j, J.hip), hy = Y(j, J.hip), cx = X(j, J.chest), cy = Y(j, J.chest), nx0 = X(j, J.neck), ny0 = Y(j, J.neck);
    if (L.badge === 'belt') {
      ctx.lineWidth = 3 * wpp + 0.6; ctx.beginPath(); ctx.moveTo(hx - 7 * s, hy - 3 * s); ctx.lineTo(hx + 7 * s, hy - 3 * s); ctx.stroke();
      ctx.fillStyle = bpl.red; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.ellipse(hx + face * 3 * s, hy - 3 * s, 9 * s, 7 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = bpl.paper; star(ctx, hx + face * 3 * s, hy - 3 * s, 4.5 * s); ctx.fill();
    } else {
      const bx = cx + (nx0 - cx) * 0.45 + face * 4 * s, by = cy + (ny0 - cy) * 0.45;
      if (L.badge === 'sheriff') { ctx.fillStyle = bpl.paper; star(ctx, bx, by, 8.5 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = bpl.ink; ctx.beginPath(); ctx.arc(bx, by, 1.4 * s, 0, TAU); ctx.fill(); }
      else {
        const r = STYLE.ranks[Math.max(0, Math.min(STYLE.ranks.length - 1, L.rank))];
        ctx.fillStyle = L.rank >= 4 ? bpl.red : bpl.paper; ctx.beginPath(); ctx.arc(bx, by, 9 * s, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.rank >= 4 ? bpl.paper : bpl.ink; ctx.font = `bold ${Math.round((r.length > 1 ? 7 : 11) * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r, bx, by + 0.5 * s);
      }
    }
  }
  ctx.restore();
}
