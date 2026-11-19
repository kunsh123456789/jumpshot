import type { World } from './world';
import type { Fighter } from './fighter';
import type { MoveDef } from '../data/moves';
import { COMBO, JUICE, PHYS, PLAYER, SUPER } from '../data/tuning';
import { settings } from '../core/settings';
import { simRng } from '../core/rng';
import type { EnemyAttack } from '../data/enemies';

function hitstopFrames(base: number): number {
  return Math.max(0, Math.min(JUICE.hitstopMaxFrames, Math.round(base * settings.hitstop)));
}

/** Circle overlap test between a hitbox and the fighter's hurtbox. */
export function overlaps(hx: number, hy: number, hr: number, f: Fighter): boolean {
  const dx = f.cx - hx, dy = f.cy - hy;
  const r = hr + f.hurtR;
  if (dx * dx + dy * dy <= r * r) return true;
  // lower body circle for standing fighters
  if (f.state !== 'knockdown' && f.grounded) {
    const ly = f.y - 24 * f.scale;
    const dy2 = ly - hy;
    const r2 = hr + 30 * f.scale;
    return dx * dx + dy2 * dy2 <= r2 * r2;
  }
  return false;
}

/**
 * Player move hits an enemy. Handles blocks, armor/poise, damage scaling,
 * crits, launches, spikes, juggles, bursts, KOs, and all combo bookkeeping.
 */
