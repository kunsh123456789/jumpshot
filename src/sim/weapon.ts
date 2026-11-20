import type { World } from './world';
import type { Fighter } from './fighter';
import type { MoveDef } from '../data/moves';
import { DIR_VX, DIR_VY } from '../data/moves';
import { WORLD } from '../data/tuning';
import { WEAPON_T } from '../data/weapons/tuning';
import { clamp } from '../core/math';
import { playerHit, shockwave } from './combat';

/** One rope point (verlet). */
interface RopePt { x: number; y: number; ox: number; oy: number }

/**
 * Weapon state and the generic weapon hooks (revision pass 7). The player
 * controller calls into this from its normal move flow; everything still hits
 * through combat.playerHit, so damage scaling, juggles, the style rank, super
 * meter, Rhythm Mode bonuses and enemy-into-enemy bowling apply unchanged.
 *
 * Hooks (all fire on the move's CONTACT frame, so Rhythm Mode lands them on the grid):
 *  - beam:   hitscan line from the hand along the aimed swipe direction
 *  - grab:   catch the target when the dash arrives, hold it, throw it at contact
 *  - tether: the hook connects at contact and pulls the victim (pull/slam/air)
 *            or swings the player around it (swing); zip is a long rope-drawn dash
 *  - plant:  floor shockwave + crack
 *  - deflect: enemy projectiles bounce off while active
 *  - heat:   laser heat limiter (overheat swaps swipes for a melee bash)
 */
export class WeaponSim {
  /** Aim direction of the current move (unit vector, screen space: +y down). */
  aimX = 1; aimY = 0;
  /** Laser heat 0..1 and remaining overheat frames. */
  heat = 0;
  overheat = 0;
  /** Grab: the held enemy (state 'held'). */
  held: Fighter | null = null;
  /** Tether: the hooked enemy and what the rope is doing. */
  tied: Fighter | null = null;
  tetherMode: '' | 'pull' | 'zip' | 'swing' | 'slam' | 'air' | 'dodge' = '';
  tetherT = 0;
  tetherLen = 0;
  /** Pull: victim start point and frames. */
  private pullFromX = 0; private pullFromY = 0; private pullFrames = 1;
  /** Swing: arc centre, radius, start angle and sweep. */
  private swCx = 0; private swCy = 0; private swR = 0; private swA0 = 0; private swSweep = 0; private swFrames = 1;
  /** Slow-mo waiting for the apex of the follow leap (staff vault). */
  apexMoment: { scale: number; sec: number } | null = null;
  /** The player is driven by the weapon (swing): the controller skips its physics. */
  ownsPlayer = false;
  /** Rope anchor for drawing (the hook end) and a short verlet rope. */
  anchorX = 0; anchorY = 0;
  hookOut = 0;
  readonly rope: RopePt[] = [];
  /** Beam flash for rendering (world coords), frames left and max. */
  beamX1 = 0; beamY1 = 0; beamX2 = 0; beamY2 = 0; beamW = 0; beamT = 0; beamMax = 1; beamColor = '#e22424';
  /** Reflected segment end (NaN = no reflection). */
  beamX3 = NaN; beamY3 = 0;

  constructor() {
    for (let i = 0; i < WEAPON_T.ropePoints; i++) this.rope.push({ x: 0, y: 0, ox: 0, oy: 0 });
  }

  reset(): void {
    this.heat = 0; this.overheat = 0;
    this.drop(null);
    this.tied = null; this.tetherMode = ''; this.ownsPlayer = false; this.hookOut = 0; this.beamT = 0; this.apexMoment = null;
  }

  // ------------------------------------------------------------------ aiming
  /** Aim along the swipe direction, snapped onto the target when it is inside the move's cone. */
  aim(p: Fighter, m: MoveDef, dir: number, target: Fighter | null): void {
    let ax = dir >= 0 ? DIR_VX[dir] : p.facing, ay = dir >= 0 ? DIR_VY[dir] : 0;
    if (ax === 0 && ay === 0) ax = p.facing;
    if (target && m.aimCone) {
      const ox = p.x + p.facing * 24 * p.scale, oy = p.y - 96 * p.scale;
      const tx = target.cx - ox, ty = target.cy - oy, d = Math.hypot(tx, ty) || 1;
      const cos = (tx * ax + ty * ay) / d;
      if (cos >= Math.cos((m.aimCone * Math.PI) / 180)) { ax = tx / d; ay = ty / d; }
    }
    const n = Math.hypot(ax, ay) || 1;
    this.aimX = ax / n; this.aimY = ay / n;
    if (Math.abs(this.aimX) > 0.05) p.facing = this.aimX > 0 ? 1 : -1;
  }

