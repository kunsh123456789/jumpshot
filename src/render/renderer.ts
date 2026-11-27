import { layout } from '../core/layout';
import { drawWeaponFx, drawRefFx } from './weaponFx';
import { drawExtraFx } from './weaponFx2';
import { drawCineFx } from './cineFx';
import { clip3Fx } from './clip3Fx';
import { drawMoveset2Fx } from './moveset2Fx';
import { drawGrappleFx } from './grappleFx';
import { drawPowerFx } from './powerFx';
import type { Camera } from '../core/camera';
import { ANIM, WORLD } from '../data/tuning';
import { settings } from '../core/settings';
import type { World } from '../sim/world';
import { Background } from './background';
import { drawFighter, drawShadow, drawTrail } from './stickman';
import { effects } from './effects';
import type { Fighter } from '../sim/fighter';
import { DRAW } from './drawStyle';
import { INK, drawInkFighter, inkReflection, quantize, setPaperColor } from './ink';
import { paper } from './paper';
import { PAPER } from '../data/paper';
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
    const dpr = Math.min(settings.mobilePerf ? 1 : 2, window.devicePixelRatio || 1);
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
  /** Rhythm beat pulse (0..1) for the page's bouncing margin doodles. */
  beatPulse = 0;
  private low: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;
  /** Mobile Performance: a GPU-backed low-res layer that is never read back (no palette snap). */
  private fast: HTMLCanvasElement | null = null;
  private fastCtx: CanvasRenderingContext2D | null = null;

  private bwShown = 0;
  render(world: World, cam: Camera, alpha: number, time: number, dt: number): void {
    // The Reaper Special drains the world to black and white (a real grayscale filter, only while it plays).
    const bw = Math.round((world.cine.ctx?.vis.bw ?? 0) * 20) / 20;
    if (bw !== this.bwShown) { this.bwShown = bw; this.canvas.style.filter = bw > 0 ? `grayscale(${bw}) contrast(${1 + bw * 0.25})` : ''; }
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
    drawGrappleFx(ctx, world, alpha, time, 1.6);
    for (const f of order) drawFighter(ctx, f, alpha, time, dt);
    drawWeaponFx(ctx, world, alpha, time, 1.6);
    drawMoveset2Fx(ctx, world, time, 1.6);
    drawExtraFx(ctx, world, alpha, time, 1.6);
    drawCineFx(ctx, world, alpha, time, 1.6);
    drawRefFx(ctx, world, alpha, time, 1.6, effects.invert > 0 && !settings.reduceFlashes);
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
    const perf = settings.mobilePerf;
    const r = layout.world, sc = layout.scale;
    // ---- Paper (screen space, pre-rendered; paper doesn't parallax) ----
    const q = pixel ? settings.pixelRes / sc : layout.dpr;
    const floorCss = r.y + (cam.groundScreen - layout.viewY0) * sc;
    paper.resize(layout.cssW, layout.cssH, q, floorCss);
    setPaperColor(PAPER.paper[paper.page]);
    this.cssTransform();
    paper.draw(ctx, time, this.beatPulse);

    // ---- World: a transparent layer over the whole screen (no letterbox gaps) ----
    let g: CanvasRenderingContext2D;
    let lw = 0, lh = 0, res: number;
    if (pixel) {
      res = settings.pixelRes;
      lw = Math.max(16, Math.ceil(layout.cssW * q)); lh = Math.max(16, Math.ceil(layout.cssH * q));
      if (perf) {
        if (!this.fast) { this.fast = document.createElement('canvas'); this.fastCtx = this.fast.getContext('2d'); }
      } else if (!this.low) { this.low = document.createElement('canvas'); this.lowCtx = this.low.getContext('2d', { willReadFrequently: true }); }
      const lc = perf ? this.fast! : this.low!;
      if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
      g = perf ? this.fastCtx! : this.lowCtx!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, lw, lh);
      g.setTransform(res, 0, 0, res, q * r.x - res * layout.viewX0, q * r.y - res * layout.viewY0);
      g.save();
    } else {
      res = INKLOOK.refRes;
      g = ctx;
      this.viewTransform();
      g.save();
    }
    const z = cam.effectiveZoom() * clip3Fx.zoomFactor();
    // World units per low-res pixel: line weights are authored in low-res pixels.
    const wpp = 1 / (res * z);
    g.translate(WORLD.viewW / 2 + cam.ox, cam.groundScreen + cam.oy);
    g.rotate(cam.rot);
    g.scale(z, z);
    g.translate(-cam.x, -cam.y);

    const G = WORLD.groundY;
    const fw = INKLOOK.floorPx * wpp * (settings.highContrast ? 1.4 : 1);
    // Floor: one thick black pen line (ruled) + the page's fixed doodles + accumulated damage.
    g.fillStyle = INK.ink;
    g.fillRect(-2600, G - fw / 2, WORLD.arenaW + 5200, fw);
    if (!settings.highContrast) drawDoodles(g, wpp);
    inkFx.drawFloor(g, wpp);

    const order = this.order;
    order.length = 0;
    for (const e of world.enemies) order.push(e);
    order.sort(sortFighters);
    order.push(world.player);

    // Reflections (dither key), clipped below the floor line. Mobile Performance skips them.
    if (!perf) {
      g.save();
      g.beginPath(); g.rect(-2600, G + fw / 2, WORLD.arenaW + 5200, 2000); g.clip();
      for (const f of order) inkReflection(g, f, alpha, time, wpp);
      g.restore();
    }

    clip3Fx.drawBack(g, world, wpp);
    drawGrappleFx(g, world, alpha, time, wpp);
    drawPowerFx(g, world, alpha, time, wpp);
    for (const f of order) drawInkFighter(g, f, alpha, time, wpp);
    drawWeaponFx(g, world, alpha, time, wpp);
    drawMoveset2Fx(g, world, time, wpp);
    drawExtraFx(g, world, alpha, time, wpp);
    drawCineFx(g, world, alpha, time, wpp);
    drawRefFx(g, world, alpha, time, wpp, effects.invert > 0 && !settings.reduceFlashes);
    clip3Fx.drawWorld(g, world, wpp);
    const pl = world.player;
    this.lastPlayerX = pl.px + (pl.x - pl.px) * alpha;
    this.lastPlayerY = pl.py + (pl.y - pl.py) * alpha;
    if (this.drawExtras) this.drawExtras(g, alpha, time);
    inkFx.drawFront(g, wpp);
    g.restore();

    if (pixel) clip3Fx.drawScreen(g, lw, lh, world);
    if (pixel) {
      // The palette snap reads the layer back from the GPU every frame: the main cost on phones.
      if (!perf) quantize(g, lw, lh);
      this.cssTransform();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(g.canvas, 0, 0, lw, lh, 0, 0, lw / q, lh / q);
      ctx.imageSmoothingEnabled = true;
    }
    this.cssTransform();
    paper.drawOverlay(ctx);
    // Impact frame: hard inversion of the whole page; screen flash as a page wash.
    if (effects.invert > 0 && !settings.reduceFlashes) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, layout.cssW, layout.cssH);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (effects.screenFlash > 0.25 && !settings.reduceFlashes) {
      ctx.fillStyle = effects.screenFlashColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, 0, layout.cssW, layout.cssH);
      ctx.globalAlpha = 1;
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
