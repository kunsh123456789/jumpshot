import { clamp, ease } from '../core/math';
import { Ch, POSE_N, STANCE, makePose, lerpPose, shortDelta, J } from './rig';
import type { Fighter } from '../sim/fighter';
import type { Animator } from './animator';
import { ANIM } from '../data/tuning';

/**
 * Chooses each fighter's target pose from its sim state every tick, plus the
 * spring stiffness for the current phase. Pure presentation: reads sim state,
 * never writes it.
 */
const P = {
  stance: makePose(STANCE),
  dash: makePose({ lean: 0.62, rootY: -14, aU: -0.9, aL: 0.9, bU: -1.1, bL: 0.7, plant: 0.25, laU: 1.0, laL: -1.4, lbU: -0.7, lbL: -0.9, footA: 26, footB: -26, head: -0.25 }),
  airDash: makePose({ lean: 0.7, aU: -0.5, aL: 0.9, bU: -0.8, bL: 0.8, plant: 0, laU: 0.7, laL: -1.6, lbU: -0.5, lbL: -1.0, head: -0.3 }),
  jumpRise: makePose({ plant: 0, rootY: 4, lean: -0.08, aU: 2.9, aL: 0.4, bU: 0.4, bL: 1.6, laU: 1.3, laL: -1.9, lbU: -0.2, lbL: -0.5, head: -0.3 }),
  airIdle: makePose({ plant: 0, lean: 0.08, aU: 1.1, aL: 1.6, bU: 0.5, bL: 1.8, laU: 0.9, laL: -1.5, lbU: 0.15, lbL: -1.0 }),
  fall: makePose({ plant: 0, lean: 0.0, aU: 1.9, aL: 1.0, bU: 1.6, bL: 1.0, laU: 0.5, laL: -0.9, lbU: -0.1, lbL: -0.6 }),
  land: makePose({ rootY: -22, lean: 0.35, aU: 0.6, aL: 1.6, bU: 0.2, bL: 1.8, footA: 22, footB: -22 }),
  dodge: makePose({ lean: -0.35, rootY: -16, rootX: -6, aU: 1.3, aL: 2.2, bU: 1.0, bL: 2.3, footA: 26, footB: -14, head: 0.2, plant: 0.6, laU: 0.6, laL: -1.0 }),
  flinch: makePose({ lean: -0.38, head: 0.45, rootX: -6, rootY: -4, aU: -0.5, aL: 1.0, bU: -0.8, bL: 1.2, footA: 12, footB: -24, flex: 6 }),
  flinch2: makePose({ lean: 0.5, head: -0.4, rootX: -4, rootY: -14, aU: 0.3, aL: 0.8, bU: 0.1, bL: 1.0, footA: 20, footB: -16, flex: -5 }),
  tumble: makePose({ plant: 0, lean: -0.4, head: 0.5, aU: 2.6, aL: 0.6, bU: -2.2, bL: 0.5, laU: 1.2, laL: -0.6, lbU: -0.6, lbL: -0.7, flex: 6 }),
  lying: makePose({ plant: 0, rootY: -46, rootX: -8, lean: -1.52, head: 0.1, aU: -2.2, aL: 0.4, bU: -2.6, bL: 0.3, laU: 1.45, laL: 0.1, lbU: 1.3, lbL: -0.3 }),
  getup: makePose({ rootY: -30, lean: 0.55, aU: 0.4, aL: 0.6, bU: -0.3, bL: 0.8, footA: 22, footB: -24, head: -0.2 }),
  stunned: makePose({ lean: -0.15, head: 0.35, rootY: -12, aU: 0.2, aL: 0.4, bU: -0.2, bL: 0.4, footA: 14, footB: -16, flex: 3 }),
  taunt: makePose({ lean: -0.15, head: 0.25, aU: 2.4, aL: 1.8, bU: 2.6, bL: 1.9, footA: 20, footB: -20 }),
  burst: makePose({ lean: -0.2, head: -0.3, rootY: 6, aU: 2.6, aL: 0.2, bU: -2.6, bL: 0.2, footA: 30, footB: -30, flex: 8 }),
  wallSplat: makePose({ plant: 0, lean: -0.3, head: 0.6, aU: 2.8, aL: 0.3, bU: -2.8, bL: 0.3, laU: 0.3, laL: 0, lbU: -0.3, lbL: 0 }),
  guardbreak: makePose({ lean: -0.45, head: 0.5, rootY: -6, rootX: -8, aU: 2.6, aL: 0.6, bU: -1.4, bL: 0.8, footA: 10, footB: -26, flex: 7 }),
};

