import { layout } from '../core/layout';
import type { Camera } from '../core/camera';
import { ANIM, WORLD } from '../data/tuning';
import { settings } from '../core/settings';
import type { World } from '../sim/world';
import { Background } from './background';
import { drawFighter, drawShadow, drawTrail } from './stickman';
import { effects } from './effects';
import type { Fighter } from '../sim/fighter';
import { DRAW } from './drawStyle';
import { INK, drawInkFighter, inkReflection, quantize } from './ink';
import { INKLOOK } from '../data/inkLook';
import { inkFx } from './inkFx';

/** World-space rendering: background, fighters, effects. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly bg = new Background();
  /** Extra world-space draw hook (projectiles, pickups, hazards). */
  drawExtras: ((ctx: CanvasRenderingContext2D, alpha: number, time: number) => void) | null = null;
  private order: Fighter[] = [];
  /** Interpolated player hip position from the last rendered frame (smoothness tests). */
  lastPlayerX = 0; lastPlayerY = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unsupported');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    layout.update(w, h, dpr);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  /** Set transform to logical view space (1280x720) inside the world rect. */
  viewTransform(): void {
    const d = layout.dpr, s = layout.scale, r = layout.world;
    this.ctx.setTransform(d * s, 0, 0, d * s, d * (r.x - layout.viewX0 * s), d * (r.y - layout.viewY0 * s));
  }
  cssTransform(): void {
    const d = layout.dpr;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  // ---- Ink look (revision pass 5) ----
  private low: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;

  render(world: World, cam: Camera, alpha: number, time: number, dt: number): void {
    if (DRAW.ink) { this.renderInk(world, cam, alpha, time, dt); return; }
    const ctx = this.ctx;
    this.cssTransform();
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, layout.cssW, layout.cssH);

    this.viewTransform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
    ctx.clip();
    this.bg.update(dt, cam);
    this.bg.drawSky(ctx, cam);

    // World transform: view anchor + shake + rotation + zoom.
    const z = cam.effectiveZoom();
    ctx.translate(WORLD.viewW / 2 + cam.ox, cam.groundScreen + cam.oy);
    ctx.rotate(cam.rot);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);

    this.bg.drawFloor(ctx, cam);
    this.bg.drawAmbient(ctx);

    // Depth order: dead/knocked-down behind, player near front.
    const order = this.order;
    order.length = 0;
    for (const e of world.enemies) order.push(e);
    order.sort(sortFighters);
    order.push(world.player);

    for (const f of order) drawShadow(ctx, f, alpha, time);
    effects.drawParticles(ctx, false);
    effects.drawGhosts(ctx);
    for (const f of order) drawFighter(ctx, f, alpha, time, dt);
    const pl = world.player;
    this.lastPlayerX = pl.px + (pl.x - pl.px) * alpha;
    this.lastPlayerY = pl.py + (pl.y - pl.py) * alpha;
    if (this.drawExtras) this.drawExtras(ctx, alpha, time);
    for (const f of order) drawTrail(ctx, f, time);
    effects.drawParticles(ctx, true);
    effects.drawSpeedLines(ctx, ANIM.speedLineSec, ANIM.speedLines);
    effects.drawTexts(ctx);
    ctx.restore();

    // Impact frame: a 1-2 frame inverted-color flash on heavy hits.
    if (effects.invert > 0 && !settings.reduceFlashes) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Screen-space overlays inside the world rect.
    if (effects.screenFlash > 0) {
      ctx.globalAlpha = Math.min(1, effects.screenFlash) * 0.55;
      ctx.fillStyle = effects.screenFlashColor;
      ctx.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Ink page: white page, thick floor, stippled reflections, ink figures and FX.
   * Pixel Look draws into a low-res canvas, snaps it to the palette (no
   * anti-aliasing) and upscales it with nearest-neighbor; Crisp draws the same
   * page at full resolution. Text stays on the full-res layer either way.
   */
  private renderInk(world: World, cam: Camera, alpha: number, time: number, dt: number): void {
    const ctx = this.ctx;
    const pixel = settings.look === 'pixel';
    this.cssTransform();
    ctx.fillStyle = INK.paper;
    ctx.fillRect(0, 0, layout.cssW, layout.cssH);
    let g: CanvasRenderingContext2D;
    let lw = 0, lh = 0, res: number;
    if (pixel) {
      res = settings.pixelRes;
      lw = Math.max(16, Math.ceil(layout.viewW * res)); lh = Math.max(16, Math.ceil(layout.viewH * res));
      if (!this.low) { this.low = document.createElement('canvas'); this.lowCtx = this.low.getContext('2d', { alpha: false, willReadFrequently: true }); }
      if (this.low.width !== lw || this.low.height !== lh) { this.low.width = lw; this.low.height = lh; }
      g = this.lowCtx!;
      g.setTransform(res, 0, 0, res, -layout.viewX0 * res, -layout.viewY0 * res);
      g.save();
    } else {
      res = INKLOOK.refRes;
      g = ctx;
      this.viewTransform();
      g.save();
      g.beginPath(); g.rect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH); g.clip();
    }
    g.fillStyle = INK.paper;
    g.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
    const z = cam.effectiveZoom();
    // World units per low-res pixel: line weights are authored in low-res pixels.
    const wpp = 1 / (res * z);
    g.translate(WORLD.viewW / 2 + cam.ox, cam.groundScreen + cam.oy);
    g.rotate(cam.rot);
    g.scale(z, z);
    g.translate(-cam.x, -cam.y);

    const G = WORLD.groundY;
    const fw = INKLOOK.floorPx * wpp;
    // Floor: one thick black line + the Blank Page's few fixed doodles + accumulated damage.
    g.fillStyle = INK.ink;
    g.fillRect(-600, G - fw / 2, WORLD.arenaW + 1200, fw);
    drawDoodles(g, wpp);
    inkFx.drawFloor(g, wpp);

    const order = this.order;
    order.length = 0;
    for (const e of world.enemies) order.push(e);
    order.sort(sortFighters);
    order.push(world.player);

    // Reflections (dither key), clipped below the floor line.
    g.save();
    g.beginPath(); g.rect(-600, G + fw / 2, WORLD.arenaW + 1200, 2000); g.clip();
    for (const f of order) inkReflection(g, f, alpha, time, wpp);
    g.restore();

    for (const f of order) drawInkFighter(g, f, alpha, time, wpp);
    const pl = world.player;
    this.lastPlayerX = pl.px + (pl.x - pl.px) * alpha;
    this.lastPlayerY = pl.py + (pl.y - pl.py) * alpha;
    if (this.drawExtras) this.drawExtras(g, alpha, time);
    inkFx.drawFront(g, wpp);
    g.restore();

    // Impact frame: hard black/white inversion; screen flash as a page wash.
    if (effects.invert > 0 && !settings.reduceFlashes) {
      g.globalCompositeOperation = 'difference';
      g.fillStyle = '#ffffff';
      g.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
      g.globalCompositeOperation = 'source-over';
    }
    if (effects.screenFlash > 0.25 && !settings.reduceFlashes) {
      g.fillStyle = effects.screenFlashColor;
      g.globalAlpha = 0.5;
      g.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
      g.globalAlpha = 1;
    }

    if (pixel) {
      quantize(g, lw, lh);
      // Nearest-neighbor upscale into the world rect.
      this.cssTransform();
      const r = layout.world, sc = layout.scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.low!, 0, 0, lw, lh, r.x, r.y, layout.viewW * sc, layout.viewH * sc);
      ctx.imageSmoothingEnabled = true;
    }
    // Floating text on the crisp layer (world positioned).
    this.viewTransform();
    ctx.save();
    ctx.beginPath(); ctx.rect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH); ctx.clip();
    ctx.translate(WORLD.viewW / 2 + cam.ox, cam.groundScreen + cam.oy);
    ctx.rotate(cam.rot); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
    effects.drawTexts(ctx);
    ctx.restore();
    void dt;
  }
}

