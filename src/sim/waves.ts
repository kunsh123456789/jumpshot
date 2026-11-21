import type { World } from './world';
import { Fighter } from './fighter';
import { ENEMIES, isBoss, type EnemyKind } from '../data/enemies';
import { WAVES_T, WORLD } from '../data/tuning';
import { hpScale, waveDef } from '../data/waves';
import { simRng } from '../core/rng';
import { clamp } from '../core/math';

/** Spawns each wave's enemies from the screen edges, a few at a time. */
export class WaveDirector {
  wave = 0;
  private queue: EnemyKind[] = [];
  private timer = 0;
  active = false;
  cleared = false;
  boss = false;
  elite = false;

  start(w: World, wave: number): void {
    this.wave = wave;
    const def = waveDef(wave, () => simRng.next());
    this.queue = def.enemies;
    this.boss = def.boss; this.elite = def.elite;
    this.timer = 0;
    this.active = true;
    this.cleared = false;
    w.ai.setWave(wave);
    w.events.emit('waveStart', { wave, boss: def.boss, elite: def.elite });
    // Spawn an opening group immediately.
    const opening = Math.min(this.queue.length, 3);
    for (let i = 0; i < opening; i++) this.spawnNext(w, i);
  }

  remainingToSpawn(): number { return this.queue.length; }
  /** Cheat (nuke): drop the rest of this wave's spawns. */
  clearQueue(): void { this.queue.length = 0; }

  update(w: World): void {
    if (!this.active) return;
    let alive = 0;
    for (const e of w.enemies) if (e.alive && e.kind !== 'dummy') alive++;
    if (this.queue.length > 0) {
      this.timer++;
      const cap = Math.min(WAVES_T.maxOnScreen, 3 + Math.floor(this.wave / 2));
      if ((alive < cap && this.timer >= WAVES_T.spawnIntervalFrames) || alive === 0) {
        this.timer = 0;
        this.spawnNext(w, 0);
      }
    } else if (alive === 0) {
      let anyBodies = false;
      for (const e of w.enemies) if (!e.remove && e.state === 'ko') anyBodies = true;
      if (!anyBodies) {
        this.active = false;
        this.cleared = true;
        w.events.emit('waveClear', { wave: this.wave });
      }
    }
  }

  private spawnNext(w: World, offset: number): void {
    const kind = this.queue.shift();
    if (!kind) return;
    this.spawn(w, kind, offset);
  }

  spawn(w: World, kind: EnemyKind, offset = 0): Fighter {
    const def = ENEMIES[kind];
    const e = new Fighter('enemy', def);
    const scale = hpScale(this.wave);
    e.hp = e.maxHp = Math.round(def.hp * scale);
    // Spawn just outside the visible area, on the side with more room.
    const left = w.camLeft - 60 - offset * 70;
    const right = w.camRight + 60 + offset * 70;
    let side = simRng.chance(0.5) ? -1 : 1;
    if (left < WORLD.wallMargin + 10) side = 1;
    if (right > WORLD.arenaW - WORLD.wallMargin - 10) side = -1;
    if (left < WORLD.wallMargin + 10 && right > WORLD.arenaW - WORLD.wallMargin - 10) side = simRng.sign();
    e.x = clamp(side < 0 ? left : right, WORLD.wallMargin + 10, WORLD.arenaW - WORLD.wallMargin - 10);
    e.px = e.x;
    e.facing = -side;
    e.ai.spawnWalk = 40;
    e.ai.cooldown = 40 + simRng.int(0, 60);
    e.ai.holdOff = simRng.range(-40, 60);
    e.ai.think = simRng.int(10, 60);
    if (isBoss(e)) {
      // The boss drops in from above.
      e.y = e.py = WORLD.groundY - 700;
      e.x = e.px = clamp(w.player.x + 360 * (simRng.sign()), 200, WORLD.arenaW - 200);
      e.grounded = false;
      e.setState('air');
      e.vy = 400;
      e.knockdownOnLand = false;
      e.ai.cooldown = 120;
    }
    e.snapAnim();
    w.enemies.push(e);
    w.events.emit('spawn', { enemy: e });
    return e;
  }

  summon(w: World, kind: EnemyKind): void {
    const e = this.spawn(w, kind, 0);
    e.ai.cooldown = 90;
  }
}
