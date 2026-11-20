import { PAPER, type PageId } from '../data/paper';
import { settings } from '../core/settings';
import { penArrow, penCircle, penLine, penRect, seedSketch, srand } from './sketch';
import { audio } from '../core/audio';

/** Handwriting font stack (bundled via @fontsource; falls back to system cursive). */
export const HAND = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", cursive';
export const MARKER = '"Permanent Marker", "Patrick Hand", "Comic Sans MS", cursive';

type Variant = { page: HTMLCanvasElement; bounce: HTMLCanvasElement };

/**
 * The sheet of paper behind the fight (screen space; paper doesn't parallax).
 * Each page is pre-rendered once per screen size into a few "boil" variants
 * (the doodles re-drawn with fresh jitter) and reused every frame. A separate
 * layer holds the margin doodle characters that bounce on the beat in Rhythm
 * Mode. Wave transitions (page flip, red-pen "cleared" check, game-over
 * crumple) are stepped, hand-drawn and quick.
 */
export class Paper {
  page: PageId = 'blank';
  private cache = new Map<string, Variant[]>();
  private w = 0; private h = 0; private q = 1; private floorY = 0;
  // transitions
  private flipFrom: HTMLCanvasElement | null = null;
  private flipT = -1;
  private clearT = -1;
  private crumpleT = -1;
  private seed = 1;

  /** Screen size (css px), render scale (canvas px per css px), floor line y (css). */
  resize(w: number, h: number, q: number, floorY: number): void {
    if (w !== this.w || h !== this.h || Math.abs(q - this.q) > 1e-3 || Math.abs(floorY - this.floorY) > 1) {
      this.w = w; this.h = h; this.q = q; this.floorY = floorY;
      this.cache.clear();
    }
  }
  invalidate(): void { this.cache.clear(); }

  setPage(p: PageId): void { this.page = p; }
  /** Turn to a new page with a stepped page-curl. */
  flipTo(p: PageId): void {
    if (p === this.page) return;
    const cur = this.variants()[0];
    this.flipFrom = cur.page;
    this.page = p;
    this.flipT = 0;
    audio.paper('page');
  }
  cleared(): void { this.clearT = 0; this.seed++; audio.paper('scratch'); }
  crumple(): void { this.crumpleT = 0; this.seed++; audio.paper('crumple'); }
  resetTransitions(): void { this.flipT = this.clearT = this.crumpleT = -1; this.flipFrom = null; }
  get busy(): boolean { return this.flipT >= 0 || this.crumpleT >= 0; }

  update(dt: number): void {
    if (this.flipT >= 0) { this.flipT += dt; if (this.flipT > PAPER.flipSec) { this.flipT = -1; this.flipFrom = null; } }
    if (this.clearT >= 0) { this.clearT += dt; if (this.clearT > PAPER.clearedSec) this.clearT = -1; }
    if (this.crumpleT >= 0 && this.crumpleT < PAPER.crumpleSec) this.crumpleT += dt;
  }

  private key(): string { return `${this.page}|${settings.highContrast ? 1 : 0}`; }
  private variants(): Variant[] {
    const k = this.key();
    let v = this.cache.get(k);
    if (!v) {
      v = [];
      const n = settings.highContrast ? 1 : PAPER.boilVariants;
      for (let i = 0; i < n; i++) v.push(this.render(i));
      this.cache.set(k, v);
    }
    return v;
  }

  /** Draw the page (css transform active). pulse: Rhythm beat pulse 0..1 (bounces the margin doodles). */
  draw(ctx: CanvasRenderingContext2D, time: number, pulse: number): void {
    if (this.w === 0) return;
    const v = this.variants();
    const vi = settings.boil && !settings.highContrast ? Math.floor(time * PAPER.boilFps) % v.length : 0;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(v[vi].page, 0, 0, this.w, this.h);
    if (this.flipT >= 0 && this.flipFrom) this.drawFlip(ctx);
    else ctx.drawImage(v[vi].bounce, 0, pulse > 0.55 ? -3 : 0, this.w, this.h);
    ctx.imageSmoothingEnabled = smooth;
  }

