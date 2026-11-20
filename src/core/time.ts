import { damp } from './math';

/**
 * Global time control for slow-motion. Hit-stop is per-fighter (in the sim);
 * slow-mo scales how fast the fixed-step accumulator fills, so the sim stays
 * deterministic and simply runs fewer steps per real second.
 */
export class TimeControl {
  scale = 1;
  private target = 1;
  private remain = 0;
  /** Real seconds since start (unscaled). */
  real = 0;

  /** Rhythm mode: the sim must stay in lock-step with the music, so slow-mo is disabled. */
  locked = false;

  slowmo(scale: number, seconds: number): void {
    if (this.locked) return;
    if (scale < this.target || this.remain <= 0) this.target = scale;
    this.remain = Math.max(this.remain, seconds);
    this.scale = Math.min(this.scale, scale + 0.15);
  }

  update(realDt: number): void {
    this.real += realDt;
    if (this.remain > 0) {
      this.remain -= realDt;
      this.scale += (this.target - this.scale) * damp(30, realDt);
      if (this.remain <= 0) this.target = 1;
    } else {
      this.scale += (1 - this.scale) * damp(9, realDt);
      if (this.scale > 0.995) this.scale = 1;
    }
  }

  reset(): void { this.scale = 1; this.target = 1; this.remain = 0; }
}
