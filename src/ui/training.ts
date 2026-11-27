import type { World } from '../sim/world';
import type { Fighter } from '../sim/fighter';
import type { Menus } from './menus';
import { save, writeSave } from '../core/settings';
import { WORLD } from '../data/tuning';

/**
 * The Training Room: a dojo with one target, no waves and no game over. Practise any weapon, trait and
 * Special on a drawn Dummy, a Punching Bag or the stick figure, with live damage readouts.
 */
const TARGETS: { id: '' | 'dummy' | 'bag'; name: string }[] = [
  { id: 'dummy', name: 'DUMMY' }, { id: 'bag', name: 'BAG' }, { id: '', name: 'STICK' },
];

export class TrainingRoom {
  active = false;
  private ti = 0;
  private attacks = false;
  private target: Fighter | null = null;
  private home = 0;
  private last = 0; private total = 0; private bestCombo = 0; private frames = 0; private firstHit = -1; private lastHit = 0;
  private ui: { stats: (s: string) => void } | null = null;
  private bound = false;

  constructor(private menus: Menus) {}

  start(w: World, cb: { onExit: () => void; onWeapon: () => void }): void {
    this.active = true;
    w.trainingRoom = true;
    this.attacks = false; w.dummyAttacks = false;
    this.ti = Math.max(0, TARGETS.findIndex((t) => t.id === (save.trainTarget ?? 'dummy')));
    this.zero();
    this.spawn(w);
    this.ui = this.menus.showTraining({
      target: TARGETS[this.ti].name, mode: 'STILL',
      onTarget: () => { this.ti = (this.ti + 1) % TARGETS.length; save.trainTarget = TARGETS[this.ti].id; writeSave(); if (this.target) this.target.sprite = TARGETS[this.ti].id; return TARGETS[this.ti].name; },
      onMode: () => { this.attacks = !this.attacks; w.dummyAttacks = this.attacks; return this.attacks ? 'ATTACKS' : 'STILL'; },
      onWeapon: cb.onWeapon,
      onSpecial: () => { w.special.add(w, 1000); },
      onReset: () => { this.zero(); this.spawn(w); },
      onExit: cb.onExit,
    });
    if (this.bound) return;
    this.bound = true;
    w.events.on('hit', (e) => {
      if (!this.active || e.victim !== this.target) return;
      this.last = Math.round(e.damage); this.total += e.damage; this.lastHit = this.frames;
      if (this.firstHit < 0) this.firstHit = this.frames;
    });
  }

  stop(w: World): void { this.active = false; w.trainingRoom = false; w.dummyAttacks = false; this.menus.close('training'); }

  private zero(): void { this.last = 0; this.total = 0; this.bestCombo = 0; this.firstHit = -1; this.lastHit = 0; this.frames = 0; }

  private spawn(w: World): void {
    for (const e of w.enemies) e.remove = true;
    const p = w.player;
    const x = Math.max(WORLD.wallMargin + 100, Math.min(WORLD.arenaW - WORLD.wallMargin - 100, p.x + (p.x > WORLD.arenaW * 0.7 ? -260 : 260)));
    const d = w.spawnDummy(x);
    d.facing = x > p.x ? -1 : 1;
    d.sprite = TARGETS[this.ti].id;
    this.target = d;
    this.home = x;
  }

  update(w: World): void {
    if (!this.active) return;
    this.frames++;
    const t = this.target, p = w.player;
    if (!t || !t.alive || t.remove || !w.enemies.includes(t)) this.spawn(w);
    else {
      if (t.hp < t.maxHp * 0.5) t.hp = t.maxHp;
      if (t.sprite === 'bag') {
        // a hanging bag: it never moves, it only swings (spriteAng); hits don't knock it down
        t.x = this.home; t.vx = 0; t.vy = 0; t.y = WORLD.groundY; t.grounded = true;
        if (t.state === 'air' || t.state === 'knockdown' || t.state === 'getup' || t.state === 'ko') t.setState('idle');
      } else if (!this.attacks && t.state === 'idle' && t.grounded && Math.abs(t.x - this.home) > 6) {
        // the dummy walks back to its spot once it has recovered
        t.x += Math.sign(this.home - t.x) * Math.min(6, Math.abs(this.home - t.x));
      }
    }
    // no game over in here
    if (p.hp < p.maxHp * 0.4) p.hp = p.maxHp;
    if (w.combo.hits > this.bestCombo) this.bestCombo = w.combo.hits;
    if (this.frames % 6 === 0 && this.ui) {
      const secs = this.firstHit < 0 ? 0 : Math.max(1, this.lastHit - this.firstHit) / 60;
      const dps = this.firstHit < 0 || secs < 0.5 ? 0 : Math.round(this.total / secs);
      this.ui.stats(this.firstHit < 0 ? 'Hit the target' : `LAST ${this.last} · COMBO ${w.combo.hits} (best ${this.bestCombo}) · TOTAL ${Math.round(this.total)} · DPS ${dps}`);
    }
  }
}
