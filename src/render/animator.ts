import { Ch, IS_ANGLE, JOINT_N, J, POSE_N, RIG, angDelta, computeJoints, type RigDims } from './rig';
import { ANIM, WORLD } from '../data/tuning';
import type { AnimDef } from '../data/anims/types';
import { animFlags, crossedKey, evalAnim, type AnimFlags } from './animPlayer';
import { ease } from '../core/math';

export const SCARF_N = 7;
/** Render-rate trail history capacity. */
export const TRAIL_CAP = 40;
const TAU = Math.PI * 2;

/** Global sound hook for keyframe sfx flags (set by the FX director). */
export let animSfx: (sfx: string, x: number, y: number) => void = () => {};
export function setAnimSfx(fn: (sfx: string, x: number, y: number) => void): void { animSfx = fn; }

/**
 * Pose-to-pose animator. Each sim tick the poser picks an authored animation
 * and a time; the animator evaluates it exactly (staggered leads, per-key
 * easing, holds). The only blending is a short snap-out crossfade from the
 * CURRENT pose when an animation is interrupted. No springs, no smoothing.
 * Rendering interpolates prevPose -> pose and runs FK at the display rate.
 */
export class Animator {
  readonly pose = new Float32Array(POSE_N);
  readonly prevPose = new Float32Array(POSE_N);
  /** Pose two ticks ago: the far end of a smear. */
  readonly prev2Pose = new Float32Array(POSE_N);
  private readonly from = new Float32Array(POSE_N);
  private readonly evalBuf = new Float32Array(POSE_N);
  readonly flags: AnimFlags = { smear: 0, trail: 0, impact: false, reachW: 0, snapping: false };

  cur: AnimDef | null = null;
  /** Current animation time (frames). */
  t = 0;
  private lastT = 0;
  /** Internal clock for looping / one-shot playback. */
  clock = 0;
  private fadeT = 0;
  private fadeDur = 0;
  clipName = 'none';
  lastTransition = '';
  clipAge = 0;
  /** Last move / hit instance seen (restarts the animation per instance). */
  moveSerial = -1;
  hitSerial = -1;
  cueSerial = -1;
  /** A dash is playing ahead of the strike animation. */
  pendingStrike = false;
  /** Keyframe sfx are played for this fighter (the player). */
  sfxEnabled = false;
  /** Extra head tilt toward the target (idle only). */
  headLook = 0;
  /** Locomotion sub-state (presentation only). */
  loco: 'none' | 'start' | 'run' | 'turn' | 'stop' = 'none';
  locoFacing = 1;
  lastSpeed = 0;
  /** Extra spin added on top of the animation (sim-driven tumble spin). */
  spinAdd = 0;
  spinBase = 0;
  /** Smear limbs this tick / last tick, reach weight, intentional-snap flag. */
  smear = 0;
  reachW = 0; prevReachW = 0;
  reachLimb = 0;
  intentSnap = false;
  rig: RigDims = RIG;

  // Facing turn.
  face = 1; prevFace = 1;
  private faceFrom = 1; private faceTarget = 1; private turnT = 1; private turnDur = 1;

  /** Sim-tick joints (afterimages, scarf anchor). */
  readonly joints = new Float32Array(JOINT_N * 2);

  // Scarf (controlled follow-through ribbon).
  readonly hasScarf: boolean;
  readonly scarf = new Float32Array(SCARF_N * 2);
  readonly scarfOld = new Float32Array(SCARF_N * 2);
  readonly scarfPrev = new Float32Array(SCARF_N * 2);
  scarfInit = false;

  // Motion trail (render-rate samples).
  trailActive = false;
  trailColor = '#fff';
  trailWidth = 10;
  trailJoint: number = J.handA;
  readonly trailX = new Float32Array(TRAIL_CAP);
  readonly trailY = new Float32Array(TRAIL_CAP);
  readonly trailT = new Float32Array(TRAIL_CAP);
  trailHead = 0;
  trailCount = 0;
  ghostTime = 0;
  ghostAcc = 0;

