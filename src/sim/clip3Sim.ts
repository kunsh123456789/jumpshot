import type { World } from './world';
import type { Fighter } from './fighter';
import { WORLD } from '../data/tuning';
import { isBoss } from '../data/enemies';
import { DRAW } from '../render/drawStyle';
import { hurtPlayer, ko, parry, sideHit } from './combat';

/**
 * Gameplay from the third reference clip, Pixel look only (the player's rule; the same gate as the Ice
 * finisher in data/cines.ts), so Classic / the neon look play frame for frame as before. Deterministic:
 * frame counters only, no RNG.
 *  - Breakable walls (216-238): hard wall bounces crack a page edge; the second one (or a very fast one)
 *    smashes through it. That side stays open for the wave: bodies knocked through it are rung out (K.O.).
 *  - The Colossus's wrecking ball (184): from phase 2 it rolls a giant ball along the floor; jump it.
 *  - Blade clash (114-116): if your attack and an elite's land on the same moment face to face, the blades
 *    lock; swing again during the lock to win it (the elite is staggered), or you are both shoved apart.
 */
export interface Ball { x: number; dir: number; t: number; warn: number; done: boolean; hitP: boolean; hits: number[] }

const BALL = { every: 480, warn: 42, speed: 640, radius: 70, damage: 14, enemyDamage: 12 };
const CLASH = { reach: 150, freeze: 16, window: 40 };

export class Clip3Sim {
  /** Page edges: cracked (one hard hit) and broken open. Index 0 = left, 1 = right. */
  readonly cracks = [0, 0];
  readonly broken = [false, false];
  readonly balls: Ball[] = [];
  clash: { e: Fighter; t: number; serial: number; x: number; y: number } | null = null;

  get on(): boolean { return DRAW.ink; }

  reset(): void {
    this.cracks[0] = this.cracks[1] = 0;
    this.broken[0] = this.broken[1] = false;
    this.balls.length = 0;
    this.clash = null;
  }

  /** A hard wall bounce (physics.ts): crack the wall, or smash through it. Returns true if it broke. */
  wallHit(w: World, e: Fighter, dir: number, speed: number): boolean {
    if (!this.on || !this.breaker(e)) return false;
    const side = dir > 0 ? 0 : 1;
    if (this.broken[side]) return false;
    this.cracks[side]++;
    if (this.cracks[side] < 2 && speed < 1300) return false;
    this.broken[side] = true;
    e.vx = -dir * Math.max(700, speed);
    e.hp -= 12;
    w.events.emit('wallBreak', { x: side === 0 ? WORLD.wallMargin : WORLD.arenaW - WORLD.wallMargin, y: e.cy, dir });
    w.events.emit('text', { text: 'WALL BREAK!', x: e.x - dir * 40, y: e.y - 180, color: '#e22424', size: 30 });
    return true;
  }

  /** May this body pass the page edge at x (a broken wall, while it is flying)? */
  passable(e: Fighter): boolean {
    if (!this.on || !this.breaker(e)) return false;
    const side = e.x < WORLD.arenaW / 2 ? 0 : 1;
    return this.broken[side] && !e.grounded;
  }

  /** Only ordinary enemies break walls and pass through them (never bosses or the training dummy). */
  private breaker(e: Fighter): boolean { return e.team === 'enemy' && !isBoss(e) && e.kind !== 'dummy'; }

  spawnBall(w: World, boss: Fighter): void {
    if (!this.on) return;
    const dir = Math.sign(w.player.x - boss.x) || boss.facing;
    this.balls.push({ x: boss.x + dir * 60, dir, t: 0, warn: BALL.warn, done: false, hitP: false, hits: [] });
    w.events.emit('text', { text: 'BALL!', x: boss.x, y: boss.y - 300, color: '#e22424', size: 28 });
    w.events.emit('telegraph', { enemy: boss });
  }

