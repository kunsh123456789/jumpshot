import type { World } from './world';
import type { Fighter } from './fighter';
import { MOVES, MOVE_MAP, dirClass, dirSignX, type MoveDef, type MoveTag } from '../data/moves';
import { INPUT, MOVE, PHYS, PLAYER, SUPER, WORLD } from '../data/tuning';
import type { SwipeEvent } from '../ui/pad';
import { clamp, ease } from '../core/math';
import { overlaps, playerHit, sideHit } from './combat';
import { airGravity } from './physics';

interface Buffered { ev: SwipeEvent; age: number; heavy: boolean; used: boolean }

const DIR_VX = [1, 0.707, 0, -0.707, -1, -0.707, 0, 0.707];
const DIR_VY = [0, -0.707, -1, -0.707, 0, 0.707, 1, 0.707];

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

  constructor() {
    for (let i = 0; i < 8; i++) this.pool.push({ ev: null as unknown as SwipeEvent, age: 0, heavy: false, used: false });
  }

  reset(): void { this.buf.length = 0; this.lastMove = null; this.lastMoveFrame = -999; }

  /** Ingest this tick's swipes. */
  ingest(w: World, inputs: SwipeEvent[]): void {
    const p = w.player;
    for (const ev of inputs) {
      if (ev.kind === 'upgrade') {
        // Upgrade a buffered swipe or the move it just started.
        let done = false;
        for (const b of this.buf) if (b.ev.segId === ev.segId) { b.heavy = true; done = true; }
        if (!done && p.state === 'move' && p.move && p.strokeId === ev.segId) this.upgradeCurrent(w);
        continue;
      }
      let b: Buffered;
      if (this.buf.length >= INPUT.bufferSize) {
        b = this.buf[this.buf.length - 1]; // replace the tail with the newest intent
      } else {
        b = this.pool.pop() ?? { ev, age: 0, heavy: false, used: false };
        this.buf.push(b);
      }
      b.ev = ev; b.age = 0; b.heavy = ev.heavy; b.used = false;
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
    const cancelStart = p.move ? p.effStartup + p.move.cancelFrom - w.stats.cancelEarly : 0;
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
      case 'jumpFollow':
        if (p.vy > 0) p.setState('fall');
        break;
    }
    this.locomotion(w);
    this.physics(w);
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
      case 'dodge':
        return p.stateFrame >= 6;
      case 'move': {
        const m = p.move!;
        const start = p.effStartup + m.cancelFrom - this.cancelEarly;
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
  private cancelEarly = 0;
  /** The input whose tryExecute is starting a move (Rhythm Mode binds its judgement). */
  private curEv: SwipeEvent | null = null;

  private tryExecute(w: World, b: Buffered): boolean {
    const p = w.player;
    this.cancelEarly = w.stats.cancelEarly;
    if (b.ev.kind === 'tap') {
      if (!this.canAct(p, null, true)) return false;
      this.startDodge(w);
      if (w.rhythm) w.rhythm.onTap(w, b.ev);
      return true;
    }
    const plan = this.resolve(w, b.ev.dir, b.heavy);
    if (!plan) return false;
    if (!this.canAct(p, plan.move.tags, false)) return false;
    this.curEv = b.ev;
    this.startMove(w, plan.move, plan.target, b.ev.dir, plan.crossUp, b.ev.segId);
    this.curEv = null;
    return true;
  }

  private resolve(w: World, dir: number, heavy: boolean): { move: MoveDef; target: Fighter | null; crossUp: boolean } | null {
    const p = w.player;
    const combo = w.combo;
    const dc = dirClass(dir);
    const airborne = !p.grounded;
    const target = this.selectTarget(w, dir);

    // Specials (cost super meter).
    if (combo.superMeter >= SUPER.finisherCost) {
      if (airborne && (dc === 'down' || dc === 'downDiag') && combo.launcherUsed && combo.airJuggle >= SUPER.jumpshotMinJuggle && target) {
        return { move: MOVES.jumpshotFinisher, target, crossUp: false };
      }
      if (heavy && combo.hits >= SUPER.flurryMinCombo && target) {
        return { move: MOVES.flurry, target, crossUp: false };
      }
    }

    let useAir = airborne;
    // Airborne but low, chasing a grounded target: drop into a ground move instead.
    if (airborne && target && target.grounded && p.height < 140) useAir = false;
    if (!airborne && target && dc !== 'down') {
      const h = target.height;
      if (dc === 'up' ? h > 150 : h > PLAYER.airborneHeight) useAir = true;
    }
    const set = useAir ? MOVE_MAP.air : MOVE_MAP.ground;
    let id: string = set[dc][heavy ? 'heavy' : 'light'];
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
    const range = PLAYER.targetRange * w.stats.dashRange;
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
    if (m.tags.includes('special')) {
      if (m.id === 'jumpshotFinisher' || m.id === 'flurry') {
        w.combo.superMeter -= SUPER.finisherCost;
        w.combo.finishers++;
        if (w.stats.finisherHeal > 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * w.stats.finisherHeal);
        w.events.emit('finisher', { kind: m.id === 'flurry' ? 'flurry' : 'jumpshot', x: p.x, y: p.cy });
      }
    }

    // Facing.
    if (target) {
      const side = Math.sign(target.x - p.x) || p.facing;
      p.facing = crossUp ? -side : side;
    } else {
      const sx = dirSignX(dir);
      if (sx !== 0) p.facing = sx;
    }

    // Attack magnetism: dash/air-dash so the strike lands as the dash ends.
    p.dashFrames = 0;
    p.dashFromX = p.x; p.dashFromY = p.y;
    const isAir = m.tags.includes('air');
    if (target && m.dash) {
      this.computeDashTarget(p, m, target, isAir);
      const ddx = p.dashToX - p.x, ddy = p.dashToY - p.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist > PLAYER.dashMinDistance || (isAir && dist > 4)) {
        const perFrame = (PLAYER.dashSpeed * Math.max(1, w.stats.dashRange * 0.85)) / 60;
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
    p.effStartup = Math.max(m.startup, p.dashFrames);
    // Hang an airborne target briefly while we wind up (decays with juggle depth).
    if (target && !target.grounded && target.alive) {
      const fin = m.id === 'jumpshotFinisher';
      const pre = fin ? p.effStartup + 8 : Math.round(p.effStartup * Math.max(0, 1 - target.juggleHits * 0.1 * w.stats.juggleDecayMult));
      if (pre > target.stall) {
        target.stall = pre;
        if (target.vy > 0 || fin) target.vy *= fin ? 0 : 0.3;
        if (fin) target.vx = 0;
      }
    }
    if (isAir || !p.grounded) { p.stall = Math.max(p.stall, p.effStartup + m.active); }
    else p.vx = 0;
    if (w.rhythm) w.rhythm.onMoveStart(w, p, this.curEv, false);
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

  private upgradeCurrent(w: World): void {
    const p = w.player;
    const m = p.move!;
    if (p.moveFrame >= p.effStartup - 1 || p.moveHit || m.tags.includes('heavy') || m.tags.includes('special')) return;
    const set = m.tags.includes('air') ? MOVE_MAP.air : MOVE_MAP.ground;
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
    const m = p.move!;
    const fr = p.moveFrame;
    const S = p.effStartup;

    // Launcher follow: leap after the launched enemy as soon as hit-stop ends.
    if (m.follow && p.moveHit && p.followTarget && fr >= S + 1) {
      const t = p.followTarget;
      p.move = null;
      p.setState('jumpFollow');
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
          this.checkHits(w, m, true);
          if (p.multiHitDone >= m.multiHit.count && m.multiHit.then) {
            const next = MOVES[m.multiHit.then];
            const t = p.target;
            this.startMove(w, next, t && t.alive ? t : null, p.facing > 0 ? 0 : 4, false, -1);
            return;
          }
        }
      } else {
        this.checkHits(w, m, false);
      }
    }

    p.moveFrame++;
    if (p.moveFrame >= S + m.active + m.recovery) {
      p.move = null;
      p.setState(p.grounded ? 'idle' : 'fall');
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
  private startDodge(w: World): void {
    const p = w.player;
    p.move = null;
    p.setState('dodge', PLAYER.dodgeFrames);
    p.invuln = Math.max(p.invuln, PLAYER.dodgeInvulnFrames);
    p.parryWindow = PLAYER.parryWindowFrames + w.stats.parryWindowBonus;
    p.dodgeHit = 0;
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
    p.dodgeToX = clamp(p.x + away * PLAYER.dodgeDistance, WORLD.wallMargin, WORLD.arenaW - WORLD.wallMargin);
    if (!p.grounded) { p.vy = Math.min(p.vy, -120); p.stall = 10; }
    p.vx = 0;
    w.events.emit('dodge', { x: p.x, y: p.cy });
    w.events.emit('afterimage', { fighter: p });
  }

  private updateDodge(w: World): void {
    const p = w.player;
    const t = ease.outCubic(Math.min(1, p.stateFrame / (PLAYER.dodgeFrames - 2)));
    p.x = p.dodgeFromX + (p.dodgeToX - p.dodgeFromX) * t;
    if ((p.stateFrame & 1) === 0 && p.stateFrame < 8) w.events.emit('afterimage', { fighter: p });
    // Afterburn: damage enemies you pass through.
    if (w.stats.dodgeStrike > 0 && p.dodgeHit < 3) {
      for (const e of w.enemies) {
        if (e.canBeHit && Math.abs(e.x - p.x) < 30 && !p.alreadyHit(e.id)) {
          p.markHit(e.id); p.dodgeHit++;
          sideHit(w, e, w.stats.dodgeStrike, p.facing, -200, 'shock', 120);
        }
      }
    }
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
    const dashing = p.state === 'move' && p.dashFrames > 0 && p.moveFrame <= p.dashFrames;
    const hanging = p.state === 'move' && p.move !== null && !p.grounded && p.moveFrame < p.effStartup;
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
        p.vy = 0;
        p.stallCount = 0;
        p.followTarget = null;
        w.combo.onPlayerLanded();
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
  }
}