  // Pop-detector readings.
  maxAngDelta = 0;
  maxSpinDelta = 0;
  maxAngCh = 0;

  constructor(hasScarf = false) { this.hasScarf = hasScarf; }

  private switchTo(def: AnimDef, fade: number): void {
    this.lastTransition = `${this.clipName}→${def.id}`;
    this.clipName = def.id;
    this.clipAge = 0;
    this.cur = def;
    // Full turns are identical: unwind spin at both interpolation ends.
    const sp = this.pose[Ch.spin];
    const unwind = Math.round(sp / TAU) * TAU;
    if (unwind !== 0) { this.pose[Ch.spin] -= unwind; this.prevPose[Ch.spin] -= unwind; this.prev2Pose[Ch.spin] -= unwind; }
    this.spinAdd = 0;
    this.from.set(this.pose);
    this.fadeT = 0;
    this.fadeDur = Math.max(0, fade);
    this.lastT = 0;
  }

  /** Show `def` at an explicit, gameplay-mapped time. */
  show(def: AnimDef, t: number, fade: number = ANIM.fadeFrames, restart = false): void {
    if (def !== this.cur || restart) this.switchTo(def, fade);
    this.t = t;
  }

  /** Play `def` on the internal clock (loops wrap, one-shots clamp). Returns true when a one-shot is finished. */
  run(def: AnimDef, rate: number, fade: number = ANIM.fadeFrames, restart = false): boolean {
    if (def !== this.cur || restart) { this.switchTo(def, fade); this.clock = 0; }
    else this.clock += rate;
    if (!def.loop && this.clock > def.len) this.clock = def.len;
    this.t = this.clock;
    return !def.loop && this.clock >= def.len;
  }

  /** Is the current one-shot `id` still playing? */
  playing(id: string): boolean { return !!this.cur && this.cur.id === id && this.clock < this.cur.len; }

  impulseSquash(_ix: number, _iy: number): void { /* authored stretch replaces the old squash spring */ }

  private stepFace(facing: number, fast: boolean): void {
    if (facing !== this.faceTarget) {
      this.faceFrom = this.face; this.faceTarget = facing; this.turnT = 0;
      this.turnDur = fast ? ANIM.turnFramesAttack : ANIM.turnFrames;
    }
    if (this.turnT < this.turnDur) {
      this.turnT++;
      this.face = this.faceFrom + (this.faceTarget - this.faceFrom) * ease.inOutCubic(this.turnT / this.turnDur);
    } else this.face = this.faceTarget;
  }

