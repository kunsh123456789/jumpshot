import { ease } from '../core/math';
import { Ch, POSE_N, STANCE, makePose, lerpPose, J } from './rig';
import type { Fighter } from '../sim/fighter';
import { WORLD } from '../data/tuning';

/**
 * Chooses each fighter's target pose from its sim state every tick and feeds
 * the animator. Pure presentation: reads sim state, never writes it.
 */
const P = {
  stance: makePose(STANCE),
  dash: makePose({ lean: 0.62, rootY: -14, aU: -0.9, aL: 0.9, bU: -1.1, bL: 0.7, plant: 0.25, laU: 1.0, laL: -1.4, lbU: -0.7, lbL: -0.9, footA: 26, footB: -26, head: -0.25 }),
  airDash: makePose({ lean: 0.7, aU: -1.0, aL: 0.6, bU: -1.2, bL: 0.6, plant: 0, laU: 0.7, laL: -1.6, lbU: -0.5, lbL: -1.0, head: -0.3 }),
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
  walkA: makePose({ lean: 0.18 }),
  taunt: makePose({ lean: -0.15, head: 0.25, aU: 2.4, aL: 1.8, bU: 2.6, bL: 1.9, footA: 20, footB: -20 }),
  burst: makePose({ lean: -0.2, head: -0.3, rootY: 6, aU: 2.6, aL: 0.2, bU: -2.6, bL: 0.2, footA: 30, footB: -30, flex: 8 }),
  wallSplat: makePose({ plant: 0, lean: -0.3, head: 0.6, aU: 2.8, aL: 0.3, bU: -2.8, bL: 0.3, laU: 0.3, laL: 0, lbU: -0.3, lbL: 0 }),
  guardbreak: makePose({ lean: -0.45, head: 0.5, rootY: -6, rootX: -8, aU: 2.6, aL: 0.6, bU: -1.4, bL: 0.8, footA: 10, footB: -26, flex: 7 }),
};

// Clip ids (for cross-fade detection). Moves use 1000 + index.
const CLIP = { idle: 1, walk: 2, dash: 3, air: 4, fall: 5, land: 6, dodge: 7, flinch: 8, tumble: 9, lying: 10, getup: 11, stunned: 12, jump: 13, taunt: 14, burst: 15, guardbreak: 16, ko: 17, windup: 18, attack: 19, recover: 20, airDash: 21, wallSplat: 22 };

const tmp = new Float32Array(POSE_N);
let moveClipCounter = 1000;

