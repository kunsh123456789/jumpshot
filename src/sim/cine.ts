import type { World } from './world';
import type { Fighter } from './fighter';
import { CINE } from '../data/tuning';
import { isBoss } from '../data/enemies';
import { ko } from './combat';
import { WORLD } from '../data/tuning';

/**
 * Cinematic player (revision pass 8): the shared engine behind the air
 * finishers, the last-hit KO finishers and the Special moves. A cinematic is a
 * script that runs once per SIM frame (deterministic, so Rhythm Mode stays on
 * the beat clock): it picks the hero's drawing (`hero()`), places the hero and
 * its victims, lands hits through `strike()` (combo, style, score, Special
 * charge rules all apply) and fires presentation cues (`fx()`: slow-mo, camera
 * focus, inverted impact frames, floor cracks, scribbles, lightning, stars).
 *
 * While a cinematic plays the hero is in state 'cine' and invulnerable, and its
 * victims are in state 'cine' (posed by the script). Every cinematic has a
 * fixed length, so it always ends; the KO finisher can be skipped by any input.
 */
export type CineKind = 'air' | 'ko' | 'special';

export interface CineCtx {
  w: World;
  p: Fighter;
  /** The main target (air finisher / KO victim / grabbed enemy). */
  main: Fighter | null;
  /** Everyone caught (specials). */
  group: Fighter[];
  /** The weapon this cinematic belongs to (a Special can be another weapon's than the equipped one). */
  weaponId: string;
  /** Frame since start. */
  f: number;
  /** Special result tier 0 SLOPPY / 1 CLEAN / 2 PERFECT, and qte (0-3, from the trace score: scales the cinematic's length). */
  tier: number;
  qte: number;
  /** Damage multiplier for this run (tier). */
  dmg: number;
  /** Trace data (aim angle for the laser sweep / throw hurl, hook dot order). */
  aim: number;
  /** Free per-script scratch values. */
  v: Record<string, number>;
  /** Presentation state read by the renderer (ropes, beams, tornado, X-slash line). */
  vis: CineVisual;
  /** True while the script's final beat has been forced (skip). */
  skipping: boolean;
  /** Boss damage taken so far this cinematic (capped). */
  bossDmg: number;
}

export interface CineVisual {
  /** style 'blast': the laser Special's horizontal beam (white core, ragged flame edge in `tone`); t = frames since firing (< 0 while charging). */
  beam: { x1: number; y1: number; x2: number; y2: number; w: number; style?: 'blast'; tone?: string; t?: number } | null;
  ropes: number[];          // flat list x1,y1,x2,y2,...
  tornado: { x: number; y: number; r: number; h: number } | null;
  slash: { x1: number; y1: number; x2: number; y2: number; t: number }[];
  bubble: { x: number; y: number; r: number } | null;
  dark: number;             // 0..1 special-mode dark vignette
}

export interface CineScript {
  id: string;
  /** Shown in the finisher pop-up. */
  name: string;
  len: (c: CineCtx) => number;
  start?: (c: CineCtx) => void;
  frame: (c: CineCtx) => void;
  /** Called once at the end (normal or skipped): settle everyone into a normal state. */
  end: (c: CineCtx) => void;
}

const emptyVis = (): CineVisual => ({ beam: null, ropes: [], tornado: null, slash: [], bubble: null, dark: 0 });

export class CinePlayer {
  script: CineScript | null = null;
  kind: CineKind = 'air';
  ctx: CineCtx | null = null;
  private length = 0;
  /** Victims held by the cinematic (restored by end()). */
  readonly held: Fighter[] = [];

  get active(): boolean { return this.script !== null; }
  /** The world outside the cinematic is frozen (specials: the freeze bubble). */
  freezeOthers = false;

  reset(): void { this.script = null; this.ctx = null; this.held.length = 0; this.freezeOthers = false; }