// Clip ids (for cross-fade detection). Moves use 1000 + counter.
const CLIP = { idle: 1, walk: 2, air: 4, fall: 5, land: 6, dodge: 7, flinch: 8, tumble: 9, lying: 10, getup: 11, stunned: 12, jump: 13, taunt: 14, burst: 15, guardbreak: 16, ko: 17, windup: 18, attack: 19, recover: 20, wallSplat: 22, hurt: 23 };

const tmp = new Float32Array(POSE_N);
const carry = new Float32Array(POSE_N);
const dashFrom = new Float32Array(POSE_N);
let moveClipCounter = 1000;

export function poseFighter(f: Fighter, time: number): void {
  const a = f.anim;
  const out = a.target;
  const st = f.state;
  a.trailActive = false;
  // Intentional snaps (exempt from the pop detector): hit impacts and strike contact.
  a.intentSnap = f.impact > 0;

  if (f.team === 'player' && st === 'move' && f.move) {
    const m = f.move;
    const fr = f.moveFrame;
    if (a.moveSerial !== f.moveSerial) {
      a.moveSerial = f.moveSerial;
      // Size the crossfade against the wind-up this move is heading for; long startups may blend longer.
      a.restart(moveClipCounter++, clamp(f.effStartup - 1, ANIM.blendMoveMin, ANIM.blendMoveMax), m.id, m.poses.antic,
        Math.max(ANIM.blendExtraMax, f.effStartup - ANIM.blendMoveMax));
    }
    const dashing = f.dashFrames > 0 && fr < f.dashFrames && fr < anticStart(f);
    if (dashing) {
      // Dash pose already leaning toward the wind-up, so limbs don't detour.
      lerpPose(f.grounded ? P.dash : P.airDash, m.poses.antic, ANIM.dashTowardAntic, out);
      a.omega = ANIM.springAnticipation;
    } else {
      evalMove(f, a, out);
    }
    const S = f.effStartup;
    if (fr >= S - 2 && fr <= S + 3) a.intentSnap = true;
    if (fr >= S - 1 && fr < S + m.active + 3) {
      a.trailActive = true;
      a.trailColor = m.trail.color;
      a.trailWidth = m.trail.width;
      a.trailJoint = J[m.trail.limb];
    }
    look(f, out);
    return;
  }

  if (f.team === 'enemy' && (st === 'windup' || st === 'attack' || st === 'recover') && f.attack) {
    const atk = f.attack;
    if (st === 'windup') {
      a.play(CLIP.windup, ANIM.blendDefault, 'windup');
      const t = Math.min(1, f.stateFrame / Math.max(1, f.timer + f.stateFrame));
      lerpPose(P.stance, atk.poses.antic, ease.inOutQuad(Math.min(1, t * 1.6)), out);
      out[Ch.rootX] += Math.sin(time * 70) * 1.2 * t;
      a.omega = ANIM.springAnticipation;
    } else if (st === 'attack') {
      a.play(CLIP.attack, 2, 'attack');
      out.set(atk.poses.strike);
      a.omega = ANIM.springStrike;
      a.intentSnap = f.stateFrame <= 4; // strike contact snap
      a.trailActive = true; a.trailColor = '#ff6a6a'; a.trailWidth = 8 * f.scale;
      a.trailJoint = atk.id.includes('ick') || atk.id === 'bSweep' ? J.footA : J.handA;
    } else {
      a.play(CLIP.recover, 4, 'recover');
      const total = f.timer + f.stateFrame;
      const t = total > 0 ? f.stateFrame / total : 1;
      lerpPose(atk.poses.follow, P.stance, ease.inOutQuad(t), out);
      a.omega = ANIM.springRecovery;
    }
    look(f, out);
    return;
  }

  switch (st) {
    case 'idle': {
      a.play(CLIP.idle, ANIM.blendDefault + 1, 'idle');
      out.set(P.stance);
      const br = Math.sin(time * 3.2 + f.id);
      const shift = Math.sin(time * 1.1 + f.id * 1.3);
      const bounce = 0.5 + 0.5 * Math.sin(time * 9.0 + f.id * 0.7);
      out[Ch.rootY] += br * 1.4 - bounce * (f.team === 'player' ? 2.4 : 1.2);
      out[Ch.aU] += br * 0.05; out[Ch.bU] -= br * 0.05;
      out[Ch.lean] += Math.sin(time * 1.3 + f.id) * 0.03 + br * 0.015;
      out[Ch.rootX] += shift * 2.2;
      out[Ch.footA] += shift * 1.5; out[Ch.footB] += shift * 1.5;
      a.omega = ANIM.springIdle;
      runDecay(a);
      break;
    }
    case 'walk': {
      a.play(CLIP.walk, ANIM.blendDefault, 'run');
      runCycle(f, a, out);
      a.omega = ANIM.springLocomotion;
      break;
    }
    case 'taunt': {
      a.play(CLIP.taunt, 8, 'taunt');
      out.set(P.taunt);
      out[Ch.rootY] += Math.sin(time * 9) * 3;
      out[Ch.aL] += Math.sin(time * 9) * 0.3;
      a.omega = ANIM.springLocomotion;
      break;
    }
    case 'dodge': {
      a.play(CLIP.dodge, 3, 'dodge');
      out.set(P.dodge);
      a.omega = ANIM.springHitReact;
      break;
    }
    case 'jumpFollow': {
      a.play(CLIP.jump, 4, 'jump');
      out.set(P.jumpRise);
      a.omega = ANIM.springAnticipation;
      break;
    }
    case 'fall': {
      a.play(CLIP.fall, 7, 'fall');
      lerpPose(P.airIdle, P.fall, ease.inOutQuad(clamp(f.vy / 900, 0, 1)), out);
      a.omega = ANIM.springRecovery;
      break;
    }
    case 'land': {
      a.play(CLIP.land, ANIM.blendLand, 'land');
      out.set(P.land);
      a.omega = ANIM.springHitReact;
      break;
    }
    case 'hurt': case 'hitstun': {
      const alt = (f.comboHits & 1) === 1;
      a.play(CLIP.flinch + (alt ? 100 : 0), ANIM.blendHitReact, alt ? 'flinch2' : 'flinch');
      out.set(alt ? P.flinch2 : P.flinch);
      if (!f.grounded) out[Ch.plant] = 0;
      // ease back toward stance over the hitstun
      const total = f.timer + f.stateFrame;
      if (total > 0 && f.grounded) {
        const t = clamp(f.stateFrame / total, 0, 1);
        if (t > 0.55) lerpPose(out, P.stance, ease.inOutQuad((t - 0.55) / 0.45), out);
      }
      a.omega = f.stateFrame < 4 ? ANIM.springHitReact : ANIM.springRecovery;
      break;
    }
    case 'air': case 'ko': {
      if (f.splat > 0) {
        a.play(CLIP.wallSplat, 3, 'wallSplat');
        out.set(P.wallSplat);
        a.omega = ANIM.springHitReact;
        break;
      }
      a.play(st === 'ko' ? CLIP.ko : CLIP.tumble, 4, st === 'ko' ? 'ko' : 'tumble');
      out.set(P.tumble);
      // Continue from the current (possibly unwound) pose spin: never a 2*pi catch-up.
      out[Ch.spin] = a.pose[Ch.spin] + shortDelta(a.pose[Ch.spin], f.spinAngle);
      const flail = Math.sin(time * 14 + f.id);
      out[Ch.aU] += flail * 0.3; out[Ch.bU] -= flail * 0.3;
      out[Ch.laU] += flail * 0.2;
      a.omega = ANIM.springHitReact;
      break;
    }
    case 'knockdown': case 'dead': {
      a.play(CLIP.lying, 6, 'knockdown');
      out.set(P.lying);
      // breathing on the floor
      out[Ch.rootY] += Math.sin(time * 4 + f.id) * 0.8;
      a.omega = ANIM.springRecovery;
      break;
    }
    case 'getup': {
      a.play(CLIP.getup, ANIM.blendGetup, 'getup');
      const total = f.timer + f.stateFrame;
      const t = total > 0 ? f.stateFrame / total : 1;
      if (t < 0.5) lerpPose(P.lying, P.getup, ease.inOutQuad(t * 2), out);
      else lerpPose(P.getup, P.stance, ease.inOutQuad((t - 0.5) * 2), out);
      a.omega = ANIM.springLocomotion;
      break;
    }
    case 'stunned': {
      a.play(CLIP.stunned, 6, 'stunned');
      out.set(P.stunned);
      out[Ch.lean] += Math.sin(time * 4 + f.id) * 0.12;
      out[Ch.head] += Math.sin(time * 6 + f.id) * 0.15;
      a.omega = ANIM.springRecovery;
      break;
    }
    case 'guardbreak': {
      a.play(CLIP.guardbreak, 3, 'guardbreak');
      out.set(P.guardbreak);
      a.omega = ANIM.springHitReact;
      break;
    }
    case 'burst': {
      a.play(CLIP.burst, 3, 'burst');
      out.set(P.burst);
      a.omega = ANIM.springHitReact;
      break;
    }
    default: {
      a.play(CLIP.idle, ANIM.blendDefault, 'idle');
      out.set(f.grounded ? P.stance : P.airIdle);
      a.omega = ANIM.springIdle;
    }
  }
  if (st !== 'knockdown' && st !== 'dead' && st !== 'air' && st !== 'ko') look(f, out);
}

