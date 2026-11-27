import type { World } from './world';
import type { Fighter } from './fighter';
import { WAVES_T, WORLD } from '../data/tuning';
import { isBoss, BOSS, type EnemyAttack } from '../data/enemies';
import { simRng } from '../core/rng';
import { enemyStrike } from './combat';
import { clamp } from '../core/math';

/**
 * Enemy brains with a token system: only N enemies may attack at once; the
 * rest hold at a distance, shuffle and taunt so threats stay readable.
 */
export class EnemyAI {
  tokens = 1;
  private holders = 0;

  setWave(wave: number): void {
    this.tokens = Math.min(WAVES_T.tokensMax, WAVES_T.tokensBase + Math.floor((wave - 1) / WAVES_T.tokensPerWaves));
  }

  releaseToken(e: Fighter): void {
    if (e.hasToken) { e.hasToken = false; this.holders = Math.max(0, this.holders - 1); }
  }

  reset(): void { this.holders = 0; }

  /** Grant tokens to the most suitable waiting enemies. */
  distribute(w: World): void {
    let count = 0;
    for (const e of w.enemies) if (e.hasToken) count++;
    this.holders = count;
    let guard = 0;
    const tokens = this.tokens + (w.rhythm ? w.rhythm.tokenBonus() : 0);
    while (this.holders < tokens && guard++ < 4) {
      let best: Fighter | null = null, bs = Infinity;
      const p = w.player;
      for (const e of w.enemies) {
        if (!e.alive || e.hasToken || isBoss(e) || e.kind === 'dummy') continue;
        if (e.ai.cooldown > 0 || !(e.state === 'idle' || e.state === 'walk' || e.state === 'taunt')) continue;
        if (e.ai.spawnWalk > 0) continue;
        const score = Math.abs(e.x - p.x) - e.ai.tokenTime * 2 + simRng.range(0, 80);
        if (score < bs) { bs = score; best = e; }
      }
      if (!best) break;
      best.hasToken = true;
      best.ai.tokenTime = 0;
      this.holders++;
    }
  }

  update(w: World, e: Fighter): void {
    const p = w.player;
    if (e.ai.cooldown > 0) e.ai.cooldown--;
    if (!e.hasToken) e.ai.tokenTime++;
    if (e.guardBroken > 0) e.guardBroken--;
    if (e.blockFlash > 0) e.blockFlash--;
    if (e.invuln > 0) e.invuln--;
    // Poise regenerates after a quiet period.
    if (e.maxPoise > 0 && e.poise < e.maxPoise && !e.inHitState && e.ai.stagger === 0) {
      if (++e.poiseTimer > (e.def?.poiseRegenFrames ?? 120)) e.poise = e.maxPoise;
    }

    if (e.alive && isBoss(e)) this.bossExtras(w, e);

    switch (e.state) {
      case 'idle': case 'walk': case 'taunt': this.think(w, e); break;
      case 'windup': this.windup(w, e); break;
      case 'attack': this.active(w, e); break;
      case 'recover':
        if (--e.timer <= 0) { e.setState('idle'); this.releaseToken(e); }
        e.vx *= 0.8;
        e.x += e.vx / 60;
        break;
      default: break;
    }
    void p;
  }

  private think(w: World, e: Fighter): void {
    const p = w.player;
    const def = e.def!;
    const dx = p.x - e.x;
    const dist = Math.abs(dx);
    if (e.ai.spawnWalk > 0) e.ai.spawnWalk--;
    if (e.state !== 'taunt' || e.stateFrame > 40) e.facing = Math.sign(dx) || e.facing;
    if (e.kind === 'dummy' && !w.dummyAttacks) { e.vx = 0; if (e.state !== 'idle') e.setState('idle'); return; }

    const canAttack = (e.hasToken || isBoss(e) || (e.kind === 'dummy' && w.dummyAttacks)) && e.ai.cooldown <= 0 && p.alive && e.ai.spawnWalk <= 0;
    if (canAttack) {
      const atk = this.pickAttack(e, dist);
      if (dist <= atk.range * e.scale) {
        // Rhythm Mode: wind-ups start on a beat (the enemy squares up and waits for it).
        if (w.rhythm && !w.rhythm.enemyCanStart(w, e)) { e.vx = 0; if (e.state !== 'idle') e.setState('idle'); return; }
        this.startWindup(w, e, atk);
        return;
      }
      if (e.hasToken) e.ai.tokenTime++;
      // A token holder that can't reach in time gives the token back.
      if (e.hasToken && e.ai.tokenTime > 240) { this.releaseToken(e); e.ai.cooldown = 30; }
      this.walkTo(e, p.x - Math.sign(dx) * atk.range * 0.75 * e.scale, def.walkSpeed * 1.25);
      return;
    }
    // Hold position at a distance, shuffling.
    if (--e.ai.think <= 0) {
      e.ai.think = simRng.int(40, 100);
      e.ai.holdOff = simRng.range(-50, 70);
      if (simRng.chance(0.12) && e.state !== 'taunt' && dist < 600) { e.setState('taunt'); e.vx = 0; return; }
    }
    if (e.state === 'taunt') { if (e.stateFrame > 50) e.setState('idle'); return; }
    const side = dx === 0 ? 1 : -Math.sign(dx);
    const hold = def.holdDist + e.ai.holdOff;
    const tx = clamp(p.x + side * hold, WORLD.wallMargin + 20, WORLD.arenaW - WORLD.wallMargin - 20);
    this.walkTo(e, tx, def.walkSpeed * (e.ai.spawnWalk > 0 ? 1.4 : 0.8));
  }

