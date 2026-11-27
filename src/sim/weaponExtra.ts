import type { World } from './world';
import type { Fighter } from './fighter';
import type { MoveDef } from '../data/moves';
import { WORLD } from '../data/tuning';
import { WEAPON_T } from '../data/weapons/tuning';
import { ko, playerHit, sideHit } from './combat';

/**
 * Extra weapon mechanics (the third weapon batch), all pooled and allocation
 * free per frame:
 *  - player projectiles (`MoveDef.shoot`): ink blobs, homing paper planes,
 *    rocket fists, bubbles, ice shards; they hit through combat.playerHit
 *  - ground spikes (`MoveDef.spikes`): erupt one after another along the floor
 *  - status effects (`MoveDef.status`) ticked here: bleed (damage over time),
 *    freeze (stunned in ice; the next hit shatters it), bubble (floats up
 *    helpless; the next hit pops it), snare (stunned in an ink ring)
 *  - chain lightning (`MoveDef.chain`): arcs from the victim to nearby enemies
 */
export interface Shot {
  on: boolean; kind: string; x: number; y: number; px: number; py: number; vx: number; vy: number;
  life: number; grav: number; homing: number; pierce: number; radius: number; spin: number;
  move: MoveDef | null; hits: Int32Array; nHits: number;
}
export interface Spike { on: boolean; x: number; delay: number; t: number; move: MoveDef | null; first: boolean; i: number }

const MAX_SHOTS = 48, MAX_SPIKES = 24;

export class WeaponExtra {
  readonly shots: Shot[] = Array.from({ length: MAX_SHOTS }, () => ({
    on: false, kind: '', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, grav: 0, homing: 0, pierce: 1, radius: 10, spin: 0,
    move: null, hits: new Int32Array(8), nHits: 0,
  }));
  readonly spikes: Spike[] = Array.from({ length: MAX_SPIKES }, () => ({ on: false, x: 0, delay: 0, t: 0, move: null, first: true, i: 0 }));
  /** Chain-lightning arcs to draw (x1,y1,x2,y2,t). */
  readonly arcs = new Float32Array(5 * 16);
  nArcs = 0;

  reset(): void {
    for (const s of this.shots) s.on = false;
    for (const s of this.spikes) s.on = false;
    this.nArcs = 0;
  }

  // ------------------------------------------------------------------ firing
  /** Fire the move's projectiles along the aim (fanned out by `spread` degrees). */
  fire(_w: World, p: Fighter, m: MoveDef, aimX: number, aimY: number): void {
    const S = m.shoot!;
    const base = Math.atan2(aimY, aimX);
    const n = S.count;
    for (let i = 0; i < n; i++) {
      const s = this.shots.find((x) => !x.on);
      if (!s) return;
      const a = base + (n > 1 ? ((i / (n - 1)) - 0.5) * (S.spread * Math.PI / 180) : 0);
      s.on = true; s.kind = S.kind; s.move = m; s.nHits = 0;
      s.x = s.px = p.x + p.facing * 30 * p.scale + (S.fromSky ? (i - (n - 1) / 2) * 70 : 0);
      s.y = s.py = S.fromSky ? WORLD.groundY - 760 - i * 40 : p.y - 96 * p.scale;
      const sp = S.speed * (1 - 0.06 * Math.abs(i - (n - 1) / 2));
      if (S.fromSky) { s.vx = aimX * sp * 0.25; s.vy = sp; }
      else { s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; }
      s.life = S.life; s.grav = S.gravity; s.homing = S.homing; s.pierce = S.pierce; s.radius = S.radius; s.spin = 0;
    }
    p.moveHit = true;
  }

  /** Spikes erupt one after another along the floor in front of the hero. */
  plantSpikes(p: Fighter, m: MoveDef): void {
    const K = m.spikes!;
    for (let i = 0; i < K.count; i++) {
      const s = this.spikes.find((x) => !x.on);
      if (!s) return;
      s.on = true; s.move = m; s.t = 0; s.first = i === 0; s.i = i;
      // A single spike (geyser / pillar launcher) erupts under the target; lines start in front.
      const tx = K.count === 1 && p.target && p.target.alive && Math.abs(p.target.x - p.x) < 520 ? p.target.x : 0;
      s.x = tx || p.x + p.facing * (K.start + i * K.spacing) * p.scale;
      s.delay = i * K.delay;
    }
    p.moveHit = true;
  }

  // ------------------------------------------------------------------ statuses / chain (called from playerHit)
  /** Before damage: a frozen victim shatters, a bubbled one pops. Returns the damage multiplier. */
  preHit(w: World, v: Fighter): number {
    if (v.frozen > 0) { v.frozen = 0; w.events.emit('shatter', { x: v.cx, y: v.cy }); return WEAPON_T.shatterMult; }
    if (v.bubble > 0) { v.bubble = 0; v.gravityScale = 1; w.events.emit('pop', { x: v.cx, y: v.cy }); return WEAPON_T.popMult; }
    return 1;
  }

  /** After a landed hit: apply the move's status and chain lightning. */
  postHit(w: World, m: MoveDef, v: Fighter, dmg: number): void {
    if (m.status && v.alive) {
      const st = m.status;
      if (st.kind === 'bleed') { v.bleed = Math.max(v.bleed, st.frames); }
      else if (st.kind === 'freeze' && !v.def?.boss) { v.frozen = st.frames; v.vx *= 0.3; if (v.grounded) v.setState('stunned', st.frames); }
      else if (st.kind === 'freeze') { v.poise = Math.max(0, v.poise - v.maxPoise * 0.25); }
      else if (st.kind === 'bubble' && !v.def?.boss) { v.bubble = st.frames; v.grounded = false; v.setState('air'); v.vy = -260; v.stall = 4; }
      else if (st.kind === 'snare' && !v.def?.boss) { v.setState('stunned', st.frames); v.snare = st.frames; }
    }
    if (m.chain) this.chainFrom(w, v, m.chain.arcs, dmg * m.chain.dmg);
  }

