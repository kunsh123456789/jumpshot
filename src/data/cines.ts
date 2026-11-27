import { ANIMS } from './anims';
import './anims/cineSet';
import { WORLD } from './tuning';
import { isBoss } from './enemies';
import type { Fighter } from '../sim/fighter';
import { fx, hero, place, pose, strike, tween, type CineCtx, type CineScript } from '../sim/cine';

/**
 * Cinematic scripts (revision pass 8): per-weapon AIR FINISHERS, LAST-HIT KO
 * finishers and SPECIAL moves. Each runs one frame at a time on the sim clock
 * (see sim/cine.ts). Frame numbers are 60 Hz ticks from the start. Five
 * families are fully scripted (fists, staff, laser, hook, throw); the other
 * weapons use the family closest to their feel (WEAPON_FAMILY) with their own
 * names, and their own held weapon drawn in the hero's hands.
 */
export type Family = 'fists' | 'staff' | 'laser' | 'hook' | 'throw';
export const WEAPON_FAMILY: Record<string, Family> = {
  fists: 'fists', hammer: 'fists',
  staff: 'staff', daggers: 'staff', scythe: 'hook',
  laser: 'laser', ice: 'laser', raygun: 'laser',
  hook: 'hook', whip: 'hook',
};
/** Special names per weapon (the family script with its own name). */
export const SPECIAL_NAME: Record<string, string> = {
  fists: 'MEGA JUMPSHOT', hammer: 'EARTHSPLITTER',
  staff: 'CYCLONE', daggers: 'BLADE STORM', scythe: 'REAPER',
  laser: 'OVERLOAD BEAM', ice: 'DEEP FREEZE', raygun: 'DEATH RAY',
  hook: 'WEB TAKEDOWN', whip: 'LION TAMER',
};

const G = WORLD.groundY;
const TAU = Math.PI * 2;

/** Show the attack drawing `id` so that its CONTACT drawing lands on frame `fc` of the cinematic. */
function heroHit(c: CineCtx, id: string, fc: number): void {
  const d = ANIMS[id];
  if (!d) return;
  const C = d.contact >= 0 ? d.contact : 0;
  hero(c, id, Math.min(d.len - 1, Math.max(0, C + (c.f - fc))));
}
/** Loop drawing `id` from frame f0. */
function heroLoop(c: CineCtx, id: string, f0: number, rate = 1): void {
  const d = ANIMS[id];
  if (!d) return;
  hero(c, id, Math.floor((c.f - f0) * rate) % d.len);
}
const facing = (c: CineCtx) => c.p.facing || 1;
function faceTo(p: Fighter, x: number): void { if (x !== p.x) p.facing = x > p.x ? 1 : -1; }

// ======================================================================= AIR FINISHERS (A4.1)
const airFists: CineScript = {
  id: 'air.fists', name: 'JUMPSHOT FINISHER', len: () => 50,
  start: (c) => { c.v.x0 = c.p.x; c.v.y0 = c.p.y; c.v.tx = c.main!.x; c.v.ty = c.main!.y; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    place(m, c.v.tx, c.v.ty); pose(m, 'launched', 6);
    if (f === 0) { fx(c, 'whoosh', p.x, p.cy); faceTo(p, m.x); }
    if (f < 12) { hero(c, 'jumpFlip', f * 2); place(p, tween(c, 0, 12, c.v.x0, m.x - facing(c) * 12), tween(c, 0, 12, c.v.y0, m.y - 150)); }
    else if (f < 26) {
      if (f === 12) { fx(c, 'slowmo', p.x, p.cy, 0.22); fx(c, 'focus', p.x, p.cy, 0.3); }
      hero(c, 'cine_axeWind', f - 12); place(p, m.x - facing(c) * 12, m.y - 150);
    } else {
      heroHit(c, 'cine_axeHit', 27);
      if (f === 27) { strike(c, m, 30, { vx: 0, vy: 2700, release: true, kind: 'spike', shock: 360, weight: 1.2 }); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.4); fx(c, 'scribble', m.x, m.cy, 120); }
      place(p, p.x, Math.min(G, p.y + (f - 27) * 9));
    }
  },
  end: (c) => { if (c.main && c.main.state === 'cine') strike(c, c.main, 0, { vy: 2600, vx: 0, release: true, kind: 'spike', shock: 300 }); },
};

const airStaff: CineScript = {
  id: 'air.staff', name: 'POLE-PLANT DIVE', len: () => 52,
  start: (c) => { c.v.x0 = c.p.x; c.v.y0 = c.p.y; c.v.tx = c.main!.x; c.v.ty = c.main!.y; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f < 22) { place(m, c.v.tx, c.v.ty); pose(m, 'launched', 6); }
    if (f === 0) faceTo(p, m.x);
    if (f < 14) { heroLoop(c, 'st_aheli', 0); place(p, tween(c, 0, 14, c.v.x0, m.x), tween(c, 0, 14, c.v.y0, m.y - 170)); if (f % 5 === 0) fx(c, 'whirl', p.x, p.cy, 0.6); }
    else if (f < 32) {
      if (f === 14) { fx(c, 'slowmo', p.x, p.cy, 0.25); fx(c, 'focus', p.x, p.cy, 0.25); }
      heroHit(c, 'st_plunge', 22);
      if (f === 22) { strike(c, m, 28, { vx: 0, vy: 3000, release: true, kind: 'spike', shock: 420, weight: 1.2 }); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.2); }
      place(p, p.x, f < 22 ? m.y - 170 : tween(c, 22, 32, c.v.ty - 170, G));
    } else {
      if (f === 32) { fx(c, 'bigCrack', p.x, G, 1.6); fx(c, 'dust', p.x, G); }
      heroHit(c, 'cine_plant', 33); place(p, p.x, G);
    }
  },
  end: (c) => { if (c.main && c.main.state === 'cine') strike(c, c.main, 0, { vy: 2600, vx: 0, release: true, kind: 'spike' }); },
};

