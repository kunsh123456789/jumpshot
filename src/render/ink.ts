import { J, JOINT_N } from './rig';
import { heldWeapon } from './weaponFx';
import { HERO_LOOK, colorHex } from '../data/hero';
import { drawTarget } from './targetArt';
import { drawHeroGear } from './heroGear';
import { drawHeroBack, drawHeroFront, femaleJoints, gearPals } from './heroCos';
import type { Fighter } from '../sim/fighter';
import { TAU } from '../core/math';
import { WORLD } from '../data/tuning';
import { INKLOOK } from '../data/inkLook';
import { interpJoints } from './stickman';

/**
 * The "ink page" look (revision pass 5): white page, black line work, team
 * colors blue / black / red, a dithered gray reflection, hard 1-bit pixels.
 */

// ------------------------------------------------------------ palette + quantizer
export const INK = {
  paper: '#ffffff',
  ink: '#000000',
  blue: '#2436e6',
  red: '#e22424',
  gray: '#808080',
  /** Reserved key color: the Pixel post-pass turns it into a checkerboard stipple (the reflection). */
  dither: '#b0a8c8',
} as const;

// No solid grey: anti-aliased edges must snap to ink or paper (the stipple provides the grey).
const PAL: [number, number, number][] = [
  [255, 255, 255], [0, 0, 0], [36, 54, 230], [226, 36, 36],
  [176, 168, 200], // dither key
];
const DITHER_IDX = 4;
const STIPPLE: [number, number, number] = [150, 150, 158];
const LUT = new Uint8Array(4096);
(() => {
  for (let i = 0; i < 4096; i++) {
    const r = ((i >> 8) & 15) * 17, g = ((i >> 4) & 15) * 17, b = (i & 15) * 17;
    let best = 0, bd = Infinity;
    for (let k = 0; k < PAL.length; k++) {
      const [pr, pg, pb] = PAL[k];
      // Weighted (redmean-ish) distance; neutral greys between black and white snap to the nearer of the two.
      const dr = r - pr, dg = g - pg, db = b - pb;
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    LUT[i] = best;
  }
})();
// Packed little-endian RGBA words for the output colors.
const packed = new Uint32Array(PAL.length + 1);
for (let k = 0; k < PAL.length; k++) { const [r, g, b] = k === DITHER_IDX ? [255, 255, 255] : PAL[k]; packed[k] = (255 << 24) | (b << 16) | (g << 8) | r; }
packed[PAL.length] = (255 << 24) | (STIPPLE[2] << 16) | (STIPPLE[1] << 8) | STIPPLE[0];

/**
 * Snap every pixel to the palette (this is what removes anti-aliasing), and
 * turn the reserved dither-key gray into an ordered checkerboard stipple.
 */
export function quantize(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  syncExtraInks();
  const img = ctx.getImageData(0, 0, w, h);
  const px = new Uint32Array(img.data.buffer);
  const L = LUT32, S = packed[PAL.length], P = paperWord;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const ph = y & 1;
    for (let x = 0; x < w; x++, i++) {
      const v = px[i];
      // Transparent layer over the paper: weak coverage (AA fringe) drops out, the rest snaps to the palette.
      if ((v >>> 24) < 110) { px[i] = 0; continue; }
      const o = L[((v & 0xf0) << 4) | ((v >> 8) & 0xf0) | ((v >> 20) & 0x0f)];
      px[i] = o === 0 ? (((x & 1) ^ ph) ? 0 : S) : o === packed[0] ? P : o;
    }
  }
  ctx.putImageData(img, 0, 0);
}
/** The paper colour the "white" ink (hollow heads, hit flashes) becomes on the current page. */
let paperWord = packed[0];
export function setPaperColor(hex: string): void {
  const n = parseInt(hex.slice(1), 16);
  paperWord = ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
}
/** LUT straight to packed output colours; 0 marks the dither key. */
const LUT32 = new Uint32Array(4096);
for (let i = 0; i < 4096; i++) LUT32[i] = LUT[i] === DITHER_IDX ? 0 : packed[LUT[i]];

