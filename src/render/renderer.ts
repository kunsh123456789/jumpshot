import { layout } from '../core/layout';
import type { Camera } from '../core/camera';
import { WORLD } from '../data/tuning';
import type { World } from '../sim/world';
import { Background } from './background';
import { drawFighter, drawShadow, drawTrail } from './stickman';
import { effects } from './effects';
import type { Fighter } from '../sim/fighter';

/** World-space rendering: background, fighters, effects. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly bg = new Background();
  /** Extra world-space draw hook (projectiles, pickups, hazards). */
  drawExtras: ((ctx: CanvasRenderingContext2D, alpha: number, time: number) => void) | null = null;
  private order: Fighter[] = [];

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

  render(world: World, cam: Camera, alpha: number, time: number, dt: number): void {
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
    ctx.translate(WORLD.viewW / 2 + cam.ox, WORLD.groundScreenY + cam.oy);
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
    for (const f of order) drawFighter(ctx, f, alpha, time);
    if (this.drawExtras) this.drawExtras(ctx, alpha, time);
    for (const f of order) drawTrail(ctx, f, alpha);
    effects.drawParticles(ctx, true);
    effects.drawTexts(ctx);
    ctx.restore();

    // Screen-space overlays inside the world rect.
    if (effects.screenFlash > 0) {
      ctx.globalAlpha = Math.min(1, effects.screenFlash) * 0.55;
      ctx.fillStyle = effects.screenFlashColor;
      ctx.fillRect(layout.viewX0, layout.viewY0, layout.viewW, layout.viewH);
      ctx.globalAlpha = 1;
    }
  }
}

function sortFighters(a: Fighter, b: Fighter): number {
  const ka = a.state === 'knockdown' || a.state === 'dead' ? 0 : a.inHitState ? 2 : 1;
  const kb = b.state === 'knockdown' || b.state === 'dead' ? 0 : b.inHitState ? 2 : 1;
  return ka - kb;
}
