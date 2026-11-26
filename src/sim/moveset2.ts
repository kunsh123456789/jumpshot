import type { World } from './world';
import type { Fighter } from './fighter';
import type { MoveDef } from '../data/moves';
import { MOVES } from '../data/moves';
import { WORLD } from '../data/tuning';
import { V2 } from '../data/weapons/tuning';
import { isBoss } from '../data/enemies';
import { playerHit, sideHit, shockwave } from './combat';

/**
 * The reworked movesets' signature mechanics (Settings -> Movesets: New). Everything
 * here only runs for moves that carry `MoveDef.x2` or a weapon with a `passive`, so
 * the original movesets (and the Classic fingerprint) are untouched. Pooled state,
 * no per-frame allocation, deterministic (sim state only).
 *
 *  - floor shockwaves (hammer): travel along the floor both ways, bounce every grounded
 *    enemy once; jumping over them is the counter
 *  - ice patches and walls (ice): enemies slide on ice (low friction), sliding bodies
 *    shatter into each other; walls block and freeze; the hero skates faster on ice
 *  - delayed cuts (daggers' shadow dash), bleed detonation (execute), vanish + backstab
 *  - doom marks (scythe): the third mark reaps after a beat; KOs drop souls that heal;
 *    at low HP scythe hits steal life; grave hands hold enemies in place
 *  - ties (hook): two enemies roped together; hitting one drags and hurts the other
 *  - fury (fists): hits fill it; while it burns, punches hit harder and boom louder
 *  - slip (fists dodge): an attack dodged during the slip triggers an automatic counter
 */
interface Wave { on: boolean; x: number; dir: number; left: number; speed: number; dmg: number; launch: number; t: number; hit: Int32Array; n: number }
interface Patch { on: boolean; x: number; r: number; t: number; max: number }
interface Wall { on: boolean; x: number; side: number; t: number; max: number }
interface Pending { on: boolean; v: Fighter | null; m: MoveDef | null; t: number }
interface Soul { on: boolean; x: number; y: number; vx: number; vy: number; t: number }
interface Tie { on: boolean; a: Fighter | null; b: Fighter | null; t: number }

const N_WAVES = 12, N_PATCH = 16, N_WALL = 3, N_PEND = 24, N_SOUL = 24, N_TIE = 4;

