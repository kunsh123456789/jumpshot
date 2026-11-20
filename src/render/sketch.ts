/**
 * Hand-drawn pen strokes for canvas (paper pages, HUD, pad): wobbly lines,
 * rectangles, circles, arrows, checkmarks, underlines and scribble fills.
 * Every shape is seeded, so it looks identical every frame unless the caller
 * changes the seed (e.g. a 6-8 fps "boil" picks one of a few seeds).
 */

let s = 1;
export function seedSketch(v: number): void { s = (v | 0) || 1; }
export function srand(): number { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 16777216; }
const j = (amt: number) => (srand() - 0.5) * 2 * amt;

/** A pen line from (x0,y0) to (x1,y1): slight bow, jittered ends, tiny overshoot. Adds to the current path. */
export function penLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, wob = 1.5, over = 2): void {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const sx = x0 - ux * srand() * over + j(wob * 0.4), sy = y0 - uy * srand() * over + j(wob * 0.4);
  const ex = x1 + ux * srand() * over + j(wob * 0.4), ey = y1 + uy * srand() * over + j(wob * 0.4);
  const bow = j(wob) * Math.min(1, L / 60);
  const mx = (sx + ex) / 2 - uy * bow, my = (sy + ey) / 2 + ux * bow;
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
}

/** Hand-drawn rectangle: four separate strokes with overshoot and an occasional gap. */
export function penRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wob = 1.5): void {
  const o = Math.min(4, Math.min(w, h) * 0.08);
  penLine(ctx, x, y, x + w, y, wob, o);
  penLine(ctx, x + w, y, x + w, y + h, wob, o);
  penLine(ctx, x + w, y + h, x, y + h, wob, o);
  penLine(ctx, x, y + h, x, y, wob, o);
}

/** Hand-drawn circle/ellipse: one loop that overshoots its start a little. */
export function penCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry = rx, wob = 1.2): void {
  const n = 18, a0 = srand() * Math.PI * 2, sweep = Math.PI * 2 * (1.04 + srand() * 0.08);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (sweep * i) / n;
    const r = 1 + j(wob / Math.max(8, rx)) * 4;
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

/** Arrow from (x0,y0) to (x1,y1) with a two-stroke head. */
export function penArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head = 8, wob = 1.2): void {
  penLine(ctx, x0, y0, x1, y1, wob, 1);
  const a = Math.atan2(y1 - y0, x1 - x0);
  penLine(ctx, x1, y1, x1 - Math.cos(a - 0.5) * head, y1 - Math.sin(a - 0.5) * head, wob * 0.5, 0);
  penLine(ctx, x1, y1, x1 - Math.cos(a + 0.5) * head, y1 - Math.sin(a + 0.5) * head, wob * 0.5, 0);
}

/** A checkmark that fits in a box at (x,y,size). */
export function penCheck(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  penLine(ctx, x + size * 0.12, y + size * 0.52, x + size * 0.4, y + size * 0.82, 1, 1);
  penLine(ctx, x + size * 0.4, y + size * 0.82, x + size * 0.95, y + size * 0.05, 1.5, 2);
}

/** A loose zig-zag scribble filling a box (fills, strike-outs, crossed-out areas). */
export function penScribble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 5, slant = 0.35): void {
  let up = true;
  ctx.moveTo(x, y + h);
  for (let px = x; px <= x + w; px += step * (0.7 + srand() * 0.6)) {
    const yy = up ? y + j(1) : y + h + j(1);
    ctx.lineTo(Math.min(x + w, px + h * slant * (up ? 1 : -1) * 0.2), yy);
    up = !up;
  }
}

/** Short hatch strokes filling a box (pencil shading). */
export function penHatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap = 4): void {
  for (let i = -h; i < w; i += gap) {
    const x0 = x + Math.max(0, i), y0 = y + h - Math.max(0, -i);
    const len = Math.min(h - Math.max(0, -i), w - Math.max(0, i));
    if (len <= 0) continue;
    penLine(ctx, x0, y0, x0 + len, y0 - len, 0.6, 0.5);
  }
}