/** Head tracks the target (clamped tilt). */
function look(f: Fighter, out: Float32Array): void {
  if (!f.hasLook) return;
  const hx = f.x, hy = f.y - 118 * f.scale;
  const dx = Math.abs(f.lookX - hx) + 40, dy = f.lookY - hy;
  const tilt = clamp(Math.atan2(dy, dx) * 0.7, -ANIM.headLook, ANIM.headLook);
  out[Ch.head] += tilt;
}

function runDecay(a: Animator): void { a.accel *= 0.8; a.prevVx *= 0.8; }

/**
 * Run cycle with planted feet: the phase advances by distance travelled, so a
 * stance foot moves backward relative to the body exactly as fast as the body
 * moves forward (no sliding). Stride grows with speed; lean follows speed and
 * acceleration (start lean / braking skid).
 */
function runCycle(f: Fighter, a: Animator, out: Float32Array): void {
  out.set(P.stance);
  const speed = Math.abs(f.vx);
  const stride = Math.min(ANIM.strideMax, ANIM.strideBase + speed * ANIM.stridePerSpeed);
  a.runPhase = (a.runPhase + speed / 60 / (2 * stride)) % 1;
  const rawAcc = (f.vx - a.prevVx) * 60;
  a.prevVx = f.vx;
  a.accel += (rawAcc - a.accel) * 0.25;
  const dir = f.vx * f.facing >= 0 ? 1 : -1; // forward or backpedal relative to facing
  const u = a.runPhase;
  footPhase(u, stride, dir, out, Ch.footA, Ch.liftA);
  footPhase((u + 0.5) % 1, stride, dir, out, Ch.footB, Ch.liftB);
  out[Ch.plant] = 1;
  const k = Math.min(1, speed / 260);
  out[Ch.rootY] = -6 - k * 4 - ANIM.runBounce * k * 0.5 * (1 + Math.cos(u * Math.PI * 4));
  const accLean = clamp(a.accel * f.facing * ANIM.accelLean, -ANIM.maxAccelLean, ANIM.maxAccelLean);
  out[Ch.lean] = 0.12 + speed * ANIM.runLeanPerSpeed * dir + accLean;
  const swing = Math.sin(u * Math.PI * 2) * (0.25 + 0.45 * k);
  out[Ch.aU] = 0.85 - swing * dir; out[Ch.aL] = 1.7 + 0.2 * k;
  out[Ch.bU] = 0.45 + swing * dir; out[Ch.bL] = 1.9;
  out[Ch.head] = -0.05 - k * 0.1;
}