export function playerHit(w: World, m: MoveDef, v: Fighter, multi: boolean): void {
  const p = w.player;
  const s = w.stats;
  const combo = w.combo;
  const dirX = v.x === p.x ? p.facing : Math.sign(v.x - p.x) || p.facing;
  const finisher = m.tags.includes('finisher');
  const heavy = m.tags.includes('heavy');

  // ---- Shield block ----
  if (v.def?.blocksFront && v.guardBroken <= 0 && !finisher) {
    const fromFront = Math.sign(p.x - v.x) === v.facing || p.x === v.x;
    const breaks = m.tags.includes('guardbreak') || !fromFront || v.inHitState;
    if (!breaks) {
      v.blockFlash = 8;
      v.vx = dirX * 160;
      p.hitstop = hitstopFrames(3);
      v.hitstop = hitstopFrames(3);
      p.vx = -dirX * 120;
      w.events.emit('block', { x: v.x - dirX * 20 * v.scale, y: v.cy, victim: v });
      return;
    }
    v.guardBroken = 360;
    w.events.emit('guardBreak', { x: v.x, y: v.cy, enemy: v });
  }

  // ---- Damage ----
  let crit = false;
  if (p.critTimer > 0) { crit = true; p.critTimer = 0; }
  else if (s.critChance > 0 && simRng.chance(s.critChance)) crit = true;
  let dmg = m.damage * combo.scale() * combo.repeatMult(m.family);
  dmg *= heavy ? s.heavyDamage : m.tags.includes('light') ? s.lightDamage : 1;
  if (crit) dmg *= PLAYER.critMult;
  dmg = Math.max(1, dmg);

  // ---- Poise / armor ----
  if (v.poise > 0 && !v.inHitState) {
    v.poise -= m.damage * m.poise * (crit ? 1.5 : 1);
    v.poiseTimer = 0;
    if (v.poise > 0 && !finisher) {
      v.hp -= dmg * 0.7;
      v.flash = JUICE.flashFrames;
      p.hitstop = hitstopFrames(Math.min(4, m.hitstop));
      v.hitstop = p.hitstop;
      v.hitDirX = dirX; v.hitDirY = 0;
      combo.registerHit(m.family, dmg * 0.7, { air: false, multi, bounce: false, finisher: false, launcher: false, bowl: false, ko: false });
      emitHit(w, p, v, m, dmg * 0.7, crit, 'armor', dirX, 0, 0.5);
      if (v.hp <= 0) ko(w, v, dirX);
      return;
    }
    if (v.poise <= 0) {
      v.poise = 0;
      w.events.emit('poiseBreak', { x: v.x, y: v.cy, enemy: v });
    }
  }

  v.hp -= dmg;
  v.flash = JUICE.flashFrames;
  v.lastHitBy = p.id;
  v.comboHits++;
  v.invuln = 0;
  if (v.hasToken) w.ai.releaseToken(v);
  if (v.state === 'windup' || v.state === 'attack') { v.attack = null; v.telegraph = 0; }

  const wasAir = !v.grounded || v.state === 'air';
  const lying = v.state === 'knockdown';
  const weight = v.def ? v.def.weight : 1;
  const launchMult = (v.def ? v.def.launchMult : 1) * s.launchMult;
  const hsScale = Math.max(COMBO.hitstunScaleFloor, 1 - COMBO.hitstunScalePerHit * v.comboHits);
  const jDecay = COMBO.juggleKbDecay * s.juggleDecayMult;
  let kind: 'normal' | 'launch' | 'spike' | 'finisher' = finisher ? 'finisher' : 'normal';
  v.facing = -dirX;
  v.hitDirX = dirX;

  if (m.launch !== 0) {
    if (wasAir) v.juggleHits++;
    const jf = wasAir ? Math.max(COMBO.juggleKbFloor * 2, 1 - jDecay * v.juggleHits) : 1;
    v.vy = m.launch * launchMult * jf;
    v.vx = dirX * m.kbX * 0.3;
    goAir(v);
    v.stall = 2;
    v.hitDirY = -1;
    kind = 'launch';
  } else if (m.spike) {
    v.vy = m.kbY;
    v.vx = dirX * m.kbX * weight;
    goAir(v);
    v.spiked = true;
    v.stall = 0;
    v.impactShock = m.impactShock
      ? { radius: m.impactShock.radius * s.finisherRadiusMult, damage: m.impactShock.damage }
      : s.spikeShockRadius > 0 ? { radius: s.spikeShockRadius, damage: 8 } : null;
    v.hitDirY = 1;
    if (!finisher) kind = 'spike';
  } else if (wasAir || lying || m.kbY < -250 || m.knockdown) {
    if (wasAir || lying) v.juggleHits++;
    const jf = Math.max(COMBO.juggleKbFloor, 1 - jDecay * v.juggleHits);
    let vy = m.kbY;
    if (vy < 0) vy *= wasAir ? jf : 1;
    if (lying && vy > -260) vy = -300 * jf;
    v.vy = vy * (m.knockdown ? 1 : weight);
    v.vx = dirX * m.kbX * weight * (wasAir ? 0.9 : 1);
    goAir(v);
    if (m.knockdown) v.knockdownOnLand = true;
    if (wasAir) {
      const stallDecay = Math.max(0.3, 1 - COMBO.juggleStallDecay * v.juggleHits * s.juggleDecayMult);
      v.stall = Math.round((PHYS.stallFrames + s.airStallBonus) * stallDecay);
      v.gravityScale = 1 + COMBO.juggleGravityPerHit * v.juggleHits * s.juggleDecayMult;
    }
    v.hitDirY = vy < 0 ? -0.5 : 0.5;
  } else {
    v.vx = dirX * m.kbX * weight;
    v.setState('hitstun', Math.round(m.hitstun * hsScale));
    v.hitDirY = 0;
  }
  v.spinVel = (wasAir ? 0.12 : 0.2) * dirX * (0.5 + m.weight);

  // Soft ceiling: upward knockback fades with height so juggles stay on screen.
  if (v.vy < 0) {
    const h = v.height - COMBO.juggleCeiling;
    if (h > 0) v.vy *= Math.max(0.05, 1 - h / COMBO.juggleCeilingFade);
  }

  // Hold the victim in place during a flurry.
  if (m.multiHit) {
    v.vx = dirX * 30; if (!v.grounded) { v.vy = -60; v.stall = 6; }
  }

  // Hit-stop for both.
  const hs = hitstopFrames(m.hitstop + (crit ? 2 : 0));
  p.hitstop = hs; v.hitstop = hs;

  // Player follow-through on air hits: hover with the target.
  if (!p.grounded) {
    if (p.stallCount < PLAYER.maxAirStalls) {
      p.vy = m.selfVY !== 0 ? m.selfVY : -80;
      const ph = p.height - COMBO.juggleCeiling;
      if (ph > 0 && p.vy < 0) p.vy *= Math.max(0, 1 - ph / COMBO.juggleCeilingFade);
      p.stall = PLAYER.maxAirStalls > 0 ? PHYS.stallFrames + s.airStallBonus + 1 : 0;
      p.stallCount++;
    }
  }
  if (m.follow) p.followTarget = v;

  // ---- Grounded burst escape ----
  if (v.alive && v.hp > 0 && !wasAir && v.grounded && v.def && v.comboHits > v.def.burstThreshold && !finisher && simRng.chance(COMBO.burstChance)) {
    burst(w, v);
  }

  const air = wasAir || !p.grounded;
  combo.registerHit(m.family, dmg, {
    air, multi, bounce: false, finisher, launcher: m.launch !== 0, bowl: false, ko: v.hp <= 0,
  });
  emitHit(w, p, v, m, dmg, crit, kind, dirX, v.hitDirY, m.weight);

  // Chain lightning on heavy hits.
  if (heavy && s.chainLightning > 0) chainLightning(w, v, s.chainLightning, dmg * 0.4);

  if (v.hp <= 0) ko(w, v, dirX);
}