  private chainFrom(w: World, from: Fighter, arcs: number, dmg: number): void {
    let src = from;
    const seen = chainSeen; let ns = 0;
    seen[ns++] = from.id;
    for (let n = 0; n < arcs; n++) {
      let best: Fighter | null = null, bd = WEAPON_T.chainRange * WEAPON_T.chainRange;
      for (const e of w.enemies) {
        if (!e.canBeHit) continue;
        let dup = false;
        for (let i = 0; i < ns; i++) if (seen[i] === e.id) { dup = true; break; }
        if (dup) continue;
        const dx = e.cx - src.cx, dy = e.cy - src.cy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best || ns >= seen.length) break;
      seen[ns++] = best.id;
      if (this.nArcs < 16) { const k = this.nArcs++ * 5; this.arcs[k] = src.cx; this.arcs[k + 1] = src.cy; this.arcs[k + 2] = best.cx; this.arcs[k + 3] = best.cy; this.arcs[k + 4] = 12; }
      w.events.emit('chainArc', { x1: src.cx, y1: src.cy, x2: best.cx, y2: best.cy });
      sideHit(w, best, dmg, Math.sign(best.x - src.x) || 1, -320, 'shock', 200);
      src = best;
    }
  }

  // ------------------------------------------------------------------ per step
  update(w: World): void {
    // arcs fade
    let k = 0;
    for (let i = 0; i < this.nArcs; i++) {
      const t = this.arcs[i * 5 + 4] - 1;
      if (t > 0) { for (let q = 0; q < 4; q++) this.arcs[k * 5 + q] = this.arcs[i * 5 + q]; this.arcs[k * 5 + 4] = t; k++; }
    }
    this.nArcs = k;
    // statuses
    for (const e of w.enemies) {
      if (!e.alive) { e.bleed = 0; e.frozen = 0; e.bubble = 0; e.snare = 0; continue; }
      if (e.bleed > 0) {
        e.bleed--;
        if (e.bleed % WEAPON_T.bleedEvery === 0) {
          e.hp -= WEAPON_T.bleedDamage; e.flash = 2;
          w.combo.score += 5;
          w.events.emit('bleed', { x: e.cx, y: e.cy });
          if (e.hp <= 0) ko(w, e, e.facing * -1);
        }
      }
      if (e.frozen > 0) { e.frozen--; if (e.grounded && e.state !== 'stunned' && e.frozen > 0 && e.inHitState === false) e.setState('stunned', e.frozen); }
      if (e.snare > 0) e.snare--;
      if (e.bubble > 0) {
        e.bubble--;
        if (e.state === 'air' || e.state === 'held') {
          e.vy = WORLD.groundY - e.y > WEAPON_T.bubbleHeight ? 20 : -70;
          e.vx *= 0.92; e.stall = 2; e.gravityScale = 0.2;
        }
        if (e.bubble === 0) e.gravityScale = 1;
      }
    }
    // projectiles
    for (const s of this.shots) {
      if (!s.on) continue;
      s.px = s.x; s.py = s.y;
      if (s.homing > 0) {
        let best: Fighter | null = null, bd = 900 * 900;
        for (const e of w.enemies) { if (!e.canBeHit) continue; const dx = e.cx - s.x, dy = e.cy - s.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } }
        if (best) {
          const sp = Math.hypot(s.vx, s.vy) || 1;
          const want = Math.atan2(best.cy - s.y, best.cx - s.x), cur = Math.atan2(s.vy, s.vx);
          let da = want - cur; da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
          const na = cur + Math.max(-s.homing, Math.min(s.homing, da));
          s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
        }
      }
      s.vy += s.grav / 60;
      s.x += s.vx / 60; s.y += s.vy / 60;
      s.spin += 0.4;
      if (--s.life <= 0 || s.x < -40 || s.x > WORLD.arenaW + 40 || s.y > WORLD.groundY) {
        if (s.y > WORLD.groundY - 4) w.events.emit('splat', { x: s.x, y: WORLD.groundY, kind: s.kind });
        s.on = false; continue;
      }
      for (const e of w.enemies) {
        if (!e.canBeHit && !(e.bubble > 0)) continue;
        let dup = false;
        for (let i = 0; i < s.nHits; i++) if (s.hits[i] === e.id) { dup = true; break; }
        if (dup) continue;
        const dx = e.cx - s.x, dy = e.cy - s.y, rr = s.radius + e.hurtR;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (s.nHits < s.hits.length) s.hits[s.nHits++] = e.id;
        playerHit(w, s.move!, e, true);
        w.events.emit('splat', { x: s.x, y: s.y, kind: s.kind });
        if (--s.pierce <= 0) { s.on = false; break; }
      }
    }
    // spikes
    for (const s of this.spikes) {
      if (!s.on) continue;
      if (s.delay > 0) { s.delay--; continue; }
      if (s.t === 0) {
        w.events.emit('groundImpact', { x: s.x, y: WORLD.groundY, power: 0.5, fighter: w.player, bounce: false });
        for (const e of w.enemies) {
          if (!e.canBeHit || e.height > 140) continue;
          if (Math.abs(e.x - s.x) > WEAPON_T.spikeWidth * e.scale) continue;
          playerHit(w, s.move!, e, !s.first);
        }
      }
      if (++s.t > WEAPON_T.spikeFrames) s.on = false;
    }
  }
}

const chainSeen = new Int32Array(12);
