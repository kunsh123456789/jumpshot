import type { World } from './world';
import type { Fighter } from './fighter';
import { MOVES } from '../data/moves';
import { WORLD } from '../data/tuning';
import { GRAPPLE as G } from '../data/weapons/tuning';
import { clamp } from '../core/math';
import { playerHit } from './combat';

/**
 * Grappling hook mobility (hook, New moveset): web-swing from the roof, zip to a wall and
 * cling to it, wall-jump off it.
 *
 * While it is active the hero is in state 'swing' (roof rope, including the zip to a wall)
 * or 'cling' (stuck to a wall) and this module owns its position. The swing is a rope
 * constraint on the hip, solved position-based (predict, project onto the rope, derive the
 * velocity from the move), so reeling in, the floor and the walls all feed back into the
 * momentum the hero keeps when it lets go.
 */
export type GrapplePhase = 'off' | 'swing' | 'zip' | 'cling';

/** World y of the roof line the hook bites into. */
export const ROOF_Y = WORLD.groundY - G.roofHeight;
const WALL_L = WORLD.wallMargin, WALL_R = WORLD.arenaW - WORLD.wallMargin;
/** The drawn wall faces the hook bites into (just outside the hero's walkable range). */
export const WALL_FACE_L = 10, WALL_FACE_R = WORLD.arenaW - 10;

interface Mark { x: number; y: number; t: number; wall: boolean }

export class Grapple {
  phase: GrapplePhase = 'off';
  /** Rope anchor (roof bite or wall bite). */
  ax = 0; ay = 0;
  /** The hip: the swing's bob. */
  hx = 0; hy = 0; vx = 0; vy = 0;
  /** Rope length to the hip and the length it is reeling toward. */
  len = 0; lenT = 0;
  /** Swing direction (+1 right), frames in this phase, auto-hang frames left. */
  dir = 1; t = 0; hang = 0;
  /** The wall being zipped to / clung to: -1 left, +1 right. */
  side = 0;
  /** Rope shot: 0..1 while the hook flies out (drawing only). */
  shot = 1;
  /** Frames since the hook bit: the rope's grip eases in over the first few (no jolt on the bite). */
  bite = 0;
  /** Fading bite marks left on the roof and walls (drawing only). */
  marks: Mark[] = [];
  /** World-space body rotation for the renderer (top of the body toward the anchor). */
  spin = 0;

  get active(): boolean { return this.phase !== 'off'; }

  reset(): void { this.phase = 'off'; this.marks.length = 0; this.spin = 0; }

  // ------------------------------------------------------------------ starts
  /**
   * Fire a rope at the roof ahead (dir) and swing. `up`: straight overhead and reel in to a
   * tight hang (the dodge zip-up / climb), held there for `hang` frames.
   */
  swing(w: World, p: Fighter, dir: number, up = false, hang = 0): void {
    const s = p.scale;
    const wasOff = this.phase === 'off' || this.phase === 'cling';
    this.syncFrom(p, wasOff);
    this.dir = dir || p.facing || 1;
    const speed = Math.abs(this.vx);
    const ahead = up ? 26 : (p.grounded ? G.aheadGround : G.ahead) + Math.min(G.aheadMax, speed * G.aheadPerSpeed);
    this.ax = clamp(this.hx + this.dir * ahead, WALL_L + 30, WALL_R - 30);
    this.ay = ROOF_Y;
    this.len = Math.hypot(this.hx - this.ax, this.hy - this.ay);
    this.lenT = up ? G.minLen * s : clamp(this.len, G.minLen * s, G.maxLen * s);
    if (p.grounded && !up) {
      // Off the floor: a rope short enough to clear the floor at the bottom, and a running start
      // along the arc (the reel lifts the hero onto it).
      const floorHip = WORLD.groundY - (G.hipH + 6) * s;
      this.lenT = clamp(floorHip - this.ay - G.groundClear * s, G.minLen * s, G.maxLen * s);
      const nx = (this.hx - this.ax) / (this.len || 1), ny = (this.hy - this.ay) / (this.len || 1);
      this.vx = ny * this.dir * G.yank; this.vy = -nx * this.dir * G.yank;
    }
    this.hang = hang;
    this.shot = 0; this.bite = 0;
    this.t = 0;
    this.phase = 'swing';
    this.enter(w, p, 'swing');
    w.events.emit('v2fx', { kind: 'gFire', x: this.ax, y: this.ay, a: 1 });
  }

