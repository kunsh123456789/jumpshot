import type { World } from './world';
import type { Fighter } from './fighter';
import { DIR_VX, DIR_VY, MOVES, dirClass, dirSignX, type MoveDef, type MoveTag } from '../data/moves';
import { CINE, INPUT, MOVE, PHYS, PLAYER, WORLD } from '../data/tuning';
import { airFinisher } from '../data/cines';
import type { SwipeEvent } from '../ui/pad';
import { clamp, ease } from '../core/math';
import { overlaps, playerHit } from './combat';
import { airGravity } from './physics';
import { WEAPON_T } from '../data/weapons/tuning';

interface Buffered { ev: SwipeEvent; age: number; heavy: boolean; used: boolean }


/**
 * Turns swipe intents into moves: input buffer, auto-targeting, attack
 * magnetism (dash/air-dash), cancel windows, strings, specials and dodge/parry.
 */
export class PlayerController {
  private buf: Buffered[] = [];
  private pool: Buffered[] = [];
  lastMove: MoveDef | null = null;
  lastMoveFrame = -999;
  /** Frame index the most recent move began (latency measurement). */
  lastCommitFrame = -1;
  lastStartFrame = -1;
  latency = 0;
  /** Debug: buffer description. */
  bufDesc = '';
  /** Mid-air jumps left, and the frame of the last tap (double-tap = dodge when tap jumps). */
  private airJumps = PLAYER.airJumps;
  private lastTap = -999;

  constructor() {
    for (let i = 0; i < 8; i++) this.pool.push({ ev: null as unknown as SwipeEvent, age: 0, heavy: false, used: false });
  }

  reset(): void { this.buf.length = 0; this.lastMove = null; this.lastMoveFrame = -999; }

  /** Ingest this tick's swipes. */
  ingest(w: World, inputs: SwipeEvent[]): void {
    const p = w.player;
    // Cinematics take no input (any input skips a KO finisher).
    if (w.cine.active) {
      if (inputs.length > 0 && w.cine.kind === 'ko') w.cine.skip();
      return;
    }
    if (w.special.busy) return;
    for (const ev of inputs) {
      if (ev.kind === 'promote') {
        // Promote a buffered swipe, or the move it just started, to heavy.
        let done = false;
        for (const b of this.buf) if (b.ev.segId === ev.segId) { b.heavy = true; done = true; }
        if (!done && p.state === 'move' && p.move && p.strokeId === ev.segId) this.promoteCurrent(w);
        continue;
      }
      p.idleFrames = 0;
      // Long-press: the Special (never buffered as an attack).
      if (ev.kind === 'hold') { w.special.request(w, ev); continue; }
      let b: Buffered;
      if (this.buf.length >= INPUT.bufferSize) {
        b = this.buf[this.buf.length - 1]; // replace the tail with the newest intent
      } else {
        b = this.pool.pop() ?? { ev, age: 0, heavy: false, used: false };
        this.buf.push(b);
      }
      b.ev = ev; b.age = 0; b.heavy = ev.heavy; b.used = false;
      // Tap = jump: a second tap soon after (or Shift+Space / F, sent as a heavy tap) dodges & parries instead.
      if (ev.kind === 'tap' && w.tapJump) {
        if (w.frame - this.lastTap <= INPUT.doubleTapFrames) b.heavy = true;
        this.lastTap = w.frame;
      }
      this.lastCommitFrame = w.frame;
    }
  }