  start(w: World, s: CineScript, kind: CineKind, main: Fighter | null, group: Fighter[], opt: { tier?: number; qte?: number; dmg?: number; aim?: number; freeze?: boolean; weapon?: string } = {}): void {
    const p = w.player;
    if (p.move) w.wpn.endMove(p);
    w.wpn.recall(p);
    p.move = null;
    this.script = s;
    this.kind = kind;
    this.freezeOthers = !!opt.freeze;
    this.held.length = 0;
    const c: CineCtx = {
      w, p, main, group, weaponId: opt.weapon ?? w.weapon.id, f: 0, tier: opt.tier ?? 1, qte: opt.qte ?? 0, dmg: opt.dmg ?? 1, aim: opt.aim ?? 0,
      v: {}, vis: emptyVis(), skipping: false, bossDmg: 0,
    };
    this.ctx = c;
    p.setState('cine');
    p.invuln = Math.max(p.invuln, 9999);
    p.vx = 0; p.vy = 0;
    for (const e of [main, ...group]) if (e && !this.held.includes(e)) this.grab(e);
    s.start?.(c);
    this.length = s.len(c);
    w.events.emit('finisher', { kind, name: s.name, x: p.x, y: p.cy });
  }

  /** Put a fighter under the script's control. */
  grab(e: Fighter): void {
    if (this.held.includes(e)) return;
    this.held.push(e);
    if (e.hasToken && this.ctx) this.ctx.w.ai.releaseToken(e);
    e.attack = null; e.telegraph = 0;
    e.setState('cine');
    e.cineAnim = e.alive ? 'hurtHeavy' : 'tumble';
    e.cineT = 0;
    e.vx = 0; e.vy = 0; e.stall = 0;
  }

  /** Any input skips the KO finisher straight to its final blow. */
  skip(): void {
    const c = this.ctx;
    if (!c || this.kind !== 'ko' || c.skipping || c.f < CINE.skipAfter) return;
    c.skipping = true;
    this.finish();
  }

  step(_w: World): void {
    const s = this.script, c = this.ctx;
    if (!s || !c) return;
    c.vis.slash = c.vis.slash.filter((x) => --x.t > 0);
    s.frame(c);
    c.f++;
    for (const e of this.held) { e.px = e.px; e.cineT++; }
    if (c.f >= this.length) this.finish();
  }

  private finish(): void {
    const s = this.script, c = this.ctx;
    if (!s || !c) return;
    s.end(c);
    const p = c.p;
    if (p.state === 'cine') {
      p.setState(p.grounded ? 'idle' : 'fall');
      if (!p.grounded) { p.jumpKind = 'none'; p.vy = Math.max(p.vy, 0); }
    }
    p.invuln = CINE.afterInvuln;
    p.cineAnim = '';
    for (const e of this.held) if (e.state === 'cine') release(e);
    this.reset();
  }
}

/** Return a held fighter to the normal sim (airborne, or standing). */
export function release(e: Fighter): void {
  e.cineSpin = 0;
  if (!e.alive) { e.setState('ko'); e.grounded = false; if (e.vy === 0) e.vy = -300; return; }
  if (e.y < WORLD.groundY - 2 || e.vy < 0) { e.grounded = false; e.setState('air'); } else { e.grounded = true; e.y = WORLD.groundY; e.setState('knockdown', 40); }
}

// ------------------------------------------------------------------ script helpers
/** Show a drawing on the hero: animation `id`, time `t` (frames into it). */
export function hero(c: CineCtx, id: string, t: number): void { c.p.cineAnim = id; c.p.cineT = Math.max(0, t); }
/** Pose a held victim. */
export function pose(e: Fighter, id: string, t = e.cineT): void { e.cineAnim = id; e.cineT = t; }

/** Place a fighter (feet position), with facing toward `faceX` if given. */
export function place(e: Fighter, x: number, y: number, faceX?: number): void {
  e.x = Math.max(WORLD.wallMargin, Math.min(WORLD.arenaW - WORLD.wallMargin, x));
  e.y = Math.min(WORLD.groundY, y);
  e.grounded = e.y >= WORLD.groundY - 0.5;
  if (faceX !== undefined && faceX !== e.x) e.facing = faceX > e.x ? 1 : -1;
}