  /** Fire at the wall on `side` (-1 left, +1 right) and zip to it. */
  zipWall(w: World, p: Fighter, side: number): void {
    const wasOff = this.phase === 'off' || this.phase === 'cling';
    this.syncFrom(p, wasOff);
    this.side = side;
    this.ax = side > 0 ? WALL_FACE_R : WALL_FACE_L;
    // from the floor the rope bites high up the wall (a cling worth jumping off); in the air, level
    this.ay = clamp(this.hy - (p.grounded ? 190 : 40) * p.scale, ROOF_Y + 130, WORLD.groundY - 150);
    this.dir = side;
    this.shot = 0;
    this.t = 0;
    this.phase = 'zip';
    this.enter(w, p, 'swing');
    w.events.emit('v2fx', { kind: 'gFire', x: this.ax, y: this.ay, a: 1 });
  }

  private syncFrom(p: Fighter, fresh: boolean): void {
    const s = p.scale;
    this.hx = p.x; this.hy = p.y - G.hipH * s;
    if (fresh) { this.vx = p.vx; this.vy = p.grounded ? 0 : p.vy; }
  }

  private enter(w: World, p: Fighter, st: 'swing' | 'cling'): void {
    if (p.move) w.wpn.endMove(p);
    p.move = null;
    p.grounded = false;
    p.stall = 0; p.stallCount = 0;
    p.hitCount = 0; // a fresh rope: every enemy can be kicked again
    p.setState(st);
  }

  // ------------------------------------------------------------------ ends
  /** Let go: the hero flies on with the rope's momentum (plus a pop), flipping. */
  release(w: World, p: Fighter, pop: number = G.pop, jump = false): void {
    if (this.phase === 'off') return;
    const s = p.scale;
    if (this.phase !== 'cling') this.mark(this.phase === 'zip');
    p.x = this.hx; p.y = this.hy + G.hipH * s;
    p.vx = this.vx;
    // a jump off the rope cancels the fall first (a web-jump always goes up)
    p.vy = Math.max(-1350, (jump ? Math.min(this.vy, 0) : this.vy) - pop);
    this.off(p);
    p.fling = G.fling;
    p.jumpKind = 'leap'; p.airFrames = 0;
    if (Math.abs(p.vx) > 60) p.facing = p.vx > 0 ? 1 : -1;
    p.setState(p.vy < 0 ? 'jumpFollow' : 'fall');
    w.events.emit('v2fx', { kind: 'gRelease', x: p.x, y: p.cy, a: Math.min(1, Math.hypot(p.vx, p.vy) / G.maxSpeed) });
    w.events.emit('afterimage', { fighter: p });
  }

  /** Kick off the wall: `flat` = a low fast side launch, otherwise up and away. */
  wallJump(w: World, p: Fighter, flat = false): void {
    if (this.phase !== 'cling') return;
    const away = -this.side;
    this.vx = away * (flat ? G.wallFlatVx : G.wallJumpVx);
    this.vy = flat ? G.wallFlatVy : G.wallJumpVy;
    this.release(w, p, 0);
    p.facing = away;
    w.events.emit('v2fx', { kind: 'gWallJump', x: p.x, y: p.cy, a: 1 });
  }