  /** Evaluate the current animation into the pose; joints + secondary for the sim tick. */
  step(bx: number, by: number, facing: number, scale: number, vx: number, _vy: number, frozen: boolean, fastTurn = false): void {
    this.prev2Pose.set(frozen ? this.prev2Pose : this.prevPose);
    this.prevPose.set(this.pose);
    this.prevFace = this.face;
    this.prevReachW = this.reachW;
    if (this.hasScarf) this.scarfPrev.set(this.scarf);

    if (!frozen) { this.stepFace(facing, fastTurn); this.clipAge++; }
    const def = this.cur;
    if (def) {
      evalAnim(def, this.t, this.evalBuf);
      animFlags(def, this.t, this.flags);
      if (!frozen && def.keys.some((k) => k.sfx)) {
        const k = crossedKey(def, this.lastT, this.t);
        if (k && k.sfx && this.sfxEnabled) animSfx(k.sfx, bx, by);
      }
      this.lastT = this.t;
      this.evalBuf[Ch.spin] += this.spinAdd;
      this.evalBuf[Ch.head] += this.headLook;
      if (this.fadeT < this.fadeDur) {
        if (!frozen) this.fadeT++;
        const k = ease.snapOut(this.fadeT / this.fadeDur);
        for (let i = 0; i < POSE_N; i++) {
          const a = this.from[i], b = this.evalBuf[i];
          this.pose[i] = IS_ANGLE[i] ? a + angDelta(a, b) * k : a + (b - a) * k;
        }
      } else {
        this.pose.set(this.evalBuf);
      }
      this.smear = frozen ? 0 : this.flags.smear;
      this.reachW = this.flags.reachW;
      this.reachLimb = def.reach;
      this.trailActive = this.flags.trail !== 0 && !frozen;
      if (this.trailActive) this.trailJoint = this.flags.trail & 1 ? J.handA : this.flags.trail & 2 ? J.handB : this.flags.trail & 4 ? J.footA : J.footB;
      // Authored snaps and interruption crossfades are intentional; the pop detector
      // flags only what is left: unblended jumps and keys authored too close together.
      if (this.flags.snapping || this.fadeT <= this.fadeDur && this.fadeDur > 0 && this.fadeT > 0) this.intentSnap = true;
    }

    // Pop-detector readings.
    this.maxAngDelta = 0;
    if (!frozen) {
      for (let i = 0; i < POSE_N; i++) {
        if (!IS_ANGLE[i]) continue;
        const d = Math.abs(angDelta(this.prevPose[i], this.pose[i]));
        if (d > this.maxAngDelta) { this.maxAngDelta = d; this.maxAngCh = i; }
      }
    }
    this.maxSpinDelta = Math.abs(this.pose[Ch.spin] - this.prevPose[Ch.spin]);

    computeJoints(this.pose, bx, by, this.face, scale, WORLD.groundY, this.joints, this.rig);
    if (this.hasScarf) this.stepScarf(facing, scale, vx, frozen);
  }

  private stepScarf(facing: number, scale: number, vx: number, frozen: boolean): void {
    const s = this.scarf, o = this.scarfOld;
    const hx = this.joints[J.head * 2] - this.face * 7 * scale;
    const hy = this.joints[J.head * 2 + 1] - 2 * scale;
    if (!this.scarfInit) {
      for (let i = 0; i < SCARF_N; i++) {
        s[i * 2] = o[i * 2] = hx - facing * i * 7 * scale;
        s[i * 2 + 1] = o[i * 2 + 1] = hy + i * 2;
      }
      this.scarfPrev.set(s);
      this.scarfInit = true;
    }
    s[0] = hx; s[1] = hy;
    if (frozen) return;
    const seg = 7.5 * scale;
    const wind = -vx * 0.0008 - this.face * 0.3;
    for (let i = 1; i < SCARF_N; i++) {
      const x = s[i * 2], y = s[i * 2 + 1];
      // heavily damped: a controlled ribbon, not a jelly
      const nx = x + (x - o[i * 2]) * 0.78 + wind;
      const ny = y + (y - o[i * 2 + 1]) * 0.78 + 0.38;
      o[i * 2] = x; o[i * 2 + 1] = y;
      s[i * 2] = nx; s[i * 2 + 1] = ny;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < SCARF_N; i++) {
        const ax = s[(i - 1) * 2], ay = s[(i - 1) * 2 + 1];
        const dx = s[i * 2] - ax, dy = s[i * 2 + 1] - ay;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        const r = seg / dd;
        s[i * 2] = ax + dx * r; s[i * 2 + 1] = ay + dy * r;
      }
    }
  }

  /** Snap to the current animation at time t with no blend (spawn, lab). */
  snap(facing: number): void {
    if (this.cur) { evalAnim(this.cur, this.t, this.pose); }
    this.prevPose.set(this.pose);
    this.prev2Pose.set(this.pose);
    this.fadeT = this.fadeDur = 0;
    this.face = this.prevFace = this.faceFrom = this.faceTarget = facing;
    this.turnT = this.turnDur = 1;
    this.scarfInit = false;
    this.trailCount = 0;
  }

  pushTrail(x: number, y: number, t: number): void {
    const i = this.trailHead;
    this.trailX[i] = x; this.trailY[i] = y; this.trailT[i] = t;
    this.trailHead = (i + 1) % TRAIL_CAP;
    if (this.trailCount < TRAIL_CAP) this.trailCount++;
  }
}
