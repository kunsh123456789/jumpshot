import { CAMERA, JUICE, WORLD } from '../data/tuning';
import { clamp } from './math';
import { settings } from './settings';
import { layout } from './layout';

/** Camera with action-centroid tracking, zoom, trauma shake, directional kick and punch-zoom. */
export class Camera {
  x: number = WORLD.arenaW / 2;
  y: number = WORLD.groundY;
  zoom = 1;
  targetX: number = WORLD.arenaW / 2;
  targetY: number = WORLD.groundY;
  targetZoom = 1;
  /** Extra zoom requested by finishers (multiplicative, eased). */
  focusZoom = 0;
  private focusTarget = 0;
  private focusRemain = 0;

  private trauma = 0;
  private rotTrauma = 0;
  private kickX = 0; private kickY = 0; private kickVX = 0; private kickVY = 0;
  private punch = 0;
  private punchTarget = 0;
  private vPunch = 0;
  private vx = 0; private vy = 0; private vz = 0; private vFocus = 0;
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
    this.punchTarget = Math.min(JUICE.punchZoomMax, this.punchTarget + a * JUICE.punchZoomMax);
  }

  focus(amount: number, seconds: number): void {
    this.focusTarget = amount;
    this.focusRemain = seconds;
  }

  snap(): void {
    this.x = this.targetX; this.y = this.targetY; this.zoom = this.targetZoom;
    this.vx = this.vy = this.vz = 0;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.focusRemain > 0) { this.focusRemain -= dt; if (this.focusRemain <= 0) this.focusTarget = 0; }
    // Critically damped springs: inertia on start, no overshoot, never a snap-cut.
    [this.focusZoom, this.vFocus] = spring(this.focusZoom, this.vFocus, this.focusTarget, this.focusTarget > this.focusZoom ? 14 : 6, dt);
    [this.x, this.vx] = spring(this.x, this.vx, this.targetX, CAMERA.followOmega, dt);
    [this.y, this.vy] = spring(this.y, this.vy, this.targetY, CAMERA.followOmega * 0.85, dt);
    [this.zoom, this.vz] = spring(this.zoom, this.vz, this.targetZoom, this.targetZoom < this.zoom ? CAMERA.zoomOutOmega : CAMERA.zoomOmega, dt);
    // Punch-in: the target spikes and decays; the zoom springs toward it (eased in AND out).
    this.punchTarget *= Math.exp(-CAMERA.punchDecay * dt);
    [this.punch, this.vPunch] = spring(this.punch, this.vPunch, this.punchTarget, CAMERA.punchOmega, dt);

    const z = this.effectiveZoom();
    const half = layout.viewW / 2 / z;
    const cx = clamp(this.x, half - 10, WORLD.arenaW - half + 10);
    if (cx !== this.x) { this.x = cx; this.vx = 0; }

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
  viewLeft(): number { return this.x - layout.viewW / 2 / this.effectiveZoom(); }
  viewRight(): number { return this.x + layout.viewW / 2 / this.effectiveZoom(); }
}

/** Exact critically damped spring step (stable for any dt). Returns [x, v]. */
const out2: [number, number] = [0, 0];
function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const y = x - target;
  const e = Math.exp(-omega * dt);
  const tmp = (v + omega * y) * dt;
  out2[0] = target + (y + tmp) * e;
  out2[1] = (v - omega * tmp) * e;
  return out2;
}