  /** Drop without momentum (cling: let go of the wall; also used before an attack out of a swing). */
  drop(p: Fighter): void {
    if (this.phase === 'off') return;
    const s = p.scale;
    if (this.phase !== 'cling') this.mark(this.phase === 'zip');
    p.x = this.hx; p.y = this.hy + G.hipH * s;
    p.vx = this.phase === 'cling' ? -this.side * 120 : this.vx * 0.6;
    p.vy = this.phase === 'cling' ? 0 : Math.min(this.vy, 200);
    this.off(p);
    p.fling = G.fling >> 1;
    p.jumpKind = 'none';
    p.setState('fall');
  }

  /** Something else took the hero (hit, cinematic, death): the rope just goes. */
  cut(p: Fighter): void {
    if (this.phase === 'off') return;
    if (this.phase !== 'cling') this.mark(this.phase === 'zip');
    this.off(p);
  }

  private off(p: Fighter): void {
    this.phase = 'off';
    this.spin = 0;
    p.grounded = p.y >= WORLD.groundY - 0.5;
  }

  private mark(wall: boolean): void {
    if (this.shot < 1) return;
    if (this.marks.length >= 6) this.marks.shift();
    this.marks.push({ x: this.ax, y: this.ay, t: 60, wall });
  }

  // ------------------------------------------------------------------ tick
  /** One frame while active (called from the player controller instead of its own physics). */
  update(w: World, p: Fighter): void {
    this.t++;
    if (this.shot < 1) {
      this.shot = Math.min(1, this.shot + 0.34);
      if (this.shot >= 1) w.events.emit('v2fx', { kind: 'gAttach', x: this.ax, y: this.ay, a: this.phase === 'zip' ? 1 : 0.6 });
    }
    if (this.shot >= 1) this.bite++; else this.bite = 0;
    if (this.phase === 'swing') this.tickSwing(w, p);
    else if (this.phase === 'zip') this.tickZip(w, p);
    else if (this.phase === 'cling') this.tickCling(w, p);
    if (this.phase === 'off') return;
    const s = p.scale;
    p.x = this.hx; p.y = this.hy + G.hipH * s;
    p.vx = this.vx; p.vy = this.vy;
    p.grounded = false;
    if (this.phase === 'cling') { p.facing = -this.side; this.spin = 0; }
    else {
      if (Math.abs(this.vx) > 40) p.facing = this.vx > 0 ? 1 : -1;
      // Body points at the anchor (the zip leans into the flight).
      const a = Math.atan2(this.ax - this.hx, this.hy - this.ay);
      this.spin = this.phase === 'zip' ? clamp(a, -1.2, 1.2) * 0.55 : a;
    }
    for (const m of this.marks) m.t--;
    p.grapPose = this.phase === 'cling' ? 3 : this.phase === 'zip' ? 2 : Math.hypot(this.vx, this.vy) > 480 ? 1 : 0;
    p.grapSpin = this.spin;
    if (this.phase !== 'cling') this.kicks(w, p);
  }

