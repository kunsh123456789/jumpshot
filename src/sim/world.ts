import { EventBus } from '../core/events';
import { Fighter } from './fighter';
import type { SimEvents } from './events';
import { PICKUPS, PLAYER, STYLE, WORLD } from '../data/tuning';
import type { SwipeEvent } from '../ui/pad';
import { poseFighter } from '../render/poser';
import { ComboTracker } from './combo';
import { baseStats, type Stats } from '../data/upgrades';
import { EnemyAI } from './enemyAI';
import { WaveDirector } from './waves';
import { Entities } from './entities';
import { PlayerController } from './player';
import { bowling, enemyPhysics, separate } from './physics';
import { BOSS, ENEMIES, PROJECTILE, type EnemyAttack, type EnemyKind } from '../data/enemies';
import { simRng } from '../core/rng';

/** The simulation container. Advanced only in fixed 60 Hz steps. */
export class World {
  readonly events = new EventBus<SimEvents>();
  player: Fighter;
  enemies: Fighter[] = [];
  frame = 0;
  stats: Stats = baseStats();
  readonly combo: ComboTracker;
  readonly ai = new EnemyAI();
  readonly waves = new WaveDirector();
  readonly ents = new Entities();
  readonly ctrl = new PlayerController();
  gameOver = false;
  /** Tutorial: whether the training dummy attacks. */
  dummyAttacks = false;
  /** Visible world range, provided by the camera each frame (spawn placement). */
  camLeft = 0;
  camRight: number = WORLD.viewW;
  wave = 0;

  constructor() {
    this.player = this.makePlayer();
    this.combo = new ComboTracker(this.events, this.stats);
  }

  private makePlayer(): Fighter {
    const p = new Fighter('player', null);
    p.x = p.px = WORLD.arenaW / 2;
    p.scale = PLAYER.scale;
    p.hp = p.maxHp = PLAYER.maxHp;
    return p;
  }

  /** Fresh run. */
  reset(): void {
    this.player = this.makePlayer();
    this.enemies.length = 0;
    this.stats = baseStats();
    this.combo.setStats(this.stats);
    Object.assign(this.combo, new ComboTracker(this.events, this.stats));
    this.ai.reset();
    this.ents.clear();
    this.ctrl.reset();
    this.gameOver = false;
    this.wave = 0;
    this.waves.wave = 0;
    this.waves.active = false;
    this.waves.cleared = false;
    simRng.seed(1234567);
  }

  applyStats(): void {
    const p = this.player;
    const newMax = PLAYER.maxHp + this.stats.maxHpBonus;
    if (newMax !== p.maxHp) { p.hp += newMax - p.maxHp; p.maxHp = newMax; }
    this.combo.setStats(this.stats);
  }

  spawnDummy(x: number): Fighter {
    const e = new Fighter('enemy', ENEMIES.dummy);
    e.x = e.px = x;
    e.facing = -1;
    e.ai.cooldown = 120;
    this.enemies.push(e);
    return e;
  }