export class Moveset2 {
  readonly waves: Wave[] = Array.from({ length: N_WAVES }, () => ({ on: false, x: 0, dir: 1, left: 0, speed: 0, dmg: 0, launch: 0, t: 0, hit: new Int32Array(16), n: 0 }));
  readonly patches: Patch[] = Array.from({ length: N_PATCH }, () => ({ on: false, x: 0, r: 0, t: 0, max: 1 }));
  readonly walls: Wall[] = Array.from({ length: N_WALL }, () => ({ on: false, x: 0, side: 1, t: 0, max: 1 }));
  readonly pending: Pending[] = Array.from({ length: N_PEND }, () => ({ on: false, v: null, m: null, t: 0 }));
  readonly souls: Soul[] = Array.from({ length: N_SOUL }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0 }));
  readonly ties: Tie[] = Array.from({ length: N_TIE }, () => ({ on: false, a: null, b: null, t: 0 }));
  /** Fists fury 0..1 and frames left while it burns. */
  fury = 0; furyT = 0;
  /** Slip dodge: the attacker whose hit was slipped (counter target), if any. */
  slipTarget: Fighter | null = null;
  /** Whip tip crack: where along the current beam the hit landed (0..1). Set by WeaponSim.fireBeam. */
  beamFrac = 0;
  /** Lasso orbit: enemies the swung body already bowled this hold. */
  private orbitHit = new Int32Array(16); private orbitN = 0;
  /** Smoke puffs and slash marks to draw (x, y, t). */
  readonly puffs = new Float32Array(3 * 16); nPuffs = 0;

  reset(): void {
    for (const a of [this.waves, this.patches, this.walls, this.pending, this.souls, this.ties] as { on: boolean }[][]) for (const x of a) x.on = false;
    for (const t of this.ties) { t.a = null; t.b = null; }
    for (const p of this.pending) { p.v = null; p.m = null; }
    this.fury = 0; this.furyT = 0; this.slipTarget = null; this.nPuffs = 0; this.orbitN = 0;
  }

  // ------------------------------------------------------------------ queries
  /** Is this floor x on an ice patch? */
  onIce(x: number): boolean {
    for (const p of this.patches) if (p.on && Math.abs(x - p.x) < p.r) return true;
    return false;
  }

  // ------------------------------------------------------------------ contact
  /**
   * The move's contact frame. Returns true when the move is fully resolved here
   * (no hitbox check afterwards: the smoke bomb).
   */
  onContact(w: World, p: Fighter, m: MoveDef): boolean {
    const X = m.x2!;
    const fx = p.x + p.facing * 60 * p.scale;
    if (X.wave) this.spawnWaves(w, fx, p.facing, X.wave.forward ? 1 : 2, X.wave);
    if (X.ice) {
      if (X.ice.trail) { for (let i = 0; i < 4; i++) this.addPatch(p.x - p.facing * i * 70, X.ice.r * 0.7, X.ice.frames); }
      else this.addPatch(p.grounded ? p.x : fx, X.ice.r, X.ice.frames);
    }
    if (X.iceWall) this.addWall(w, p.x + p.facing * X.iceWall.dist, p.facing, X.iceWall.frames);
    if (X.self && !X.self.free) { p.vx = p.facing * X.self.vx; p.vy = X.self.vy; p.grounded = false; p.stall = 0; }
    if (X.puff && p.target && p.target.alive && Math.abs(p.target.x - p.x) < 200) {
      shockwave(w, p.target.x, p.target.cy, X.puff, 3, p.target, '#ff4040');
      this.fx(w, 'puff', p.target.cx, p.target.cy, X.puff / 120);
    }
    if (X.grave) {
      let n = 0;
      for (const e of w.enemies) {
        if (!e.canBeHit || !e.grounded || Math.abs(e.x - p.x) > X.grave.r) continue;
        if (isBoss(e)) { e.poise = Math.max(0, e.poise - e.maxPoise * 0.3); continue; }
        e.grave = X.grave.frames; e.setState('stunned', X.grave.frames); e.vx = 0; n++;
      }
      this.fx(w, 'grave', p.x, WORLD.groundY, n);
    }
    if (X.tie && p.target) this.tieNear(w, p.target, X.tie);
    if (X.detonate) this.detonate(w, X.detonate);
    if (X.disarm) this.disarm(w, p, X.disarm.range, X.disarm.stun);
    if (X.poof) { this.puff(p.x, p.cy); this.fx(w, 'smoke', p.x, p.cy, 1); }
    if (X.vanish) {
      p.vanish = X.vanish;
      p.invuln = Math.max(p.invuln, X.vanish + 6);
      this.puff(p.x, p.cy);
      this.fx(w, 'smoke', p.x, p.cy, 1);
      p.moveHit = true;
      return true;
    }
    return false;
  }

  /** Before damage (combat.playerHit): damage multiplier and a forced crit (backstab, tip crack, fury). */
  preHit(w: World, m: MoveDef, v: Fighter, dirX: number): { mult: number; crit: boolean } {
    let mult = 1, crit = false;
    const P = w.weapon.passive;
    // backstab: a hit on an enemy facing away, or any move that lands behind (smoke-bomb reappear, blink slash)
    if (P?.backstab && v.grounded && (m.behind || (v.facing === dirX && !v.inHitState))) { crit = true; this.fx(w, 'backstab', v.cx, v.cy, 1); }
    if (m.x2?.tipCrack && this.beamFrac > V2.tipFrac) { mult *= V2.tipMult; this.fx(w, 'crack', v.cx, v.cy, 1); }
    if (P?.fury && this.furyT > 0) mult *= V2.furyDmg;
    return { mult, crit };
  }

  /** After a landed player hit. */
  afterHit(w: World, m: MoveDef, v: Fighter, dmg: number): void {
    const P = w.weapon.passive, p = w.player;
    if (P?.fury) {
      if (this.furyT > 0) v.vx *= V2.furyKb;
      else {
        this.fury = Math.min(1, this.fury + V2.furyPerHit);
        if (this.fury >= 1) { this.fury = 0; this.furyT = V2.furyFrames; this.fx(w, 'fury', p.x, p.cy, 1); }
      }
    }
    if (P?.souls && p.hp < p.maxHp * V2.deathsDoor) { p.hp = Math.min(p.maxHp, p.hp + dmg * V2.lifesteal); }
    if (m.x2?.doom && v.alive && v.doomT === 0) {
      v.doom++;
      if (v.doom >= 3) { v.doom = 0; v.doomT = V2.reapDelay; this.fx(w, 'doom', v.cx, v.cy - 60, 3); }
    }
    if (m.x2?.stun && v.alive && !isBoss(v)) v.setState('stunned', m.x2.stun);
    // a tied partner is dragged toward the victim and takes half the hit
    for (const t of this.ties) {
      if (!t.on) continue;
      const other = t.a === v ? t.b : t.b === v ? t.a : null;
      if (!other || !other.canBeHit) continue;
      const d = Math.sign(v.x - other.x) || 1;
      sideHit(w, other, dmg * V2.tieShare, d, -260, 'shock', 420);
    }
  }

  /** An enemy was KO'd (combat.ko). */
  onKo(w: World, v: Fighter): void {
    v.doom = 0; v.doomT = 0; v.grave = 0;
    if (w.weapon.passive?.souls) {
      const s = this.souls.find((x) => !x.on);
      if (s) { s.on = true; s.x = v.cx; s.y = v.cy - 30; s.vx = (v.x > w.player.x ? 1 : -1) * 160; s.vy = -340; s.t = 0; }
    }
  }

  /** A soul flies from (x, y) to the hero and heals on arrival (scythe KOs, the Reaper Special). */
  spawnSoul(x: number, y: number): void {
    const s = this.souls.find((q) => !q.on);
    if (s) { s.on = true; s.x = x; s.y = y; s.vx = 0; s.vy = -360; s.t = 0; }
  }

  /** Player landed (sim/player.ts). */
  playerLanded(w: World, p: Fighter, m: MoveDef | null): void {
    const L = m?.x2?.landWave;
    if (L) { this.spawnWaves(w, p.x, p.facing, 2, L); w.events.emit('groundImpact', { x: p.x, y: WORLD.groundY, power: 1.2, fighter: p, bounce: false }); }
  }

  /** Daggers shadow dash: queue the cut. */
  queue(v: Fighter, m: MoveDef, frames: number): void {
    const q = this.pending.find((x) => !x.on);
    if (!q) return;
    q.on = true; q.v = v; q.m = m; q.t = frames;
    this.puff(v.cx, v.cy, -1);
  }

  /** Lasso orbit: the held body bowls whoever it touches (called each hold tick). */
  orbitTick(w: World, held: Fighter): void {
    for (const e of w.enemies) {
      if (e === held || !e.canBeHit) continue;
      let dup = false;
      for (let i = 0; i < this.orbitN; i++) if (this.orbitHit[i] === e.id) { dup = true; break; }
      if (dup || Math.hypot(e.cx - held.cx, e.cy - held.cy) > 70) continue;
      if (this.orbitN < 16) this.orbitHit[this.orbitN++] = e.id;
      sideHit(w, e, V2.orbitDmg, Math.sign(e.x - held.x) || 1, -520, 'bowl', 640);
    }
  }
  orbitReset(): void { this.orbitN = 0; }

  // ------------------------------------------------------------------ per step
  update(w: World): void {
    const p = w.player;
    if (this.furyT > 0) this.furyT--;
    if (p.vanish > 0) p.vanish--;
    if (p.phase > 0) p.phase--;
    // floor shockwaves
    for (const wv of this.waves) {
      if (!wv.on) continue;
      wv.x += wv.dir * wv.speed / 60; wv.left -= wv.speed / 60; wv.t++;
      if (wv.left <= 0 || wv.x < 0 || wv.x > WORLD.arenaW) { wv.on = false; continue; }
      for (const e of w.enemies) {
        if (!e.canBeHit || !e.grounded || e.height > 20 || Math.abs(e.x - wv.x) > 40) continue;
        let dup = false;
        for (let i = 0; i < wv.n; i++) if (wv.hit[i] === e.id) { dup = true; break; }
        if (dup) continue;
        if (wv.n < 16) wv.hit[wv.n++] = e.id;
        sideHit(w, e, wv.dmg, wv.dir, wv.launch, 'shock', 160);
      }
    }
    // ice patches / walls
    for (const pa of this.patches) if (pa.on && --pa.t <= 0) pa.on = false;
    for (const wl of this.walls) {
      if (!wl.on) continue;
      if (--wl.t <= 0) { wl.on = false; this.fx(w, 'iceBreak', wl.x, WORLD.groundY - 80, 1); continue; }
      for (const e of w.enemies) {
        if (!e.alive || e.state === 'held' || e.state === 'cine') continue;
        // the wall blocks from the far side: enemies beyond it can't come through
        const rel = (e.x - wl.x) * wl.side;
        if (rel > 0 && rel < 34) { e.x = wl.x + wl.side * 34; if (e.vx * wl.side < 0) e.vx = 0; if (e.frozen <= 0 && !isBoss(e) && e.grounded && wl.max - wl.t < 4) { e.frozen = V2.wallFreeze; e.setState('stunned', V2.wallFreeze); } }
      }
    }
    // ice: sliding bodies shatter into each other
    for (const e of w.enemies) {
      if (!e.canBeHit || !e.grounded || Math.abs(e.vx) < V2.slideShatterSpeed || !this.onIce(e.x)) continue;
      for (const o of w.enemies) {
        if (o === e || !o.canBeHit || Math.abs(o.x - e.x) > 46 || Math.abs(o.cy - e.cy) > 80) continue;
        const d = Math.sign(e.vx) || 1;
        sideHit(w, o, V2.slideShatterDmg, d, -360, 'bowl', Math.abs(e.vx) * 0.8);
        sideHit(w, e, V2.slideShatterDmg * 0.6, -d, -260, 'bowl', 200);
        this.fx(w, 'shatter', (e.cx + o.cx) / 2, (e.cy + o.cy) / 2, 1);
        break;
      }
    }
    // delayed cuts
    for (const q of this.pending) {
      if (!q.on || --q.t > 0) continue;
      q.on = false;
      const v = q.v!, m = q.m!;
      q.v = null; q.m = null;
      if (v.alive && v.state !== 'dead') { p.moveHit = true; playerHit(w, m, v, true); this.fx(w, 'cut', v.cx, v.cy, 1); }
    }
    // doom reaping, grave hands
    for (const e of w.enemies) {
      if (e.grave > 0) {
        e.grave--;
        // the hands keep holding: a held enemy that recovers from a hit is pinned again
        if (e.alive && e.grounded && (e.state === 'idle' || e.state === 'walk' || e.state === 'windup' || e.state === 'attack')) {
          e.attack = null; e.telegraph = 0; e.vx = 0;
          if (e.grave > 0) e.setState('stunned', e.grave);
        }
      }
      if (e.doomT > 0 && --e.doomT === 0 && e.alive) {
        sideHit(w, e, V2.reapDmg, Math.sign(e.x - p.x) || 1, -620, 'shock', 300);
        this.fx(w, 'reap', e.cx, e.cy, 1);
      }
    }
    // souls fly to the hero and heal
    for (const s of this.souls) {
      if (!s.on) continue;
      s.t++;
      const dx = p.cx - s.x, dy = p.cy - s.y, d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, s.t / 30);
      s.vx += ((dx / d) * 900 - s.vx) * 0.08 * k; s.vy += ((dy / d) * 900 - s.vy) * 0.08 * k;
      s.x += s.vx / 60; s.y += s.vy / 60;
      if (d < 40 || s.t > 150) { s.on = false; if (p.alive) { p.hp = Math.min(p.maxHp, p.hp + V2.soulHeal); this.fx(w, 'soul', p.cx, p.cy, 1); } }
    }
    // ties
    for (const t of this.ties) {
      if (!t.on) continue;
      if (--t.t <= 0 || !t.a!.alive || !t.b!.alive) { t.on = false; t.a = null; t.b = null; continue; }
      // the rope keeps them within reach of each other
      const a = t.a!, b = t.b!, d = b.x - a.x;
      if (Math.abs(d) > V2.tieLen) { const pull = (Math.abs(d) - V2.tieLen) * 0.15 * Math.sign(d); if (a.grounded && a.state !== 'held') a.x += pull; if (b.grounded && b.state !== 'held') b.x -= pull; }
    }
    // puffs fade
    let k = 0;
    for (let i = 0; i < this.nPuffs; i++) {
      const t = this.puffs[i * 3 + 2] + (this.puffs[i * 3 + 2] < 0 ? -1 : 1);
      if (Math.abs(t) < 30) { this.puffs[k * 3] = this.puffs[i * 3]; this.puffs[k * 3 + 1] = this.puffs[i * 3 + 1]; this.puffs[k * 3 + 2] = t; k++; }
    }
    this.nPuffs = k;
  }

  // ------------------------------------------------------------------ helpers
  spawnWaves(w: World, x: number, facing: number, n: number, s: { dmg: number; range: number; speed: number; launch: number }): void {
    for (let i = 0; i < n; i++) {
      const wv = this.waves.find((q) => !q.on);
      if (!wv) return;
      wv.on = true; wv.x = x; wv.dir = n === 1 ? facing : i === 0 ? 1 : -1; wv.left = s.range; wv.speed = s.speed; wv.dmg = s.dmg; wv.launch = s.launch; wv.t = 0; wv.n = 0;
    }
    this.fx(w, 'wave', x, WORLD.groundY, s.range / 500);
  }
  private addPatch(x: number, r: number, frames: number): void {
    // merge with an overlapping patch instead of stacking
    for (const p of this.patches) if (p.on && Math.abs(p.x - x) < (p.r + r) * 0.5) { p.x = (p.x + x) / 2; p.r = Math.max(p.r, r) + 20; p.t = p.max = Math.max(p.t, frames); return; }
    const p = this.patches.find((q) => !q.on) ?? this.patches.reduce((a, b) => (a.t < b.t ? a : b));
    p.on = true; p.x = Math.max(0, Math.min(WORLD.arenaW, x)); p.r = r; p.t = p.max = frames;
  }
  private addWall(w: World, x: number, side: number, frames: number): void {
    const wl = this.walls.find((q) => !q.on) ?? this.walls[0];
    wl.on = true; wl.x = Math.max(WORLD.wallMargin, Math.min(WORLD.arenaW - WORLD.wallMargin, x)); wl.side = side; wl.t = wl.max = frames;
    this.fx(w, 'iceWall', wl.x, WORLD.groundY - 80, 1);
  }
  private tieNear(w: World, t: Fighter, frames: number): void {
    let best: Fighter | null = null, bd: number = V2.tieRange;
    for (const e of w.enemies) { if (e === t || !e.canBeHit) continue; const d = Math.abs(e.x - t.x); if (d < bd) { bd = d; best = e; } }
    if (!best) return;
    const tie = this.ties.find((q) => !q.on) ?? this.ties[0];
    tie.on = true; tie.a = t; tie.b = best; tie.t = frames;
    this.fx(w, 'tie', (t.cx + best.cx) / 2, (t.cy + best.cy) / 2, 1);
  }
  private detonate(w: World, perFrame: number): void {
    for (const e of w.enemies) {
      if (!e.canBeHit || e.bleed <= 0) continue;
      const dmg = V2.executeBase + e.bleed * perFrame;
      e.bleed = 0;
      sideHit(w, e, dmg, Math.sign(e.x - w.player.x) || 1, -480, 'shock', 260);
      this.fx(w, 'execute', e.cx, e.cy, 1);
    }
  }
  /** Disarm Crack: interrupt every telegraphed attack in front of the hero and swat enemy projectiles. */
  private disarm(w: World, p: Fighter, range: number, stun: number): void {
    for (const e of w.enemies) {
      if (!e.alive || e.remove || isBoss(e)) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx < -60 || dx > range) continue;
      if (e.state !== 'windup' && e.state !== 'attack') continue;
      e.attack = null; e.telegraph = 0; e.vx = 0;
      e.setState('stunned', stun);
      this.fx(w, 'disarm', e.cx, e.cy - 40, 1);
    }
    const P = w.ents.projectiles;
    for (let i = P.count - 1; i >= 0; i--) {
      const q = P.items[i];
      if (q.team !== 'enemy') continue;
      const dx = (q.x - p.x) * p.facing;
      if (dx < -60 || dx > range || Math.abs(q.y - p.cy) > 220) continue;
      this.puff(q.x, q.y);
      this.fx(w, 'disarm', q.x, q.y - 20, 1);
      P.releaseAt(i);
    }
  }

  private puff(x: number, y: number, kind = 1): void {
    if (this.nPuffs >= 16) return;
    const k = this.nPuffs++ * 3; this.puffs[k] = x; this.puffs[k + 1] = y; this.puffs[k + 2] = kind;
  }
  private fx(w: World, kind: string, x: number, y: number, a: number): void { w.events.emit('v2fx', { kind, x, y, a }); }
}

/** Point-blank swap (laser): the close variant when the target is near and in front. */
export function closeVariant(p: Fighter, m: MoveDef, target: Fighter | null): MoveDef {
  const c = m.x2?.close;
  if (!c || !target || !target.alive) return m;
  const dx = (target.x - p.x) * p.facing;
  return dx > -20 && Math.abs(target.x - p.x) < c.range && Math.abs(target.cy - p.cy) < 140 ? MOVES[c.move] : m;
}
