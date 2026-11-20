import { EventBus } from '../core/events';
import { Fighter } from './fighter';
import type { SimEvents } from './events';
import { PICKUPS, PLAYER, STYLE, WORLD } from '../data/tuning';
import type { SwipeEvent } from '../ui/pad';
import { poseFighter, setPoseBeat } from '../render/poser';
import { ComboTracker } from './combo';
import { EnemyAI } from './enemyAI';
import { WaveDirector } from './waves';
import { Entities } from './entities';
import { PlayerController } from './player';
import { bowling, enemyPhysics, separate } from './physics';
import { BOSS, ENEMIES, PROJECTILE, type EnemyAttack, type EnemyKind } from '../data/enemies';
import { simRng } from '../core/rng';
import type { RhythmSim } from '../rhythm/simHooks';
import { WeaponSim } from './weapon';
import { WEAPONS, weaponById, type WeaponDef } from '../data/weapons';

/** The simulation container. Advanced only in fixed 60 Hz steps. */
export class World {
  readonly events = new EventBus<SimEvents>();
  player: Fighter;
  enemies: Fighter[] = [];
  frame = 0;
  readonly combo: ComboTracker;
  readonly ai = new EnemyAI();
  readonly waves = new WaveDirector();
  readonly ents = new Entities();
  readonly ctrl = new PlayerController();
  /** The equipped weapon and its sim state (hooks, heat, ropes, held bodies). */
  weapon: WeaponDef = WEAPONS.fists;
  readonly wpn = new WeaponSim();
  gameOver = false;
  /** Tutorial: whether the training dummy attacks. */
  dummyAttacks = false;
  /** Visible world range, provided by the camera each frame (spawn placement). */
  camLeft = 0;
  camRight: number = WORLD.viewW;
  wave = 0;
  /** Rhythm Mode hooks; null in Classic Mode (every use is guarded). */
  rhythm: RhythmSim | null = null;
  /** Horizontal movement input this tick (-1..1), from the pad stick or keyboard. */
  moveAxis = 0;

  constructor() {
    this.player = this.makePlayer();
    this.combo = new ComboTracker(this.events);
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
    Object.assign(this.combo, new ComboTracker(this.events));
    this.ai.reset();
    this.ents.clear();
    this.ctrl.reset();
    this.wpn.reset();
    this.player.weapon = this.weapon.id;
    this.gameOver = false;
    this.wave = 0;
    this.waves.wave = 0;
    this.waves.active = false;
    this.waves.cleared = false;
    simRng.seed(1234567);
  }

  /** Equip a weapon (between waves or before a run). Drops anything the old one was holding. */
  setWeapon(id: string): void {
    this.weapon = weaponById(id);
    this.wpn.reset();
    this.player.weapon = this.weapon.id;
    this.events.emit('weaponSwap', { id: this.weapon.id });
  }

  spawnDummy(x: number): Fighter {
    const e = new Fighter('enemy', ENEMIES.dummy);
    e.x = e.px = x;
    e.facing = -1;
    e.ai.cooldown = 120;
    e.snapAnim();
    this.enemies.push(e);
    return e;
  }

  step(inputs: SwipeEvent[], moveAxis = 0): void {
    this.frame++;
    this.moveAxis = moveAxis;
    const p = this.player;
    p.px = p.x; p.py = p.y;
    for (const e of this.enemies) { e.px = e.x; e.py = e.y; }

    this.ctrl.ingest(this, inputs);
    if (p.alive) this.ctrl.update(this);
    else this.deadPlayerPhysics();
    this.wpn.update(this);

    // S-rank regen.
    if (p.alive && this.combo.rank >= 4 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + PLAYER.hpRegenSRank / 60);

    this.ai.distribute(this);
    if (p.impact > 0 && p.hitstop === 0) p.impact--;
    for (const e of this.enemies) {
      if (e.flash > 0) e.flash--;
      if (e.impact > 0 && e.hitstop === 0) e.impact--;
      if (e.hitstop > 0) {
        e.hitstop--;
        continue; // frozen; the renderer adds a smooth vibration
      }
      e.stateFrame++;
      // Held and reeled-in bodies are positioned by the weapon sim.
      if (e.state === 'held' || e.state === 'pulled') continue;
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
    if (this.combo.hits === 0) for (const e of this.enemies) if (!e.inHitState) e.comboHits = 0;
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
    setPoseBeat(this.rhythm ? this.rhythm.poseBeat() : null);
    // Look targets: the player looks at its target (or nearest enemy), enemies look at the player.
    let look = p.target && p.target.alive ? p.target : null;
    if (!look) {
      let bd = 700;
      for (const e of this.enemies) { if (!e.alive) continue; const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; look = e; } }
    }
    p.hasLook = !!look;
    if (look) { p.lookX = look.cx; p.lookY = look.cy - 30 * look.scale; }
    poseFighter(p, t);
    p.anim.step(p.x, p.y, p.facing, p.scale, p.vx, p.vy, p.hitstop > 0, p.state === 'move');
    for (const e of this.enemies) {
      e.hasLook = p.alive && e.alive;
      e.lookX = p.cx; e.lookY = p.cy - 30;
      poseFighter(e, t);
      e.anim.step(e.x, e.y, e.facing, e.scale, e.vx, e.vy, e.hitstop > 0, e.state === 'attack' || e.state === 'windup');
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
