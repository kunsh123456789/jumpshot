import { EventBus } from '../core/events';
import { Fighter } from './fighter';
import type { SimEvents } from './events';
import { WORLD } from '../data/tuning';
import type { SwipeEvent } from '../ui/pad';
import { poseFighter } from '../render/poser';

/** The simulation container. Advanced only in fixed 60 Hz steps. */
export class World {
  readonly events = new EventBus<SimEvents>();
  player: Fighter;
  enemies: Fighter[] = [];
  frame = 0;

  constructor() {
    this.player = new Fighter('player', null);
    this.player.x = this.player.px = WORLD.arenaW / 2;
  }

  step(_inputs: SwipeEvent[]): void {
    this.frame++;
    const all = this.enemies;
    this.player.px = this.player.x; this.player.py = this.player.y;
    for (const e of all) { e.px = e.x; e.py = e.y; }
    this.updateVisuals();
  }

  updateVisuals(): void {
    const t = this.frame / 60;
    const p = this.player;
    poseFighter(p, t);
    p.anim.step(p.x, p.y, p.facing, p.scale, p.vx, p.vy, p.hitstop > 0);
    for (const e of this.enemies) {
      poseFighter(e, t);
      e.anim.step(e.x, e.y, e.facing, e.scale, e.vx, e.vy, e.hitstop > 0);
    }
  }
}
