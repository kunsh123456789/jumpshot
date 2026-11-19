import { Ch, IS_ANGLE, JOINT_N, J, POSE_N, angDelta, computeJoints, squashJoints } from './rig';
import { ANIM, WORLD } from '../data/tuning';

export const SCARF_N = 7;
/** Render-rate trail history capacity. */
export const TRAIL_CAP = 40;

const TAU = Math.PI * 2;

/** Per-channel spring stiffness multipliers (overlapping action). */
const CH_MULT = (() => {
  const m = new Float32Array(POSE_N).fill(1);
  m[Ch.head] = ANIM.headLag;
  m[Ch.bU] = ANIM.rearArmLag; m[Ch.bL] = ANIM.rearArmLag;
  m[Ch.lean] = ANIM.leanLag;
  return m;
})();

/**
 * Per-fighter animation state, stepped in the fixed sim tick:
 *   poser target -> crossfade layer (outgoing pose fades out with momentum,
 *   incoming fades in) -> critically damped spring per channel -> pose.
 * Rendering interpolates prevPose -> pose (angles along the shortest arc),
 * the feet position, facing turn and squash, then runs FK at render time.
 */
export class Animator {
  /** Final pose this tick (spring output) and last tick's, for interpolation. */
  readonly pose = new Float32Array(POSE_N);
  readonly prevPose = new Float32Array(POSE_N);
  /** Spring velocities per channel. */
  private readonly vel = new Float32Array(POSE_N);
  /** Target pose written by the poser each tick. */
  readonly target = new Float32Array(POSE_N);
  /** Outgoing pose (snapshot of where the limbs were) and its momentum. */
  private readonly from = new Float32Array(POSE_N);
  private readonly fromVel = new Float32Array(POSE_N);
  private readonly blended = new Float32Array(POSE_N);
  /** Continuously unwrapped target during a crossfade (arc chosen once, never flips). */
  private readonly tU = new Float32Array(POSE_N);
  private blendT = 0;
  private blendDur = 0;
  private blendCap = 0;
  /** Where the new clip is headed (e.g. a move's wind-up), for sizing the crossfade. */
  private dest: Float32Array | null = null;
  clip = -1;
  clipName = 'none';
  /** Ticks since the current clip started (for pop attribution). */
  clipAge = 0;
  /** Last move instance this animator crossfaded into. */
  moveSerial = -1;
  lastTransition = '';
  /** Spring stiffness (rad/s) for this tick, chosen by the poser per phase. */
  omega: number = ANIM.springIdle;
  /** Set by the poser on frames where a hard snap is intended (strike contact). */
  intentSnap = false;

  // Facing turn (fractional facing passes through 0 = rotating through the camera plane).
  face = 1; prevFace = 1;
  private faceFrom = 1; private faceTarget = 1; private turnT = 0; private turnDur = 1;

  /** Sim-tick joints (afterimages, scarf anchor). Rendering recomputes from the interpolated pose. */
  readonly joints = new Float32Array(JOINT_N * 2);

  // Head spring lag (offset from rigid head position).
  headOX = 0; headOY = 0; headVX = 0; headVY = 0;
  prevHeadOX = 0; prevHeadOY = 0;

  // Squash & stretch spring (1 = rest).
  sqX = 1; sqY = 1; sqVX = 0; sqVY = 0;
  prevSqX = 1; prevSqY = 1;

  // Scarf verlet chain.
  readonly hasScarf: boolean;
  readonly scarf = new Float32Array(SCARF_N * 2);
  readonly scarfOld = new Float32Array(SCARF_N * 2);
  readonly scarfPrev = new Float32Array(SCARF_N * 2);
  scarfInit = false;

  // Trail: sim decides when it is active; the renderer samples it every render frame.
  trailActive = false;
  trailColor = '#fff';
  trailWidth = 10;
  trailJoint: number = J.handA;
  readonly trailX = new Float32Array(TRAIL_CAP);
  readonly trailY = new Float32Array(TRAIL_CAP);
  readonly trailT = new Float32Array(TRAIL_CAP);
  trailHead = 0;
  trailCount = 0;
  /** Afterimage emission (render-time). */
  ghostTime = 0;
  ghostAcc = 0;

  // Run cycle state.
  runPhase = 0;
  accel = 0;
  prevVx = 0;