/**
 * Extra inks: the hero's cosmetic colours beyond the page's four (pink, purple, green, orange, or any
 * custom colour). Only each colour's own 12-bit LUT cell is redirected to it, so everything else in the
 * game still snaps to the four inks exactly as before; the colour's anti-aliased edges snap as usual.
 */
let extraKey = '';
const extraCells: number[] = [];
function syncExtraInks(): void {
  const key = Object.values(HERO_LOOK.colors).join(',');
  if (key === extraKey) return;
  extraKey = key;
  for (const c of extraCells) LUT32[c] = LUT[c] === DITHER_IDX ? 0 : packed[LUT[c]];
  extraCells.length = 0;
  for (const id of Object.values(HERO_LOOK.colors)) {
    const hex = colorHex(id);
    if (!hex) continue;
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const cell = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    if (LUT[cell] !== DITHER_IDX && packed[LUT[cell]] === ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0) continue; // already a page ink
    LUT32[cell] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    extraCells.push(cell);
  }
}

// ------------------------------------------------------------ fighters
const TEAM: Record<string, string> = {
  player: INK.ink, grunt: INK.blue, rusher: INK.ink, brute: INK.red, kicker: INK.ink, thrower: INK.blue,
  shield: INK.blue, elite: INK.red, boss: INK.red, dummy: INK.blue, witch: INK.blue, juggernaut: INK.red, shadow: INK.ink,
};
export function inkColor(f: Fighter): string { return TEAM[f.kind] ?? INK.ink; }

/** Line width (world units) for `px` low-res pixels at the current zoom. */
export function pxW(px: number, worldPerPx: number): number { return px * worldPerPx; }

const mj = new Float32Array(JOINT_N * 2);

function seg(ctx: CanvasRenderingContext2D, j: Float32Array, a: number, b: number): void {
  ctx.moveTo(j[a * 2], j[a * 2 + 1]);
  ctx.lineTo(j[b * 2], j[b * 2 + 1]);
}
/** Stick body: straight torso, shoulders, hips and the four limbs. */
export function inkBody(ctx: CanvasRenderingContext2D, j: Float32Array): void {
  ctx.moveTo(j[J.hip * 2], j[J.hip * 2 + 1]);
  ctx.lineTo(j[J.chest * 2], j[J.chest * 2 + 1]);
  ctx.lineTo(j[J.neck * 2], j[J.neck * 2 + 1]);
  seg(ctx, j, J.chest, J.shB); seg(ctx, j, J.shB, J.elbB); ctx.lineTo(j[J.handB * 2], j[J.handB * 2 + 1]);
  seg(ctx, j, J.hip, J.hipB); seg(ctx, j, J.hipB, J.kneeB); ctx.lineTo(j[J.footB * 2], j[J.footB * 2 + 1]);
  seg(ctx, j, J.hip, J.hipA); seg(ctx, j, J.hipA, J.kneeA); ctx.lineTo(j[J.footA * 2], j[J.footA * 2 + 1]);
  seg(ctx, j, J.chest, J.shA); seg(ctx, j, J.shA, J.elbA); ctx.lineTo(j[J.handA * 2], j[J.handA * 2 + 1]);
}

/** Limb and head-outline widths in low-res pixels: thin hero, chunkier enemies. */
function weights(f: Fighter): { limb: number; head: number } {
  if (f.team === 'player') return { limb: INKLOOK.heroLimbPx, head: INKLOOK.heroHeadPx };
  const k = f.kind === 'brute' || f.kind === 'boss' || f.kind === 'juggernaut' ? 1.35 : 1;
  return { limb: INKLOOK.enemyLimbPx * k, head: INKLOOK.enemyLimbPx };
}

