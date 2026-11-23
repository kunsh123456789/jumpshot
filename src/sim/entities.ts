import { Pool } from '../core/pool';
import type { World } from './world';
import { PICKUPS, PHYS, WORLD } from '../data/tuning';
import { SPECIAL } from '../data/special';
import { BOSS, PROJECTILE, isBoss } from '../data/enemies';
import { hurtPlayer, overlaps, parry, sideHit } from './combat';

export class Projectile {
  x = 0; y = 0; vx = 0; vy = 0; life = 0; damage = 0;
  team: 'enemy' | 'player' = 'enemy';
  ownerId = 0;
  px = 0; py = 0;
}
export class GroundWave {
  x = 0; dir = 1; speed = 0; damage = 0; life = 0; max = 1; hit = false; px = 0;
}
export class Meteor {
  x = 0; t = 0; warn = 0; done = false;
}
export class Pickup {
  kind: 'health' | 'orb' = 'health';
  x = 0; y = 0; vx = 0; vy = 0; life = 0; px = 0; py = 0; grounded = false;
}

/** Projectiles, ground shockwaves, boss meteors and pickups (all pooled). */
export class Entities {
  readonly projectiles = new Pool(() => new Projectile(), 32);
  readonly waves = new Pool(() => new GroundWave(), 16);
  readonly meteors = new Pool(() => new Meteor(), 12);
  readonly pickups = new Pool(() => new Pickup(), 48);

  clear(): void { this.projectiles.clear(); this.waves.clear(); this.meteors.clear(); this.pickups.clear(); }

  update(w: World): void {
    const p = w.player;
    // ---- Projectiles ----
    const ps = this.projectiles;
    for (let i = ps.count - 1; i >= 0; i--) {
      const pr = ps.items[i];
      pr.px = pr.x; pr.py = pr.y;
      pr.x += pr.vx / 60; pr.y += pr.vy / 60;
      if (--pr.life <= 0 || pr.x < -50 || pr.x > WORLD.arenaW + 50) { ps.releaseAt(i); continue; }
      if (pr.team === 'enemy') {
        // Weapon deflect (staff helicopter): bounces darts back while the move is active.
        const m = p.state === 'move' ? p.move : null;
        if (m && m.deflect && p.moveFrame >= p.effStartup && p.moveFrame < p.effStartup + m.active && overlaps(pr.x, pr.y, PROJECTILE.radius + 70 * p.scale, p)) {
          pr.team = 'player';
          pr.vx = -pr.vx * PROJECTILE.reflectSpeedMult;
          pr.vy = 0;
          pr.life = PROJECTILE.life;
          w.events.emit('deflect', { x: pr.x, y: pr.y });
          w.events.emit('projectile', { x: pr.x, y: pr.y, kind: 'reflect' });
          continue;
        }
        if (p.parryWindow > 0 && overlaps(pr.x, pr.y, PROJECTILE.radius + 60, p)) {
          // Perfect parry reflects the dart back at double speed.
          pr.team = 'player';
          pr.vx = -pr.vx * PROJECTILE.reflectSpeedMult;
          pr.vy = 0;
          pr.life = PROJECTILE.life;
          parry(w, null, true);
          w.events.emit('projectile', { x: pr.x, y: pr.y, kind: 'reflect' });
          continue;
        }
        if (p.invuln <= 0 && overlaps(pr.x, pr.y, PROJECTILE.radius, p)) {
          hurtPlayer(w, pr.damage, Math.sign(pr.vx) || 1, 260, -120, null);
          ps.releaseAt(i);
        }
      } else {
        for (const e of w.enemies) {
          if (!e.canBeHit) continue;
          if (overlaps(pr.x, pr.y, PROJECTILE.radius + 6, e)) {
            sideHit(w, e, PROJECTILE.reflectDamage, Math.sign(pr.vx) || 1, -200, 'reflect');
            ps.releaseAt(i);
            break;
          }
        }
      }
    }
    // ---- Ground shockwaves (boss) ----
    const gw = this.waves;
    for (let i = gw.count - 1; i >= 0; i--) {
      const g = gw.items[i];
      g.px = g.x;
      g.x += (g.dir * g.speed) / 60;
      if (++g.life >= g.max || g.x < 0 || g.x > WORLD.arenaW) { gw.releaseAt(i); continue; }
      if (!g.hit && p.grounded && Math.abs(p.x - g.x) < 36) {
        if (p.parryWindow > 0) { g.hit = true; parry(w, null, true); }
        else if (p.invuln <= 0) { g.hit = true; hurtPlayer(w, g.damage, g.dir, 300, -500, null); }
      }
    }
    // ---- Meteors ----
    const ms = this.meteors;
    for (let i = ms.count - 1; i >= 0; i--) {
      const m = ms.items[i];
      m.t++;
      if (m.t === m.warn) {
        w.events.emit('meteor', { x: m.x, y: WORLD.groundY });
        if (Math.abs(p.x - m.x) < BOSS.meteorRadius + 20 && p.height < 120) {
          if (p.parryWindow > 0) parry(w, null, true);
          else hurtPlayer(w, BOSS.meteorDamage, Math.sign(p.x - m.x) || 1, 380, -600, null);
        }
        for (const e of w.enemies) {
          if (!isBoss(e) && e.canBeHit && Math.abs(e.x - m.x) < BOSS.meteorRadius + 20) sideHit(w, e, 10, Math.sign(e.x - m.x) || 1, -600, 'shock');
        }
      }
      if (m.t > m.warn + 20) ms.releaseAt(i);
    }
    // ---- Pickups ----
    const pk = this.pickups;
    for (let i = pk.count - 1; i >= 0; i--) {
      const u = pk.items[i];
      u.px = u.x; u.py = u.y;
      u.life++;
      const dx = p.cx - u.x, dy = p.cy - u.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (u.life > 25 && d < PICKUPS.magnetRange && p.alive) {
        const pull = 1 - d / PICKUPS.magnetRange;
        u.vx += (dx / d) * 2200 * pull / 60;
        u.vy += (dy / d) * 2200 * pull / 60;
        u.grounded = false;
      } else if (!u.grounded) {
        u.vy += PHYS.gravity * 0.6 / 60;
      }
      u.vx *= 0.94;
      u.x += u.vx / 60; u.y += u.vy / 60;
      if (u.y > WORLD.groundY - 12) { u.y = WORLD.groundY - 12; u.vy = -u.vy * 0.3; if (Math.abs(u.vy) < 40) { u.vy = 0; u.grounded = true; } }
      if (d < 46 && u.life > 15 && p.alive) {
        if (u.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + PICKUPS.healthAmount);
        else w.special.add(w, SPECIAL.orb);
        w.events.emit('pickup', { kind: u.kind, x: u.x, y: u.y });
        pk.releaseAt(i);
        continue;
      }
      if (u.life > PICKUPS.lifeFrames) pk.releaseAt(i);
    }
  }

  spawnPickup(kind: 'health' | 'orb', x: number, y: number, vx: number): void {
    const u = this.pickups.acquire();
    u.kind = kind; u.x = u.px = x; u.y = u.py = y; u.vx = vx; u.vy = -500; u.life = 0; u.grounded = false;
  }
}