  // Pop-detector readings for the last tick.
  maxAngDelta = 0;
  maxSpinDelta = 0;
  /** Channel index of maxAngDelta. */
  maxAngCh = 0;

  constructor(hasScarf = false) { this.hasScarf = hasScarf; }

  /** Start a new clip, cross-fading from wherever the limbs currently are. */
  play(clip: number, blendFrames: number, name = '', dest: Float32Array | null = null, maxExtra: number = ANIM.blendExtraMax): void {
    if (clip === this.clip) return;
    this.lastTransition = `${this.clipName}→${name || clip}`;
    this.clip = clip;
    this.clipName = name || String(clip);
    this.clipAge = 0;
    // Full rotations are visually identical: unwind spin (in both interpolation
    // endpoints) so blends never spin backwards and rendering never pops.
    const sp = this.pose[Ch.spin];
    const unwind = Math.round(sp / TAU) * TAU;
    if (unwind !== 0) { this.pose[Ch.spin] -= unwind; this.prevPose[Ch.spin] -= unwind; }
    this.from.set(this.pose);
    // Outgoing pose keeps (clamped) momentum while it fades out.
    const mv = ANIM.outgoingMaxVel;
    for (let i = 0; i < POSE_N; i++) this.fromVel[i] = Math.max(-mv, Math.min(mv, this.vel[i]));
    this.blendT = 0;
    this.blendDur = Math.max(1, blendFrames);
    this.blendCap = this.blendDur + maxExtra;
    this.dest = dest;
  }

  /** Force a re-blend even for the same logical clip (e.g. a string re-using a pose). */
  restart(clip: number, blendFrames: number, name = '', dest: Float32Array | null = null, maxExtra: number = ANIM.blendExtraMax): void {
    this.clip = -2;
    this.play(clip, blendFrames, name, dest, maxExtra);
  }

  impulseSquash(ix: number, iy: number): void {
    this.sqVX += ix; this.sqVY += iy;
  }

  /** Eased facing turn toward `facing` (+1/-1). */
  private stepFace(facing: number, fast: boolean): void {
    if (facing !== this.faceTarget) {
      this.faceFrom = this.face;
      this.faceTarget = facing;
      this.turnT = 0;
      this.turnDur = fast ? ANIM.turnFramesAttack : ANIM.turnFrames;
    }
    if (this.turnT < this.turnDur) {
      this.turnT++;
      let t = this.turnT / this.turnDur;
      t = t * t * (3 - 2 * t);
      this.face = this.faceFrom + (this.faceTarget - this.faceFrom) * t;
    } else this.face = this.faceTarget;
  }

