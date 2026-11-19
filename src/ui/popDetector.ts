import { ANIM } from '../data/tuning';
import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import { Ch } from '../render/rig';

const CH_NAMES = Object.keys(Ch);

export interface PopEvent {
  frame: number;
  who: string;
  kind: 'angle' | 'spin' | 'root';
  value: number;
  transition: string;
  state: string;
}

/**
 * Pop detector: every sim tick, measures the largest change of any joint angle
 * (shortest arc), of the body spin, and of the root position for the player and
 * the nearest enemy. Flags ticks above the ANIM thresholds that are not covered
 * by hit-stop or an intentional snap (strike contact, spawn), and records which
 * clip transition caused it. Kept in the build; read it in the ` debug panel.
 */
export class PopDetector {
  readonly events: PopEvent[] = [];
  total = 0;
  ticks = 0;
  /** Rolling maxima (decay over ~1 s) for the panel. */
  maxAng = 0;
  maxRoot = 0;
  log = false;
  /** How many recent events to keep. */
  cap = 12;

  check(w: World): void {
    this.ticks++;
    this.maxAng *= 0.985; this.maxRoot *= 0.985;
    this.one(w, w.player, 'player');
    let near: Fighter | null = null, bd = Infinity;
    for (const e of w.enemies) {
      if (e.state === 'dead') continue;
      const d = Math.abs(e.x - w.player.x);
      if (d < bd) { bd = d; near = e; }
    }
    if (near) this.one(w, near, near.kind);
  }

  private one(w: World, f: Fighter, who: string): void {
    const a = f.anim;
    if (f.hitstop > 0 || a.intentSnap) return;
    const root = Math.hypot(f.x - f.px, f.y - f.py);
    if (a.maxAngDelta > this.maxAng) this.maxAng = a.maxAngDelta;
    if (root > this.maxRoot) this.maxRoot = root;
    if (a.maxAngDelta > ANIM.popAngle) this.rec(w, f, who, 'angle', a.maxAngDelta);
    if (a.maxSpinDelta > ANIM.popSpin) this.rec(w, f, who, 'spin', a.maxSpinDelta);
    if (root > ANIM.popRoot) this.rec(w, f, who, 'root', root);
  }

  private rec(w: World, f: Fighter, who: string, kind: PopEvent['kind'], value: number): void {
    this.total++;
    const ev: PopEvent = {
      frame: w.frame, who, kind, value: Math.round(value * 100) / 100,
      transition: `${f.anim.lastTransition} +${f.anim.clipAge}f${kind === 'angle' ? ' ch' + CH_NAMES[f.anim.maxAngCh] : ''}`,
      state: f.state + (f.move ? ':' + f.move.id + '@' + f.moveFrame + '/' + f.effStartup + (f.dashFrames ? 'd' + f.dashFrames : '') : ''),
    };
    this.events.push(ev);
    if (this.events.length > this.cap) this.events.shift();
    if (this.log) console.debug('[pop]', ev);
  }

  reset(): void { this.events.length = 0; this.total = 0; this.ticks = 0; }
}