const DOODLE_SEED = 917;

function sortFighters(a: Fighter, b: Fighter): number {
  const ka = a.state === 'knockdown' || a.state === 'dead' ? 0 : a.inHitState ? 2 : 1;
  const kb = b.state === 'knockdown' || b.state === 'dead' ? 0 : b.inHitState ? 2 : 1;
  return ka - kb;
}

/** The Blank Page's fixed floor doodles: small scratchy marks on the floor line (seeded, always the same). */
function drawDoodles(g: CanvasRenderingContext2D, wpp: number): void {
  let sd = DOODLE_SEED;
  const rnd = () => ((sd = (Math.imul(sd, 1103515245) + 12345) | 0) >>> 8) / 16777216;
  const G = WORLD.groundY;
  g.strokeStyle = INK.ink;
  g.lineWidth = 1.5 * wpp;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < INKLOOK.floorDoodles; i++) {
    const x = (WORLD.arenaW * (i + 0.5)) / INKLOOK.floorDoodles + (rnd() - 0.5) * 140;
    const n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const x0 = x + (rnd() - 0.5) * 60, y0 = G + (rnd() - 0.2) * 8;
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, l = 6 + rnd() * 12;
      g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.abs(Math.sin(a)) * l * (rnd() < 0.5 ? -0.6 : 0.8));
    }
  }
  g.stroke();
}