function goAir(v: Fighter): void {
  v.grounded = false;
  if (v.state !== 'ko') v.setState('air');
  v.y = Math.min(v.y, v.y - 1);
}

function emitHit(w: World, p: Fighter, v: Fighter, m: MoveDef | null, dmg: number, crit: boolean,
  kind: 'normal' | 'launch' | 'spike' | 'finisher' | 'armor', dirX: number, dirY: number, weight: number): void {
  const hb = m?.hitbox;
  const hx = hb && !m!.aoe ? p.x + p.facing * hb.x * p.scale : v.x - dirX * 12;
  const hy = hb && !m!.aoe ? p.y - hb.y * p.scale : v.cy;
  w.events.emit('hit', {
    attacker: p, victim: v,
    x: (hx + v.cx) / 2, y: (hy + v.cy) / 2,
    dirX, dirY, weight: weight * (crit ? 1.25 : 1), damage: dmg, crit, move: m,
    combo: w.combo.hits, kind,
    shake: m ? m.shake : 4, hitstop: v.hitstop, zoom: m ? m.zoom : 0,
  });
}

function burst(w: World, v: Fighter): void {
  const p = w.player;
  v.setState('burst', 22);
  v.invuln = 26;
  v.vx = 0; v.vy = 0;
  v.comboHits = 0;
  const dir = Math.sign(p.x - v.x) || 1;
  if (Math.abs(p.x - v.x) < 260 && p.grounded) {
    p.vx = dir * 620;
    p.move = null;
    p.setState('hurt', 14);
  }
  w.events.emit('burst', { x: v.x, y: v.cy, enemy: v });
}