const airLaser: CineScript = {
  id: 'air.laser', name: 'MEGA-BEAM', len: () => 58,
  start: (c) => { c.v.x0 = c.p.x; c.v.y0 = c.p.y; c.v.tx = c.main!.x; c.v.ty = c.main!.y; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f === 0) faceTo(p, m.x);
    if (f < 10) { heroHit(c, 'lz_spikeH', 10); place(p, tween(c, 0, 10, c.v.x0, m.x - facing(c) * 20), tween(c, 0, 10, c.v.y0, Math.min(c.v.y0, m.y - 230))); }
    else if (f < 42) {
      if (f === 10) { fx(c, 'slowmo', p.x, p.cy, 0.3); fx(c, 'invert', p.x, p.cy); fx(c, 'focus', p.x, p.cy, 0.25); }
      hero(c, 'cine_beam', (f - 10) % 6);
      const my = tween(c, 10, 34, c.v.ty, G);
      place(m, m.x, my); pose(m, 'hurtHeavy', 2);
      c.vis.beam = { x1: p.x + facing(c) * 14, y1: p.cy + 20, x2: m.x, y2: G + 10, w: 30 };
      if (f % 5 === 0) { strike(c, m, 5, { quiet: true }); fx(c, 'shake', m.x, m.cy, 0.5); }
      if (f === 34) { fx(c, 'bigCrack', m.x, G, 1.4); fx(c, 'lightning', m.x, G - 40); }
    } else {
      c.vis.beam = null;
      if (f === 42) { strike(c, m, 14, { vx: facing(c) * 200, vy: -400, release: true, kind: 'finisher', weight: 1.1 }); fx(c, 'invert', m.x, m.cy); }
      hero(c, 'jumpFall', (f - 42) % 15);
    }
  },
  end: (c) => { c.vis.beam = null; if (c.main && c.main.state === 'cine') strike(c, c.main, 0, { vy: -300, release: true }); },
};

const airHook: CineScript = {
  id: 'air.hook', name: 'ROPE RING SLAM', len: () => 56,
  start: (c) => { c.v.a0 = Math.atan2(c.main!.cy - c.p.cy, c.main!.x - c.p.x); },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f === 0) faceTo(p, m.x);
    const hx = p.x + facing(c) * 20, hy = p.cy - 10;
    if (f < 10) { heroHit(c, 'hk_air', 6); pose(m, 'launched', 6); if (f === 6) fx(c, 'whoosh', p.x, p.cy); }
    else if (f < 36) {
      if (f === 10) { fx(c, 'slowmo', p.x, p.cy, 0.35); fx(c, 'focus', p.x, p.cy, 0.2); }
      heroLoop(c, 'hk_swingH', 10, 0.8);
      const a = c.v.a0 + tween(c, 10, 34, 0, TAU * (facing(c) > 0 ? 1 : -1) + (Math.PI / 2 - c.v.a0) * 0);
      const r = tween(c, 10, 30, 150, 130);
      place(m, p.x + Math.cos(a) * r, Math.min(G, p.cy + Math.sin(a) * r + 60)); pose(m, 'tumble', f);
      m.spinAngle = a * 2;
      if (f % 8 === 0) fx(c, 'whirl', p.x, p.cy, 0.7);
    } else {
      heroHit(c, 'hk_slamH', 38);
      if (f < 40) place(m, tween(c, 36, 40, m.x, p.x + facing(c) * 120), tween(c, 36, 40, m.y, G));
      if (f === 40) { strike(c, m, 30, { vx: 0, vy: 1400, release: true, kind: 'spike', shock: 380, weight: 1.2 }); fx(c, 'bigCrack', m.x, G, 1.5); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.2); }
    }
    c.vis.ropes = m.state === 'cine' && f >= 6 ? [hx, hy, m.x, m.cy] : [];
  },
  end: (c) => { c.vis.ropes = []; if (c.main && c.main.state === 'cine') strike(c, c.main, 0, { vy: 1200, release: true, kind: 'spike' }); },
};

const airThrow: CineScript = {
  id: 'air.throw', name: 'SPINNING PILE-DRIVER', len: () => 58,
  start: (c) => { c.v.x0 = c.p.x; c.v.y0 = c.p.y; c.v.my = c.main!.y; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f === 0) faceTo(p, m.x);
    if (f < 8) { heroHit(c, 'th_pile', 8); place(p, tween(c, 0, 8, c.v.x0, m.x), tween(c, 0, 8, c.v.y0, m.y - 100)); pose(m, 'hurtHeavy', 4); }
    else if (f < 38) {
      if (f === 8) { fx(c, 'slowmo', p.x, p.cy, 0.3); fx(c, 'focus', p.x, p.cy, 0.3); }
      hero(c, 'cine_pile', f - 8);
      const y = tween(c, 10, 38, c.v.my, G);
      place(m, m.x, y); pose(m, 'held', f);
      place(p, m.x, y - 70);
      const spin = (f - 8) * 0.55;
      c.p.cineSpin = spin; m.spinAngle = Math.PI + spin;
      if (f % 6 === 0) fx(c, 'whirl', m.x, m.cy, 0.8);
    } else {
      c.p.cineSpin = 0;
      if (f === 38) { strike(c, m, 34, { vx: facing(c) * 300, vy: 700, release: true, kind: 'spike', shock: 380, weight: 1.3 }); fx(c, 'bigCrack', m.x, G, 1.7); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.5); }
      heroHit(c, 'jumpHardLand', 40); place(p, p.x, Math.min(G, p.y + 12));
    }
  },
  end: (c) => { c.p.cineSpin = 0; if (c.main && c.main.state === 'cine') strike(c, c.main, 0, { vy: 900, release: true, kind: 'spike' }); },
};

// ======================================================================= LAST-HIT KO FINISHERS (A4.2)
/** Shared KO setup: the victim stands dazed in front of the hero. */
function koSetup(c: CineCtx, dist: number): void {
  const p = c.p, m = c.main!;
  m.spinAngle = 0;
  const side = Math.sign(m.x - p.x) || p.facing;
  p.facing = side;
  place(m, p.x + side * dist, G, p.x);
  if (!p.grounded) place(p, p.x, G);
  pose(m, 'stunned', 0);
  m.deathStyle = 0;
}
const koFists: CineScript = {
  id: 'ko.fists', name: 'K.O. ROUNDHOUSE', len: () => 62,
  start: (c) => { koSetup(c, 74); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.35); },
  frame: (c) => {
    const m = c.main!, f = c.f;
    hero(c, 'cine_roundhouse', f);
    if (f < 15) pose(m, 'stunned', f);
    if (f === 15) { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 1500, vy: -760, release: true, kind: 'finisher', weight: 1.4 }); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.4); fx(c, 'stars', m.x, m.cy); }
  },
  end: (c) => { const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 1500, vy: -760, release: true }); } },
};
/**
 * Hammer KO (designed from the player's sketch): the last enemy is floored, the hero stands over it
 * with the hammer raised high overhead in slow motion, then brings it down for the kill.
 */
