import { clamp } from '../core/math';
import { Ch, shortDelta } from './rig';
import type { Fighter } from '../sim/fighter';
import type { Animator } from './animator';
import { DRAW } from './drawStyle';
import { ANIM, MOVE } from '../data/tuning';
import { ANIMS, getAnim } from '../data/anims';
import type { AnimDef } from '../data/anims/types';
import { RIGS } from './rig';

/**
 * Chooses which authored animation each fighter shows, and at what time,
 * from its sim state. Gameplay frame data is the source of truth: attack
 * animations are time-mapped so the authored CONTACT key lands exactly on the
 * move's first active frame, and hit-stop (a frozen fighter) holds it.
 * Pure presentation: reads sim state, never writes it.
 */
/** Rhythm Mode: beat phase/count for beat-locked idle loops (null in Classic). */
let poseBeat: { phase: number; count: number } | null = null;
export function setPoseBeat(b: { phase: number; count: number } | null): void { poseBeat = b; }

/** Idle loops have two bobs per cycle: lock each bob to a beat. */
function beatIdle(a: Animator): void {
  if (!poseBeat || !a.cur || !a.cur.loop) return;
  const L = a.cur.len;
  a.clock = a.t = (L / 4 + ((poseBeat.count & 1) + poseBeat.phase) * (L / 2)) % L;
}