/** One stick figure from joints: body, head (hollow hero / solid enemy), minimal props. */
export function inkFigure(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number, outlineOnly = false): void {
  const s = f.scale;
  const { limb, head } = weights(f);
  const headR = f.anim.rig.headR * s * INKLOOK.headScale;
  const hx = j[J.head * 2], hy = j[J.head * 2 + 1];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col;
  ctx.lineWidth = limb * wpp;
  ctx.beginPath(); inkBody(ctx, j); ctx.stroke();
  // Hollow head: the hero, outline-only flashes, and Shadow (the hero's ink double).
  if (f.team === 'player' || outlineOnly || f.def?.boss?.prop === 'band') {
    ctx.fillStyle = INK.paper;
    ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
    ctx.lineWidth = head * wpp;
    ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.stroke();
  } else {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(hx, hy, headR, 0, TAU); ctx.fill();
  }
}

/** Mirror a joint set about the floor line (reflection). */
export function mirror(src: Float32Array, out: Float32Array): Float32Array {
  const G = WORLD.groundY, q = INKLOOK.reflectSquash;
  for (let i = 0; i < JOINT_N; i++) { out[i * 2] = src[i * 2]; out[i * 2 + 1] = G + (G - src[i * 2 + 1]) * q; }
  return out;
}

/** The fighter's reflection below the floor, in the dither key (the post-pass stipples it). */
export function inkReflection(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, wpp: number): void {
  if (f.sprite) return;
  const j = interpJoints(f, alpha, time);
  const h = WORLD.groundY - j[J.hip * 2 + 1];
  if (h > 340) return;
  mirror(j, mj);
  inkFigure(ctx, f, mj, INK.dither, wpp);
  if (f.team === 'player') { ctx.fillStyle = INK.dither; ctx.beginPath(); ctx.arc(mj[J.head * 2], mj[J.head * 2 + 1], f.anim.rig.headR * f.scale * INKLOOK.headScale * 0.6, 0, TAU); ctx.fill(); }
}

// ------------------------------------------------------------ full fighter (ink look)
const tmpJ = new Float32Array(JOINT_N * 2);

/** Small starburst of short strokes (telegraph accent, impacts). Deterministic for a given seed. */
export function burst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, seed: number, col: string, w: number): void {
  let s = seed | 0;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.5;
    const r0 = r * (0.35 + rnd() * 0.25), r1 = r * (0.8 + rnd() * 0.5);
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
  }
  ctx.stroke();
}

export interface InkHooks {
  /** Scribble-hatch smear for the fighter's current drawing (set by the FX module). */
  smear: ((ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number) => void) | null;
}
export const inkHooks: InkHooks = { smear: null };

/**
 * A fighter in the ink look: echo copies (fast travel), smear, the figure
 * (hollow hero head / solid enemy head in its team color), hit flash as a
 * white figure with a black outline, telegraph as alternating red drawings
 * plus a red pixel burst, and a few props.
 */
/**
 * Scanline blur (reference clip 3, frames 86 / 270 / 276): while the hero dodges, or flickers back in at the
 * end of the daggers' vanish, it is drawn as horizontal stripes, plus a stripe-shifted copy where it just was.
 */
export function drawInkFighter(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, wpp: number): void {
  const scan = f.team === 'player' && f.kind === 'player' && (f.state === 'dodge' || (f.vanish > 0 && f.vanish < 7));
  if (!scan) { drawInkFighterInner(ctx, f, alpha, time, wpp); return; }
  const s = f.scale, x = f.px + (f.x - f.px) * alpha, y = f.py + (f.y - f.py) * alpha;
  const x0 = x - 80 * s, y0 = y - 230 * s, x1 = x + 80 * s, y1 = y + 12 * s, row = Math.max(wpp, 1e-3);
  const stripes = (phase: number) => {
    ctx.beginPath();
    for (let yy = y0 + phase * row; yy < y1; yy += row * 2) ctx.rect(x0, yy, x1 - x0, row);
    ctx.clip();
  };
  // the copy where it just was (a frame behind, stripes on the other rows)
  const dx = (f.x - f.px) * 2.2;
  if (Math.abs(dx) > 1) {
    ctx.save(); ctx.translate(-dx, 0); stripes(1); drawInkFighterInner(ctx, f, alpha, time, wpp, true); ctx.restore();
  }
  ctx.save(); stripes(0); drawInkFighterInner(ctx, f, alpha, time, wpp, true); ctx.restore();
}

