import type { World } from './world';
import type { Fighter } from './fighter';
import type { SwipeEvent } from '../ui/pad';
import { SPECIAL } from '../data/special';
import { WORLD } from '../data/tuning';
import { familyOf, specialScript } from '../data/cines';

/** What the input phases (ui/specialInput.ts) hand back to the sim. */
export interface SpecialResult {
  /** Trace score 0..1 (coverage, accuracy, speed) and its parts (debug). */
  trace: number; coverage: number; accuracy: number; speed: number;
  /** QTE prompts hit / total, and how many were Perfect. */
  qteHits: number; qteCount: number; perfects: number;
  /** Aim angle (laser sweep / throw hurl), radians in world space. */
  aim: number;
  /** Hook: enemy ids connected by the trace, in order. */
  dots: number[];
  judgments: string[];
}

export type SpecialPhase = 'charging' | 'intro' | 'input' | 'cine';

/**
 * The Special Bar (revision pass 8, PART B1-B2). Charges from hits, rhythm
 * grades, parries, orbs, kills and (a little) from damage taken; never while
 * a Special is running. When READY, a long-press in place (or X / Enter)
 * starts it: the world freezes inside a bubble, the hero strikes the
 * activation pose (invulnerable), then the input phases run in real time on
 * the UI side (trace, then QTE) and hand back a SpecialResult; its tier picks
 * the strength of the weapon's cinematic (sim/cine.ts + data/cines.ts).
 * Every phase has a timeout, so a Special can never soft-lock.
 */
export class SpecialSystem {
  charge = 0;
  phase: SpecialPhase = 'charging';
  /** Frames in the current phase. */
  t = 0;
  /** The world outside the hero is frozen (intro / input). */
  freeze = false;
  bubble: { x: number; y: number; r: number } | null = null;
  /** The last result (debug view) and tier. */
  last: SpecialResult | null = null;
  lastTier = -1;
  lastTotal = 0;
  private pending: SpecialResult | null = null;
  /** READY was announced for the current full charge. */
  private announced = false;
  /** First time the bar fills (tutorial hint). */
  everReady = false;

  get max(): number { return SPECIAL.full * SPECIAL.segments; }
  get ready(): boolean { return this.charge >= SPECIAL.full && this.phase === 'charging'; }
  get busy(): boolean { return this.phase !== 'charging'; }

  reset(): void {
    this.charge = 0; this.phase = 'charging'; this.t = 0; this.freeze = false; this.bubble = null;
    this.pending = null; this.announced = false; this.last = null; this.lastTier = -1;
  }

  /** Add charge (ignored while a Special runs). Announces READY once per full charge. */
  add(w: World, amount: number): void {
    if (this.busy || amount <= 0) return;
    this.charge = Math.min(this.max, this.charge + amount);
    if (this.charge >= SPECIAL.full && !this.announced) {
      this.announced = true;
      this.everReady = true;
      w.events.emit('specialReady', { x: w.player.x, y: w.player.cy });
    }
  }

  /** Long-press / X: start the Special if READY and the hero is free (not in hit-stun, not dead). */
  request(w: World, _ev: SwipeEvent | null): void {
    const p = w.player;
    if (!this.ready || !p.alive || w.cine.active || p.state === 'hurt' || p.state === 'ko' || w.gameOver) return;
    if (p.move) w.wpn.endMove(p);
    w.wpn.recall(p);
    p.move = null;
    this.charge -= SPECIAL.full;
    this.announced = this.charge >= SPECIAL.full;
    this.phase = 'intro';
    this.t = 0;
    this.freeze = true;
    this.pending = null;
    p.setState('cine');
    p.cineAnim = p.grounded ? 'cine_activate' : 'cine_activateAir';
    p.cineT = 0;
    p.invuln = Math.max(p.invuln, 9999);
    p.vx = 0; p.vy = 0;
    this.bubble = { x: p.x, y: p.cy, r: 10 };
    w.events.emit('specialStart', { weapon: w.weapon.id, family: familyOf(w.weapon.id), name: specialScript(w.weapon.id).name, x: p.x, y: p.cy });
  }