export function poseFighter(f: Fighter, time: number): void {
  const a = f.anim;
  const out = a.target;
  const st = f.state;
  a.trailActive = false;

  if (f.team === 'player' && st === 'move' && f.move) {
    const m = f.move;
    const fr = f.moveFrame;
    if (fr === 0 && f.stateFrame === 0) {
      a.restart(moveClipCounter++, Math.min(5, Math.max(2, f.effStartup - 1)));
      a.trailCount = 0;
    }
    const dashing = f.dashFrames > 0 && fr < f.dashFrames && fr < f.effStartup - m.startup;
    if (dashing) {
      out.set(f.grounded ? P.dash : P.airDash);
    } else {
      evalMove(f, out);
    }
    const S = f.effStartup;
    if (fr >= S - 1 && fr < S + m.active + 4) {
      a.trailActive = true;
      a.trailColor = m.trail.color;
      a.trailWidth = m.trail.width;
      a.trailJoint = J[m.trail.limb];
    }
    return;
  }

  if (f.team === 'enemy' && (st === 'windup' || st === 'attack' || st === 'recover') && f.attack) {
    const atk = f.attack;
    const key = st === 'windup' ? CLIP.windup : st === 'attack' ? CLIP.attack : CLIP.recover;
    a.play(key, st === 'windup' ? Math.min(10, atk.windup - 2) : st === 'attack' ? 2 : 6);
    if (st === 'windup') {
      const t = Math.min(1, f.stateFrame / Math.max(1, f.timer + f.stateFrame));
      lerpPose(P.stance, atk.poses.antic, ease.outCubic(Math.min(1, t * 1.6)), out);
      // tremble at the end of the telegraph
      out[Ch.rootX] += Math.sin(time * 70) * 1.2 * t;
    } else if (st === 'attack') {
      out.set(atk.poses.strike);
      a.trailActive = true; a.trailColor = '#ff6a6a'; a.trailWidth = 8 * f.scale;
      a.trailJoint = atk.id.includes('ick') || atk.id === 'bSweep' ? J.footA : J.handA;
    } else {
      const total = f.timer + f.stateFrame;
      const t = total > 0 ? f.stateFrame / total : 1;
      lerpPose(atk.poses.follow, P.stance, ease.inOutQuad(t), out);
    }
    return;
  }

  switch (st) {
    case 'idle': {
      a.play(CLIP.idle, 6);
      out.set(P.stance);
      const br = Math.sin(time * 3.2 + f.id);
      const bounce = Math.abs(Math.sin(time * 5.0 + f.id * 0.7));
      out[Ch.rootY] += br * 1.4 - bounce * (f.team === 'player' ? 3.2 : 1.5);
      out[Ch.aU] += br * 0.05; out[Ch.bU] -= br * 0.05;
      out[Ch.lean] += Math.sin(time * 1.3 + f.id) * 0.03;
      out[Ch.rootX] += Math.sin(time * 1.1 + f.id * 1.3) * 2;
      break;
    }
    case 'walk': {
      a.play(CLIP.walk, 6);
      walkCycle(f, out, time);
      break;
    }
    case 'taunt': {
      a.play(CLIP.taunt, 8);
      out.set(P.taunt);
      out[Ch.rootY] += Math.sin(time * 9) * 3;
      out[Ch.aL] += Math.sin(time * 9) * 0.3;
      break;
    }
    case 'dodge': {
      a.play(CLIP.dodge, 2);
      out.set(P.dodge);
      break;
    }
    case 'jumpFollow': {
      a.play(CLIP.jump, 4);
      out.set(P.jumpRise);
      break;
    }
    case 'fall': {
      a.play(CLIP.fall, 8);
      lerpPose(P.airIdle, P.fall, Math.min(1, Math.max(0, f.vy / 900)), out);
      break;
    }
    case 'land': {
      a.play(CLIP.land, 2);
      out.set(P.land);
      break;
    }
    case 'hurt': case 'hitstun': {
      const alt = (f.comboHits & 1) === 1;
      a.play(CLIP.flinch + (alt ? 100 : 0), 2);
      out.set(alt ? P.flinch2 : P.flinch);
      if (f.grounded === false) out[Ch.plant] = 0;
      break;
    }
    case 'air': case 'ko': {
      if (f.splat > 0) {
        a.play(CLIP.wallSplat, 1);
        out.set(P.wallSplat);
        break;
      }
      a.play(st === 'ko' ? CLIP.ko : CLIP.tumble, 3);
      out.set(P.tumble);
      out[Ch.spin] = f.spinAngle;
      const flail = Math.sin(time * 20 + f.id);
      out[Ch.aU] += flail * 0.3; out[Ch.bU] -= flail * 0.3;
      out[Ch.laU] += flail * 0.2;
      break;
    }
    case 'knockdown': case 'dead': {
      a.play(CLIP.lying, 5);
      out.set(P.lying);
      break;
    }
    case 'getup': {
      a.play(CLIP.getup, 8);
      const total = f.timer + f.stateFrame;
      const t = total > 0 ? f.stateFrame / total : 1;
      if (t < 0.5) lerpPose(P.lying, P.getup, ease.outQuad(t * 2), out);
      else lerpPose(P.getup, P.stance, ease.inOutQuad((t - 0.5) * 2), out);
      break;
    }
    case 'stunned': {
      a.play(CLIP.stunned, 6);
      out.set(P.stunned);
      out[Ch.lean] += Math.sin(time * 4 + f.id) * 0.12;
      out[Ch.head] += Math.sin(time * 6 + f.id) * 0.15;
      break;
    }
    case 'guardbreak': {
      a.play(CLIP.guardbreak, 2);
      out.set(P.guardbreak);
      break;
    }
    case 'burst': {
      a.play(CLIP.burst, 2);
      out.set(P.burst);
      break;
    }
    default: {
      a.play(CLIP.idle, 6);
      out.set(f.grounded ? P.stance : P.airIdle);
    }
  }
}