function drawInkFighterInner(ctx: CanvasRenderingContext2D, f: Fighter, alpha: number, time: number, wpp: number, scanning = false): void {
  if (f.sprite && drawTarget(ctx, f, alpha, time, wpp)) return;
  const j = femaleJoints(f, interpJoints(f, alpha, time));
  const a = f.anim;
  const step = Math.floor(time * 12);
  // Fades are impossible in 1-bit: dying and invulnerable figures blink on alternate drawings instead.
  const scribbled = f.state === 'dead' && f.deathStyle === 2;
  if (!scribbled && f.state === 'dead' && f.deadTimer > 14 && (step & 1)) return;
  if (f.state === 'dead' && f.deadTimer > 30) return;
  if (!scanning && f.team === 'player' && f.invuln > 0 && f.state !== 'dodge' && f.state !== 'move' && f.state !== 'cine' && (step & 1)) return;
  // New movesets: the daggers' smoke-bomb vanish hides the hero; the scythe's phase flickers it.
  if (f.team === 'player' && ((f.vanish > 0 && !scanning) || (f.phase > 0 && (step & 1)))) return;
  let col = inkColor(f);
  const winding = f.team === 'enemy' && (f.state === 'windup' || f.telegraph > 0) && f.alive;
  if (winding && (step & 1)) col = col === INK.red ? INK.ink : INK.red;
  // Spawn-in: drawn in the dithered gray, then flickering into its solid color.
  if (f.spawnFade > 12 || (f.spawnFade > 0 && (step & 1))) col = INK.dither;

  // Echo copies: 2-3 full copies evenly spaced back along the path since the last drawing.
  if (a.dEcho > 0) {
    const n = Math.min(3, a.dEcho);
    const dx = a.dX - a.dPrevX, dy = a.dY - a.dPrevY;
    for (let i = 1; i <= n; i++) {
      const k = i / (n + 1);
      for (let q = 0; q < JOINT_N; q++) { tmpJ[q * 2] = j[q * 2] - dx * k; tmpJ[q * 2 + 1] = j[q * 2 + 1] - dy * k; }
      inkFigure(ctx, f, tmpJ, col, wpp);
    }
    // Speed bars (reference 82-84): a few thick horizontal streaks behind fast horizontal travel.
    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      const s0 = f.scale;
      ctx.fillStyle = col;
      for (const [jj, len] of [[J.chest, 0.9], [J.hip, 0.7], [J.kneeA, 0.5]] as [number, number][]) {
        const y = j[jj * 2 + 1] + (jj === J.hip ? 4 * s0 : 0);
        const x1 = j[jj * 2 + 0] - Math.sign(dx) * 22 * s0, x0 = x1 - dx * len;
        ctx.fillRect(Math.min(x0, x1), y - 1.5 * wpp, Math.abs(x1 - x0), 3 * wpp);
      }
    }
  }
  if ((a.dSmear || a.dSpin) && inkHooks.smear) inkHooks.smear(ctx, f, j, col, wpp);

  const flashing = f.flash > 0;
  const COS = { ink: INK.ink, paper: INK.paper, red: INK.red, blue: INK.blue, dither: INK.dither };
  if (f.kind === 'player') drawHeroBack(ctx, f, j, a.rig.headR * f.scale * INKLOOK.headScale, time, wpp, COS);
  if (flashing) {
    // Hit flash: white figure with a black outline.
    const { limb } = weights(f);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK.ink; ctx.lineWidth = (limb + 2) * wpp;
    ctx.beginPath(); inkBody(ctx, j); ctx.stroke();
    ctx.restore();
    inkFigure(ctx, f, j, INK.paper, wpp, true);
  } else inkFigure(ctx, f, j, col, wpp);

  if (f.team === 'player') heldWeapon(ctx, f, j, flashing ? INK.ink : col, wpp);
  const s = f.scale;
  const headR = a.rig.headR * s * INKLOOK.headScale;
  const hx = j[J.head * 2], hy = j[J.head * 2 + 1];
  const face = a.dFace || f.facing || 1;
  if (f.team === 'player') {
    // Headband tail: a 2-segment line (the hero's cosmetic colour) that only changes with the drawing.
    const fl = f.grounded ? 0.15 : -0.25;
    if (f.kind === 'player' && HERO_LOOK.band !== 'none') {
      ctx.strokeStyle = HERO_LOOK.band === 'blue' ? INK.blue : HERO_LOOK.band === 'black' ? INK.ink : INK.red; ctx.lineWidth = 2 * wpp; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx - face * headR * 0.9, hy - headR * 0.25);
      ctx.lineTo(hx - face * headR * 1.9, hy - headR * (0.05 + fl));
      ctx.lineTo(hx - face * headR * 2.7, hy + headR * (0.35 - fl));
      ctx.stroke();
    }
    if (f.kind === 'player') { const gp = gearPals({ ink: INK.ink as string, paper: INK.paper as string, red: INK.red as string, blue: INK.blue as string }); drawHeroGear(ctx, j, hx, hy, headR, face, s, wpp, gp.gear, gp.hands); drawHeroFront(ctx, f, j, time, wpp, COS); }
  }
  if (winding) burst(ctx, hx, hy - headR * 1.9, headR * 0.9, 5, f.id * 31 + step, INK.red, 2 * wpp);
  if (f.kind === 'shield' && f.guardBroken <= 0 && f.alive) {
    // Thin-line shield (reference 69-71): an outline rectangle at the lead hand.
    const sx = j[J.handA * 2] + face * 6 * s, sy = j[J.handA * 2 + 1];
    ctx.fillStyle = INK.paper; ctx.strokeStyle = f.blockFlash > 0 ? INK.red : INK.ink; ctx.lineWidth = 2 * wpp;
    ctx.beginPath(); ctx.rect(sx - 7 * s, sy - 34 * s, 14 * s, 50 * s); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 3 * s, sy - 20 * s); ctx.lineTo(sx + 3 * s, sy - 4 * s); ctx.stroke();
  }
  const prop = f.def?.boss?.prop;
  if (prop === 'horns' || prop === 'helm') {
    ctx.strokeStyle = col; ctx.lineWidth = 3 * wpp;
    ctx.beginPath();
    ctx.moveTo(hx - headR * 0.6, hy - headR * 0.7); ctx.lineTo(hx - headR * 1.1, hy - headR * 1.8);
    ctx.moveTo(hx + headR * 0.6, hy - headR * 0.7); ctx.lineTo(hx + headR * 1.1, hy - headR * 1.8);
    ctx.stroke();
    if (prop === 'helm') {
      // Juggernaut: a helmet band with a visor slit and shoulder plates.
      ctx.fillStyle = INK.ink;
      ctx.beginPath(); ctx.rect(hx - headR * 1.15, hy - headR * 0.35, headR * 2.3, headR * 0.5); ctx.fill();
      ctx.fillStyle = INK.paper;
      ctx.beginPath(); ctx.rect(hx + face * headR * 0.1 - headR * 0.35, hy - headR * 0.2, headR * 0.7, headR * 0.16); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 4 * wpp;
      ctx.beginPath();
      for (const sh of [J.shA, J.shB]) { const sx = j[sh * 2], sy = j[sh * 2 + 1]; ctx.moveTo(sx - 12 * s, sy + 4 * s); ctx.quadraticCurveTo(sx, sy - 12 * s, sx + 12 * s, sy + 4 * s); }
      ctx.stroke();
    }
  } else if (prop === 'hat') {
    // Witch: a tall bent pointy hat with a brim.
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.5 * wpp;
    ctx.beginPath();
    ctx.moveTo(hx - headR * 1.0, hy - headR * 0.6);
    ctx.lineTo(hx - face * headR * 0.6, hy - headR * 3.2);
    ctx.lineTo(hx - face * headR * 1.4, hy - headR * 2.9);
    ctx.lineTo(hx + headR * 1.0, hy - headR * 0.6);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - headR * 1.9, hy - headR * 0.55); ctx.lineTo(hx + headR * 1.9, hy - headR * 0.65); ctx.stroke();
  } else if (prop === 'band') {
    // Shadow: the hero's red headband, mirrored.
    ctx.strokeStyle = INK.red; ctx.lineWidth = 2 * wpp; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - face * headR * 0.9, hy - headR * 0.25);
    ctx.lineTo(hx - face * headR * 1.9, hy - headR * 0.1);
    ctx.lineTo(hx - face * headR * 2.8, hy + headR * 0.4);
    ctx.stroke();
  }
  if (f.burn > 0 && f.alive) drawFlames(ctx, j, f, wpp, step);
  if (scribbled) scribbleOut(ctx, j, f, wpp);
  if (f.state === 'stunned' || f.dizzy > 0) {
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5 * wpp;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = step * 0.9 + (i * TAU) / 3;
      const px = hx + Math.cos(ang) * headR * 1.7, py = hy - headR * 1.5 + Math.sin(ang) * headR * 0.4;
      ctx.moveTo(px - 3 * s, py); ctx.lineTo(px + 3 * s, py); ctx.moveTo(px, py - 3 * s); ctx.lineTo(px, py + 3 * s);
    }
    ctx.stroke();
  }
}

