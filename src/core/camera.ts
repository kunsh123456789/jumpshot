import { CAMERA, JUICE, WORLD } from '../data/tuning';
import { clamp, damp } from './math';
import { settings } from './settings';

/** Camera with action-centroid tracking, zoom, trauma shake, directional kick and punch-zoom. */
export class Camera {
  x = WORLD.arenaW / 2;
  y = WORLD.groundY;
  zoom = 1;
  targetX = WORLD.arenaW / 2;
  targetY = WORLD.groundY;
  targetZoom = 1;
  /** Extra zoom requested by finishers (multiplicative, eased). */
  focusZoom = 0;
  private focusTarget = 0;
  private focusRemain = 0;

  private trauma = 0;
  private rotTrauma = 0;
  private kickX = 0; private kickY = 0; private kickVX = 0; private kickVY = 0;
  private punch = 0;
  private t = 0;

  // Outputs (logical px / radians).
  ox = 0; oy = 0; rot = 0;

  shake(amount: number, dirX = 0, dirY = 0, rotational = 0): void {
    const m = settings.shake;
    if (m <= 0) return;
    this.trauma = Math.min(1, this.trauma + (amount / JUICE.shakeMax) * 0.9 * m);
    this.rotTrauma = Math.min(1, this.rotTrauma + rotational * m);
    const len = Math.hypot(dirX, dirY) || 1;
    const k = amount * 0.9 * m;
    this.kickVX += (dirX / len) * k * 55;
    this.kickVY += (dirY / len) * k * 55;
  }

  punchZoom(a: number): void {
    this.punch = Math.min(JUICE.punchZoomMax, this.punch + a * JUICE.punchZoomMax);
  }

  focus(amount: number, seconds: number): void {
    this.focusTarget = amount;
    this.focusRemain = seconds;
  }

  snap(): void {
    this.x = this.targetX; this.y = this.targetY; this.zoom = this.targetZoom;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.focusRemain > 0) { this.focusRemain -= dt; if (this.focusRemain <= 0) this.focusTarget = 0; }
    this.focusZoom += (this.focusTarget - this.focusZoom) * damp(this.focusTarget > this.focusZoom ? 12 : 4, dt);

    this.x += (this.targetX - this.x) * damp(CAMERA.followRate, dt);
    this.y += (this.targetY - this.y) * damp(CAMERA.followRate * 0.8, dt);
    this.zoom += (this.targetZoom - this.zoom) * damp(CAMERA.zoomRate, dt);
    this.punch += (0 - this.punch) * damp(7, dt);

    const z = this.effectiveZoom();
    const half = WORLD.viewW / 2 / z;
    this.x = clamp(this.x, half - 10, WORLD.arenaW - half + 10);

    // Trauma shake (squared for nicer falloff) using layered sines (no allocation).
    this.trauma = Math.max(0, this.trauma - JUICE.shakeDecay * dt * 0.5);
    this.rotTrauma = Math.max(0, this.rotTrauma - JUICE.shakeDecay * dt * 0.5);
    const s = this.trauma * this.trauma * JUICE.shakeMax;
    const t = this.t * 60;
    const nx = Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1 + 1.3) * 0.4;
    const ny = Math.sin(t * 2.3 + 0.7) * 0.6 + Math.sin(t * 2.9 + 2.1) * 0.4;
    // Directional kick spring.
    // Under-damped spring (omega ~32 rad/s), integrated with sub-steps for stability.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.kickVX += (-1000 * this.kickX - 26 * this.kickVX) * h;
      this.kickVY += (-1000 * this.kickY - 26 * this.kickVY) * h;
      this.kickX += this.kickVX * h; this.kickY += this.kickVY * h;
    }
    this.kickX = clamp(this.kickX, -JUICE.shakeMax, JUICE.shakeMax);
    this.kickY = clamp(this.kickY, -JUICE.shakeMax, JUICE.shakeMax);
    this.ox = clamp(nx * s + this.kickX, -JUICE.shakeMax, JUICE.shakeMax);
    this.oy = clamp(ny * s + this.kickY, -JUICE.shakeMax, JUICE.shakeMax);
    this.rot = Math.sin(t * 1.9 + 0.4) * this.rotTrauma * this.rotTrauma * JUICE.shakeRotMax;
  }

  effectiveZoom(): number {
    return this.zoom * (1 + this.punch + this.focusZoom);
  }

  /** World -> logical view coordinates (before world rect scaling). */
  toViewX(wx: number): number { return (wx - this.x) * this.effectiveZoom() + WORLD.viewW / 2; }
  toViewY(wy: number): number { return (wy - this.y) * this.effectiveZoom() + WORLD.groundScreenY; }
  /** Visible world-space x range. */
  viewLeft(): number { return this.x - WORLD.viewW / 2 / this.effectiveZoom(); }
  viewRight(): number { return this.x + WORLD.viewW / 2 / this.effectiveZoom(); }
}