const koHammer: CineScript = {
  id: 'ko.hammer', name: 'HAMMER CRUSH', len: () => 78,
  start: (c) => { koSetup(c, 84); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.4); c.v.x0 = c.p.x; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f, side = facing(c);
    // the victim crumples to the floor, then lies there
    pose(m, 'knockdown', f < 14 ? f : 13);
    place(m, m.x, G);
    // hero: steps up beside the body, raises the hammer (held long), then slams
    if (f < 40) { hero(c, 'cine_hammerUp', f); place(p, c.v.x0, G); }
    else heroHit(c, 'cine_hammerSlam', 42);
    if (f === 20) fx(c, 'stars', p.x, p.cy - 60, 0.5);
    if (f === 42) {
      m.deathStyle = 0;
      strike(c, m, 0, { vx: side * 120, vy: -380, release: true, kind: 'finisher', weight: 1.5 });
      fx(c, 'bigCrack', m.x, G, 2.2); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 2.2); fx(c, 'boom', m.x, m.cy); fx(c, 'dust', m.x, G);
    }
  },
  end: (c) => { const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 0; strike(c, m, 0, { vx: facing(c) * 120, vy: -380, release: true }); } },
};
/**
 * Ice KO (designed from the player's sketch): the last enemy is dazed, the hero coils and lunges, an ice spear drives
 * clean through its body (an impact frame as it lands), the enemy hangs on it, then the spear shatters.
 */
const koIce: CineScript = {
  id: 'ko.ice', name: 'ICE SPEAR', len: () => 74,
  start: (c) => { koSetup(c, 175); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.35); c.v.x0 = c.p.x; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f, d = facing(c);
    heroHit(c, 'cine_lunge', 16);
    // the lunge: a fast step in to arm's length
    if (f >= 8 && f < 16) place(p, tween(c, 8, 16, c.v.x0, m.x - d * 54), G);
    // the spear: drawn back while coiling, then driven through (butt behind the hero, tip well past the target)
    const y = p.cy - 4;
    if (f < 8) c.vis.spear = { x1: p.x - d * 118, y1: y, x2: p.x + d * 112, y2: y };
    else if (f < 46) { const tx = f < 16 ? tween(c, 8, 16, p.x + d * 112, m.x + d * 96) : m.x + d * 96; c.vis.spear = { x1: tx - d * 250, y1: y, x2: tx, y2: y }; }
    else c.vis.spear = null;
    if (f < 16) { pose(m, 'stunned', f); if (f % 6 === 0) fx(c, 'stars', m.x, m.cy - 70, 0.4); }
    else if (f < 46) pose(m, 'hurtHeavy', 0);
    if (f === 16) { fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.8); fx(c, 'sparks', m.x, m.cy); fx(c, 'boom', m.x, m.cy); }
    if (f > 16 && f < 46 && f % 5 === 0) fx(c, 'sparks', m.x, m.cy, 0.35);
    if (f === 46) {
      c.w.events.emit('shatter', { x: m.x, y: m.cy });
      m.deathStyle = 0; strike(c, m, 0, { vx: d * 520, vy: -420, release: true, kind: 'finisher', weight: 1.2 });
    }
  },
  end: (c) => { c.vis.spear = null; const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 0; strike(c, m, 0, { vx: facing(c) * 520, vy: -420, release: true }); } },
};
const koStaff: CineScript = {
  id: 'ko.staff', name: 'X-SLASH', len: () => 58,
  start: (c) => { koSetup(c, 90); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.3); c.v.x0 = c.p.x; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    hero(c, 'cine_xslash', f);
    if (f >= 5 && f <= 12) place(p, tween(c, 5, 12, c.v.x0, m.x + facing(c) * 70), G);
    const cx = m.x, cy = m.cy;
    if (f === 5) { c.vis.slash.push({ x1: cx - 70, y1: cy - 70, x2: cx + 70, y2: cy + 70, t: 44 }); fx(c, 'invert', cx, cy); fx(c, 'shake', cx, cy, 0.8); }
    if (f === 12) { c.vis.slash.push({ x1: cx + 70, y1: cy - 70, x2: cx - 70, y2: cy + 70, t: 38 }); fx(c, 'invert', cx, cy); fx(c, 'shake', cx, cy, 1.0); }
    pose(m, f < 30 ? 'stunned' : 'knockdown', f < 30 ? f : f - 30);
    if (f === 34) { m.deathStyle = 0; strike(c, m, 0, { vx: 0, vy: -120, release: true, kind: 'finisher', weight: 1.0 }); fx(c, 'dust', m.x, G); }
  },
  end: (c) => { const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 0; strike(c, m, 0, { vx: 0, vy: -120, release: true }); } },
};
const koLaser: CineScript = {
  id: 'ko.laser', name: 'POINT-BLANK', len: () => 54,
  start: (c) => { koSetup(c, 64); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.35); },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    heroHit(c, 'lz_blastH', 18);
    if (f < 18) { pose(m, 'stunned', f); if (f % 6 === 0) fx(c, 'stars', p.x + facing(c) * 30, p.cy - 10, 0.5); }
    if (f >= 18 && f < 26) c.vis.beam = { x1: p.x + facing(c) * 30, y1: p.cy - 8, x2: m.x + facing(c) * 60, y2: m.cy, w: 34 };
    else c.vis.beam = null;
    if (f === 18) { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 1700, vy: -520, release: true, kind: 'finisher', weight: 1.4 }); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.3); fx(c, 'sparks', m.x, m.cy); }
    if (f > 18 && f < 40 && f % 3 === 0 && c.main) fx(c, 'sparks', c.main.x, c.main.cy, 0.4);
  },
  end: (c) => { c.vis.beam = null; const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 1700, vy: -520, release: true }); } },
};
const koHook: CineScript = {
  id: 'ko.hook', name: 'PULL & UPPERCUT', len: () => 60,
  start: (c) => { koSetup(c, 330); fx(c, 'focus', c.p.x, c.p.cy, 0.3); c.v.mx = c.main!.x; },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f < 20) { heroHit(c, 'hk_pull', 6); place(m, tween(c, 6, 18, c.v.mx, p.x + facing(c) * 52), G); pose(m, 'hurtHeavy', 3); }
    else heroHit(c, 'launcher', 26);
    if (f === 18) fx(c, 'slowmo', p.x, p.cy, 0.3);
    c.vis.ropes = f >= 4 && f < 26 && m.state === 'cine' ? [p.x + facing(c) * 20, p.cy - 10, m.x, m.cy] : [];
    if (f === 26) { fx(c, 'sparks', (p.x + m.x) / 2, p.cy - 10); m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 180, vy: -1900, release: true, kind: 'finisher', weight: 1.4 }); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.2); }
  },
  end: (c) => { c.vis.ropes = []; const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 1; strike(c, m, 0, { vx: 0, vy: -1900, release: true }); } },
};
const koThrow: CineScript = {
  id: 'ko.throw', name: 'BOWLING TOSS', len: () => 70,
  start: (c) => { koSetup(c, 56); fx(c, 'focus', c.p.x, c.p.cy, 0.3); },
  frame: (c) => {
    const p = c.p, m = c.main!, f = c.f;
    if (f < 8) { heroHit(c, 'th_longArm', 6); pose(m, 'hurtHeavy', 2); }
    else if (f < 40) {
      if (f === 8) fx(c, 'slowmo', p.x, p.cy, 0.45);
      heroLoop(c, 'cine_spin', 8, 1 + (f - 8) / 30);
      const a = (f - 8) * (0.25 + (f - 8) * 0.012);
      place(m, p.x + Math.cos(a) * 92, G - 50 - Math.sin(a) * 18); pose(m, 'held', f); m.spinAngle = a;
      if (f % 6 === 0) fx(c, 'whirl', p.x, p.cy, 0.8);
    } else {
      heroHit(c, 'cine_hurl', 41);
      if (f === 41) { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 2600, vy: -260, release: true, kind: 'finisher', weight: 1.4 }); fx(c, 'invert', p.x, p.cy); fx(c, 'stars', p.x + facing(c) * 60, p.cy); fx(c, 'shake', p.x, p.cy, 1.0); }
    }
  },
  end: (c) => { const m = c.main; if (m && m.state === 'cine') { m.deathStyle = 1; strike(c, m, 0, { vx: facing(c) * 2600, vy: -260, release: true }); } },
};