export function poseFighter(f: Fighter, _time: number): void {
  const a = f.anim;
  if (a.rig === RIGS.player && f.kind !== 'player') a.rig = RIGS[f.kind] ?? RIGS.grunt;
  a.intentSnap = f.impact > 0;
  const frozen = f.hitstop > 0;
  const rate = frozen ? 0 : 1;
  const kind = f.kind;

  // ---------------- Player attacks ----------------
  if (f.team === 'player' && f.state === 'move' && f.move) {
    const m = f.move;
    const def = ANIMS[m.id] ?? ANIMS.jab1;
    const restart = a.moveSerial !== f.moveSerial;
    if (restart) a.moveSerial = f.moveSerial;
    // Rhythm Mode snapping re-times the startup; play the authored anticipation stretched/compressed over it.
    // Hand-Drawn: show the drawing of the frame just processed, so the contact drawing appears on the
    // exact tick the first active frame (the hit) is resolved, and an attack's first drawing on its first tick.
    const fr = DRAW.stepped ? Math.max(0, f.moveFrame - 1) : f.moveFrame;
    const t = f.snapBase > 0 && fr < f.effStartup
      ? moveTime(def, f.snapBase, (fr * f.snapBase) / f.effStartup)
      : moveTime(def, f.effStartup, fr);
    if (t < 0) {
      // Magnetism dash: authored dash pose; the strike's anticipation starts straight out of it.
      a.run(f.grounded ? ANIMS.dash : ANIMS.airDash, rate, ANIM.fadeCancel, restart);
      a.pendingStrike = true;
    } else {
      const fresh = restart || a.pendingStrike;
      a.pendingStrike = false;
      a.show(def, t, ANIM.fadeCancel, fresh);
    }
    a.trailColor = m.trail.color;
    a.trailWidth = m.trail.width * 0.7;
    return;
  }

  // ---------------- Enemy attacks (telegraph = stretched wind-up) ----------------
  if (f.team === 'enemy' && (f.state === 'windup' || f.state === 'attack' || f.state === 'recover') && f.attack) {
    const atk = f.attack;
    const def = getAnim(kind, atk.id);
    const C = def.contact >= 0 ? def.contact : 8;
    let t: number;
    if (f.state === 'windup') {
      const total = Math.max(1, f.timer + f.stateFrame);
      t = (C * f.stateFrame) / total;
    } else if (f.state === 'attack') t = C + (DRAW.stepped ? Math.max(0, f.stateFrame - 1) : f.stateFrame);
    else t = C + atk.active + f.stateFrame;
    a.show(def, Math.min(def.len, t), ANIM.fadeFrames);
    a.trailColor = '#ff6a6a';
    a.trailWidth = 7 * f.scale;
    return;
  }

  // ---------------- Hit reactions ----------------
  const newHit = a.hitSerial !== f.hitSerial;
  if (newHit) a.hitSerial = f.hitSerial;
  const newCue = a.cueSerial !== f.cueSerial;
  if (newCue) a.cueSerial = f.cueSerial;

  switch (f.state) {
    case 'hurt': case 'hitstun': {
      const def = f.hitBehind ? ANIMS.hurtBehind : f.hitHeavy ? ANIMS.hurtHeavy : ANIMS.hurtLight;
      a.run(def, rate, ANIM.fadeHit, newHit);
      if (!f.grounded) a.flags.snapping = true;
      return;
    }
    case 'air': case 'ko': {
      if (f.splat > 0) { a.run(ANIMS.wallSplat, rate, ANIM.fadeHit, a.cur !== ANIMS.wallSplat); tumbleSpin(f, a); return; }
      if (newCue && f.cue === 'bounce') { a.run(ANIMS.groundBounce, rate, ANIM.fadeHit, true); tumbleSpin(f, a); return; }
      if (a.cur === ANIMS.groundBounce && a.playing('groundBounce')) { a.run(ANIMS.groundBounce, rate); tumbleSpin(f, a); return; }
      if (newHit || (a.cur !== ANIMS.launched && a.cur !== ANIMS.tumble && a.cur !== ANIMS.wallSplat)) {
        a.run(ANIMS.launched, rate, ANIM.fadeHit, true);
        a.spinBase = f.spinAngle;
      } else if (a.cur === ANIMS.launched && !a.playing('launched')) {
        a.run(ANIMS.tumble, rate, 2);
        a.spinBase = f.spinAngle - a.spinAdd;
      } else {
        a.run(a.cur ?? ANIMS.tumble, rate);
      }
      tumbleSpin(f, a);
      return;
    }
    case 'knockdown': case 'dead': {
      if (a.cur !== ANIMS.knockdown && a.cur !== ANIMS.lying) a.run(ANIMS.knockdown, rate, ANIM.fadeLand, true);
      else if (a.cur === ANIMS.knockdown && !a.playing('knockdown')) a.run(ANIMS.lying, rate, 2);
      else a.run(a.cur!, rate);
      return;
    }
    case 'getup': {
      const total = Math.max(1, f.timer + f.stateFrame);
      a.show(ANIMS.getup, (ANIMS.getup.len * f.stateFrame) / total, 2);
      return;
    }
    case 'held': a.run(getAnim(kind, 'held'), rate, 2); tumbleSpin(f, a); return;
    case 'pulled': a.run(getAnim(kind, 'pulled'), rate, 2); return;
    case 'stunned': a.run(ANIMS.stunned, rate, 3); return;
    case 'guardbreak': a.run(ANIMS.guardbreak, rate, ANIM.fadeHit); return;
    case 'burst': a.run(ANIMS.burst, rate, ANIM.fadeHit); return;
    case 'dodge': a.show(ANIMS.dodge, (f.stateFrame * ANIMS.dodge.len) / Math.max(1, f.dodgeLen), 1); return;
    case 'jumpFollow': a.run(ANIMS.leap, rate, 2); return;
    case 'fall': {
      if (newCue && f.cue === 'parry') { a.run(ANIMS.parry, rate, 1, true); return; }
      if (a.playing('parry') || a.playing('leap')) { a.run(a.cur!, rate); return; }
      a.run(ANIMS.fall, rate, 4); return;
    }
    case 'land': a.run(ANIMS.land, rate, ANIM.fadeLand); return;
    case 'taunt': a.run(getAnim(kind, 'taunt'), rate, 4); return;
    case 'walk':
      if (newCue && f.cue === 'draw') { a.run(ANIMS.drawWeapon, rate, 1, true); return; }
      locomotion(f, a, rate, true); return;
    case 'idle': default: {
      if (newCue && f.cue === 'parry') { a.run(ANIMS.parry, rate, 1, true); return; }
      if (newCue && f.cue === 'draw') { a.run(ANIMS.drawWeapon, rate, 1, true); return; }
      // one-shots that finish even though the sim is already idle
      if (a.playing('parry') || a.playing('land') || a.playing('runStop') || a.playing('drawWeapon')) { a.run(a.cur!, rate); return; }
      locomotion(f, a, rate, false);
    }
  }
}