const chainVisited = new Int32Array(8);
export function chainLightning(w: World, from: Fighter, arcs: number, dmg: number): void {
  let nv = 0;
  chainVisited[nv++] = from.id;
  let src = from;
  for (let n = 0; n < arcs && nv < chainVisited.length; n++) {
    let best: Fighter | null = null, bd = 300 * 300;
    for (const e of w.enemies) {
      if (!e.canBeHit) continue;
      let seen = false;
      for (let i = 0; i < nv; i++) if (chainVisited[i] === e.id) { seen = true; break; }
      if (seen) continue;
      const dx = e.x - src.x, dy = e.cy - src.cy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    chainVisited[nv++] = best.id;
    w.events.emit('chain', { x1: src.x, y1: src.cy, x2: best.x, y2: best.cy });
    sideHit(w, best, dmg, Math.sign(best.x - src.x) || 1, -320, 'shock');
    src = best;
  }
}

/** Generic non-move hit (shockwaves, bowling, lightning, reflected darts). */
export function sideHit(w: World, v: Fighter, dmg: number, dirX: number, vy: number, kind: 'bowl' | 'shock' | 'reflect', kbX = 260): void {
  if (!v.canBeHit) return;
  v.hp -= dmg;
  v.flash = JUICE.flashFrames;
  v.comboHits++;
  if (v.hasToken) w.ai.releaseToken(v);
  v.attack = null; v.telegraph = 0;
  const weight = v.def ? v.def.weight : 1;
  if (v.poise > 0 && kind !== 'reflect') {
    v.poise -= dmg;
    if (v.poise > 0) {
      w.combo.registerHit(kind, dmg, { air: false, multi: true, bounce: false, finisher: false, launcher: false, bowl: kind === 'bowl', ko: false });
      emitSide(w, v, dmg, dirX, kind, 0.4);
      if (v.hp <= 0) ko(w, v, dirX);
      return;
    }
  }
  if (kind === 'reflect') {
    v.vx = dirX * 200;
    v.setState('stunned', 70);
  } else {
    v.vx = dirX * kbX * weight;
    v.vy = vy * weight;
    if (!v.grounded) v.juggleHits++;
    goAir(v);
    v.spinVel = 0.15 * dirX;
  }
  v.facing = -dirX;
  v.hitstop = hitstopFrames(4);
  w.combo.registerHit(kind, dmg, { air: !v.grounded, multi: true, bounce: false, finisher: false, launcher: false, bowl: kind === 'bowl', ko: v.hp <= 0 });
  emitSide(w, v, dmg, dirX, kind, kind === 'bowl' ? 0.6 : 0.5);
  if (v.hp <= 0) ko(w, v, dirX);
}

function emitSide(w: World, v: Fighter, dmg: number, dirX: number, kind: 'bowl' | 'shock' | 'reflect', weight: number): void {
  w.events.emit('hit', {
    attacker: w.player, victim: v, x: v.cx - dirX * 18, y: v.cy, dirX, dirY: -0.4, weight, damage: dmg, crit: false,
    move: null, combo: w.combo.hits, kind, shake: 6, hitstop: v.hitstop, zoom: 0,
  });
}

/** Shockwave (finisher impact, crater upgrade, KO blast): hits everything in radius. */
export function shockwave(w: World, x: number, y: number, radius: number, damage: number, exclude: Fighter | null, color: string): void {
  w.events.emit('shockwave', { x, y, radius, color, power: Math.min(1.5, radius / 250) });
  for (const e of w.enemies) {
    if (e === exclude || !e.canBeHit) continue;
    const dx = e.x - x;
    if (Math.abs(dx) > radius || Math.abs(e.y - y) > radius * 0.7) continue;
    const dir = Math.sign(dx) || 1;
    sideHit(w, e, damage * (1 - Math.abs(dx) / radius * 0.5), dir, -620, 'shock', 380);
    e.knockdownOnLand = true;
  }
}

/** KO: dramatic launch, then dissolve on landing. */
export function ko(w: World, v: Fighter, dirX: number): void {
  if (!v.alive) return;
  v.alive = false;
  v.hp = 0;
  if (v.hasToken) w.ai.releaseToken(v);
  v.setState('ko');
  v.grounded = false;
  v.vy = v.kind === 'boss' ? -900 : -1050;
  v.vx = dirX * (v.kind === 'boss' ? 300 : 760);
  v.spinVel = 0.35 * dirX;
  v.stall = 0;
  v.gravityScale = 1;
  v.koLaunched = true;
  v.bowlCount = 0;
  w.combo.totalKOs++;
  w.combo.addStyle(5);
  w.combo.score += (v.def?.score ?? 100);
  let last = true;
  for (const e of w.enemies) if (e.alive) { last = false; break; }
  if (last && w.waves.remainingToSpawn() > 0) last = false;
  w.events.emit('ko', { x: v.x, y: v.cy, victim: v, last });
  if (w.stats.koBlast > 0) shockwave(w, v.x, v.y, w.stats.koBlast, 10, v, '#ffb040');
}

/** Enemy attack connects check against the player. Returns true if it hit/parried. */
export function enemyStrike(w: World, e: Fighter, atk: EnemyAttack): boolean {
  const p = w.player;
  if (p.state === 'ko' || !p.alive) return false;
  const s = e.scale;
  const hx = e.x + e.facing * atk.hitbox.x * s;
  const hy = e.y - atk.hitbox.y * s;
  const r = atk.hitbox.r * s;
  // Perfect parry: generous range while the window is open.
  if (p.parryWindow > 0) {
    if (overlaps(hx, hy, r + PLAYER.parryRangeBonus, p)) {
      parry(w, e, false);
      return true;
    }
  }
  if (p.invuln > 0) return false;
  if (!overlaps(hx, hy, r, p)) return false;
  hurtPlayer(w, atk.damage, e.facing, atk.kbX, atk.kbY, e);
  return true;
}

export function parry(w: World, e: Fighter | null, projectile: boolean): void {
  const p = w.player;
  const s = w.stats;
  w.combo.onParry();
  p.critTimer = PLAYER.parryCritFrames + s.critWindowBonus;
  p.telegraph = -1;
  p.invuln = Math.max(p.invuln, 16);
  p.parryWindow = 0;
  if (s.parryHeal > 0) p.hp = Math.min(p.maxHp, p.hp + s.parryHeal);
  if (p.state === 'dodge') { p.setState(p.grounded ? 'idle' : 'fall'); p.vx = 0; }
  if (e) {
    if (e.hasToken) w.ai.releaseToken(e);
    e.attack = null; e.telegraph = 0;
    e.setState('stunned', e.kind === 'boss' ? 60 : 80);
    e.vx = e.facing * -160;
    e.flash = 4;
    // Parrying armored enemies breaks a chunk of poise.
    if (e.poise > 0) e.poise = Math.max(0, e.poise - e.maxPoise * 0.6);
    p.facing = Math.sign(e.x - p.x) || p.facing;
  }
  w.combo.superMeter = Math.min(SUPER.max, w.combo.superMeter);
  w.events.emit('parry', { x: e ? (e.x + p.x) / 2 : p.x + p.facing * 30, y: p.cy, projectile });
}

export function hurtPlayer(w: World, dmg: number, dirX: number, kbX: number, kbY: number, _src: Fighter | null): void {
  const p = w.player;
  if (p.invuln > 0 || !p.alive) return;
  p.hp -= dmg;
  p.move = null;
  p.followTarget = null;
  p.invuln = PLAYER.hurtInvulnFrames;
  p.flash = 4;
  p.vx = dirX * Math.max(kbX, PLAYER.hurtKnockback) * 0.8;
  if (!p.grounded || kbY < -300) { p.vy = Math.min(p.vy, kbY * 0.6); p.grounded = false; }
  p.setState('hurt', PLAYER.hurtStunFrames);
  p.hitstop = hitstopFrames(5);
  p.critTimer = 0;
  p.telegraph = 0;
  w.combo.onPlayerHurt();
  w.events.emit('playerHurt', { damage: dmg, x: p.x, y: p.cy, dirX });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.setState('ko');
    p.grounded = false;
    p.vy = -800; p.vx = dirX * 500;
    p.spinVel = 0.3 * dirX;
    w.gameOver = true;
  }
}