  step(inputs: SwipeEvent[]): void {
    this.frame++;
    const p = this.player;
    p.px = p.x; p.py = p.y;
    for (const e of this.enemies) { e.px = e.x; e.py = e.y; }

    this.ctrl.ingest(this, inputs);
    if (p.alive) this.ctrl.update(this);
    else this.deadPlayerPhysics();

    // S-rank regen.
    if (p.alive && this.combo.rank >= 4 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + PLAYER.hpRegenSRank / 60);

    this.ai.distribute(this);
    for (const e of this.enemies) {
      if (e.hitstop > 0) {
        e.hitstop--;
        // victim jitter along the hit direction
        const j = (this.frame & 1) === 0 ? 1 : -1;
        e.anim.shakeX = j * 3.5 * (e.hitDirX || 1) * (e.state === 'dead' ? 0 : 1);
        e.anim.shakeY = j * 1.5 * e.hitDirY;
        continue;
      }
      e.anim.shakeX = 0; e.anim.shakeY = 0;
      e.stateFrame++;
      if (e.alive || e.state === 'ko' || e.state === 'dead') {
        if (e.alive) this.ai.update(this, e);
        enemyPhysics(this, e);
      }
    }
    bowling(this);
    separate(this);
    this.ents.update(this);

    // Remove finished enemies (in place, no allocation).
    let n = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.remove) this.enemies[n++] = e;
    }
    this.enemies.length = n;

    let anyHit = false;
    for (const e of this.enemies) if (e.alive && (e.inHitState || e.hitstop > 0)) { anyHit = true; break; }
    this.combo.update(anyHit);
    this.waves.update(this);
    this.updateVisuals();
  }

  private deadPlayerPhysics(): void {
    const p = this.player;
    if (p.hitstop > 0) { p.hitstop--; return; }
    p.stateFrame++;
    if (!p.grounded) {
      p.vy += 2600 / 60; p.y += p.vy / 60; p.x += p.vx / 60;
      p.spinAngle += p.spinVel;
      if (p.y >= WORLD.groundY) { p.y = WORLD.groundY; p.grounded = true; p.vy = 0; p.setState('knockdown', 99999); }
    } else { p.vx *= 0.85; p.x += p.vx / 60; }
    p.x = Math.max(WORLD.wallMargin, Math.min(WORLD.arenaW - WORLD.wallMargin, p.x));
  }

  updateVisuals(): void {
    const t = this.frame / 60;
    const p = this.player;
    p.anim.shakeX = 0; p.anim.shakeY = 0;
    poseFighter(p, t);
    p.anim.step(p.x, p.y, p.facing, p.scale, p.vx, p.vy, p.hitstop > 0);
    for (const e of this.enemies) {
      poseFighter(e, t);
      e.anim.step(e.x, e.y, e.facing, e.scale, e.vx, e.vy, e.hitstop > 0);
    }
  }

  // ---- spawn helpers used by AI ----
  spawnProjectile(e: Fighter, atk: EnemyAttack): void {
    const pr = this.ents.projectiles.acquire();
    const pj = atk.projectile!;
    pr.team = 'enemy';
    pr.x = pr.px = e.x + e.facing * 40 * e.scale;
    pr.y = pr.py = e.y - pj.y * e.scale;
    const dx = this.player.x - pr.x;
    pr.vx = Math.sign(dx || e.facing) * pj.speed;
    pr.vy = 0;
    pr.damage = pj.damage;
    pr.life = PROJECTILE.life;
    pr.ownerId = e.id;
    this.events.emit('projectile', { x: pr.x, y: pr.y, kind: 'throw' });
  }

  spawnGroundWave(x: number, dir: number, speed: number, damage: number, life: number): void {
    const g = this.ents.waves.acquire();
    g.x = g.px = x; g.dir = dir; g.speed = speed; g.damage = damage; g.life = 0; g.max = life; g.hit = false;
  }

  spawnMeteor(x: number): void {
    const m = this.ents.meteors.acquire();
    m.x = Math.max(80, Math.min(WORLD.arenaW - 80, x)); m.t = 0; m.warn = BOSS.meteorWarn; m.done = false;
    this.events.emit('meteorWarn', { x: m.x });
  }

  dropLoot(e: Fighter): void {
    if (e.kind === 'dummy') return;
    const big = e.kind === 'boss' || e.kind === 'elite';
    const nOrbs = big ? 5 : simRng.chance(PICKUPS.orbDropChance) ? 1 : 0;
    for (let i = 0; i < nOrbs; i++) this.ents.spawnPickup('orb', e.x, e.y - 40, simRng.range(-220, 220));
    const healthChance = PICKUPS.healthDropChance + (this.player.hp < this.player.maxHp * 0.35 ? 0.2 : 0);
    if (big || simRng.chance(healthChance)) this.ents.spawnPickup('health', e.x, e.y - 40, simRng.range(-160, 160));
  }

  /** Spawn an enemy directly (debug / tutorial). */
  spawnEnemy(kind: EnemyKind): Fighter { return this.waves.spawn(this, kind, 0); }

  get styleRankName(): string { return STYLE.ranks[this.combo.rank]; }
}