/** Map a move frame to animation time: contact key == first active frame. Returns -1 while dashing. */
export function moveTime(def: AnimDef, S: number, fr: number): number {
  const C = def.contact >= 0 ? def.contact : S;
  if (fr < S) {
    if (S >= C) { const pre = S - C; return fr < pre ? -1 : fr - pre; }
    return (fr * C) / S;
  }
  return C + (fr - S);
}

/** The sim's tumble spin added on top of the authored limbs, continuous across switches. */
function tumbleSpin(f: Fighter, a: Animator): void {
  a.spinAdd = a.spinAdd + shortDelta(a.spinAdd, f.spinAngle - a.spinBase);
}

/** Idle / run with authored start, stop (skid) and turn animations. */
function locomotion(f: Fighter, a: Animator, rate: number, moving: boolean): void {
  const kind = f.kind;
  const speed = Math.abs(f.vx);
  if (f.team === 'enemy') {
    if (moving) {
      const walk = getAnim(kind, 'walk');
      const ref = kind === 'brute' || kind === 'boss' ? 167 : kind === 'rusher' ? 340 : 190;
      a.run(walk, rate * clamp(speed / ref, 0.5, 1.6), 5);
    } else {
      a.run(getAnim(kind, 'idle'), rate, 6);
      if (poseBeat && rate > 0) beatIdle(a);
    }
    a.lastSpeed = speed;
    return;
  }
  // Player.
  if (moving) {
    const runRate = rate * clamp(speed / MOVE.runSpeed, ANIM.runRateMin, ANIM.runRateMax);
    if (a.loco === 'run' && f.facing !== a.locoFacing) { a.loco = 'turn'; a.run(ANIMS.runTurn, rate, 2, true); }
    else if (a.loco === 'none' || a.loco === 'stop') { a.loco = 'start'; a.run(ANIMS.runStart, rate, 3, true); }
    else if ((a.loco === 'start' || a.loco === 'turn') && a.cur && !a.playing(a.cur.id)) { a.loco = 'run'; a.run(ANIMS.run, runRate, 1, true); }
    else if (a.loco === 'run') a.run(ANIMS.run, runRate, 2);
    else a.run(a.cur ?? ANIMS.run, rate);
    a.locoFacing = f.facing;
    a.lastSpeed = speed;
    return;
  }
  if ((a.loco === 'run' || a.loco === 'turn') && a.lastSpeed > ANIM.skidMinSpeed) {
    a.loco = 'stop';
    a.run(ANIMS.runStop, rate, 2, true);
  } else if (a.loco === 'stop' && a.playing('runStop')) {
    a.run(ANIMS.runStop, rate);
  } else {
    a.loco = 'none';
    if (f.stateFrame > ANIM.tauntIdleFrames && f.stateFrame < ANIM.tauntIdleFrames + ANIMS.taunt.len) a.run(ANIMS.taunt, rate, 6);
    else { a.run(ANIMS.idle, rate, 5); if (poseBeat && rate > 0) beatIdle(a); }
  }
  a.lastSpeed = speed;
  // Head follows the target a little in idle.
  if (f.hasLook && a.cur === ANIMS.idle) {
    const dy = f.lookY - (f.y - 118 * f.scale);
    a.headLook = clamp(Math.atan2(dy, Math.abs(f.lookX - f.x) + 40) * 0.6, -ANIM.headLook, ANIM.headLook);
  } else a.headLook = 0;
}

export { Ch };