  private tickSwing(w: World, p: Fighter): void {
    const s = p.scale;
    const held = w.attackHeld;
    const minHipY = ROOF_Y + 60 * s, maxHipY = WORLD.groundY - (G.hipH + 6) * s;
    const dt = 1 / 120;
    for (let k = 0; k < 2; k++) {
      const ox = this.hx, oy = this.hy;
      // gravity, the downswing pump (only while the rope is biting), and stick steering
      let nx = this.hx - this.ax, ny = this.hy - this.ay;
      let d = Math.hypot(nx, ny) || 1;
      nx /= d; ny /= d;
      this.vy += G.gravity * dt;
      if (this.shot >= 1) {
        const tx = ny * this.dir, ty = -nx * this.dir; // tangent toward the swing direction
        const ahead = (this.hx - this.ax) * this.dir;
        // the pump fades out smoothly as the hip swings past the anchor (no jolt when it stops)
        const k = clamp((this.len * 0.35 - ahead) / (this.len * 0.5), 0, 1);
        if (k > 0 && (held || this.t < G.maxAuto || this.hang > 0)) { const pk = G.pump * k * k * (3 - 2 * k); this.vx += tx * pk * dt; this.vy += ty * pk * dt; }
        const ax = w.moveAxis;
        if (ax !== 0) { this.vx += ny * ax * G.steer * dt; this.vy += -nx * ax * G.steer * dt; }
      }
      this.hx += this.vx * dt; this.hy += this.vy * dt;
      // while the hook is still flying the rope pays out (no snap when it bites)
      if (this.shot < 1) this.len = Math.max(this.len, Math.hypot(this.hx - this.ax, this.hy - this.ay));
      // reel toward the wanted length: eased in (a soft pull, not a yank); the zip-up hang winches at full speed
      const fast = this.hang > 0 || this.lenT <= G.minLen * s + 1;
      const reel = (fast ? G.reelUp : G.reel) * dt;
      const want = this.lenT - this.len;
      this.len += clamp(fast ? want : want * Math.min(1, 7 * dt), -reel, reel);
      // the rope reels in its own slack once the hook has bitten (like a web retracting), so the hero rides
      // one continuous arc instead of falling free and snapping taut
      if (this.shot >= 1 && this.hang === 0) { const dd = Math.hypot(this.hx - this.ax, this.hy - this.ay); if (dd < this.len) this.len = Math.max(G.minLen * s, dd); }
      // rope: never longer than len
      nx = this.hx - this.ax; ny = this.hy - this.ay; d = Math.hypot(nx, ny) || 1;
      // a slightly elastic rope: it catches the hero over a few substeps instead of snapping taut
      const grip = Math.min(1, this.bite / 6);
      if (d > this.len && this.shot >= 1) { const L = this.len + (d - this.len) * (1 - 0.55 * grip); this.hx = this.ax + (nx / d) * L; this.hy = this.ay + (ny / d) * L; }
      // a hang is a winch: it stops at its length instead of flinging the hero past the anchor
      else if (this.hang > 0 && this.len <= this.lenT + 1 && d < this.lenT) { this.hx = this.ax + (nx / d) * this.lenT; this.hy = this.ay + (ny / d) * this.lenT; }
      // the floor: skim it and take the slack out of the rope; never through the roof
      if (this.hy > maxHipY) { this.hy = maxHipY; const fl = Math.hypot(this.hx - this.ax, this.hy - this.ay); this.lenT = Math.min(this.lenT, fl); if (this.shot >= 1) this.len = Math.min(this.len, fl); }
      if (this.hy < minHipY) { this.hy = minHipY; this.vx *= 0.9; }
      this.hx = clamp(this.hx, WALL_L, WALL_R);
      this.vx = (this.hx - ox) / dt; this.vy = (this.hy - oy) / dt;
      // a taut rope only lets the hip move along the arc: reeling in never turns into a fling
      nx = this.hx - this.ax; ny = this.hy - this.ay; d = Math.hypot(nx, ny) || 1;
      if (this.shot >= 1 && d >= Math.min(this.len, this.hang > 0 ? this.lenT : this.len) - 0.5) {
        nx /= d; ny /= d;
        const vr = this.vx * nx + this.vy * ny;
        // outward speed is soaked up gradually (the stretch), inward speed (reeling) is removed outright
        const keep = vr > 0 ? 0.35 : 0;
        const g2 = Math.min(1, this.bite / 6);
        this.vx -= nx * vr * (1 - keep) * g2; this.vy -= ny * vr * (1 - keep) * g2;
      }
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > G.maxSpeed) { this.vx *= G.maxSpeed / sp; this.vy *= G.maxSpeed / sp; }
    }
    // Swung into a wall: stick to it.
    const wallSide = this.hx <= WALL_L + 1 ? -1 : this.hx >= WALL_R - 1 ? 1 : 0;
    if (wallSide !== 0 && this.t > 4) { this.side = wallSide; this.mark(false); this.cling(w, p); return; }
    if (this.hang > 0) { this.hang--; if (this.hang === 0 && !held) this.drop(p); return; }
    if (this.t < 6) return;
    // Held: keep swinging (back and forth) up to maxHold, the pump following the motion.
    if (held && this.t < G.maxHold) {
      if (Math.abs(this.vx) > 90 && this.vy > 0) this.dir = this.vx > 0 ? 1 : -1;
      return;
    }
    const ahead = (this.hx - this.ax) * this.dir;
    if ((ahead > this.len * G.releaseAt && this.vy < 0) || this.vx * this.dir < -60 || this.t >= G.maxAuto || this.t >= G.maxHold) this.release(w, p);
  }

  private tickZip(w: World, p: Fighter): void {
    const s = p.scale;
    const tx = this.side > 0 ? WALL_R - 22 * s : WALL_L + 22 * s, ty = this.ay + 30 * s;
    const dx = tx - this.hx, dy = ty - this.hy, d = Math.hypot(dx, dy) || 1;
    if (this.shot < 1) { // the hook is still flying: drift
      this.vy += 900 / 60; this.hx += this.vx / 60; this.hy = Math.min(WORLD.groundY - G.hipH * s, this.hy + this.vy / 60);
      return;
    }
    const sp = Math.min(G.zipSpeed, Math.hypot(this.vx, this.vy) + 260);
    this.vx = (dx / d) * sp; this.vy = (dy / d) * sp;
    const step = sp / 60;
    if (d <= step) { this.hx = tx; this.hy = ty; this.cling(w, p); return; }
    this.hx += this.vx / 60; this.hy += this.vy / 60;
    if (this.t > 70) this.drop(p); // safety: never zip forever
  }

  private cling(w: World, p: Fighter): void {
    const s = p.scale;
    this.phase = 'cling';
    this.hx = this.side > 0 ? WALL_R - 22 * s : WALL_L + 22 * s;
    this.hx = clamp(this.hx, WALL_L, WALL_R);
    this.ax = this.side > 0 ? WALL_FACE_R : WALL_FACE_L;
    this.ay = this.hy - 46 * s;
    this.vx = 0; this.vy = 0; this.t = 0;
    p.setState('cling');
    w.events.emit('v2fx', { kind: 'gCling', x: this.ax, y: this.hy, a: 1 });
  }

  private tickCling(_w: World, p: Fighter): void {
    const s = p.scale;
    // slide down slowly, then faster, then let go
    this.vy = this.t < G.clingSlip ? G.clingSlide : G.clingSlide + (this.t - G.clingSlip) * 6;
    this.hy += this.vy / 60;
    this.ay = this.hy - 46 * s;
    if (this.hy >= WORLD.groundY - G.hipH * s) {
      this.hy = WORLD.groundY - G.hipH * s;
      p.x = this.hx; p.y = WORLD.groundY; p.vx = 0; p.vy = 0;
      this.off(p); p.grounded = true; p.facing = -this.side;
      p.setState('land', 6);
      return;
    }
    if (this.t >= G.clingMax) this.drop(p);
  }

  /** Swinging / zipping through an enemy kicks it (once per rope). */
  private kicks(w: World, p: Fighter): void {
    const sp = Math.hypot(this.vx, this.vy);
    if (sp < G.kickSpeed || this.shot < 1) return;
    const m = MOVES.hk3_kick;
    if (!m) return;
    const r = G.kickR * p.scale;
    for (const e of w.enemies) {
      if (!e.canBeHit || p.alreadyHit(e.id) || p.hitCount >= 8) continue;
      const dx = e.cx - this.hx, dy = e.cy - (this.hy + 20 * p.scale);
      const er = 26 * e.scale;
      if (dx * dx + dy * dy > (r + er) * (r + er)) continue;
      p.markHit(e.id);
      p.facing = this.vx >= 0 ? 1 : -1;
      playerHit(w, m, e, p.hitCount > 1);
      // a hit bleeds a little speed (hit-stop does the rest)
      this.vx *= 0.82; this.vy *= 0.82;
    }
  }
}