  /** Crossfade + springs, FK for the sim-time joints, and secondary motion. */
  step(bx: number, by: number, facing: number, scale: number, vx: number, vy: number, frozen: boolean, fastTurn = false): void {
    this.prevPose.set(this.pose);
    this.prevFace = this.face;
    this.prevHeadOX = this.headOX; this.prevHeadOY = this.headOY;
    this.prevSqX = this.sqX; this.prevSqY = this.sqY;
    if (this.hasScarf) this.scarfPrev.set(this.scarf);
    this.maxAngDelta = 0; this.maxSpinDelta = 0;

    if (!frozen) {
      this.clipAge++;
      this.stepFace(facing, fastTurn);
      // 1) Crossfade layer: outgoing pose (with decaying momentum) -> incoming target.
      if (this.blendT < this.blendDur) {
        if (this.blendT === 0) {
          for (let i = 0; i < POSE_N; i++) this.tU[i] = IS_ANGLE[i] ? this.from[i] + angDelta(this.from[i], this.target[i]) : this.target[i];
          // Adaptive crossfade: big pose changes get a few more frames so no
          // joint has to move faster than blendMaxRate per frame.
          let md = 0;
          for (let i = 0; i < POSE_N; i++) {
            if (!IS_ANGLE[i]) continue;
            const d = Math.abs(angDelta(this.from[i], this.target[i]));
            if (d > md) md = d;
            if (this.dest) { const d2 = Math.abs(angDelta(this.from[i], this.dest[i])); if (d2 > md) md = d2; }
          }
          // smoothstep peaks at 1.5x its average rate
          const need = Math.ceil((1.5 * md) / ANIM.blendMaxRate);
          this.blendDur = Math.min(this.blendCap, Math.max(this.blendDur, need));
        }
        this.blendT++;
        let t = this.blendT / this.blendDur;
        t = t * t * (3 - 2 * t);
        const m = ANIM.outgoingMomentum;
        for (let i = 0; i < POSE_N; i++) {
          this.from[i] += this.fromVel[i] / 60;
          this.fromVel[i] *= m;
          const a = this.from[i];
          if (IS_ANGLE[i]) {
            // Unwrap the (moving) target continuously so the blend arc can't flip sides.
            this.tU[i] += angDelta(this.tU[i], this.target[i]);
            this.blended[i] = a + (this.tU[i] - a) * t;
          } else {
            this.blended[i] = a + (this.target[i] - a) * t;
          }
        }
      } else {
        this.blended.set(this.target);
      }
      // 2) Critically damped spring per channel (exact, stable for any stiffness).
      const dt = 1 / 60;
      for (let i = 0; i < POSE_N; i++) {
        const w = this.omega * CH_MULT[i];
        const x = this.pose[i], tgt = this.blended[i];
        const y = IS_ANGLE[i] ? -angDelta(x, tgt) : x - tgt;
        const e = Math.exp(-w * dt);
        const tmp = (this.vel[i] + w * y) * dt;
        this.vel[i] = (this.vel[i] - w * tmp) * e;
        this.pose[i] = tgt + (y + tmp) * e;
        const d = IS_ANGLE[i] ? Math.abs(angDelta(this.prevPose[i], this.pose[i])) : 0;
        if (d > this.maxAngDelta) { this.maxAngDelta = d; this.maxAngCh = i; }
      }
      this.maxSpinDelta = Math.abs(this.pose[Ch.spin] - this.prevPose[Ch.spin]);
      // squash spring
      const k = 0.3, d = 0.62;
      this.sqVX = (this.sqVX + (1 - this.sqX) * k) * d;
      this.sqVY = (this.sqVY + (1 - this.sqY) * k) * d;
      this.sqX += this.sqVX; this.sqY += this.sqVY;
    }

    computeJoints(this.pose, bx, by, this.face, scale, WORLD.groundY, this.joints);
    const airborne = by < WORLD.groundY - 2;
    squashJoints(this.joints, airborne ? this.joints[J.hip * 2] : bx, airborne ? this.joints[J.hip * 2 + 1] : by, this.sqX, this.sqY);

    // Head spring: lags behind body motion, then settles (overlapping action).
    if (!frozen) {
      const k = 0.2, d = 0.74;
      this.headVX = (this.headVX - this.headOX * k - vx * 0.00035) * d;
      this.headVY = (this.headVY - this.headOY * k - vy * 0.00025) * d;
      this.headOX += this.headVX; this.headOY += this.headVY;
      if (this.headOX > 6) this.headOX = 6; else if (this.headOX < -6) this.headOX = -6;
      if (this.headOY > 6) this.headOY = 6; else if (this.headOY < -6) this.headOY = -6;
    }

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
    const wind = -vx * 0.0009 - this.face * 0.35;
    for (let i = 1; i < SCARF_N; i++) {
      const x = s[i * 2], y = s[i * 2 + 1];
      const nx = x + (x - o[i * 2]) * 0.9 + wind;
      const ny = y + (y - o[i * 2 + 1]) * 0.9 + 0.42;
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

  /** Snap without blending (spawn/teleport): an intentional discontinuity. */
  snap(facing: number): void {
    this.pose.set(this.target);
    this.prevPose.set(this.target);
    this.vel.fill(0);
    this.blendT = this.blendDur = 0;
    this.face = this.prevFace = this.faceFrom = this.faceTarget = facing;
    this.turnT = this.turnDur = 1;
    this.scarfInit = false;
    this.trailCount = 0;
  }

  /** Render-rate trail sample. */
  pushTrail(x: number, y: number, t: number): void {
    const i = this.trailHead;
    this.trailX[i] = x; this.trailY[i] = y; this.trailT[i] = t;
    this.trailHead = (i + 1) % TRAIL_CAP;
    if (this.trailCount < TRAIL_CAP) this.trailCount++;
  }
}