/** Laser Eyes: a burning enemy wears a few flickering flame tongues (red ink, boiling per drawing). */
function drawFlames(ctx: CanvasRenderingContext2D, j: Float32Array, f: Fighter, wpp: number, step: number): void {
  const cx = j[J.chest * 2], cy = (j[J.chest * 2 + 1] + j[J.hip * 2 + 1]) / 2, s = f.scale;
  ctx.save(); ctx.strokeStyle = INK.red; ctx.lineWidth = 2.4 * wpp + 0.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 5; k++) {
    const side = k - 2, base = cx + side * 15 * s, h = (46 + ((step * 7 + k * 13) % 21)) * s, sway = (((step + k * 3) % 4) - 1.5) * 4 * s;
    const by = cy + 38 * s - Math.abs(side) * 6 * s;
    ctx.beginPath(); ctx.moveTo(base - 7 * s, by); ctx.quadraticCurveTo(base - 9 * s + sway, by - h * 0.6, base + sway, by - h); ctx.quadraticCurveTo(base + 9 * s + sway, by - h * 0.6, base + 7 * s, by); ctx.stroke();
  }
  ctx.restore();
}

/** Scribbled-out death: a pen scribble covers the body, denser each drawing (seeded per fighter). */
function scribbleOut(ctx: CanvasRenderingContext2D, j: Float32Array, f: Fighter, wpp: number): void {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let q = 0; q < JOINT_N; q++) { const x = j[q * 2], y = j[q * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const pad = 10 * f.scale;
  x0 -= pad; x1 += pad; y0 -= pad * 2; y1 += pad * 0.3;
  const k = Math.min(1, f.deadTimer / 22);
  const n = 4 + Math.floor(k * 22);
  let sd = f.id * 977 + 13;
  const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.2 * wpp; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
  ctx.moveTo(x, y);
  for (let i = 0; i < n; i++) {
    x = x0 + rnd() * (x1 - x0); y = y0 + rnd() * (y1 - y0);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}
