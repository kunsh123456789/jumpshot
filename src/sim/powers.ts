import type { World } from './world';
import type { Fighter } from './fighter';
import { addMove, CANCEL } from '../data/moves';
import { playerHit } from './combat';

/**
 * Laser Eyes (the "fly" trait, from the player's sketch): hold jump after the apex to hover and slowly climb
 * on a small fuel tank (refilled by landing); while flying, red beams from the eyes hit the nearest enemy in front
 * and set it burning. All of it is gated on the trait, so a run without it is untouched.
 */
export const EYES = {
  fuelFrames: 150,
  /** Climb speed while hovering (up is negative). */
  riseVy: -90,
  /** Frames between eye shots, range, and how long a burn lasts. */
  every: 10, range: 820, burnFrames: 200,
} as const;

const EYE_MOVE = addMove({ id: 'eye_laser', name: 'Laser Eyes', tags: ['light', 'air'], startup: 1, active: 1, recovery: 1, damage: 3, hitstun: 12, kbX: 20, kbY: 0, hitbox: { x: 0, y: 0, r: 0 }, reach: 0, dash: false, cancelInto: CANCEL.air, sound: 'slash', weight: 0.15, trail: { limb: 'handA', color: '#e22424', width: 6 } });

export interface EyeBeam { x1: number; y1: number; x2: number; y2: number; t: number }

export class Powers {
  fuel: number = EYES.fuelFrames;
  hovering = false;
  beam: EyeBeam | null = null;
  private shot = 0;

  reset(): void { this.fuel = EYES.fuelFrames; this.hovering = false; this.beam = null; this.shot = 0; }
  refuel(): void { this.fuel = EYES.fuelFrames; }

  /** Once per frame (player update): decide whether the hero is hovering, and fire the eyes while it is. */
  update(w: World): void {
    const p = w.player;
    if (this.beam && --this.beam.t <= 0) this.beam = null;
    for (const e of w.enemies) if (e.burn > 0) { e.burn--; if (e.alive && e.burn % 20 === 0) e.hp = Math.max(1, e.hp - 1); }
    this.hovering = false;
    if (w.traits.fly <= 0 || !p.alive || p.grounded) return;
    if (p.state !== 'fall' && p.state !== 'jumpFollow') return;
    if (w.jumpCharge > 0.6 && p.airFrames > 12 && p.vy > -80 && this.fuel > 0) {
      this.hovering = true; this.fuel--;
      if (++this.shot >= EYES.every) { this.shot = 0; this.fire(w, p); }
    }
  }

  private fire(w: World, p: Fighter): void {
    let best: Fighter | null = null, bd: number = EYES.range;
    for (const e of w.enemies) {
      if (!e.alive || e.remove || !e.canBeHit) continue;
      const dx = e.x - p.x;
      if (Math.sign(dx) !== p.facing && Math.abs(dx) > 90) continue;
      const d = Math.hypot(dx, e.cy - p.cy);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    p.facing = best.x >= p.x ? 1 : -1;
    playerHit(w, EYE_MOVE, best, true);
    best.burn = EYES.burnFrames;
    this.beam = { x1: p.x + p.facing * 8, y1: p.y - 118 * p.scale, x2: best.cx, y2: best.cy - 20, t: 7 };
  }
}