/**
 * Boss deaths: a bigger multi-stage version: three heavy blows with inverted
 * frames and growing cracks (the boss reels between them), then the weapon's
 * own KO finisher.
 */
function bossKO(base: CineScript): CineScript {
  const PRE = 54;
  const strikes = [8, 24, 40];
  return {
    id: base.id + '.boss', name: 'BOSS ' + base.name, len: (c) => PRE + base.len(c),
    start: (c) => { koSetup(c, 80); fx(c, 'slowmo', c.p.x, c.p.cy, 0.3); fx(c, 'focus', c.p.x, c.p.cy, 0.4); },
    frame: (c) => {
      if (c.f < PRE) {
        const m = c.main!, f = c.f;
        const k = strikes.findIndex((s) => f < s + 10);
        // Fists: the hundred-fist FLURRY; other weapons: three heavy blows.
        if (base.id === 'ko.fists') heroLoop(c, 'flurry', 0);
        else heroHit(c, k === 1 ? 'cross' : k === 2 ? 'launcherH' : 'jab1', strikes[Math.max(0, k)] ?? strikes[2]);
        pose(m, 'hurtHeavy', (f % 16));
        if (strikes.includes(f)) { const i = strikes.indexOf(f); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 0.8 + i * 0.4); fx(c, i === 2 ? 'bigCrack' : 'crack', m.x, G, 1 + i * 0.4); fx(c, 'scribble', m.x, m.cy, 60 + i * 30); place(m, m.x + facing(c) * 18, G); }
        return;
      }
      if (c.f === PRE) { const save = c.f; base.start?.(c); c.f = save; }
      const save = c.f; c.f -= PRE; base.frame(c); c.f = save;
    },
    end: (c) => base.end(c),
  };
}

// ======================================================================= SPECIAL MOVES (B4)
/** Mega Jumpshot: ground eruption launches everyone, leap to the apex, more kicks for a better trace, meteor axe-kick. */
const spFists: CineScript = {
  id: 'sp.fists', name: 'MEGA JUMPSHOT',
  len: (c) => 40 + kicks(c) * 8 + 40,
  start: (c) => { c.v.y0 = c.p.y; c.p.y = Math.min(c.p.y, G); },
  frame: (c) => {
    const p = c.p, f = c.f, grp = c.group, K = kicks(c);
    const top = G - 300;
    if (f < 16) {
      heroHit(c, 'cine_erupt', 9);
      place(p, p.x, tween(c, 0, 8, c.v.y0, G));
      if (f === 9) { fx(c, 'bigCrack', p.x, G, 2.0); fx(c, 'scribble', p.x, G - 30, 150); fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.5); for (const e of grp) strike(c, e, 8, { quiet: true }); }
      grp.forEach((e, i) => { if (f >= 9) { place(e, e.x + (p.x + facing(c) * (70 + i * 34) - e.x) * 0.15, tween(c, 9, 30, G, top + 20 - (i % 3) * 36)); pose(e, 'launched', 4); } });
    } else if (f < 40) {
      hero(c, 'jumpFlip', (f - 16) * 0.9);
      place(p, tween(c, 16, 38, p.x, p.x), tween(c, 16, 36, G, top - 20));
      grp.forEach((e, i) => { place(e, e.x + (p.x + facing(c) * (70 + i * 34) - e.x) * 0.15, tween(c, 9, 30, G, top + 20 - (i % 3) * 36)); pose(e, 'tumble', f); });
    } else if (f < 40 + K * 8) {
      const k = Math.floor((f - 40) / 8), lf = (f - 40) % 8;
      heroHit(c, ['akick1', 'akick2', 'akick3'][k % 3], 40 + k * 8 + 3);
      const t = grp[k % Math.max(1, grp.length)];
      if (t && lf === 3) { strike(c, t, 9, { weight: 0.45 }); fx(c, 'shake', t.x, t.cy, 0.5); if (k === K - 1) fx(c, 'invert', t.x, t.cy); }
      if (t && lf < 3) place(p, t.x - facing(c) * 60, t.y - 10);
      grp.forEach((e) => { pose(e, 'tumble', f); e.y = Math.max(top - 40, e.y - 0.6); });
    } else {
      const f0 = 40 + K * 8;
      if (f < f0 + 12) { hero(c, 'cine_axeWind', f - f0); const cx = avgX(grp, p.x); place(p, cx, top - 70); if (f === f0) fx(c, 'slowmo', p.x, p.cy, 0.25); }
      else {
        heroHit(c, 'cine_axeHit', f0 + 13);
        if (f === f0 + 13) {
          for (const e of grp) strike(c, e, 22, { vx: (e.x - p.x) * 2, vy: 2600, release: true, kind: 'spike', weight: 1.3 });
          fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 2); fx(c, 'bigCrack', p.x, G, 2.4); fx(c, 'lightning', p.x, G - 60);
        }
        place(p, p.x, Math.min(G, p.y + 14));
      }
      if (f < f0 + 13) grp.forEach((e) => pose(e, 'tumble', f));
    }
  },
  end: (c) => { for (const e of c.group) if (e.state === 'cine') strike(c, e, 0, { vy: 2400, vx: 0, release: true, kind: 'spike' }); },
};
function kicks(c: CineCtx): number { return Math.min(7, 2 + c.qte + (c.tier === 2 ? 2 : 0)); }
function avgX(g: Fighter[], fb: number): number { if (!g.length) return fb; let s = 0; for (const e of g) s += e.x; return s / g.length; }