function walkCycle(f: Fighter, out: Float32Array, time: number): void {
  out.set(P.walkA);
  const speed = Math.min(1.4, Math.abs(f.vx) / 180);
  const ph = time * (7 + speed * 5) + f.id;
  const s = Math.sin(ph), c = Math.cos(ph);
  const back = f.vx * f.facing < 0 ? -1 : 1;
  out[Ch.plant] = 0;
  out[Ch.laU] = s * 0.6 * back + 0.1;
  out[Ch.laL] = -0.5 - Math.max(0, c) * 0.9;
  out[Ch.lbU] = -s * 0.6 * back + 0.1;
  out[Ch.lbL] = -0.5 - Math.max(0, -c) * 0.9;
  out[Ch.rootY] = -4 - Math.abs(c) * 4;
  out[Ch.lean] = 0.12 + speed * 0.12 * back;
  out[Ch.aU] = 0.9 - s * 0.35; out[Ch.aL] = 1.8;
  out[Ch.bU] = 0.5 + s * 0.35; out[Ch.bL] = 2.0;
}

/** Evaluate a move's keyframes at the fighter's current move frame. */
function evalMove(f: Fighter, out: Float32Array): void {
  const m = f.move!;
  const poses = m.poses;
  const fr = f.moveFrame;
  const S = f.effStartup;
  const A = m.active;
  const R = m.recovery;
  const snap = 2;
  if (fr < S) {
    // Anticipation: ease into the antic pose over the startup.
    const t = S <= 1 ? 1 : fr / (S - 1);
    lerpPose(P.stance, poses.antic, ease.outCubic(Math.min(1, t * 1.4)), out);
    if (!f.grounded) {
      out[Ch.plant] = 0;
    }
    return;
  }
  const af = fr - S;
  if (m.multiHit && af < A) {
    // Alternate strike poses every interval for rapid flurries.
    const k = Math.floor(af / m.multiHit.interval);
    const local = (af % m.multiHit.interval) / m.multiHit.interval;
    const strike = (k & 1) === 0 || !poses.strikeAlt ? poses.strike : poses.strikeAlt;
    lerpPose(poses.antic, strike, ease.outBack(Math.min(1, local * 1.8)), out);
    return;
  }
  if (af < snap) {
    lerpPose(poses.antic, poses.strike, ease.outBack((af + 1) / snap), out);
    return;
  }
  const followEnd = A + Math.floor(R * 0.4);
  if (af < followEnd) {
    const t = (af - snap) / Math.max(1, followEnd - snap);
    lerpPose(poses.strike, poses.follow, ease.outQuad(t), out);
    return;
  }
  const t = Math.min(1, (af - followEnd) / Math.max(1, A + R - followEnd));
  tmp.set(f.grounded ? P.stance : P.airIdle);
  // keep spin continuous: return to the nearest full rotation
  const fs = poses.follow[Ch.spin];
  tmp[Ch.spin] = Math.round(fs / (Math.PI * 2)) * Math.PI * 2;
  lerpPose(poses.follow, tmp, ease.inOutQuad(t), out);
  if (!f.grounded) out[Ch.plant] = 0;
}

/** Ground-plane helper exported for renderer. */
export const GROUND = WORLD.groundY;