  private walkTo(e: Fighter, tx: number, speed: number): void {
    const d = tx - e.x;
    if (Math.abs(d) < 14) {
      e.vx = 0;
      if (e.state !== 'idle') e.setState('idle');
      return;
    }
    e.vx = Math.sign(d) * speed;
    e.x += e.vx / 60;
    if (e.state !== 'walk') e.setState('walk');
  }

  private pickAttack(e: Fighter, dist: number): EnemyAttack {
    const atks = e.def!.attacks;
    if (atks.length === 1) return atks[0];
    if (e.kind === 'boss') {
      const ph = e.ai.phase;
      if (dist > 300 && ph >= 2) return atks[2];
      if (dist < 200) return simRng.chance(0.55) ? atks[0] : atks[1];
      return ph >= 3 && simRng.chance(0.5) ? atks[2] : atks[1];
    }
    if (isBoss(e)) {
      // Other bosses: any attack that reaches; the last (signature) attack is held back until phase 2
      // unless nothing else reaches, and favoured in phase 3.
      const reach = (a: EnemyAttack) => dist <= a.range * e.scale;
      const last = atks[atks.length - 1];
      if (e.ai.phase >= 3 && reach(last) && simRng.chance(0.5)) return last;
      const pool = atks.filter((a, i) => reach(a) && (i < atks.length - 1 || e.ai.phase >= 2 || atks.length === 2));
      if (pool.length) return pool[simRng.int(0, pool.length - 1)];
      let best = atks[0];
      for (const a of atks) if (a.range > best.range) best = a;
      return best;
    }
    // elite: pattern rotation with distance preference
    e.ai.pattern = (e.ai.pattern + 1) % 3;
    if (dist > 220) return atks[1];
    return atks[e.ai.pattern === 1 ? 2 : 0];
  }

  private startWindup(w: World, e: Fighter, atk: EnemyAttack): void {
    e.attack = atk;
    e.attackHit = false;
    let wind = atk.windup;
    if (isBoss(e) && e.ai.phase >= 3) wind = Math.round(wind * BOSS.p3Speed);
    if (w.wave >= 8 && !isBoss(e)) wind = Math.max(14, wind - Math.min(6, w.wave - 7));
    if (w.rhythm) wind = w.rhythm.enemyWindup(w, e, wind);
    e.setState('windup', wind);
    e.telegraph = wind;
    e.vx = 0;
    e.facing = Math.sign(w.player.x - e.x) || e.facing;
    w.events.emit('telegraph', { enemy: e });
  }

  private windup(_w: World, e: Fighter): void {
    const atk = e.attack;
    if (!atk) { e.setState('idle'); return; }
    e.x += (e.facing * atk.stepIn) / 60;
    if (_w.rhythm) _w.rhythm.enemyWindupTick(_w, e);
    else if (e.telegraph > 0) e.telegraph--;
    if (--e.timer <= 0) {
      e.setState('attack', atk.active);
      e.vx = e.facing * atk.lunge;
      if (atk.projectile) _w.spawnProjectile(e, atk);
      if (atk.shockwave) {
        _w.spawnGroundWave(e.x + e.facing * 60 * e.scale, e.facing, atk.shockwave.speed, atk.shockwave.damage, atk.shockwave.life);
        _w.spawnGroundWave(e.x - e.facing * 60 * e.scale, -e.facing, atk.shockwave.speed, atk.shockwave.damage, atk.shockwave.life);
        _w.events.emit('shockwave', { x: e.x + e.facing * 80 * e.scale, y: WORLD.groundY, radius: 160, color: '#ff4040', power: 0.8 });
      }
    }
  }