  // ------------------------------------------------------------------ per move tick
  /** Called every tick of a player move (before the active-frame check). */
  tick(w: World, p: Fighter, m: MoveDef): void {
    const fr = p.moveFrame, S = p.effStartup;
    // Grab: catch the target once the dash has arrived.
    if (m.grab && !this.held && fr < S && fr >= p.dashFrames && p.target) this.tryGrab(w, p, m, p.target);
    if (this.held) this.holdAt(p, m, fr, S);
    // Zip: the rope is out for the whole dash.
    if (m.tether?.mode === 'zip' && p.target && fr < S && p.dashFrames > 0) {
      this.tetherMode = 'zip'; this.tied = p.target; this.anchorX = p.target.cx; this.anchorY = p.target.cy; this.hookOut = 1;
    }
    // Swing: drive the player around the anchor during the active frames.
    if (this.tetherMode === 'swing' && this.tied && fr >= S) {
      const k = clamp((fr - S + 1) / this.swFrames, 0, 1);
      const e = k * k * (3 - 2 * k);
      const a = this.swA0 + this.swSweep * e;
      p.x = clamp(this.swCx + Math.cos(a) * this.swR, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
      p.y = Math.min(WORLD.groundY, this.swCy + Math.sin(a) * this.swR);
      p.grounded = p.y >= WORLD.groundY;
      this.anchorX = this.tied.cx; this.anchorY = this.tied.cy;
      if (k >= 1) this.endSwing(p);
    }
  }

  /** The move ended or was interrupted: let go of everything it was holding. */
  endMove(p: Fighter): void {
    if (this.held) this.drop(p);
    if (this.tetherMode === 'swing') this.endSwing(p);
    if (this.tetherMode === 'zip') { this.tetherMode = ''; this.tied = null; }
  }

  private endSwing(p: Fighter): void {
    this.ownsPlayer = false;
    this.tetherMode = '';
    this.tied = null;
    if (!p.grounded) { p.vy = -260; p.vx = Math.cos(this.swA0 + this.swSweep) * 0; p.stall = 6; }
  }

  // ------------------------------------------------------------------ contact
  /**
   * The move reached its contact frame (or a multi-hit tick). Returns true if a
   * hook resolved it; false means the controller runs its normal hitbox check.
   */
  contact(w: World, p: Fighter, m: MoveDef, multi: boolean): boolean {
    if (m.heat) this.addHeat(w, m.heat);
    if (m.plant && p.moveFrame === p.effStartup) this.plant(w, p, m);
    if (m.beam) { this.fireBeam(w, p, m, multi); return true; }
    if (m.grab) {
      if (!this.held) return false; // whiffed or unthrowable: the move strikes instead
      this.release(w, p, m);
      return true;
    }
    if (m.tether && m.tether.mode !== 'zip') {
      this.fireTether(w, p, m);
      return m.tether.mode !== 'swing';
    }
    return false;
  }

  // ------------------------------------------------------------------ beams
  private fireBeam(w: World, p: Fighter, m: MoveDef, multi: boolean): void {
    const b = m.beam!;
    const s = p.scale;
    const ox = p.x + p.facing * 24 * s, oy = p.y - 96 * s;
    // Re-aim each multi-hit tick at the live target (keeps a juggle aloft).
    if (multi && p.target && p.target.alive && m.aimCone) {
      const tx = p.target.cx - ox, ty = p.target.cy - oy, d = Math.hypot(tx, ty) || 1;
      if ((tx * this.aimX + ty * this.aimY) / d > Math.cos((m.aimCone * Math.PI) / 180)) { this.aimX = tx / d; this.aimY = ty / d; }
    }
    const ax = this.aimX, ay = this.aimY;
    // Clip at the floor and the arena edges.
    const clip = (x: number, y: number, dx: number, dy: number, L: number): [number, boolean] => {
      let l = L, wall = false;
      if (dy > 0.01) l = Math.min(l, (WORLD.groundY - y) / dy);
      if (dx > 0.01 && (WORLD.arenaW - x) / dx < l) { l = (WORLD.arenaW - x) / dx; wall = true; }
      if (dx < -0.01 && x / -dx < l) { l = x / -dx; wall = true; }
      return [Math.max(0, l), wall];
    };
    const [len, hitWall] = clip(ox, oy, ax, ay, b.len);
    // Collect enemies on the line, nearest first.
    let n = 0;
    n = collectLine(w, p, m, multi, ox, oy, ax, ay, len, b.width, 0, n);
    // Stretch goal (flag): a piercing beam that reaches a wall reflects once.
    this.beamX3 = NaN;
    if (WEAPON_T.beamWallReflect && b.pierce && hitWall && b.len - len > 40) {
      const rx = ox + ax * len, ry = oy + ay * len;
      const [len2] = clip(rx, ry, -ax, ay, b.len - len);
      n = collectLine(w, p, m, multi, rx, ry, -ax, ay, len2, b.width, len, n);
      this.beamX3 = rx - ax * len2; this.beamY3 = ry + ay * len2;
    }
    // insertion sort by distance
    for (let i = 1; i < n; i++) {
      const e = hitBuf[i], d = hitDist[i];
      let j = i - 1;
      while (j >= 0 && hitDist[j] > d) { hitBuf[j + 1] = hitBuf[j]; hitDist[j + 1] = hitDist[j]; j--; }
      hitBuf[j + 1] = e; hitDist[j + 1] = d;
    }
    const count = b.pierce ? Math.min(n, m.maxTargets) : Math.min(n, 1);
    let end = len;
    if (!b.pierce && count > 0) end = Math.max(20, hitDist[0]);
    for (let i = 0; i < count; i++) {
      const e = hitBuf[i];
      if (!multi) p.markHit(e.id);
      p.moveHit = true;
      playerHit(w, m, e, multi || i > 0);
    }
    for (let i = 0; i < n; i++) hitBuf[i] = null as unknown as Fighter;
    this.beamX1 = ox; this.beamY1 = oy; this.beamX2 = ox + ax * end; this.beamY2 = oy + ay * end;
    this.beamW = b.width; this.beamColor = b.color;
    this.beamMax = this.beamT = m.tags.includes('heavy') ? WEAPON_T.beamHeavyFrames : WEAPON_T.beamFrames;
    w.events.emit('beam', { x1: ox, y1: oy, x2: this.beamX2, y2: this.beamY2, width: b.width, heavy: m.tags.includes('heavy'), color: b.color, hit: count > 0 });
    if (this.beamY2 >= WORLD.groundY - 2) w.events.emit('groundImpact', { x: this.beamX2, y: WORLD.groundY, power: m.tags.includes('heavy') ? 0.9 : 0.4, fighter: p, bounce: false });
    if (count > 0 && m.slowmo) w.events.emit('weaponMoment', { scale: m.slowmo.scale, sec: m.slowmo.sec, x: this.beamX2, y: this.beamY2 });
  }

  private addHeat(w: World, h: number): void {
    const H = w.weapon.heat;
    if (!H) return;
    this.heat = Math.min(1, this.heat + h);
    if (this.heat >= 1 && this.overheat <= 0) {
      this.overheat = Math.round(H.overheatSec * 60);
      w.events.emit('overheat', { x: w.player.x, y: w.player.cy });
    }
  }

  /** Rhythm Mode: a Perfect-timed shot vents heat. */
  vent(amount: number): void { this.heat = Math.max(0, this.heat - amount); }

  // ------------------------------------------------------------------ grab / throw
  private tryGrab(w: World, p: Fighter, m: MoveDef, t: Fighter): void {
    if (!t.alive || !(t.canBeHit || t.state === 'held')) return;
    const reach = WEAPON_T.grabReach * p.scale + t.hurtR;
    if (Math.abs(t.x - p.x) > reach || Math.abs(t.cy - p.cy) > reach * 1.3) return;
    // Heavy enemies keep their footing until their poise is broken (stagger, then throw).
    if (m.grab!.respectPoise && t.poise > 0 && !t.inHitState && t.kind !== 'grunt') return;
    if (t.kind === 'boss' && !t.inHitState) return;
    if (t.hasToken) w.ai.releaseToken(t);
    t.attack = null; t.telegraph = 0;
    t.setState('held');
    t.vx = 0; t.vy = 0; t.stall = 0; t.spiked = false; t.knockdownOnLand = false; t.impactShock = null;
    t.grounded = false;
    t.thrown = 0;
    this.held = t;
    p.stall = Math.max(p.stall, p.effStartup - p.moveFrame + 4);
    w.events.emit('grab', { x: t.cx, y: t.cy, victim: t });
  }

  /** Hold point: low in front during the grab, swinging up and back during the wind-up. */
  private holdAt(p: Fighter, m: MoveDef, fr: number, S: number): void {
    const t = this.held!;
    const k = clamp((fr - p.dashFrames) / Math.max(1, S - p.dashFrames), 0, 1);
    const s = p.scale;
    const lift = m.launch !== 0 || m.spike || m.tags.includes('heavy');
    const hx = p.facing * (lift ? 46 - 70 * k : 50) * s;
    const hy = (lift ? 40 + 120 * k : 46) * s;
    t.x = clamp(p.x + hx, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    t.y = Math.min(WORLD.groundY, p.y - hy);
    t.facing = -p.facing;
    t.spinAngle = lift ? -p.facing * k * 1.2 : 0;
  }

  /** Throw: the body leaves in the swipe direction as a live projectile (bowling). */
  private release(w: World, p: Fighter, m: MoveDef): void {
    const t = this.held!;
    this.held = null;
    // Aim decides the side: swing the body over to the throw side.
    const side = Math.abs(this.aimX) > 0.05 ? Math.sign(this.aimX) : p.facing;
    p.facing = side;
    t.x = clamp(p.x + side * 40 * p.scale, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    t.y = Math.min(WORLD.groundY - 1, t.y);
    t.setState('air');
    p.markHit(t.id);
    p.moveHit = true;
    playerHit(w, m, t, false);
    if (t.alive && t.state !== 'ko') t.thrown = m.grab!.bowl;
    else if (!t.alive) t.thrown = m.grab!.bowl;
    t.bowlCount = 0;
    w.events.emit('throw', { x: t.cx, y: t.cy, victim: t, heavy: m.tags.includes('heavy') });
    if (m.slowmo) w.events.emit('weaponMoment', { scale: m.slowmo.scale, sec: m.slowmo.sec, x: t.cx, y: t.cy });
  }

  /** Let go without a throw (interrupted). */
  drop(p: Fighter | null): void {
    const t = this.held;
    this.held = null;
    if (!t) return;
    if (t.state === 'held') {
      t.setState('air');
      t.grounded = false;
      t.vy = -200; t.vx = p ? p.facing * 120 : 0;
    }
  }

  // ------------------------------------------------------------------ tether
  private fireTether(w: World, p: Fighter, m: MoveDef): void {
    const t = p.target;
    const T = m.tether!;
    const hx = p.x + p.facing * 24 * p.scale, hy = p.y - 96 * p.scale;
    if (!t || !t.alive || !(t.canBeHit || t.state === 'held')) {
      // Missed: the hook flies out along the aim and snaps back.
      this.anchorX = hx + this.aimX * (m.ranged ?? 400); this.anchorY = Math.min(WORLD.groundY, hy + this.aimY * (m.ranged ?? 400));
      this.hookOut = WEAPON_T.hookMissFrames; this.tetherMode = ''; this.tied = null;
      this.seedRope(hx, hy);
      w.events.emit('hookFire', { x: hx, y: hy, x2: this.anchorX, y2: this.anchorY, hit: false });
      return;
    }
    this.anchorX = t.cx; this.anchorY = t.cy;
    this.seedRope(hx, hy);
    w.events.emit('hookFire', { x: hx, y: hy, x2: t.cx, y2: t.cy, hit: true });
    p.markHit(t.id);
    p.moveHit = true;
    if (T.mode === 'swing') {
      this.tied = t; this.tetherMode = 'swing'; this.ownsPlayer = true;
      this.swCx = t.cx; this.swCy = t.cy;
      const dx = p.x - t.cx, dy = (p.y - 40 * p.scale) - t.cy;
      this.swR = clamp(Math.hypot(dx, dy), 90, 220);
      this.swA0 = Math.atan2(dy, dx);
      // Over the top for up-diagonals, a low skimming arc for down-diagonals; always ends on the far side.
      const over = this.aimY < 0;
      const toRight = dx < 0;
      this.swSweep = (over ? (toRight ? 1 : -1) : (toRight ? -1 : 1)) * Math.PI * (over ? 1 : 0.85);
      if (!over) { this.swA0 = toRight ? Math.PI * 0.95 : Math.PI * 0.05; this.swSweep = toRight ? -Math.PI * 0.9 : Math.PI * 0.9; }
      this.swFrames = Math.max(4, T.frames);
      p.grounded = false;
      p.vx = 0; p.vy = 0;
      w.events.emit('afterimage', { fighter: p });
      return;
    }
    playerHit(w, m, t, false);
    if (!t.alive) { this.hookOut = 6; return; }
    if (T.mode === 'pull') {
      if (t.state === 'ko') return;
      this.tied = t; this.tetherMode = 'pull';
      this.pullFromX = t.x; this.pullFromY = t.y; this.pullFrames = T.frames; this.tetherT = 0;
      t.setState('pulled');
      t.vx = 0; t.vy = 0; t.stall = 0;
      if (m.slowmo) w.events.emit('weaponMoment', { scale: m.slowmo.scale, sec: m.slowmo.sec, x: t.cx, y: t.cy });
    } else {
      // slam / air: the hit itself (spike / launch) does the work; the rope stays out briefly.
      this.tied = t; this.tetherMode = T.mode; this.tetherT = 0; this.hookOut = T.frames;
      if (m.slowmo) w.events.emit('weaponMoment', { scale: m.slowmo.scale, sec: m.slowmo.sec, x: t.cx, y: t.cy });
    }
  }

  private seedRope(x: number, y: number): void {
    for (const r of this.rope) { r.x = r.ox = x; r.y = r.oy = y; }
  }

  // ------------------------------------------------------------------ plant
  private plant(w: World, p: Fighter, m: MoveDef): void {
    const pl = m.plant!;
    const x = clamp(p.x + p.facing * pl.x * p.scale, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    w.events.emit('groundImpact', { x, y: WORLD.groundY, power: 1.3, fighter: p, bounce: false });
    if (pl.damage > 0) shockwave(w, x, WORLD.groundY, pl.radius, pl.damage, null, '#e22424');
    else w.events.emit('shockwave', { x, y: WORLD.groundY, radius: pl.radius, color: '#e22424', power: Math.min(1.5, pl.radius / 250) });
  }

  // ------------------------------------------------------------------ world step
  /** Per sim step: heat, pulled victims, rope physics, beam flash. */
  update(w: World): void {
    const p = w.player;
    const H = w.weapon.heat;
    if (H) {
      if (this.overheat > 0) { if (--this.overheat === 0) this.heat = H.resumeAt; }
      else this.heat = Math.max(0, this.heat - H.decayPerSec / 60);
    }
    if (this.beamT > 0) this.beamT--;
    // A held body is only valid inside a grab move.
    if (this.held && (p.state !== 'move' || !p.move?.grab || !this.held.alive)) this.drop(p);
    // Pull: reel the victim to just in front of the player, then hand it to the follow-up.
    if (this.tetherMode === 'pull' && this.tied) {
      const t = this.tied;
      if (!t.alive || t.state !== 'pulled') { this.tetherMode = ''; this.tied = null; }
      else if (t.hitstop <= 0) {
        this.tetherT++;
        const k = Math.min(1, this.tetherT / this.pullFrames);
        const e = 1 - (1 - k) * (1 - k);
        const tx = p.x + p.facing * WEAPON_T.pullStop * p.scale;
        const ty = Math.min(WORLD.groundY, p.grounded ? WORLD.groundY : p.y);
        const nx = clamp(this.pullFromX + (tx - this.pullFromX) * e, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
        const ny = this.pullFromY + (ty - this.pullFromY) * e;
        // Velocity of the reel (bowling: dragging a body through others knocks them over).
        t.vx = (nx - t.x) * 60; t.vy = (ny - t.y) * 60;
        t.x = nx; t.y = ny;
        this.anchorX = t.cx; this.anchorY = t.cy;
        if (k >= 1) {
          this.tetherMode = ''; this.tied = null; this.hookOut = 3;
          t.vx = 0; t.vy = 0;
          if (t.y < WORLD.groundY - 4) { t.setState('air'); t.grounded = false; t.stall = 18; }
          else { t.y = WORLD.groundY; t.grounded = true; t.setState('hitstun', WEAPON_T.pullStun); }
          w.events.emit('pullArrive', { x: t.cx, y: t.cy, victim: t });
        }
      }
    } else if ((this.tetherMode === 'slam' || this.tetherMode === 'air') && this.tied) {
      this.anchorX = this.tied.cx; this.anchorY = this.tied.cy;
      if (++this.tetherT > this.hookOut) { this.tetherMode = ''; this.tied = null; this.hookOut = 0; }
    } else if (this.tetherMode === 'zip' && (p.state !== 'move' || !p.move?.tether || p.moveFrame >= p.effStartup)) {
      this.tetherMode = ''; this.tied = null; this.hookOut = 3;
    } else if (this.tetherMode === '' && this.hookOut > 0) this.hookOut--;
    if (this.tetherMode === 'dodge' && p.state !== 'dodge') { this.tetherMode = ''; this.hookOut = 3; }
    this.stepRope(p);
  }

  /** Hook dodge: fire at the wall behind the dodge and reel in. */
  dodgeRope(p: Fighter, toX: number): void {
    this.tetherMode = 'dodge';
    this.anchorX = toX > p.x ? WORLD.arenaW - WORLD.wallMargin + 10 : WORLD.wallMargin - 10;
    this.anchorY = p.y - 140 * p.scale;
    this.hookOut = 1;
    this.seedRope(p.x, p.y - 96 * p.scale);
  }

  /** True while a rope should be drawn. */
  get ropeVisible(): boolean { return this.tetherMode !== '' || this.hookOut > 0; }

  /** Short verlet rope from the hand to the anchor: slack when the hook is just out, taut when pulling. */
  private stepRope(p: Fighter): void {
    if (!this.ropeVisible) return;
    const R = this.rope, n = R.length;
    const hx = p.x + p.facing * 24 * p.scale, hy = p.y - 96 * p.scale;
    const taut = this.tetherMode === 'pull' || this.tetherMode === 'swing' || this.tetherMode === 'zip' || this.tetherMode === 'dodge';
    const dist = Math.hypot(this.anchorX - hx, this.anchorY - hy);
    const seg = (dist * (taut ? 1 : 1.12)) / (n - 1);
    for (let i = 1; i < n - 1; i++) {
      const r = R[i];
      const vx = (r.x - r.ox) * 0.9, vy = (r.y - r.oy) * 0.9;
      r.ox = r.x; r.oy = r.y;
      r.x += vx; r.y += vy + (taut ? 0.2 : 0.9);
    }
    R[0].x = hx; R[0].y = hy; R[n - 1].x = this.anchorX; R[n - 1].y = this.anchorY;
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = R[i], b = R[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const diff = (d - seg) / d * 0.5;
        if (i > 0) { a.x += dx * diff; a.y += dy * diff; }
        if (i + 1 < n - 1) { b.x -= dx * diff; b.y -= dy * diff; }
      }
    }
    for (const r of R) if (r.y > WORLD.groundY) r.y = WORLD.groundY;
  }
}

const hitBuf: Fighter[] = new Array(24);
const hitDist = new Float32Array(24);

/** Append the enemies a beam segment crosses (distance measured from the beam origin, `d0` along). */
function collectLine(w: World, p: Fighter, m: MoveDef, multi: boolean, ox: number, oy: number, ax: number, ay: number, len: number, width: number, d0: number, n: number): number {
  for (const e of w.enemies) {
    if (!e.canBeHit && !(e.state === 'getup' && m.launch !== 0)) continue;
    if (p.alreadyHit(e.id) && !multi) continue;
    let dup = false;
    for (let i = 0; i < n; i++) if (hitBuf[i] === e) { dup = true; break; }
    if (dup) continue;
    const ex = e.cx - ox, ey = e.cy - oy;
    const along = ex * ax + ey * ay;
    if (along < -10 || along > len + e.hurtR) continue;
    const perp = Math.abs(ex * ay - ey * ax);
    if (perp > width * 0.5 + e.hurtR) continue;
    if (n < hitBuf.length) { hitBuf[n] = e; hitDist[n] = d0 + along; n++; }
  }
  return n;
}