/** Cyclone: the traced spiral becomes a tornado that sucks everyone in, spins them, hurls them out; staff plant splits the floor. */
const spStaff: CineScript = {
  id: 'sp.staff', name: 'CYCLONE',
  len: (c) => 14 + spinT(c) + 46,
  start: (c) => { c.group.forEach((e, i) => { c.v['a' + i] = Math.atan2(0, e.x - c.p.x) + i; c.v['r' + i] = Math.abs(e.x - c.p.x); }); place(c.p, c.p.x, G); },
  frame: (c) => {
    const p = c.p, f = c.f, T = spinT(c), grp = c.group;
    if (f < 14 + T) {
      heroLoop(c, 'st_heliH', 0);
      const R = tween(c, 0, 14, 20, 150);
      c.vis.tornado = { x: p.x, y: G, r: R, h: tween(c, 0, 20, 60, 380) };
      if (f % 6 === 0) fx(c, 'whirl', p.x, G - 120, 1.2);
      grp.forEach((e, i) => {
        const a = c.v['a' + i] + f * 0.22;
        const r = tween(c, 0, 18, c.v['r' + i], 110 + (i % 3) * 26);
        place(e, p.x + Math.cos(a) * r, G - tween(c, 4, 30, 0, 90 + (i % 4) * 50) - Math.sin(f * 0.1 + i) * 12);
        pose(e, 'tumble', f); e.spinAngle = a * 1.5;
        if (f > 14 && (f + i) % 10 === 0) strike(c, e, 3 + c.tier, { quiet: true });
      });
      if (f === 14) fx(c, 'slowmo', p.x, p.cy, 0.5);
    } else {
      const f0 = 14 + T;
      c.vis.tornado = f < f0 + 6 ? { x: p.x, y: G, r: 150 * (1 - (f - f0) / 6), h: 380 } : null;
      if (f === f0) { for (const e of grp) { const d = Math.sign(e.x - p.x) || 1; strike(c, e, 14, { vx: d * 1300, vy: -800, release: true, kind: 'launch', weight: 1.0 }); } fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.2); }
      heroHit(c, 'cine_plant', f0 + 14);
      if (f === f0 + 14) {
        fx(c, 'bigCrack', p.x, G, 2.2); fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.6);
        for (const dx of [-220, -120, 120, 220]) fx(c, 'crack', p.x + dx, G, 1.2);
      }
    }
  },
  end: (c) => { c.vis.tornado = null; for (const e of c.group) if (e.state === 'cine') { const d = Math.sign(e.x - c.p.x) || 1; strike(c, e, 0, { vx: d * 1200, vy: -700, release: true }); } },
};
function spinT(c: CineCtx): number { return 50 + c.qte * 12 + (c.tier === 2 ? 20 : 0); }

/**
 * Overload Beam: charge an orb at the fist, then fire a horizontal blast (white core, ragged flame
 * edge) across the whole screen in the traced direction. Everyone in its path is held, pushed along
 * it and hit repeatedly, then launched when it collapses. PERFECT fires it longer and wider.
 */
const CHARGE = 40;
const BEAM_TONE: Record<string, string> = { ice: '#3fd8ff', raygun: '#3dff7a' };
const spLaser: CineScript = {
  id: 'sp.laser', name: 'OVERLOAD BEAM',
  len: (c) => CHARGE + 8 + sweepT(c) + 26,
  start: (c) => {
    place(c.p, c.p.x, Math.min(c.p.y, G));
    c.v.dir = Math.cos(c.aim) >= 0 ? 1 : -1;
  },
  frame: (c) => {
    const p = c.p, f = c.f, S = sweepT(c), dir = c.v.dir;
    p.facing = dir;
    const hx = p.x + dir * 34 * p.scale, hy = p.cy - 14 * p.scale;   // the fist
    const far = dir > 0 ? c.w.camRight + 260 : c.w.camLeft - 260;
    const tone = BEAM_TONE[c.weaponId] ?? '#ff2a1f';
    if (f < CHARGE) {
      hero(c, 'cine_charge', f % 6);
      if (f === 0) fx(c, 'laserCharge', hx, hy);
      if (f % 8 === 0) { fx(c, 'lightning', hx, hy, 0.6); fx(c, 'stars', hx, hy - 30, 0.4); }
      c.vis.beam = { x1: hx, y1: hy, x2: hx, y2: hy, w: 6 + (f / CHARGE) * 24, style: 'blast', tone, t: f - CHARGE };
      return;
    }
    const g = f - CHARGE, W0 = 58 + c.tier * 12;
    if (g === 0) { fx(c, 'laserFire', hx, hy, (8 + S + 12) / 60); fx(c, 'invert', hx, hy); fx(c, 'shake', hx, hy, 1.4); }
    hero(c, g < 8 + S + 12 ? 'cine_beam' : 'cine_charge', g % 6);
    let w = W0 * (1 + 0.06 * Math.sin(g * 0.9)), x2 = far;
    if (g < 8) { const k = (g + 1) / 8; x2 = hx + (far - hx) * (k * k * (3 - 2 * k)); w *= 0.6 + 0.4 * k; }
    else if (g < 8 + S) { if (g % 6 === 0) fx(c, 'shake', hx + dir * 200, hy, 0.45); }
    else { if (g === 8 + S) fx(c, 'laserEnd', hx, hy); w *= Math.max(0, 1 - (g - 8 - S) / 12); }
    c.vis.beam = w > 0.5 ? { x1: hx, y1: hy, x2, y2: hy, w, style: 'blast', tone, t: g } : null;
    if (g < 8 + S) {
      for (const e of c.w.enemies) {
        if (!e.alive || e.state === 'ko') continue;
        const along = (e.x - hx) * dir;
        if (along < -20 || along > (x2 - hx) * dir || Math.abs(e.cy - hy) > w + 46 * e.scale) continue;
        if (!c.w.cine.held.includes(e)) c.w.cine.grab(e);
        if (!c.group.includes(e)) c.group.push(e);
        pose(e, 'hurtHeavy', 2);
        place(e, Math.max(WORLD.wallMargin, Math.min(WORLD.arenaW - WORLD.wallMargin, e.x + dir * 1.6)), Math.min(e.y, G));
        if ((c.v['h' + e.id] ?? -99) < f - 10) { c.v['h' + e.id] = f; strike(c, e, 4, { weight: 0.55, quiet: true }); }
      }
    }
    if (g === 8 + S + 12) {
      for (const e of c.group) strike(c, e, 12, { vx: dir * 900, vy: -520, release: true, kind: 'launch', weight: 1.1 });
      fx(c, 'shake', hx, hy, 1.6);
    }
  },
  end: (c) => { c.vis.beam = null; for (const e of c.group) if (e.state === 'cine') strike(c, e, 0, { vy: -600, release: true }); },
};
function sweepT(c: CineCtx): number { return 60 + c.qte * 8 + (c.tier === 2 ? 40 : 0); }

