import { Ch, JOINT_N, J, POSE_N, computeJoints, squashJoints } from './rig';
import { WORLD } from '../data/tuning';

export const SCARF_N = 7;
export const TRAIL_N = 10;

/**
 * Per-fighter animation state. Runs in the fixed sim step; render code lerps
 * between prevJoints and joints using the loop's interpolation alpha.
 */
export class Animator {
  /** Final blended pose this tick. */
  readonly pose = new Float32Array(POSE_N);
  /** Target pose written by the poser each tick. */
  readonly target = new Float32Array(POSE_N);
  private readonly from = new Float32Array(POSE_N);
  private blendT = 0;
  private blendDur = 0;
  clip = -1;
  clipFrame = 0;

  readonly joints = new Float32Array(JOINT_N * 2);
  readonly prevJoints = new Float32Array(JOINT_N * 2);

  // Head spring lag (offset from rigid head position).
  headOX = 0; headOY = 0; headVX = 0; headVY = 0;
  prevHeadOX = 0; prevHeadOY = 0;

  // Squash & stretch spring (1 = rest).
  sqX = 1; sqY = 1; sqVX = 0; sqVY = 0;

  // Scarf verlet chain.
  readonly hasScarf: boolean;
  readonly scarf = new Float32Array(SCARF_N * 2);
  readonly scarfOld = new Float32Array(SCARF_N * 2);
  readonly scarfPrev = new Float32Array(SCARF_N * 2);
  scarfInit = false;

  // Motion trail ring buffer: positions of the striking limb end.
  readonly trail = new Float32Array(TRAIL_N * 2);
  readonly trailAge = new Float32Array(TRAIL_N); // frames since recorded
  trailHead = 0;
  trailCount = 0;
  trailColor = '#fff';
  trailWidth = 10;
  trailJoint: number = J.handA;
  trailActive = false;

  shakeX = 0; // hitstop jitter
  shakeY = 0;

  constructor(hasScarf = false) { this.hasScarf = hasScarf; }

  /** Start a new clip, cross-fading from the current pose over `frames`. */
  play(clip: number, blendFrames: number): void {
    if (clip === this.clip) return;
    this.clip = clip;
    this.clipFrame = 0;
    // Full rotations are visually identical: unwind spin so blends never spin backwards.
    const sp = this.pose[Ch.spin];
    this.pose[Ch.spin] = sp - Math.round(sp / (Math.PI * 2)) * Math.PI * 2;
    this.from.set(this.pose);
    this.blendT = 0;
    this.blendDur = Math.max(0, blendFrames);
  }

  /** Force a re-blend even for the same clip id (e.g. string re-use). */
  restart(clip: number, blendFrames: number): void {
    this.clip = -2;
    this.play(clip, blendFrames);
  }

  impulseSquash(ix: number, iy: number): void {
    this.sqVX += ix; this.sqVY += iy;
  }

  /** Blend target into pose, compute joints, run secondary motion. */
  step(bx: number, by: number, facing: number, scale: number, vx: number, vy: number, frozen: boolean): void {
    this.prevJoints.set(this.joints);
    this.prevHeadOX = this.headOX; this.prevHeadOY = this.headOY;
    if (this.hasScarf) this.scarfPrev.set(this.scarf);

    if (!frozen) {
      this.clipFrame++;
      if (this.blendT < this.blendDur) {
        this.blendT++;
        let t = this.blendT / this.blendDur;
        t = t * t * (3 - 2 * t);
        for (let i = 0; i < POSE_N; i++) this.pose[i] = this.from[i] + (this.target[i] - this.from[i]) * t;
      } else {
        this.pose.set(this.target);
      }
      // squash spring
      const k = 0.28, d = 0.68;
      this.sqVX = (this.sqVX + (1 - this.sqX) * k) * d;
      this.sqVY = (this.sqVY + (1 - this.sqY) * k) * d;
      this.sqX += this.sqVX; this.sqY += this.sqVY;
    }

    computeJoints(this.pose, bx, by, facing, scale, WORLD.groundY, this.joints);
    const airborne = by < WORLD.groundY - 2;
    const pivX = airborne ? this.joints[J.hip * 2] : bx;
    const pivY = airborne ? this.joints[J.hip * 2 + 1] : by;
    squashJoints(this.joints, pivX, pivY, this.sqX, this.sqY);

    // Head spring: lags behind body motion.
    if (!frozen) {
      const k = 0.22, d = 0.72;
      this.headVX = (this.headVX - this.headOX * k - vx * 0.00035) * d;
      this.headVY = (this.headVY - this.headOY * k - vy * 0.00025) * d;
      this.headOX += this.headVX; this.headOY += this.headVY;
      if (this.headOX > 6) this.headOX = 6; else if (this.headOX < -6) this.headOX = -6;
      if (this.headOY > 6) this.headOY = 6; else if (this.headOY < -6) this.headOY = -6;
    }

    if (this.hasScarf) this.stepScarf(facing, scale, vx, frozen);

    // Trail aging + recording.
    for (let i = 0; i < this.trailCount; i++) this.trailAge[i] += frozen ? 0 : 1;
    if (this.trailActive && !frozen) {
      const j = this.trailJoint;
      const idx = this.trailHead;
      this.trail[idx * 2] = this.joints[j * 2];
      this.trail[idx * 2 + 1] = this.joints[j * 2 + 1];
      this.trailAge[idx] = 0;
      this.trailHead = (idx + 1) % TRAIL_N;
      if (this.trailCount < TRAIL_N) this.trailCount++;
    }
  }

  private stepScarf(facing: number, scale: number, vx: number, frozen: boolean): void {
    const s = this.scarf, o = this.scarfOld;
    // anchor: back of head
    const hx = this.joints[J.head * 2] - facing * 7 * scale;
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
    const wind = -vx * 0.0009 - facing * 0.35;
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
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const r = seg / d;
        s[i * 2] = ax + dx * r; s[i * 2 + 1] = ay + dy * r;
      }
    }
  }

  /** Snap without blending (spawn/teleport). */
  snap(): void {
    this.pose.set(this.target);
    this.blendT = this.blendDur = 0;
    this.prevJoints.set(this.joints);
    this.scarfInit = false;
    this.trailCount = 0;
  }
}