  update(w: World): void {
    const p = w.player;
    if (p.critTimer > 0) { p.critTimer--; if (p.critTimer === 0 && p.telegraph < 0) p.telegraph = 0; }
    if (p.hitstop > 0) { p.hitstop--; return; }
    if (p.invuln > 0) p.invuln--;
    if (p.parryWindow > 0) p.parryWindow--;
    if (p.flash > 0) p.flash--;

    // Age the buffer only while the player could act: never during hit-stop (above)
    // or while committed to a move before its cancel window, so long dashes and
    // heavy startups never eat a queued swipe.
    const cancelStart = p.move ? p.effStartup + p.move.cancelFrom : 0;
    const committed = (p.state === 'move' && p.moveFrame < cancelStart) || p.state === 'hurt' || (p.state === 'dodge' && p.stateFrame < 6);
    if (!committed) {
      for (let i = this.buf.length - 1; i >= 0; i--) {
        if (++this.buf[i].age > INPUT.bufferFrames) this.release(i);
      }
    }
    this.bufDesc = this.buf.map((b) => (b.ev.kind === 'tap' ? 'TAP' : ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'][b.ev.dir] + (b.heavy ? '!' : '')) + ':' + b.age).join(' ');

    // Try to act on the oldest buffered intent.
    if (this.buf.length > 0 && p.alive) {
      const b = this.buf[0];
      if (this.tryExecute(w, b)) this.release(0);
    }

    p.stateFrame++;
    switch (p.state) {
      case 'move': this.updateMove(w); break;
      case 'dodge': this.updateDodge(w); break;
      case 'hurt':
        if (--p.timer <= 0) p.setState(p.grounded ? 'idle' : 'fall');
        break;
      case 'land':
        if (--p.timer <= 0) p.setState('idle');
        break;
      case 'jumpSquat':
        if (--p.timer <= 0) this.takeOff(w);
        break;
      case 'jumpFollow':
        // Variable height: keep rising while the finger keeps dragging up (or the key stays held).
        // The boost behaves as if the jump had left the floor at the charged speed: target speed
        // minus the gravity accumulated since take-off (so it never over-extends the rise).
        if (p.jumpBoost > 0 && p.vy < 0) {
          p.jumpBoost--;
          const v0 = PLAYER.jumpVelMin + (PLAYER.jumpVelMax - PLAYER.jumpVelMin) * w.jumpCharge;
          const v = v0 + (PHYS.gravity * p.airFrames) / 60;
          if (v < p.vy) p.vy = v;
        }
        // Weapon slow-mo at the apex of the follow leap (staff vault).
        if (w.wpn.apexMoment && p.vy > -120) {
          const s = w.wpn.apexMoment; w.wpn.apexMoment = null;
          w.events.emit('weaponMoment', { scale: s.scale, sec: s.sec, x: p.x, y: p.cy });
        }
        if (p.vy > 0) p.setState('fall');
        break;
    }
    this.locomotion(w);
    this.physics(w);
    if (p.grounded) { p.airFrames = 0; if (p.state !== 'jumpSquat') p.jumpKind = 'none'; } else p.airFrames++;
    p.drift = p.grounded ? 0 : w.moveAxis * p.facing;
    p.crouch = p.grounded && w.crouch && (p.state === 'idle' || p.state === 'walk');
    p.idleFrames++;
  }

  private release(i: number): void {
    const b = this.buf[i];
    this.buf.splice(i, 1);
    this.pool.push(b);
  }

  // ---------------------------------------------------------------------
  private canAct(p: Fighter, tags: MoveTag[] | null, tap: boolean): boolean {
    switch (p.state) {
      case 'idle': case 'land': case 'fall': case 'jumpFollow': case 'walk':
        return true;
      case 'jumpSquat':
        return false;
      case 'dodge':
        return p.stateFrame >= 6;
      case 'move': {
        const m = p.move!;
        const start = p.effStartup + m.cancelFrom;
        if (p.moveFrame < start) return false;
        if (p.hitstop > 0) return false;
        if (tap) return m.cancelInto.includes('dodge');
        if (!tags) return false;
        for (const t of tags) if (m.cancelInto.includes(t)) return true;
        return false;
      }
      default:
        return false;
    }
  }
  /** The input whose tryExecute is starting a move (Rhythm Mode binds its judgement). */
  private curEv: SwipeEvent | null = null;

  private tryExecute(w: World, b: Buffered): boolean {
    const p = w.player;
    if (b.ev.kind === 'jump') {
      if (!this.canAct(p, null, true)) return false;
      this.jump(w, true);
      return true;
    }
    if (b.ev.kind === 'tap') {
      if (!this.canAct(p, null, true)) return false;
      if (w.tapJump && !b.heavy) { this.jump(w, false); return true; }
      this.startDodge(w);
      if (w.rhythm) w.rhythm.onTap(w, b.ev);
      return true;
    }
    // Air Finisher: a down swipe in the air after a 5+ hit air juggle (once per air combo).
    const d = b.ev.dir;
    if (!p.grounded && (d === 5 || d === 6 || d === 7) && w.combo.airJuggle >= CINE.airMinJuggle && !w.combo.airFinisherUsed && this.canAct(p, ['air', 'down'], false)) {
      // the juggled enemy: the nearest airborne one in range (the swipe's own target if it is airborne)
      let t = this.selectTarget(w, d);
      if (!t || t.grounded || !t.alive) {
        t = null; let bd: number = PLAYER.targetRange;
        for (const e of w.enemies) { if (!e.alive || e.grounded || e.remove || e.state === 'ko') continue; const dd = Math.hypot(e.x - p.x, e.cy - p.cy); if (dd < bd) { bd = dd; t = e; } }
      }
      if (t && t.alive && !t.grounded && t.state !== 'ko') {
        w.combo.airFinisherUsed = true;
        w.combo.finishers++;
        w.cine.start(w, airFinisher(w.weapon.id), 'air', t, []);
        return true;
      }
    }
    const plan = this.resolve(w, b.ev.dir, b.heavy);
    if (!plan) return false;
    if (!this.canAct(p, plan.move.tags, false)) return false;
    this.curEv = b.ev;
    this.startMove(w, plan.move, plan.target, b.ev.dir, plan.crossUp || (!!plan.move.behind && !!plan.target), b.ev.segId);
    this.curEv = null;
    return true;
  }

  private resolve(w: World, dir: number, heavy: boolean): { move: MoveDef; target: Fighter | null; crossUp: boolean } | null {
    const p = w.player;
    const dc = dirClass(dir);
    const airborne = !p.grounded;
    const target = this.selectTarget(w, dir);


    let useAir = airborne;
    // Airborne but low, chasing a grounded target: drop into a ground move instead.
    if (airborne && target && target.grounded && p.height < 140) useAir = false;
    if (!airborne && target && dc !== 'down') {
      const h = target.height;
      if (dc === 'up' ? h > 150 : h > PLAYER.airborneHeight) useAir = true;
    }
    const wp = w.weapon;
    const set = useAir ? wp.air : wp.ground;
    let id: string = set[dc][heavy ? 'heavy' : 'light'];
    // Overheated: every swipe is the weapon's melee bash until it cools.
    if (wp.heat && w.wpn.overheat > 0) id = wp.heat.bash;
    // Auto-strings: repeating the same input advances the string.
    const last = this.lastMove;
    if (last && last.next && MOVES[id].family === last.family && w.frame - this.lastMoveFrame < 48) id = last.next;
    const move = MOVES[id];

    // Shield cross-up: swiping away from a guarding shield vaults behind it.
    let crossUp = false;
    if (target && target.def?.blocksFront && target.guardBroken <= 0 && !useAir) {
      const sx = dirSignX(dir);
      if (sx !== 0 && sx === Math.sign(p.x - target.x)) crossUp = true;
    }
    return { move, target, crossUp };
  }

  /** Nearest enemy in a wide cone around the swipe, with fallbacks. */
  selectTarget(w: World, dir: number): Fighter | null {
    const p = w.player;
    const range = w.weapon.range ?? PLAYER.targetRange;
    const cone = (PLAYER.targetConeDeg * Math.PI) / 180;
    const dx = DIR_VX[dir], dy = DIR_VY[dir];
    const sx = dirSignX(dir);
    let best: Fighter | null = null, bestScore = Infinity;
    let side: Fighter | null = null, sideScore = Infinity;
    let any: Fighter | null = null, anyScore = Infinity;
    const sticky = p.followTarget;
    for (const e of w.enemies) {
      if (!e.alive || e.state === 'ko' || e.state === 'dead') continue;
      const vx = e.x - p.x, vy = e.cy - p.cy;
      const d = Math.sqrt(vx * vx + vy * vy);
      if (d > range) continue;
      let score = d;
      if (e === sticky && !e.grounded) score *= 0.45;
      if (!p.grounded && !e.grounded) score *= 0.7;
      if (e.state === 'windup') score *= 0.85; // prefer the threat
      const ang = d < 1 ? 0 : Math.acos(clamp((vx * dx + vy * dy) / d, -1, 1));
      if (ang <= cone) {
        const s2 = score * (1 + ang * 0.6);
        if (s2 < bestScore) { bestScore = s2; best = e; }
      }
      if (sx !== 0 && Math.sign(vx) === sx && score < sideScore) { sideScore = score; side = e; }
      if (score < anyScore) { anyScore = score; any = e; }
    }
    return best ?? side ?? any;
  }

  // ---------------------------------------------------------------------
  startMove(w: World, m: MoveDef, target: Fighter | null, dir: number, crossUp: boolean, strokeId: number): void {
    const p = w.player;
    const prev = p.move;
    if (prev) w.wpn.endMove(p);
    // Starting anything else calls a thrown weapon back to the hand (except the throw itself).
    if (!m.toss) w.wpn.recall(p);
    p.move = m;
    p.moveSerial++;
    p.setState('move');
    p.moveFrame = 0;
    p.hitCount = 0;
    p.multiHitDone = 0;
    p.moveHit = false;
    p.strokeId = strokeId;
    p.target = target;
    p.crossUp = crossUp;
    p.followTarget = target && !target.grounded ? target : p.followTarget;
    this.lastMove = m;
    this.lastMoveFrame = w.frame;
    this.lastStartFrame = w.frame;
    this.latency = w.frame - this.lastCommitFrame;
    w.combo.noteMove(m.family);

    // Facing.
    if (target) {
      const side = Math.sign(target.x - p.x) || p.facing;
      p.facing = crossUp ? -side : side;
    } else {
      const sx = dirSignX(dir);
      if (sx !== 0) p.facing = sx;
    }

    // Weapon moves aim along the swipe (auto-aimed onto the target inside the move's cone).
    if (m.beam || m.grab || m.tether || m.aimCone) w.wpn.aim(p, m, dir, target);

    // Attack magnetism: dash/air-dash so the strike lands as the dash ends.
    p.dashFrames = 0;
    p.dashFromX = p.x; p.dashFromY = p.y;
    const isAir = m.tags.includes('air');
    if (target && m.dash) {
      this.computeDashTarget(p, m, target, isAir);
      const ddx = p.dashToX - p.x, ddy = p.dashToY - p.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist > PLAYER.dashMinDistance || (isAir && dist > 4)) {
        const perFrame = PLAYER.dashSpeed / 60;
        p.dashFrames = clamp(Math.ceil(dist / perFrame), 2, isAir ? PLAYER.airDashMaxFrames : PLAYER.dashMaxFrames);
        if (isAir && p.grounded) { p.grounded = false; }
        w.events.emit('afterimage', { fighter: p });
      }
    } else if (!target && p.grounded && m.travel === 0) {
      // Whiff: small step forward.
      p.dashToX = p.x + p.facing * PLAYER.whiffStep; p.dashToY = p.y;
      p.dashFrames = 3;
    }
    if (prev && prev !== m && p.dashFrames === 0) {
      // keep tiny momentum continuity on cancels
      p.vx *= 0.3;
    }
    p.effStartup = Math.max(m.startup, p.dashFrames + (m.grab ? m.grab.hold : 0));
    // Hang an airborne target briefly while we wind up (decays with juggle depth).
    if (target && !target.grounded && target.alive) {
      const fin = false;
      const pre = fin ? p.effStartup + 8 : Math.round(p.effStartup * Math.max(0, 1 - target.juggleHits * 0.1));
      if (pre > target.stall) {
        target.stall = pre;
        if (target.vy > 0 || fin) target.vy *= fin ? 0 : 0.3;
        if (fin) target.vx = 0;
      }
    }
    if ((isAir || !p.grounded) && !(m.grab && !target)) { p.stall = Math.max(p.stall, p.effStartup + m.active); }
    else p.vx = 0;
    if (w.rhythm) {
      w.rhythm.onMoveStart(w, p, this.curEv, false);
      // A Perfect-timed laser shot vents heat.
      if (m.heat && w.weapon.heat && w.rhythm.moveGrade() === 3) w.wpn.vent(w.weapon.heat.perfectVent);
    }
  }

  private computeDashTarget(p: Fighter, m: MoveDef, t: Fighter, isAir: boolean): void {
    const s = p.scale;
    let reach = m.reach * s;
    if (m.aoe > 0) reach = Math.min(reach, Math.abs(t.x - p.x));
    // Facing always points at the target (after a cross-up it points back at it).
    p.dashToX = clamp(t.x - p.facing * reach, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    if (isAir) {
      // Put the hitbox height on the target's center.
      p.dashToY = Math.min(WORLD.groundY, t.cy + m.hitbox.y * s);
    } else {
      p.dashToY = WORLD.groundY;
    }
  }

  private promoteCurrent(w: World): void {
    const p = w.player;
    const m = p.move!;
    if (p.moveFrame >= p.effStartup - 1 || p.moveHit || m.tags.includes('heavy') || m.tags.includes('special')) return;
    const set = m.tags.includes('air') ? w.weapon.air : w.weapon.ground;
    let heavyId: string | null = null;
    for (const k of Object.keys(set) as (keyof typeof set)[]) {
      const pair = set[k];
      if (pair.light === m.id || MOVES[pair.light].family === m.family) { heavyId = pair.heavy; break; }
    }
    if (!heavyId || heavyId === m.id) return;
    const h = MOVES[heavyId];
    // Seamless swap: keep elapsed frames and the dash; heavier startup stretches the anticipation.
    p.move = h;
    this.lastMove = h;
    p.effStartup = Math.max(h.startup, p.dashFrames, p.moveFrame + 2);
    if (p.dashFrames > 0 && p.target) this.computeDashTarget(p, h, p.target, h.tags.includes('air'));
    if (w.rhythm) w.rhythm.onMoveStart(w, p, null, true);
    w.events.emit('afterimage', { fighter: p });
  }

  private updateMove(w: World): void {
    const p = w.player;
    // Safety net: a 'move' state without a move must never reach the tick below.
    if (!p.move) { p.setState(p.grounded ? 'idle' : 'fall'); return; }
    if (w.rhythm && p.moveFrame < p.effStartup) w.rhythm.onMoveTick(w, p);
    const m = p.move!;
    const fr = p.moveFrame;
    const S = p.effStartup;
    w.wpn.tick(w, p, m);

    // Launcher follow: leap after the launched enemy as soon as hit-stop ends.
    if (m.follow && p.moveHit && p.followTarget && fr >= S + 1) {
      const t = p.followTarget;
      w.wpn.endMove(p);
      w.wpn.apexMoment = m.slowmo && m.slowmo.at === 'apex' ? m.slowmo : null;
      p.move = null;
      p.setState('jumpFollow');
      p.jumpKind = 'leap'; p.airFrames = 0;
      p.grounded = false;
      p.vy = Math.min(-700, t.vy * 0.97);
      p.vx = clamp((t.x - p.facing * 50 - p.x) * 3, -400, 400);
      p.stallCount = 0;
      p.stall = 0;
      w.events.emit('afterimage', { fighter: p });
      w.events.emit('whoosh', { x: p.x, y: p.cy, weight: 0.7, fighter: p });
      return;
    }

    // Dash / magnetism movement with homing.
    if (p.dashFrames > 0 && fr < p.dashFrames) {
      if (p.target && p.target.alive && m.dash) this.computeDashTarget(p, m, p.target, m.tags.includes('air'));
      // Ease-out velocity curve: fast launch, soft arrival (outQuad peaks at 2x average speed).
      const t = ease.outQuad((fr + 1) / p.dashFrames);
      p.x = p.dashFromX + (p.dashToX - p.dashFromX) * t;
      p.y = p.dashFromY + (p.dashToY - p.dashFromY) * t;
      if (p.y < WORLD.groundY - 1) p.grounded = false;
      if ((fr & 1) === 0) w.events.emit('afterimage', { fighter: p });
    }

    if (fr === S) {
      w.events.emit('whoosh', { x: p.x, y: p.cy, weight: m.weight, fighter: p });
      if (!p.grounded) { p.vy = Math.min(p.vy, 0); p.stall = Math.max(p.stall, m.active + 3); }
      if (m.afterimage) w.events.emit('afterimage', { fighter: p });
    }

    // Active frames.
    if (fr >= S && fr < S + m.active) {
      if (m.travel > 0) {
        p.x += (p.facing * m.travel) / m.active;
        if ((fr & 1) === 0) w.events.emit('afterimage', { fighter: p });
      }
      if (m.multiHit) {
        const k = Math.floor((fr - S) / m.multiHit.interval);
        if (k >= p.multiHitDone && p.multiHitDone < m.multiHit.count && (fr - S) % m.multiHit.interval === 0) {
          p.hitCount = 0;
          p.multiHitDone++;
          if (!(m.beam && w.wpn.contact(w, p, m, true))) this.checkHits(w, m, true);
          if (p.multiHitDone >= m.multiHit.count && m.multiHit.then) {
            const next = MOVES[m.multiHit.then];
            const t = p.target;
            this.startMove(w, next, t && t.alive ? t : null, p.facing > 0 ? 0 : 4, false, -1);
            return;
          }
        }
      } else if (m.beam || m.grab || m.tether || m.plant || m.toss || m.shoot || m.spikes) {
        // Weapon hooks resolve on the contact frame; a grab that caught nothing (or a swing) strikes normally.
        if (fr === S) { if (!w.wpn.contact(w, p, m, false)) this.checkHits(w, m, false); }
        else if ((m.grab && !p.moveHit) || m.tether?.mode === 'swing' || (m.plant && !m.beam)) this.checkHits(w, m, false);
      } else {
        this.checkHits(w, m, false);
      }
    }

    p.moveFrame++;
    if (p.moveFrame >= S + m.active + m.recovery) {
      w.wpn.endMove(p);
      p.move = null;
      p.setState(p.grounded ? 'idle' : 'fall');
      if (m.then) {
        const t = p.target;
        this.startMove(w, MOVES[m.then], t && t.alive ? t : null, p.facing > 0 ? 0 : 4, false, -1);
      }
    }
  }

  private checkHits(w: World, m: MoveDef, multi: boolean): void {
    const p = w.player;
    const s = p.scale;
    const hx = p.x + p.facing * m.hitbox.x * s;
    const hy = p.y - m.hitbox.y * s;
    const hr = m.hitbox.r * s;
    for (const e of w.enemies) {
      if (p.hitCount >= m.maxTargets) break;
      if (!e.canBeHit && !(e.state === 'getup' && m.launch !== 0)) continue;
      if (p.alreadyHit(e.id)) continue;
      let inRange: boolean;
      if (m.aoe > 0) {
        const dx = e.x - p.x;
        inRange = Math.abs(dx) <= m.aoe && e.height < 160;
      } else {
        inRange = overlaps(hx, hy, hr, e);
      }
      if (!inRange) continue;
      p.markHit(e.id);
      p.moveHit = true;
      playerHit(w, m, e, multi || p.hitCount > 0);
      if (m.aoe > 0 && e.alive) {
        // stomp pushes away from the player
        const dir = Math.sign(e.x - p.x) || p.facing;
        e.vx = dir * Math.abs(e.vx);
      }
    }
  }

  // ---------------------------------------------------------------------
  /**
   * Jump: from the ground a short anticipation crouch (jumpSquat) then take-off; in the air one
   * extra jump. A drag jump (`drag`) starts lower and grows while the finger keeps dragging up;
   * a tap jump is a fixed full jump. Air moves are available at once after take-off.
   */
  private jump(w: World, drag: boolean): void {
    const p = w.player;
    // No jump left in the air: do nothing, and above all keep the current attack. Cancelling the
    // move here without a new state left the hero in 'move' with no move (crash -> frozen game).
    if (!p.grounded && this.airJumps <= 0) return;
    if (p.move) w.wpn.endMove(p);
    p.move = null;
    if (p.grounded) {
      this.dragJump = drag;
      p.jumpKind = 'jump';
      p.vx *= 0.6;
      p.setState('jumpSquat', PLAYER.jumpSquatFrames);
      return;
    }
    if (this.airJumps <= 0) return;
    this.airJumps--;
    p.grounded = false;
    p.vy = PLAYER.airJumpVel;
    p.jumpKind = 'air';
    p.airFrames = 0;
    p.jumpBoost = 0;
    p.stall = 0; p.stallCount = 0;
    p.setState('jumpFollow');
    w.events.emit('jump', { x: p.x, y: p.y, air: true });
    w.events.emit('afterimage', { fighter: p });
  }
  private dragJump = false;

  /** Leave the ground after the jump squat. */
  private takeOff(w: World): void {
    const p = w.player;
    p.grounded = false;
    p.vy = this.dragJump ? PLAYER.jumpVelMin : PLAYER.jumpVel;
    p.jumpBoost = this.dragJump ? PLAYER.jumpBoostFrames : 0;
    p.vx += w.moveAxis * MOVE.airMax * 0.6;
    p.airFrames = 0;
    p.stall = 0; p.stallCount = 0;
    p.setState('jumpFollow');
    w.events.emit('jump', { x: p.x, y: p.y, air: false });
    w.events.emit('afterimage', { fighter: p });
  }

  private startDodge(w: World): void {
    const p = w.player;
    if (p.move) w.wpn.endMove(p);
    p.move = null;
    const D = w.weapon.dodge;
    p.dodgeLen = D.frames;
    p.setState('dodge', D.frames);
    p.invuln = Math.max(p.invuln, PLAYER.dodgeInvulnFrames);
    p.parryWindow = PLAYER.parryWindowFrames;
    // Dodge away from the nearest threat (or backwards).
    let threat: Fighter | null = null, td = Infinity;
    for (const e of w.enemies) {
      if (!e.alive) continue;
      const d = Math.abs(e.x - p.x) + (e.state === 'windup' || e.state === 'attack' ? -200 : 0);
      if (d < td) { td = d; threat = e; }
    }
    const away = threat ? (Math.sign(p.x - threat.x) || -p.facing) : -p.facing;
    if (threat) p.facing = -away;
    p.dodgeFromX = p.x;
    p.dodgeToX = clamp(p.x + away * D.distance, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    if (D.parry) p.parryWindow = D.parry;
    if (D.blink) { p.x = p.dodgeFromX = p.dodgeToX; w.events.emit('bossBlink', { x1: p.dodgeFromX - away * D.distance, x2: p.x, y: p.cy }); }
    if (D.rope) w.wpn.dodgeRope(p, p.dodgeToX);
    if (!p.grounded) { p.vy = Math.min(p.vy, -120); p.stall = 10; p.jumpKind = 'hop'; p.airFrames = 0; }
    p.vx = 0;
    w.events.emit('dodge', { x: p.x, y: p.cy });
    w.events.emit('afterimage', { fighter: p });
  }

  private updateDodge(w: World): void {
    const p = w.player;
    const t = ease.outCubic(Math.min(1, p.stateFrame / (p.dodgeLen - 2)));
    p.x = p.dodgeFromX + (p.dodgeToX - p.dodgeFromX) * t;
    if ((p.stateFrame & 1) === 0 && p.stateFrame < 8) w.events.emit('afterimage', { fighter: p });
    if (--p.timer <= 0) { p.hitCount = 0; p.setState(p.grounded ? 'idle' : 'fall'); }
  }

  /**
   * Drag-to-move locomotion. Only while free (idle/run/landing); during attacks,
   * dodges and hit-stun the held stick is ignored and resumes as soon as the
   * player is free. Smooth acceleration/deceleration feeds the run animation.
   */
  private locomotion(w: World): void {
    const p = w.player;
    const axis = w.moveAxis;
    const free = p.state === 'idle' || p.state === 'walk' || p.state === 'land';
    if (p.grounded && free) {
      let target = axis * MOVE.runSpeed;
      if (target !== 0) {
        // Soft clamp: slow down near the walls instead of hitting them.
        const dist = target > 0 ? WORLD.arenaW - WORLD.wallMargin - p.x : p.x - WORLD.wallMargin;
        const k = clamp(dist / MOVE.wallSoft, 0, 1);
        target *= k * k * (3 - 2 * k);
      }
      const speeding = target !== 0 && (p.vx === 0 || Math.sign(target) === Math.sign(p.vx)) && Math.abs(target) > Math.abs(p.vx);
      const rate = (speeding ? MOVE.accel : MOVE.decel) / 60;
      if (p.vx < target) p.vx = Math.min(target, p.vx + rate);
      else if (p.vx > target) p.vx = Math.max(target, p.vx - rate);
      if (axis !== 0) p.facing = axis > 0 ? 1 : -1;
      if (Math.abs(p.vx) > MOVE.runThreshold || axis !== 0) { if (p.state !== 'walk') p.setState('walk'); }
      else if (p.state === 'walk') p.setState('idle');
    } else if (!p.grounded && axis !== 0 && (p.state === 'fall' || p.state === 'jumpFollow')) {
      const nv = p.vx + (axis * MOVE.airAccel) / 60;
      if (Math.abs(nv) <= MOVE.airMax || Math.abs(nv) < Math.abs(p.vx)) p.vx = nv;
    }
  }

  // ---------------------------------------------------------------------
  private physics(w: World): void {
    const p = w.player;
    const dashing = (p.state === 'move' && p.dashFrames > 0 && p.moveFrame <= p.dashFrames) || w.wpn.ownsPlayer;
    // A grab that caught nothing doesn't hang in the air (no floating on whiffed air throws).
    const whiffGrab = p.move !== null && !!p.move.grab && !w.wpn.held && p.moveFrame >= p.dashFrames;
    const hanging = p.state === 'move' && p.move !== null && !p.grounded && p.moveFrame < p.effStartup && !whiffGrab;
    if (!p.grounded) {
      if (!dashing && !hanging) {
        const g = PHYS.gravity * airGravity(p);
        p.vy = Math.min(PHYS.maxFall, p.vy + g / 60);
        p.y += p.vy / 60;
        p.x += p.vx / 60;
        p.vx *= 0.96;
      } else if (hanging && !dashing) {
        // Ease into the air hang instead of stopping dead.
        p.vy *= 0.55; p.vx *= 0.7;
        p.y += p.vy / 60; p.x += p.vx / 60;
      }
      if (p.y >= WORLD.groundY) {
        p.y = WORLD.groundY;
        p.grounded = true;
        p.landVy = p.vy;
        if (p.vy >= PLAYER.hardLandVy || (p.move !== null && p.move.tags.includes('air') && p.move.tags.includes('down'))) { p.cue = 'hardLand'; p.cueSerial++; w.events.emit('groundImpact', { x: p.x, y: p.y, power: 0.6, fighter: p, bounce: false }); }
        p.vy = 0;
        p.stallCount = 0;
        p.followTarget = null;
        w.combo.onPlayerLanded();
        this.airJumps = PLAYER.airJumps;
        w.events.emit('groundImpact', { x: p.x, y: p.y, power: 0.25, fighter: p, bounce: false });
        p.anim.impulseSquash(0.12, -0.2);
        if (p.state === 'ko') p.setState('knockdown', 99999);
        else if (p.state === 'fall' || p.state === 'jumpFollow') p.setState('land', PLAYER.landingRecovery);
        else if (p.state === 'move' && p.move && p.move.tags.includes('air') && p.moveFrame >= p.effStartup + p.move.active) {
          p.move = null; p.setState('land', PLAYER.landingRecovery);
        }
      }
    } else {
      if (!dashing && p.state !== 'dodge') {
        p.x += p.vx / 60;
        const free = p.state === 'idle' || p.state === 'walk' || p.state === 'land';
        if (!free) {
          p.vx *= p.state === 'hurt' ? 0.88 : 0.75;
          if (Math.abs(p.vx) < 5) p.vx = 0;
        }
      }
      p.y = WORLD.groundY;
    }
    p.x = clamp(p.x, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    // Hard ceiling: chained air re-grabs/zips can't carry the hero (or what it holds) off the page.
    if (WORLD.groundY - p.y > WEAPON_T.heroMaxHeight) { p.y = WORLD.groundY - WEAPON_T.heroMaxHeight; if (p.vy < 0) p.vy = 0; }
  }
}