  /** An elite's attack meets the hero's: lock the blades. Returns true when the clash took over. */
  tryClash(w: World, e: Fighter): boolean {
    if (!this.on || this.clash || e.kind !== 'elite') return false;
    const p = w.player, m = p.move;
    if (p.state !== 'move' || !m || p.moveFrame < p.effStartup || p.moveFrame >= p.effStartup + m.active) return false;
    if (Math.abs(p.x - e.x) > CLASH.reach || Math.sign(e.x - p.x) !== p.facing || Math.sign(p.x - e.x) !== e.facing) return false;
    const x = (p.x + e.x) / 2, y = (p.cy + e.cy) / 2;
    this.clash = { e, t: 0, serial: w.ctrl.swipes, x, y };
    e.attack = null; e.vx = 0; e.telegraph = 0;
    e.setState('recover', CLASH.window);
    e.hitstop = CLASH.freeze; p.hitstop = Math.max(p.hitstop, CLASH.freeze);
    w.events.emit('clash', { x, y, won: false, end: false });
    w.events.emit('text', { text: 'CLASH!', x, y: y - 120, color: '#e22424', size: 30 });
    return true;
  }

  update(w: World): void {
    if (!this.on) return;
    const p = w.player;
    // ring-outs through a broken wall
    for (const e of w.enemies) {
      if (e.remove || !this.breaker(e)) continue;
      const out = e.x < -160 ? 0 : e.x > WORLD.arenaW + 160 ? 1 : -1;
      if (out >= 0 && this.broken[out]) {
        if (e.alive) { ko(w, e, e.x < 0 ? -1 : 1); w.events.emit('text', { text: 'RING OUT!', x: Math.max(80, Math.min(WORLD.arenaW - 80, e.x)), y: e.y - 160, color: '#e22424', size: 30 }); }
        e.remove = true;
      }
    }
    // the wrecking ball
    for (const b of this.balls) {
      if (b.done) continue;
      if (++b.t <= b.warn) continue;
      b.x += (b.dir * BALL.speed) / 60;
      if (b.x < -BALL.radius * 2 || b.x > WORLD.arenaW + BALL.radius * 2) { b.done = true; continue; }
      if (!b.hitP && p.alive && Math.abs(p.x - b.x) < BALL.radius * 0.85 && p.height < BALL.radius * 1.5) {
        b.hitP = true;
        if (p.parryWindow > 0) { parry(w, null, true); b.done = true; continue; }
        if (p.invuln <= 0) hurtPlayer(w, BALL.damage, b.dir, 460, -700, null);
      }
      for (const e of w.enemies) {
        if (!e.canBeHit || isBoss(e) || b.hits.includes(e.id) || Math.abs(e.x - b.x) > BALL.radius || e.height > BALL.radius * 1.5) continue;
        b.hits.push(e.id);
        sideHit(w, e, BALL.enemyDamage, b.dir, -700, 'bowl', 520);
      }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) if (this.balls[i].done) this.balls.splice(i, 1);
    // the clash: swing again while it holds to win it
    const c = this.clash;
    if (c) {
      c.t++;
      if (w.ctrl.swipes !== c.serial && c.e.alive) {
        const e = c.e;
        e.poise = 0; e.ai.stagger = 60; e.setState('stunned', 70);
        e.vx = Math.sign(e.x - p.x) * 260;
        w.events.emit('clash', { x: c.x, y: c.y, won: true, end: true });
        w.events.emit('text', { text: 'CLASH WON!', x: c.x, y: c.y - 140, color: '#2436e6', size: 30 });
        this.clash = null;
      } else if (c.t >= CLASH.window || !c.e.alive) {
        const d = Math.sign(c.e.x - p.x) || 1;
        c.e.vx = d * 420; p.vx = -d * 420;
        w.events.emit('clash', { x: c.x, y: c.y, won: false, end: true });
        this.clash = null;
      }
    }
  }
}

export { BALL, CLASH };