/** Ease a value from a to b over [f0, f1] of the cinematic (clamped, smoothstep). */
export function tween(c: CineCtx, f0: number, f1: number, a: number, b: number): number {
  const k = Math.max(0, Math.min(1, (c.f - f0) / Math.max(1, f1 - f0)));
  return a + (b - a) * k * k * (3 - 2 * k);
}

/**
 * A cinematic hit: damage (Special damage multiplier, the boss / elite caps),
 * combo + style + score, an impact event for the FX, and an optional launch
 * that releases the victim (`release: true`). Never damage-scaled to nothing:
 * cinematic hits ignore the combo's damage scaling (it only applies to swipes).
 */
export function strike(c: CineCtx, e: Fighter, dmg: number, opt: { dirX?: number; vx?: number; vy?: number; release?: boolean; kind?: 'launch' | 'spike' | 'finisher'; weight?: number; shock?: number; quiet?: boolean } = {}): void {
  const w = c.w;
  const dirX = opt.dirX ?? (Math.sign(e.x - c.p.x) || c.p.facing);
  let d = dmg * c.dmg;
  if (isBoss(e)) {
    const cap = e.maxHp * CINE.bossCapFrac - c.bossDmg;
    d = Math.max(0, Math.min(d * CINE.bossMult, cap));
    c.bossDmg += d;
  } else if (e.kind === 'elite') d *= CINE.eliteMult;
  if (e.alive) {
    e.hp -= d;
    e.flash = 3;
    e.hitSerial++;
    e.comboHits++;
    w.combo.registerHit('cine', d, { air: !e.grounded, multi: true, bounce: false, finisher: true, launcher: false, bowl: false, ko: e.hp <= 0 });
  }
  const weight = opt.weight ?? 0.8;
  // Rapid ticks (tornado, beam, spin) stay light: a small spark instead of a full impact splash.
  if (opt.quiet) { e.flash = 2; w.events.emit('cineFx', { kind: 'sparks', x: e.cx, y: e.cy, a: 0.15 }); w.events.emit('text', { text: String(Math.round(d)), x: e.cx, y: e.cy - 50, color: '#1b1a17', size: 14 }); }
  else w.events.emit('hit', {
    attacker: c.p, victim: e, x: e.cx - dirX * 14, y: e.cy, dirX, dirY: opt.vy !== undefined ? Math.sign(opt.vy) * 0.6 : -0.3,
    weight, damage: d, crit: false, move: null, combo: w.combo.hits, kind: opt.kind ?? 'finisher', shake: 6 + weight * 10, hitstop: 0, zoom: weight * 0.4,
  });
  if (opt.release) {
    e.vx = opt.vx ?? dirX * 400;
    e.vy = opt.vy ?? -600;
    e.facing = -dirX;
    if (opt.shock) e.impactShock = { radius: opt.shock, damage: CINE.shockDamage };
    if (opt.kind === 'spike') e.spiked = true;
    e.knockdownOnLand = true;
    const i = w.cine.held.indexOf(e);
    if (i >= 0) w.cine.held.splice(i, 1);
    if ((e.hp <= 0 || c.v['dead' + e.id]) && e.alive) { const vx = e.vx, vy = e.vy; e.grounded = false; e.setState('air'); ko(w, e, dirX); e.vx = vx; e.vy = vy; }
    else release(e);
  } else if (e.hp <= 0 && e.alive) {
    // keep the body in the cinematic: it is KO'd when it is let go
    e.hp = 0.01;
    c.v['dead' + e.id] = 1;
  }
}

/** Presentation cue (slow-mo, focus, invert, crack, scribble, lightning, stars, boom, shake). */
export function fx(c: CineCtx, kind: CineFxKind, x: number, y: number, a = 1): void {
  c.w.events.emit('cineFx', { kind, x, y, a });
}
export type CineFxKind = 'slowmo' | 'focus' | 'invert' | 'shake' | 'crack' | 'bigCrack' | 'scribble' | 'lightning' | 'whirl' | 'stars' | 'boom' | 'whoosh' | 'dust' | 'sparks' | 'tier' | 'laserCharge' | 'laserFire' | 'laserEnd';
