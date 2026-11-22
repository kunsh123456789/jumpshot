import { clamp } from '../core/math';
import { Ch, shortDelta } from './rig';
import type { Fighter } from '../sim/fighter';
import type { Animator } from './animator';
import { DRAW } from './drawStyle';
import { ANIM, MOVE } from '../data/tuning';
import { ANIMS, getAnim } from '../data/anims';
import type { AnimDef } from '../data/anims/types';
import { RIGS } from './rig';
import '../data/anims/heroSet';
import '../data/anims/enemySet';
import { gripPose, gripWeight, WEAPON_VICTORY, type GripState } from '../data/weapons/grips';
import { PLAYER } from '../data/tuning';

/** Lay the equipped weapon's grip pose over the hero's locomotion drawing. */
function grip(f: Fighter, a: Animator, st: GripState | null): void {
  if (f.team !== 'player' || !st || f.weaponOut) { a.grip = null; a.gripW = 0; return; }
  a.grip = gripPose(f.weapon, st);
  a.gripW = a.grip ? gripWeight(f.weapon, st) : 0;
}

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
  a.grip = null; a.gripW = 0;
  const frozen = f.hitstop > 0;
  const rate = frozen ? 0 : 1;
  const kind = f.kind;

  // ---------------- Scripted cinematics (finishers, specials) ----------------
  if (f.state === 'cine') {
    const def = ANIMS[f.cineAnim] ?? getAnim(kind, 'idle');
    a.show(def, Math.min(def.len, f.cineT), 1);
    return;
  }

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
    const def = getAnim(kind, atk.anim ?? atk.id);
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
      const def = f.team === 'player' && !f.grounded ? ANIMS.hurtAir
        : f.hitAbove ? ANIMS.hurtAbove
        : f.hitBehind ? ANIMS.hurtBehind : f.hitHeavy ? ANIMS.hurtHeavy : ANIMS.hurtLight;
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
      if (f.team === 'player' && !f.alive) { a.run(ANIMS.deathCollapse, rate, 3, a.cur !== ANIMS.deathCollapse); return; }
      if (a.cur !== ANIMS.knockdown && a.cur !== ANIMS.lying) a.run(ANIMS.knockdown, rate, ANIM.fadeLand, true);
      else if (a.cur === ANIMS.knockdown && !a.playing('knockdown')) a.run(ANIMS.lying, rate, 2);
      else a.run(a.cur!, rate);
      return;
    }
    case 'getup': {
      const total = Math.max(1, f.timer + f.stateFrame);
      // Short get-ups (quick recoveries) kip up; long ones climb up slowly.
      const g = total <= 16 && ANIMS.getupQuick ? ANIMS.getupQuick : ANIMS.getup;
      a.show(g, (g.len * f.stateFrame) / total, 2);
      return;
    }
    case 'held': a.run(getAnim(kind, 'held'), rate, 2); tumbleSpin(f, a); return;
    case 'pulled': a.run(getAnim(kind, 'pulled'), rate, 2); return;
    case 'stunned': a.run(ANIMS.stunned, rate, 3); return;
    case 'guardbreak': a.run(ANIMS.guardbreak, rate, ANIM.fadeHit); return;
    case 'burst': a.run(ANIMS.burst, rate, ANIM.fadeHit); return;
    case 'dodge': {
      const d = f.grounded ? ANIMS.dodge : ANIMS.airDodge;
      a.show(d, (f.stateFrame * d.len) / Math.max(1, f.dodgeLen), 1); return;
    }
    case 'jumpSquat': a.show(ANIMS.jumpSquat, Math.min(ANIMS.jumpSquat.len - 1, f.stateFrame), 1); grip(f, a, 'crouch'); return;
    case 'jumpFollow': case 'fall': {
      if (newCue && f.cue === 'parry') { a.run(ANIMS.parryFlash, rate, 1, true); return; }
      if (a.playing('parryFlash')) { a.run(a.cur!, rate); return; }
      if (f.team === 'player') { airborne(f, a, rate); return; }
      if (f.state === 'jumpFollow') { a.run(ANIMS.leap, rate, 2); return; }
      a.run(ANIMS.fall, rate, 4); return;
    }
    case 'land': {
      if (f.team === 'player') {
        const hard = newCue && f.cue === 'hardLand';
        if (hard || a.playing('jumpHardLand')) { a.run(ANIMS.jumpHardLand, rate, 1, hard); grip(f, a, 'land'); return; }
        a.run(ANIMS.jumpLand, rate, ANIM.fadeLand, a.cur !== ANIMS.jumpLand); grip(f, a, 'land'); return;
      }
      a.run(ANIMS.land, rate, ANIM.fadeLand); return;
    }
    case 'taunt': a.run(getAnim(kind, 'taunt'), rate, 4); return;
    case 'walk':
      if (newCue && f.cue === 'draw') { a.run(ANIMS.weaponSwap, rate, 1, true); return; }
      locomotion(f, a, rate, true); if (f.team === 'player') grip(f, a, 'run'); return;
    case 'idle': default: {
      if (newCue && f.cue === 'parry') { a.run(f.team === 'player' ? ANIMS.parryFlash : ANIMS.parry, rate, 1, true); return; }
      if (newCue && f.cue === 'draw') { a.run(ANIMS.weaponSwap, rate, 1, true); return; }
      if (newCue && f.cue === 'victory') { a.run(ANIMS[WEAPON_VICTORY[f.weapon] ?? 'victory_pump'] ?? ANIMS.idle, rate, 2, true); return; }
      if (newCue && f.cue === 'entrance') { a.run(ANIMS.entrance, rate, 1, true); return; }
      if (newCue && f.cue === 'hardLand') { a.run(ANIMS.jumpHardLand, rate, 1, true); grip(f, a, 'land'); return; }
      // one-shots that finish even though the sim is already idle
      if (a.playing('parry') || a.playing('parryFlash') || a.playing('land') || a.playing('jumpLand') || a.playing('jumpHardLand') || a.playing('runStop')
        || a.playing('drawWeapon') || a.playing('weaponSwap') || a.playing('entrance') || (a.cur && a.cur.id.startsWith('victory_') && a.playing(a.cur.id))) {
        a.run(a.cur!, rate);
        if (a.cur!.id === 'jumpLand' || a.cur!.id === 'jumpHardLand') grip(f, a, 'land');
        return;
      }
      if (f.team === 'player' && f.crouch) { a.run(ANIMS.crouch, rate, 3); grip(f, a, 'crouch'); return; }
      locomotion(f, a, rate, false);
      if (f.team === 'player') grip(f, a, a.loco === 'none' ? 'idle' : 'run');
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
      const ref = kind === 'brute' || kind === 'boss' || kind === 'juggernaut' ? 167 : kind === 'rusher' || kind === 'shadow' ? 340 : 190;
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
    else if (f.idleFrames > ANIM.boredIdleFrames && !poseBeat) a.run(ANIMS.idleBored, rate, 6);
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

/**
 * The hero in the air (pass 8 jump set): which drawing depends on what put it there and where it
 * is in the arc. Launcher leaps and vaults tuck-flip first; air jumps burst; drag/tap jumps
 * stretch out of the squat. Then rise -> apex hang -> fall, leaning with the air-drift input.
 */
function airborne(f: Fighter, a: Animator, rate: number): void {
  const k = f.jumpKind;
  const fr = f.airFrames;
  let def: AnimDef;
  if ((k === 'leap') && fr < ANIMS.jumpFlip.len) def = ANIMS.jumpFlip;
  else if (k === 'air' && fr < ANIMS.airJump.len) def = ANIMS.airJump;
  else if (k === 'hop' && fr < ANIMS.airDodge.len) def = ANIMS.airDodge;
  else if (k === 'jump' && fr < ANIMS.jumpLaunch.len) def = ANIMS.jumpLaunch;
  else if (f.vy < -PLAYER.apexVy) def = ANIMS.jumpRise;
  else if (f.vy < PLAYER.apexVy) def = ANIMS.jumpApex;
  else if (f.drift > 0.3) def = ANIMS.airDriftF;
  else if (f.drift < -0.3) def = ANIMS.airDriftB;
  else def = ANIMS.jumpFall;
  const oneShot = def === ANIMS.jumpFlip || def === ANIMS.airJump || def === ANIMS.airDodge || def === ANIMS.jumpLaunch;
  if (oneShot) a.show(def, fr, 1, a.cur !== def);
  else a.run(def, rate, def === ANIMS.jumpApex ? 3 : 2);
  if (def === ANIMS.jumpRise || def === ANIMS.jumpApex || def === ANIMS.jumpFall || def === ANIMS.jumpLaunch) grip(f, a, 'air');
}