/** Web Takedown: a rope to each connected enemy (trace order), yank them into a ball, slam it down. */
const spHook: CineScript = {
  id: 'sp.hook', name: 'WEB TAKEDOWN',
  len: (c) => 10 + c.group.length * 4 + 26 + 36,
  frame: (c) => {
    const p = c.p, f = c.f, grp = c.group, n = grp.length;
    const hx = p.x + facing(c) * 20, hy = p.cy - 10;
    const fire = 10 + n * 4;
    const bx = p.x + facing(c) * 140, by = G - 250;
    c.vis.ropes = [];
    if (f < fire) {
      heroLoop(c, 'hk_air', 0);
      grp.forEach((e, i) => { if (f >= 6 + i * 4) { c.vis.ropes.push(hx, hy, e.x, e.cy); if (f === 6 + i * 4) { strike(c, e, 6 + c.tier * 2, { quiet: true }); fx(c, 'sparks', e.x, e.cy, 0.5); } pose(e, 'hurtHeavy', 2); } });
    } else if (f < fire + 26) {
      heroHit(c, 'hk_pull', fire + 4);
      if (f === fire) fx(c, 'slowmo', p.x, p.cy, 0.4);
      grp.forEach((e, i) => { const a = (i / Math.max(1, n)) * TAU; place(e, tween(c, fire, fire + 20, e.x, bx + Math.cos(a) * 26), tween(c, fire, fire + 20, e.y, by + Math.sin(a) * 22)); pose(e, 'tumble', f); c.vis.ropes.push(hx, hy, e.x, e.cy); });
      if (f === fire + 22) { fx(c, 'invert', bx, by); fx(c, 'scribble', bx, by - 40, 90); for (const e of grp) strike(c, e, 6, { quiet: true }); }
    } else {
      const f0 = fire + 26;
      heroHit(c, 'hk_slamH', f0 + 8);
      if (f < f0 + 8) grp.forEach((e, i) => { place(e, e.x, tween(c, f0, f0 + 8, by + i * 4, G - 20)); c.vis.ropes.push(hx, hy, e.x, e.cy); });
      if (f === f0 + 8) {
        for (const e of grp) strike(c, e, 18 + c.qte * 3, { vx: (Math.sign(e.x - bx) || 1) * 300, vy: 1600, release: true, kind: 'spike', weight: 1.3 });
        fx(c, 'bigCrack', bx, G, 2.2); fx(c, 'invert', bx, G - 40); fx(c, 'shake', bx, G, 1.8);
      }
    }
  },
  end: (c) => { c.vis.ropes = []; for (const e of c.group) if (e.state === 'cine') strike(c, e, 0, { vy: 1400, release: true, kind: 'spike' }); },
};

/** Hammer Swing: grab the biggest enemy, spin it (the traced circle), hurl it like a wrecking ball along the aimed direction. */
const spThrow: CineScript = {
  id: 'sp.throw', name: 'HAMMER SWING',
  len: (c) => 12 + swingT(c) + 54,
  start: (c) => { place(c.p, c.p.x, G); c.v.dir = Math.cos(c.aim) >= 0 ? 1 : -1; c.v.mx0 = c.main ? c.main.x : c.p.x; },
  frame: (c) => {
    const p = c.p, m = c.main, f = c.f, T = swingT(c);
    if (!m) return;
    if (f < 12) { heroHit(c, 'th_longArm', 8); place(m, tween(c, 0, 10, c.v.mx0, p.x + facing(c) * 60), G - tween(c, 0, 10, 0, 40)); pose(m, 'hurtHeavy', 3); }
    else if (f < 12 + T) {
      heroLoop(c, 'cine_spin', 12, 1 + (f - 12) / 40);
      const a = (f - 12) * (0.2 + (f - 12) * 0.006);
      place(m, p.x + Math.cos(a) * 96, G - 60 - Math.sin(a) * 20); pose(m, 'held', f); m.spinAngle = a;
      if (f % 6 === 0) fx(c, 'whirl', p.x, p.cy, 1);
      if ((f - 12) % 12 === 0) strike(c, m, 4 + c.tier, { quiet: true });
      for (const e of c.w.enemies) {
        if (e === m || !e.alive || e.state === 'ko' || c.v['b' + e.id]) continue;
        if (Math.abs(e.x - m.x) < 70 && Math.abs(e.cy - m.cy) < 90) { c.v['b' + e.id] = 1; if (!c.w.cine.held.includes(e)) c.w.cine.grab(e); strike(c, e, 12, { vx: (Math.sign(e.x - p.x) || 1) * 900, vy: -520, release: true, kind: 'launch', weight: 0.9 }); fx(c, 'stars', e.x, e.cy); }
      }
    } else {
      const f0 = 12 + T, dir = c.v.dir;
      heroHit(c, 'cine_hurl', f0 + 3);
      if (f === f0 + 3) { faceTo(p, p.x + dir); fx(c, 'invert', p.x, p.cy); fx(c, 'slowmo', p.x, p.cy, 0.5); }
      if (f >= f0 + 3) {
        const x = m.x + dir * 42;
        place(m, x, G - 40); pose(m, 'tumble', f); m.spinAngle += 0.6;
        for (const e of c.w.enemies) {
          if (e === m || !e.alive || e.state === 'ko' || c.v['b' + e.id]) continue;
          if (Math.abs(e.x - m.x) < 64) { c.v['b' + e.id] = 1; if (!c.w.cine.held.includes(e)) c.w.cine.grab(e); strike(c, e, 16 + c.qte * 2, { vx: dir * 1100, vy: -640, release: true, kind: 'launch', weight: 1.1 }); fx(c, 'stars', e.x, e.cy); fx(c, 'shake', e.x, e.cy, 0.8); }
        }
        if (x <= WORLD.wallMargin + 4 || x >= WORLD.arenaW - WORLD.wallMargin - 4 || f === f0 + 50) {
          if (m.state === 'cine') { strike(c, m, 22 + c.tier * 6, { vx: -dir * 400, vy: -700, release: true, kind: 'launch', weight: 1.4 }); fx(c, 'stars', m.x, m.cy); fx(c, 'invert', m.x, m.cy); fx(c, 'shake', m.x, m.cy, 1.6); fx(c, 'crack', m.x, G, 1.2); }
        }
      }
    }
  },
  end: (c) => { const m = c.main; if (m && m.state === 'cine') strike(c, m, 10, { vy: -600, release: true }); },
};
function swingT(c: CineCtx): number { return 36 + c.qte * 10 + (c.tier === 2 ? 16 : 0); }