function footPhase(u: number, stride: number, dir: number, out: Float32Array, chFoot: number, chLift: number): void {
  let off: number, lift: number;
  if (u < 0.5) {
    // stance: planted, sweeps back linearly as the body advances
    off = stride / 2 - stride * (u / 0.5);
    lift = 0;
  } else {
    // swing: eased forward arc
    const t = (u - 0.5) / 0.5;
    const e = t * t * (3 - 2 * t);
    off = -stride / 2 + stride * e;
    lift = ANIM.footLift * Math.sin(Math.PI * t) * Math.min(1, stride / 60);
  }
  out[chFoot] = off * dir;
  out[chLift] = lift;
}

/** Frame where the anticipation begins: after the dash, but never shorter than ANIM.minAnticFrames. */
function anticStart(f: Fighter): number {
  const m = f.move!;
  return Math.max(0, f.effStartup - Math.max(m.startup, f.dashFrames > 0 ? ANIM.minAnticFrames : 0));
}

/** Evaluate a move's keyframes: anticipation -> snap -> carry past contact -> follow -> neutral. */
function evalMove(f: Fighter, a: Animator, out: Float32Array): void {
  const m = f.move!;
  const poses = m.poses;
  const fr = f.moveFrame;
  const S = f.effStartup;
  const A = m.active;
  const R = m.recovery;
  const snap = 2;
  if (fr < S) {
    // Anticipation: ease-in-out into the wind-up. After a magnetism dash it
    // continues from the dash pose (no jump when the dash display ends).
    const dashEnd = anticStart(f);
    let from = f.grounded ? P.stance : P.airIdle;
    if (dashEnd > 0) { lerpPose(f.grounded ? P.dash : P.airDash, poses.antic, ANIM.dashTowardAntic, dashFrom); from = dashFrom; }
    const span = Math.max(1, S - 1 - dashEnd);
    const t = Math.max(0, fr - dashEnd + 1) / span;
    lerpPose(from, poses.antic, ease.inOutSine(Math.min(1, t)), out);
    if (!f.grounded) out[Ch.plant] = 0;
    a.omega = fr >= S - 1 ? ANIM.springStrike : ANIM.springAnticipation;
    return;
  }
  const af = fr - S;
  if (m.multiHit && af < A) {
    const k = Math.floor(af / m.multiHit.interval);
    const local = (af % m.multiHit.interval) / m.multiHit.interval;
    const strike = (k & 1) === 0 || !poses.strikeAlt ? poses.strike : poses.strikeAlt;
    lerpPose(poses.antic, strike, ease.outBack(Math.min(1, local * 1.8)), out);
    a.omega = ANIM.springStrike;
    a.intentSnap = true;
    return;
  }
  if (af < snap) {
    // Snap into contact with a slight overshoot.
    lerpPose(poses.antic, poses.strike, ease.outBack((af + 1) / snap), out);
    a.omega = ANIM.springStrike;
    a.intentSnap = true;
    return;
  }
  // Carry past the contact point: strike + (strike - antic) * carryPast.
  const followEnd = A + Math.floor(R * 0.45);
  const carryEnd = snap + Math.max(1, Math.round((followEnd - snap) * ANIM.carryFrac));
  if (af < carryEnd) {
    for (let i = 0; i < POSE_N; i++) carry[i] = poses.strike[i] + (poses.strike[i] - poses.antic[i]) * ANIM.carryPast;
    carry[Ch.plant] = poses.strike[Ch.plant];
    const t = (af - snap + 1) / (carryEnd - snap);
    lerpPose(poses.strike, carry, ease.outQuad(Math.min(1, t)), out);
    a.omega = ANIM.springStrike * 0.8;
    return;
  }
  if (af < followEnd) {
    for (let i = 0; i < POSE_N; i++) carry[i] = poses.strike[i] + (poses.strike[i] - poses.antic[i]) * ANIM.carryPast;
    carry[Ch.plant] = poses.strike[Ch.plant];
    const t = (af - carryEnd) / Math.max(1, followEnd - carryEnd);
    lerpPose(carry, poses.follow, ease.inOutQuad(t), out);
    a.omega = ANIM.springRecovery * 1.5;
    return;
  }
  // Slow ease back to neutral, keeping spin continuous (nearest full rotation).
  const t = Math.min(1, (af - followEnd) / Math.max(1, A + R - followEnd));
  tmp.set(f.grounded ? P.stance : P.airIdle);
  const fs = poses.follow[Ch.spin];
  tmp[Ch.spin] = Math.round(fs / (Math.PI * 2)) * Math.PI * 2;
  lerpPose(poses.follow, tmp, ease.inOutQuad(t), out);
  if (!f.grounded) out[Ch.plant] = 0;
  a.omega = ANIM.springRecovery;
}