  /** Overlays above the world: the red-pen cleared check and the crumple. */
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const step = (t: number) => Math.floor(t * PAPER.transitionFps) / PAPER.transitionFps;
    if (this.clearT >= 0) {
      const t = step(this.clearT), k = Math.min(1, t / 0.3);
      const cx = this.w * 0.5, cy = this.h * 0.3, r = Math.min(this.w, this.h) * 0.12;
      ctx.save();
      ctx.globalAlpha = t > PAPER.clearedSec - 0.25 ? Math.max(0, (PAPER.clearedSec - t) / 0.25) : 1;
      ctx.strokeStyle = PAPER.red; ctx.lineWidth = Math.max(3, r * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      seedSketch(this.seed * 77);
      ctx.beginPath();
      // circle draws on, then the tick
      const n = 24, a0 = -2.2, sweep = Math.PI * 2.15 * Math.min(1, k * 1.6);
      for (let i = 0; i <= n; i++) { const a = a0 + (sweep * i) / n; const rr = r * (1 + (srand() - 0.5) * 0.06); const x = cx + Math.cos(a) * rr * 1.25, y = cy + Math.sin(a) * rr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      if (k > 0.6) {
        const m = (k - 0.6) / 0.4;
        ctx.moveTo(cx - r * 0.55, cy + r * 0.02);
        ctx.lineTo(cx - r * 0.15, cy + r * 0.45);
        if (m > 0.4) ctx.lineTo(cx - r * 0.15 + (r * 0.85) * (m - 0.4) / 0.6, cy + r * 0.45 - (r * 1.0) * (m - 0.4) / 0.6);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (this.crumpleT >= 0) {
      const t = step(this.crumpleT), k = Math.min(1, t / PAPER.crumpleSec);
      ctx.save();
      // darkening edges + crease web growing in steps
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * (0.6 - 0.35 * k), this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, 'rgba(60,50,30,0)');
      g.addColorStop(1, `rgba(60,50,30,${0.45 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      seedSketch(this.seed * 131);
      ctx.strokeStyle = `rgba(40,35,25,${0.25 + 0.35 * k})`; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const lines = Math.floor(6 + 26 * k);
      for (let i = 0; i < lines; i++) {
        let x = srand() * this.w, y = srand() * this.h;
        ctx.moveTo(x, y);
        for (let s = 0; s < 3; s++) { x += (srand() - 0.5) * this.w * 0.35; y += (srand() - 0.5) * this.h * 0.35; ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Stepped page curl: the old page peels off from the bottom-right corner, the new page shows underneath. */
  private drawFlip(ctx: CanvasRenderingContext2D): void {
    const W = this.w, H = this.h;
    const p = Math.min(1, Math.floor((this.flipT / PAPER.flipSec) * PAPER.transitionFps * PAPER.flipSec) / (PAPER.transitionFps * PAPER.flipSec));
    const c = (W + H) * (1 - p * 1.05); // fold line x + y = c
    // old page: keep the region x + y < c
    ctx.save();
    ctx.beginPath();
    poly(ctx, clipHalf([[0, 0], [W, 0], [W, H], [0, H]], c, true));
    ctx.clip();
    ctx.drawImage(this.flipFrom!, 0, 0, W, H);
    ctx.restore();
    // flap: the turned part reflected over the fold line (back of the paper)
    const turned = clipHalf([[0, 0], [W, 0], [W, H], [0, H]], c, false).map(([x, y]) => [c - y, c - x] as [number, number]);
    if (turned.length >= 3) {
      ctx.save();
      ctx.beginPath(); poly(ctx, turned);
      ctx.fillStyle = '#e9e1cd'; ctx.fill();
      ctx.strokeStyle = PAPER.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ page rendering (once per size/variant)
  private render(variant: number): Variant {
    const q = this.q, W = this.w, H = this.h;
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * q)); c.height = Math.max(1, Math.round(H * q)); return c; };
    const page = mk(), bounce = mk();
    const g = page.getContext('2d')!, b = bounce.getContext('2d')!;
    g.setTransform(q, 0, 0, q, 0, 0); b.setTransform(q, 0, 0, q, 0, 0);
    const id = this.page, hc = settings.highContrast;
    seedSketch(1234 + id.length * 97);
    // paper
    g.fillStyle = hc ? '#ffffff' : PAPER.paper[id];
    g.fillRect(0, 0, W, H);
    if (!hc) {
      // fibers + grain (same for every variant: paper doesn't boil)
      g.lineWidth = 0.6;
      const n = Math.round((W * H) / 10000 * PAPER.fibers);
      g.strokeStyle = id === 'kraft' ? 'rgba(90,60,20,0.18)' : 'rgba(120,110,90,0.12)';
      g.beginPath();
      for (let i = 0; i < n; i++) { const x = srand() * W, y = srand() * H, a = srand() * Math.PI, l = 3 + srand() * 9; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
      g.stroke();
      g.fillStyle = `rgba(0,0,0,${PAPER.grain})`;
      for (let i = 0; i < n * 3; i++) g.fillRect(srand() * W, srand() * H, 1, 1);
      // soft vignette (uneven tint at the edges)
      const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
      vg.addColorStop(0, 'rgba(120,90,40,0)');
      vg.addColorStop(1, `rgba(120,90,40,${PAPER.vignette})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      this.pattern(g, id);
      this.details(g, id);
    }
    // doodles (boil: re-jittered per variant)
    if (!hc) {
      seedSketch(9001 + variant * 31337 + id.length);
      this.doodles(g, b, id);
    }
    return { page, bounce };
  }

  /** Ruled lines, grid, margins, holes, spiral binding. */
  private pattern(g: CanvasRenderingContext2D, id: PageId): void {
    const W = this.w, H = this.h;
    if (id === 'lined') {
      g.strokeStyle = 'rgba(70,110,210,0.22)'; g.lineWidth = 1;
      g.beginPath();
      for (let y = 70; y < H; y += PAPER.ruleGap) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      g.strokeStyle = 'rgba(210,50,50,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(64, 0); g.lineTo(64, H); g.stroke();
      for (const fy of [0.18, 0.5, 0.82]) {
        g.fillStyle = 'rgba(150,140,120,0.35)';
        g.beginPath(); g.arc(26, H * fy, 9, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(80,70,60,0.3)'; g.lineWidth = 1; g.stroke();
      }
    } else if (id === 'graph') {
      g.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? 'rgba(70,120,210,0.12)' : 'rgba(70,120,210,0.24)';
        g.beginPath();
        const gap = PAPER.gridGap * (pass === 0 ? 1 : 5);
        for (let x = 0; x < W; x += gap) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
        for (let y = 0; y < H; y += gap) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
        g.stroke();
      }
    } else if (id === 'sketch') {
      // spiral binding along the top
      g.strokeStyle = 'rgba(40,40,40,0.75)'; g.lineWidth = 2.2;
      for (let x = 30; x < W - 20; x += 26) {
        g.fillStyle = 'rgba(60,50,40,0.35)';
        g.beginPath(); g.arc(x, 20, 4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(x - 4, 12, 5, 13, -0.25, Math.PI * 0.6, Math.PI * 1.85); g.stroke();
      }
    } else if (id === 'kraft') {
      g.strokeStyle = 'rgba(70,45,15,0.18)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 80; i++) { const y = srand() * H; g.moveTo(0, y); g.lineTo(W, y + (srand() - 0.5) * 20); }
      g.stroke();
    }
  }

  /** Tape, staple, coffee ring, pencil, paper clip, folded corner: at the borders, never in the play area. */
  private details(g: CanvasRenderingContext2D, id: PageId): void {
    const W = this.w, H = this.h, F = this.floorY;
    const below = H - F; // strip under the floor/reflection
    // tape (top-right corner)
    g.save(); g.translate(W - 70, 16); g.rotate(0.5);
    g.fillStyle = 'rgba(235,225,180,0.55)'; g.fillRect(-36, -11, 72, 22);
    g.strokeStyle = 'rgba(160,150,110,0.4)'; g.lineWidth = 1; g.strokeRect(-36, -11, 72, 22);
    g.restore();
    // staple (top-left)
    if (id !== 'sketch') {
      g.strokeStyle = 'rgba(90,90,95,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(14, 36); g.lineTo(34, 26); g.stroke();
    }
    // coffee ring (bottom-right, partly off the page)
    if (below > 40) {
      g.strokeStyle = 'rgba(140,90,40,0.22)'; g.lineWidth = 3;
      g.beginPath(); g.arc(W - 40, H - below * 0.3, Math.min(48, below * 0.7), 0.3, Math.PI * 1.9); g.stroke();
      g.lineWidth = 1.2; g.beginPath(); g.arc(W - 43, H - below * 0.32, Math.min(42, below * 0.6), 0.6, Math.PI * 1.5); g.stroke();
    }
    // pencil resting along the bottom edge (bottom-left)
    if (below > 26) {
      g.save(); g.translate(20, H - Math.min(18, below * 0.4)); g.rotate(-0.04);
      const L = Math.min(170, W * 0.22);
      g.fillStyle = '#f2c230'; g.fillRect(0, -6, L, 12);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 2, L, 4);
      g.fillStyle = '#e88aa0'; g.fillRect(-14, -6, 14, 12);
      g.fillStyle = '#b8b8b8'; g.fillRect(-2, -6, 6, 12);
      g.fillStyle = '#f0d9b0'; g.beginPath(); g.moveTo(L, -6); g.lineTo(L + 20, 0); g.lineTo(L, 6); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.moveTo(L + 13, -2.4); g.lineTo(L + 20, 0); g.lineTo(L + 13, 2.4); g.fill();
      g.restore();
    }
    // paper clip (top edge, left of centre)
    g.strokeStyle = 'rgba(110,115,125,0.75)'; g.lineWidth = 1.8;
    g.beginPath();
    const px = W * 0.3, py = 2;
    g.moveTo(px, py); g.lineTo(px, py + 30); g.arc(px + 5, py + 30, 5, Math.PI, 0, true); g.lineTo(px + 10, py + 6); g.arc(px + 6, py + 6, 4, 0, Math.PI, true); g.lineTo(px + 2, py + 26);
    g.stroke();
    // folded corner (bottom-right)
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.beginPath(); g.moveTo(W, H - 34); g.lineTo(W - 34, H); g.lineTo(W, H); g.fill();
    g.fillStyle = id === 'kraft' ? '#b8956a' : '#ece4d0';
    g.beginPath(); g.moveTo(W, H - 30); g.lineTo(W - 30, H); g.lineTo(W - 30, H - 30); g.fill();
    g.strokeStyle = 'rgba(80,70,50,0.35)'; g.lineWidth = 1; g.stroke();
  }

  /** Low-contrast pencil doodles in the sky band and margins; the floor band stays clean. */
  private doodles(g: CanvasRenderingContext2D, b: CanvasRenderingContext2D, id: PageId): void {
    const W = this.w, H = this.h, F = this.floorY;
    const top = Math.max(60, H * 0.1), bottom = F - H * PAPER.cleanAbove;
    if (bottom - top < 30) return;
    const col = id === 'kraft' ? 'rgba(60,35,10,0.55)' : `rgba(70,68,62,${PAPER.doodleAlpha})`;
    const setPen = (c: CanvasRenderingContext2D) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = PAPER.doodleWidth; c.lineCap = 'round'; c.lineJoin = 'round'; };
    setPen(g); setPen(b);
    const band = (f: number) => top + (bottom - top) * f;
    // sun + clouds + stars
    g.beginPath(); penCircle(g, W * 0.82, band(0.15), 16); g.stroke();
    g.beginPath();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; penLine(g, W * 0.82 + Math.cos(a) * 22, band(0.15) + Math.sin(a) * 22, W * 0.82 + Math.cos(a) * 31, band(0.15) + Math.sin(a) * 31, 0.8, 0.5); }
    g.stroke();
    for (const [cx, cy, s] of [[W * 0.16, band(0.18), 1], [W * 0.55, band(0.08), 0.8], [W * 0.38, band(0.35), 0.65]]) {
      g.beginPath();
      for (let k = 0; k < 4; k++) penCircle(g, cx + (k - 1.5) * 14 * s, cy - (k === 1 || k === 2 ? 7 : 0) * s, 11 * s, 9 * s, 0.6);
      g.stroke();
    }
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = W * (0.05 + srand() * 0.9), y = band(srand() * 0.4), r = 4 + srand() * 3;
      for (let k = 0; k < 5; k++) { const a1 = -Math.PI / 2 + (k * 4 * Math.PI) / 5, a2 = -Math.PI / 2 + ((k + 1) * 4 * Math.PI) / 5; penLine(g, x + Math.cos(a1) * r, y + Math.sin(a1) * r, x + Math.cos(a2) * r, y + Math.sin(a2) * r, 0.4, 0.3); }
    }
    g.stroke();
    // horizon: mountains on one side, a little city skyline + trees on the other
    const hy = bottom;
    g.beginPath();
    let x = W * 0.02; g.moveTo(x, hy);
    while (x < W * 0.4) { const w2 = 30 + srand() * 50; const pk = hy - 25 - srand() * 45; g.lineTo(x + w2 / 2 + (srand() - 0.5) * 6, pk); x += w2; g.lineTo(x, hy - srand() * 6); }
    g.stroke();
    g.beginPath();
    x = W * 0.6;
    while (x < W * 0.96) {
      const bw = 18 + srand() * 26, bh = 22 + srand() * 55;
      penRect(g, x, hy - bh, bw, bh, 0.8);
      for (let wy = hy - bh + 6; wy < hy - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 7) if (srand() < 0.45) { g.moveTo(wx, wy); g.lineTo(wx + 3, wy); }
      x += bw + 4 + srand() * 10;
    }
    g.stroke();
    g.beginPath();
    for (const tx of [W * 0.45, W * 0.5, W * 0.53]) { penLine(g, tx, hy, tx, hy - 16, 0.4, 0); penCircle(g, tx, hy - 24, 8, 9, 0.6); }
    g.stroke();
    // birds, an arrow with a note
    g.beginPath();
    for (let i = 0; i < 3; i++) { const bx = W * (0.25 + i * 0.05), by = band(0.1 + i * 0.05); g.moveTo(bx - 6, by - 3); g.quadraticCurveTo(bx - 3, by - 5, bx, by); g.quadraticCurveTo(bx + 3, by - 5, bx + 6, by - 3); }
    penArrow(g, W * 0.66, band(0.5), W * 0.6, band(0.62), 7, 0.8);
    g.stroke();
    g.font = `16px ${HAND}`;
    g.fillText(id === 'graph' ? 'x = air time²' : id === 'lined' ? 'combo practice!!' : id === 'kraft' ? 'BOSS >:(' : 'jump → shot', W * 0.67, band(0.48));
    // margin doodle characters cheering (bounce on the beat)
    for (const [mx, dir] of [[W * 0.035, 1], [W * 0.965, -1]] as [number, number][]) {
      const my = band(0.75);
      b.beginPath();
      penCircle(b, mx, my - 30, 6, 6, 0.5);
      penLine(b, mx, my - 24, mx, my - 6, 0.5, 0);
      penLine(b, mx, my - 18, mx - 8 * dir, my - 30, 0.5, 0); penLine(b, mx, my - 18, mx + 9 * dir, my - 28, 0.5, 0);
      penLine(b, mx, my - 6, mx - 6, my + 6, 0.5, 0); penLine(b, mx, my - 6, mx + 6, my + 6, 0.5, 0);
      b.stroke();
    }
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Clip a polygon to the half-plane x + y < c (keepBelow) or x + y >= c. */
function clipHalf(pts: [number, number][], c: number, keepBelow: boolean): [number, number][] {
  const inside = (p: [number, number]) => (keepBelow ? p[0] + p[1] < c : p[0] + p[1] >= c);
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const fa = a[0] + a[1] - c, fb = b[0] + b[1] - c, t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export const paper = new Paper();