  private active(w: World, e: Fighter): void {
    const atk = e.attack;
    if (!atk) { e.setState('idle'); return; }
    e.x += e.vx / 60;
    const atWall = e.x <= WORLD.wallMargin || e.x >= WORLD.arenaW - WORLD.wallMargin;
    e.x = clamp(e.x, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    // A charge that runs into the wall: crash, stunned and open (the Juggernaut's punish window).
    if (atk.charge && atWall && e.stateFrame > 3) {
      e.attack = null; e.vx = 0; e.telegraph = 0;
      e.poise = 0; e.ai.stagger = BOSS.staggerFrames;
      e.setState('stunned', 110);
      this.releaseToken(e);
      w.events.emit('wallImpact', { x: e.x, y: e.cy, power: 1.5, dir: -e.facing });
      w.events.emit('text', { text: 'CRASH!', x: e.x, y: e.y - 200 * e.scale, color: '#ffe14a', size: 26 });
      return;
    }
    if (!atk.projectile && !e.attackHit && w.c3.tryClash(w, e)) return;
    if (!atk.projectile && !e.attackHit) {
      if (enemyStrike(w, e, atk)) e.attackHit = true;
    }
    if (e.state !== 'attack') return; // parried
    if (--e.timer <= 0) {
      e.setState('recover', atk.recovery);
      e.ai.cooldown = (e.def?.cooldown ?? 70) + simRng.int(0, 40);
      if (w.rhythm) e.ai.cooldown = Math.round(e.ai.cooldown * w.rhythm.cooldownMult());
    }
  }

  private bossExtras(w: World, e: Fighter): void {
    const spec = e.def!.boss!;
    const frac = e.hp / e.maxHp;
    const phase = frac <= BOSS.phase3 ? 3 : frac <= BOSS.phase2 ? 2 : 1;
    if (phase !== e.ai.phase) {
      e.ai.phase = phase;
      w.events.emit('bossPhase', { phase });
      if (e.ai.stagger === 0) e.poise = e.maxPoise;
    }
    if (phase >= 2) {
      if (e.kind === 'boss' && w.c3.on && ++e.ai.ballTimer >= 480 / (phase >= 3 ? 1.3 : 1)) { e.ai.ballTimer = 0; w.c3.spawnBall(w, e); }
      if (spec.meteors > 0 && ++e.ai.meteorTimer >= spec.meteors / (phase >= 3 ? 1.4 : 1)) {
        e.ai.meteorTimer = 0;
        w.spawnMeteor(w.player.x + simRng.range(-60, 60));
        if (phase >= 3) w.spawnMeteor(w.player.x + simRng.sign() * simRng.range(160, 280));
      }
      if (spec.summon && ++e.ai.summonTimer >= spec.summon.every) {
        e.ai.summonTimer = 0;
        let alive = 0;
        for (const o of w.enemies) if (o.alive && o !== e) alive++;
        if (alive < 3) { w.waves.summon(w, spec.summon.kinds[0]); w.waves.summon(w, phase >= 3 ? spec.summon.kinds[1] : spec.summon.kinds[0]); }
      }
    }
    // Blink: teleport to the far side when the player gets close (never mid-attack or while comboed).
    if (spec.blink) {
      if (e.ai.blinkCd > 0) e.ai.blinkCd--;
      else if ((e.state === 'idle' || e.state === 'walk' || e.state === 'recover') && Math.abs(w.player.x - e.x) < spec.blink.range * e.scale && e.ai.stagger === 0) {
        const fromX = e.x;
        const side = w.player.x < WORLD.arenaW / 2 ? 1 : -1;
        e.x = e.px = clamp(w.player.x + side * simRng.range(460, 600), WORLD.wallMargin + 40, WORLD.arenaW - WORLD.wallMargin - 40);
        e.ai.blinkCd = spec.blink.cooldown;
        e.ai.cooldown = Math.min(e.ai.cooldown, 20);
        e.facing = Math.sign(w.player.x - e.x) || e.facing;
        e.setState('idle');
        w.events.emit('bossBlink', { x1: fromX, x2: e.x, y: e.cy });
      }
    }
    // Poise break -> long stagger window: the boss's "combo stage".
    if (e.ai.stagger > 0) {
      if (--e.ai.stagger === 0) e.poise = e.maxPoise;
    } else if (e.poise <= 0) {
      e.ai.stagger = BOSS.staggerFrames;
      e.attack = null;
      if (!e.inHitState) e.setState('stunned', 70);
    }
  }
}