// ======================================================================= lookup

// ======================================================================= WEAPON SPECIALS (pass 9)
// Each of these weapons has its own Special (and trace path, ui/specialInput.ts), approved list.
const grabAll = (c: CineCtx) => { for (const e of c.group) if (!c.w.cine.held.includes(e)) c.w.cine.grab(e); };
const releaseAll = (c: CineCtx, vy = -500) => { for (const e of c.group) if (e.state === 'cine') strike(c, e, 0, { vy, release: true }); };

/** Lion Tamer: lashes spin every enemy like a top, then one crack yanks them all into a pile and launches it. */
const spWhip: CineScript = {
  id: 'sp.whip', name: 'LION TAMER',
  len: (c) => 20 + c.group.length * 9 + 44,
  start: (c) => { place(c.p, c.p.x, G); grabAll(c); c.group.forEach((e, i) => { c.v['x' + i] = e.x; }); },
  frame: (c) => {
    const p = c.p, f = c.f, grp = c.group, n = grp.length, f0 = 20 + n * 9;
    const hx = p.x + facing(c) * 30, hy = p.cy - 20;
    c.vis.ropes = [];
    if (f < 20) { hero(c, 'cine_charge', f % 6); if (f === 0) fx(c, 'whoosh', p.x, p.cy); }
    grp.forEach((e, i) => {
      const t0 = 20 + i * 9;
      if (f >= t0 && f < f0) {
        e.spinAngle += 0.55; pose(e, 'tumble', f);
        if (f < t0 + 4) c.vis.ropes.push(hx, hy, e.cx, e.cy);
        if (f === t0) { faceTo(p, e.x); strike(c, e, 5 + c.tier, { quiet: true }); fx(c, 'sparks', e.cx, e.cy, 0.6); }
      }
      if (f >= f0 && f < f0 + 16) {
        const px = p.x + facing(c) * 130 + (i - (n - 1) / 2) * 14;
        place(e, tween(c, f0, f0 + 14, c.v['x' + i], px), G - tween(c, f0, f0 + 14, 0, 40 + (i % 3) * 30));
        e.spinAngle += 0.3; pose(e, 'tumble', f);
        c.vis.ropes.push(hx, hy, e.cx, e.cy);
      }
    });
    if (f >= 20 && f < f0) heroLoop(c, 'wh_lash', 20, 1.4);
    if (f >= f0) heroHit(c, 'cine_hurl', f0 + 16);
    if (f === f0 + 16) {
      for (const e of grp) strike(c, e, 16 + c.tier * 4, { vx: facing(c) * 900, vy: -1100, release: true, kind: 'launch', weight: 1.1 });
      fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.6); fx(c, 'bigCrack', p.x + facing(c) * 130, G, 1.4);
    }
  },
  end: (c) => { c.vis.ropes = []; releaseAll(c, -700); },
};

/** Earthsplitter: leap, slam, and the floor splits both ways, slabs launching everyone it reaches. */
const spHammer: CineScript = {
  id: 'sp.hammer', name: 'EARTHSPLITTER',
  len: () => 96,
  start: (c) => { c.v.x0 = c.p.x; grabAll(c); },
  frame: (c) => {
    const p = c.p, f = c.f;
    if (f < 18) { hero(c, 'cine_axeWind', f); place(p, c.v.x0, G - tween(c, 0, 16, 0, 320)); }
    else if (f < 26) { heroHit(c, 'cine_axeHit', 25); place(p, c.v.x0, G - tween(c, 18, 25, 320, 0)); }
    else hero(c, 'cine_axeHit', 20);
    if (f === 25) { fx(c, 'bigCrack', p.x, G, 2.4); fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 2); c.vis.crack = { x: p.x, len: 0 }; }
    if (f >= 25 && c.vis.crack) c.vis.crack.len = tween(c, 25, 62, 0, 1000);
    for (const e of c.group) {
      const k = 'h' + e.id;
      if (!c.v[k] && c.vis.crack && Math.abs(e.x - c.v.x0) < c.vis.crack.len) { c.v[k] = f; fx(c, 'crack', e.x, G, 1); strike(c, e, 10 + c.tier * 3, { quiet: true }); }
      if (c.v[k]) {
        const t = f - c.v[k];
        place(e, e.x, G - Math.sin(Math.min(1, t / 40) * Math.PI) * (260 + c.tier * 40));
        pose(e, 'launched', t); e.spinAngle = t * 0.12;
      }
    }
    if (f === 80) { for (const e of c.group) strike(c, e, 10 + c.tier * 3, { vy: -700, release: true, kind: 'launch', weight: 1 }); fx(c, 'shake', p.x, p.cy, 1.2); }
    if (f >= 84) c.vis.crack = null;
  },
  end: (c) => { c.vis.crack = null; releaseAll(c, -600); },
};

