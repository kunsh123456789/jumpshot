import type { World } from './world';
import type { Fighter } from './fighter';
import { WAVES_T, WORLD } from '../data/tuning';
import { BOSS, type EnemyAttack } from '../data/enemies';
import { simRng } from '../core/rng';
import { enemyStrike } from './combat';
import { clamp } from '../core/math';
import { RHYTHM } from '../data/rhythm';

const FRAME_MS = 1000 / 60;

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
    while (this.holders < this.tokens && guard++ < 4) {
      let best: Fighter | null = null, bs = Infinity;
      const p = w.player;
      for (const e of w.enemies) {
        if (!e.alive || e.hasToken || e.kind === 'boss' || e.kind === 'dummy') continue;
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

    if (e.kind === 'boss' && e.alive) this.bossExtras(w, e);

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

    const canAttack = (e.hasToken || e.kind === 'boss' || (e.kind === 'dummy' && w.dummyAttacks)) && e.ai.cooldown <= 0 && p.alive && e.ai.spawnWalk <= 0;
    if (canAttack) {
      const atk = this.pickAttack(e, dist);
      if (dist <= atk.range * e.scale) {
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
    const hold = (def.holdDist + e.ai.holdOff) * (e.kind === 'boss' ? 1 : 1);
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
    // elite: pattern rotation with distance preference
    e.ai.pattern = (e.ai.pattern + 1) % 3;
    if (dist > 220) return atks[1];
    return atks[e.ai.pattern === 1 ? 2 : 0];
  }

  private startWindup(w: World, e: Fighter, atk: EnemyAttack): void {
    e.attack = atk;
    e.attackHit = false;
    let wind = atk.windup;
    if (e.kind === 'boss' && e.ai.phase >= 3) wind = Math.round(wind * BOSS.p3Speed);
    if (w.wave >= 8 && e.kind !== 'boss') wind = Math.max(14, wind - Math.min(6, w.wave - 7));
    // Rhythm mode: stretch the wind-up so the strike's first active frame lands on a beat.
    e.ai.beatTarget = 0;
    const r = w.rhythm;
    if (r.active) {
      const minF = Math.round(wind * RHYTHM.enemyWindMinFrac);
      const target = r.beatAfter(r.now + minF * FRAME_MS);
      const frames = Math.round((target - r.now) / FRAME_MS);
      if (isFinite(target) && frames >= minF && frames <= wind + RHYTHM.enemyWindMaxExtra) {
        wind = Math.max(1, frames);
        e.ai.beatTarget = target;
      }
    }
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
    if (e.ai.beatTarget > 0 && _w.rhythm.active) {
      // Re-derive the remaining wind-up from the clock (hit-stop freezes would otherwise drift it off the beat).
      const left = Math.round((e.ai.beatTarget - _w.rhythm.now) / FRAME_MS);
      e.timer = Math.max(1, left + 1);
      e.telegraph = e.timer;
    } else if (e.telegraph > 0) e.telegraph--;
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
    e.x = clamp(e.x, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    if (!atk.projectile && !e.attackHit) {
      if (enemyStrike(w, e, atk)) e.attackHit = true;
    }
    if (e.state !== 'attack') return; // parried
    if (--e.timer <= 0) {
      e.setState('recover', atk.recovery);
      e.ai.cooldown = (e.def?.cooldown ?? 70) + simRng.int(0, 40);
    }
  }

  private bossExtras(w: World, e: Fighter): void {
    const frac = e.hp / e.maxHp;
    const phase = frac <= BOSS.phase3 ? 3 : frac <= BOSS.phase2 ? 2 : 1;
    if (phase !== e.ai.phase) {
      e.ai.phase = phase;
      w.events.emit('bossPhase', { phase });
      if (e.ai.stagger === 0) e.poise = e.maxPoise;
    }
    if (phase >= 2) {
      if (++e.ai.meteorTimer >= BOSS.meteorInterval / (phase >= 3 ? 1.4 : 1)) {
        e.ai.meteorTimer = 0;
        w.spawnMeteor(w.player.x + simRng.range(-60, 60));
        if (phase >= 3) w.spawnMeteor(w.player.x + simRng.sign() * simRng.range(160, 280));
      }
      if (++e.ai.summonTimer >= BOSS.summonEvery) {
        e.ai.summonTimer = 0;
        let alive = 0;
        for (const o of w.enemies) if (o.alive && o !== e) alive++;
        if (alive < 3) { w.waves.summon(w, 'grunt'); w.waves.summon(w, phase >= 3 ? 'rusher' : 'grunt'); }
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