  /** Input phases call this (from the UI) with the result; it is applied on the next sim step. */
  submit(r: SpecialResult): void { if (this.phase === 'input') this.pending = r; }

  /** While frozen (intro / input): the hero holds the activation pose. */
  holdHero(w: World): void {
    const p = w.player;
    p.cineT++;
    if (p.invuln < 9999) p.invuln = 9999;
  }

  update(w: World): void {
    if (this.phase === 'charging') return;
    this.t++;
    const p = w.player;
    if (this.bubble) this.bubble.r += (SPECIAL.bubbleRadius - this.bubble.r) * 0.25;
    if (this.phase === 'intro' && this.t >= SPECIAL.introFrames) {
      this.phase = 'input'; this.t = 0;
      w.events.emit('specialInput', { family: familyOf(w.weapon.id) });
    } else if (this.phase === 'input') {
      let r = this.pending;
      // Safety: never wait forever (lost focus, UI closed): resolve as SLOPPY.
      if (!r && this.t > SPECIAL.inputTimeoutFrames) r = { trace: 0, coverage: 0, accuracy: 0, speed: 0, qteHits: 0, qteCount: 1, perfects: 0, aim: p.facing > 0 ? 0 : Math.PI, dots: [], judgments: ['TIMEOUT'] };
      if (r) this.begin(w, r);
    } else if (this.phase === 'cine' && !w.cine.active) {
      this.phase = 'charging'; this.t = 0;
      w.events.emit('specialEnd', { tier: this.lastTier });
    }
  }

  /** Grade the result and launch the weapon's cinematic. */
  private begin(w: World, r: SpecialResult): void {
    this.pending = null;
    this.last = r;
    const qf = r.qteCount > 0 ? r.qteHits / r.qteCount : 0;
    const total = r.trace * SPECIAL.wTrace + qf * SPECIAL.wQte + r.perfects * SPECIAL.perfectBonus;
    const tier = total >= SPECIAL.tierPerfect ? 2 : total >= SPECIAL.tierClean ? 1 : 0;
    this.lastTier = tier; this.lastTotal = total;
    w.events.emit('specialTier', { tier, name: SPECIAL.tierNames[tier], x: w.player.x, y: w.player.cy });
    const fam = familyOf(w.weapon.id);
    const p = w.player;
    const live = (e: Fighter) => e.alive && e.state !== 'ko' && e.state !== 'dead' && e.kind !== 'dummy';
    let main: Fighter | null = null;
    let group: Fighter[] = [];
    if (fam === 'fists' || fam === 'staff') {
      const R = fam === 'fists' ? SPECIAL.rangeFists : SPECIAL.rangeStaff;
      group = w.enemies.filter((e) => live(e) && Math.abs(e.x - p.x) < R);
    } else if (fam === 'hook') {
      for (const id of r.dots) { const e = w.enemies.find((x) => x.id === id); if (e && live(e) && !group.includes(e)) group.push(e); }
      if (group.length === 0) { const n = nearest(w, p, live); if (n) group.push(n); }
    } else if (fam === 'throw') {
      let best = -1;
      for (const e of w.enemies) if (live(e) && Math.abs(e.x - p.x) < SPECIAL.rangeThrow && e.maxHp > best) { best = e.maxHp; main = e; }
      if (!main) main = nearest(w, p, live);
    }
    if (!p.grounded && (fam === 'fists' || fam === 'staff' || fam === 'throw')) { p.y = Math.min(WORLD.groundY, p.y); }
    this.freeze = false;
    this.bubble = null;
    this.phase = 'cine';
    w.cine.start(w, specialScript(w.weapon.id), 'special', main, group, {
      tier, qte: r.qteHits, dmg: SPECIAL.tierDamage[tier], aim: r.aim, freeze: true,
    });
  }
}

function nearest(w: World, p: Fighter, ok: (e: Fighter) => boolean): Fighter | null {
  let best: Fighter | null = null, bd = Infinity;
  for (const e of w.enemies) { if (!ok(e)) continue; const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; best = e; } }
  return best;
}