/** Blade Storm: time stops; blink behind every enemy leaving slashes in the air, then every slash lands at once. */
const spDaggers: CineScript = {
  id: 'sp.daggers', name: 'BLADE STORM',
  len: (c) => 14 + c.group.length * 7 + 34,
  start: (c) => { c.v.x0 = c.p.x; grabAll(c); c.vis.marks = []; },
  frame: (c) => {
    const p = c.p, f = c.f, grp = c.group, n = grp.length, f0 = 14 + n * 7;
    c.vis.dark = f < f0 + 12 ? Math.min(0.55, f / 14) : Math.max(0, 0.55 - (f - f0 - 12) / 10);
    if (f < 14) hero(c, 'cine_charge', f % 6);
    grp.forEach((e, i) => {
      pose(e, 'hurtHeavy', 0);
      const t0 = 14 + i * 7;
      if (f === t0) {
        const side = e.x > c.v.x0 ? 1 : -1;
        place(p, e.x + side * 64, G, e.x);
        fx(c, 'whoosh', p.x, p.cy);
        c.vis.marks.push(e.cx, e.cy - 10, (i % 2 ? 1 : -1) * 0.8, e.cx, e.cy + 6, (i % 2 ? -1 : 1) * 0.6);
      }
      if (f >= t0 && f < t0 + 7) heroHit(c, 'cine_xslash', t0 + 3);
    });
    if (f === f0) { place(p, c.v.x0, G); hero(c, 'cine_charge', 0); }
    if (f === f0 + 10) {
      fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.8);
      for (const e of grp) strike(c, e, 18 + c.tier * 5, { vx: (Math.sign(e.x - p.x) || 1) * 700, vy: -800, release: true, kind: 'launch', weight: 1.1 });
      c.vis.marks = [];
    }
  },
  end: (c) => { c.vis.marks = []; c.vis.dark = 0; releaseAll(c, -600); },
};

/** Deep Freeze: the whole screen freezes solid, enemies become ice statues, one punch shatters everything. */
const spIce: CineScript = {
  id: 'sp.ice', name: 'DEEP FREEZE',
  len: () => 78,
  start: (c) => { grabAll(c); },
  frame: (c) => {
    const p = c.p, f = c.f;
    c.vis.freeze = f < 44 ? tween(c, 0, 18, 0, 1) : tween(c, 44, 62, 1, 0);
    for (const e of c.group) { pose(e, 'hurtHeavy', 0); if (f < 44) { e.frozen = 2; } }
    if (f === 10) fx(c, 'stars', p.x, p.cy - 40, 0.6);
    if (f < 30) hero(c, 'cine_charge', f % 6); else heroHit(c, 'cine_axeHit', 44);
    if (f === 44) {
      fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 2); fx(c, 'boom', p.x, p.cy);
      for (const e of c.group) { c.w.events.emit('shatter', { x: e.cx, y: e.cy }); strike(c, e, 20 + c.tier * 5, { vx: (Math.sign(e.x - p.x) || 1) * 800, vy: -900, release: true, kind: 'launch', weight: 1.1 }); }
    }
  },
  end: (c) => { c.vis.freeze = 0; releaseAll(c, -600); },
};

/** Reaper: the world drains to black and white; a giant shadow scythe sweeps the screen and their souls heal you. */
const spScythe: CineScript = {
  id: 'sp.scythe', name: 'REAPER',
  len: () => 80,
  start: (c) => { grabAll(c); },
  frame: (c) => {
    const p = c.p, f = c.f, d = facing(c);
    c.vis.bw = f < 56 ? tween(c, 0, 12, 0, 1) : tween(c, 56, 70, 1, 0);
    if (f < 14) hero(c, 'cine_charge', f % 6); else heroLoop(c, 'cine_spin', 14);
    // the swing: from high behind the hero, over the top, down through everything in front (mirrored when facing left)
    const px = p.x, py = p.cy - 30;
    if (f >= 14 && f < 50) {
      const ar = tween(c, 14, 44, -Math.PI * 0.85, Math.PI * 0.12);
      c.vis.scythe = { x: px, y: py, a: d > 0 ? ar : Math.PI - ar, r: 430 };
      for (const e of c.group) {
        const k = 'h' + e.id;
        const ang = Math.atan2(e.cy - py, (e.x - px) * d);
        if (!c.v[k] && ar >= ang) { c.v[k] = 1; strike(c, e, 16 + c.tier * 5, { weight: 1 }); pose(e, 'tumble', 0); }
        if (c.v[k]) { e.spinAngle += 0.2; }
        else pose(e, 'hurtHeavy', 0);
      }
    } else c.vis.scythe = null;
    if (f === 50) {
      fx(c, 'invert', p.x, p.cy); fx(c, 'shake', p.x, p.cy, 1.4);
      for (const e of c.group) { c.w.v2.spawnSoul(e.cx, e.cy); strike(c, e, 6, { vx: (Math.sign(e.x - p.x) || 1) * 500, vy: -900, release: true, kind: 'launch', weight: 1 }); }
    }
  },
  end: (c) => { c.vis.bw = 0; c.vis.scythe = null; releaseAll(c, -600); },
};
const SP2: Record<string, CineScript> = { whip: spWhip, hammer: spHammer, daggers: spDaggers, ice: spIce, scythe: spScythe };
/** What a weapon's Special is: its own (SP2) or its family's. Also picks the trace path. */
export type SpecialKind = Family | 'whip' | 'hammer' | 'daggers' | 'ice' | 'scythe';
export function specialKind(weapon: string): SpecialKind { return SP2[weapon] ? (weapon as SpecialKind) : familyOf(weapon); }

const AIR: Record<Family, CineScript> = { fists: airFists, staff: airStaff, laser: airLaser, hook: airHook, throw: airThrow };
const KO: Record<Family, CineScript> = { fists: koFists, staff: koStaff, laser: koLaser, hook: koHook, throw: koThrow };
const SP: Record<Family, CineScript> = { fists: spFists, staff: spStaff, laser: spLaser, hook: spHook, throw: spThrow };
/** Weapons with their own KO finisher instead of their family's. */
const KO_OWN: Record<string, CineScript> = { hammer: koHammer, ice: koIce };
const BOSS_KO: Record<string, CineScript> = {};

export function familyOf(weapon: string): Family { return WEAPON_FAMILY[weapon] ?? 'fists'; }
export function airFinisher(weapon: string): CineScript { return AIR[familyOf(weapon)]; }
export function koFinisher(weapon: string, victim: Fighter): CineScript {
  const base = KO_OWN[weapon] ?? KO[familyOf(weapon)];
  if (isBoss(victim)) return BOSS_KO[base.id] ?? (BOSS_KO[base.id] = bossKO(base));
  return base;
}
export function specialScript(weapon: string): CineScript {
  const own = SP2[weapon];
  if (own) return own;
  const s = SP[familyOf(weapon)];
  return { ...s, name: SPECIAL_NAME[weapon] ?? s.name };
}
