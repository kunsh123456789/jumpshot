import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { strikeAnim, LOW, AIRP } from './author';
import { J, type PoseSpec } from '../../render/rig';
import { PLAYER } from '../tuning';

/**
 * THROW (grab gloves): throwing people around. Every swipe dashes to the
 * nearest enemy in that direction, GRABS it, and throws it in the swipe
 * direction: the swipe aims the throw. The thrown body is a live projectile
 * that bowls through everyone it hits (damage falls off per collision), and
 * it can be re-grabbed mid-air for juggles made of throws. A grab beats a
 * shield's guard; Brutes keep their footing until their poise is broken.
 *
 * Frame data: the dash, then `grab.hold` frames of hold/wind-up, then the
 * release on the contact frame (Rhythm Mode lands the release on the grid).
 */
const C = '#ffd23f';
const tr = (w = 14) => ({ limb: 'handA' as const, color: C, width: w });
const G = (bowl: number, hold: number) => ({ bowl, hold, respectPoise: true });
const base = { hitbox: { x: 54, y: 90, r: 46 }, reach: 46, poise: 2.6, sound: 'heavy' as const, aimCone: 70 };

const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
/** Air version of a ground throw (re-grabs and air throws). */
const air = (id: string, src: string, o: Partial<MoveInput> = {}) => {
  const s = m[src];
  add({ ...s, id, tags: [...s.tags.filter((t) => t !== 'air'), 'air'], selfVY: -180, cancelInto: CANCEL.air, ...o } as MoveInput);
};

add({ ...base, id: 'th_toss', family: 'th_toss', name: 'Quick Toss', tags: ['light', 'guardbreak'], startup: 8, active: 3, recovery: 14,
  damage: 8, hitstun: 30, kbX: 560, kbY: -360, hitstop: 4, shake: 4, grab: G(1.2, 5), grid: 2, cancelInto: CANCEL.light, weight: 0.45, trail: tr() });
add({ ...base, id: 'th_heave', family: 'th_heave', name: 'Overhead Heave', tags: ['heavy', 'guardbreak'], startup: 16, active: 4, recovery: 22,
  damage: 16, hitstun: 40, kbX: 1350, kbY: -560, hitstop: 8, shake: 10, zoom: 0.45, grab: G(2.0, 14), grid: 1, fx: { crescent: true },
  slowmo: { scale: 0.35, sec: 0.3 }, cancelInto: CANCEL.heavy, weight: 0.95, afterimage: true, trail: tr(18) });
add({ ...base, id: 'th_up', family: 'th_up', name: 'Toss Up', tags: ['launcher', 'guardbreak'], startup: 10, active: 3, recovery: 16,
  damage: 10, hitstun: 40, kbX: 40, kbY: 0, hitstop: 6, shake: 7, zoom: 0.3, launch: -1300, follow: true, grab: G(1.0, 6), grid: 1,
  cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.65, afterimage: true, trail: tr(16) });
add({ ...base, id: 'th_pile', family: 'th_pile', name: 'Pile-Driver', tags: ['light', 'down', 'guardbreak'], startup: 14, active: 3, recovery: 20,
  damage: 13, hitstun: 44, kbX: 60, kbY: 1900, spike: true, impactShock: { radius: 240, damage: 10 }, hitstop: 8, shake: 12, zoom: 0.45,
  grab: G(1.4, 12), grid: 1, slowmo: { scale: 0.35, sec: 0.3 }, cancelInto: CANCEL.heavy, sound: 'spike', weight: 0.9, afterimage: true, trail: tr(16) });
add({ ...base, id: 'th_pileH', family: 'th_pile', name: 'Meteor Driver', tags: ['heavy', 'down', 'guardbreak'], startup: 18, active: 3, recovery: 24,
  damage: 17, hitstun: 48, kbX: 60, kbY: 2200, spike: true, impactShock: { radius: 330, damage: 14 }, hitstop: 9, shake: 16, zoom: 0.6,
  grab: G(1.6, 16), grid: 1, slowmo: { scale: 0.3, sec: 0.4 }, cancelInto: CANCEL.heavy, sound: 'spike', weight: 1, afterimage: true, trail: tr(18) });
add({ ...base, id: 'th_bowlHi', family: 'th_bowl', name: 'Bowling Lob', tags: ['light', 'guardbreak'], startup: 10, active: 3, recovery: 16,
  damage: 9, hitstun: 36, kbX: 1150, kbY: -470, hitstop: 5, shake: 6, grab: G(1.6, 6), grid: 2, cancelInto: CANCEL.light, weight: 0.6, trail: tr() });
add({ ...base, id: 'th_bowlHiH', family: 'th_bowl', name: 'Bowling Lob+', tags: ['heavy', 'guardbreak'], startup: 15, active: 4, recovery: 20,
  damage: 13, hitstun: 40, kbX: 1420, kbY: -540, hitstop: 7, shake: 9, zoom: 0.3, grab: G(2.2, 11), grid: 1, cancelInto: CANCEL.heavy, weight: 0.85, afterimage: true, trail: tr(16) });
add({ ...base, id: 'th_bowlLo', family: 'th_bowl', name: 'Bowling Throw', tags: ['light', 'guardbreak'], startup: 10, active: 3, recovery: 16,
  damage: 9, hitstun: 36, kbX: 1280, kbY: -230, hitstop: 5, shake: 6, grab: G(1.8, 6), grid: 2, cancelInto: CANCEL.light, weight: 0.6, trail: tr() });
add({ ...base, id: 'th_bowlLoH', family: 'th_bowl', name: 'Strike!', tags: ['heavy', 'guardbreak'], startup: 15, active: 4, recovery: 20,
  damage: 13, hitstun: 40, kbX: 1550, kbY: -260, hitstop: 7, shake: 9, zoom: 0.3, grab: G(2.4, 11), grid: 1, cancelInto: CANCEL.heavy, weight: 0.85, afterimage: true, trail: tr(16) });
// Long arm (gif2 200-232): the arm stretches out, grabs, and drags the enemy in upside down, then the
// over-the-shoulder slam (gif2 262-284) puts it into the floor behind the hero.
add({ id: 'th_longArm', family: 'th_long', name: 'Long Arm', tags: ['heavy', 'guardbreak'], startup: 9, active: 3, recovery: 16,
  damage: 5, hitstun: 40, kbX: 0, kbY: 0, hitstop: 4, shake: 5, hitbox: { x: 50, y: 92, r: 1 }, reach: 300, ranged: 460, dash: false, aimCone: 60,
  tether: { mode: 'pull', frames: 12 }, then: 'th_shoulder', grid: 1, cancelFrom: 99, cancelInto: [], sound: 'heavy', weight: 0.6, trail: tr() });
add({ ...base, id: 'th_shoulder', family: 'th_long', name: 'Over-the-Shoulder', tags: ['heavy', 'down', 'guardbreak'], startup: 12, active: 3, recovery: 20,
  damage: 15, hitstun: 46, kbX: 80, kbY: 1900, spike: true, impactShock: { radius: 230, damage: 9 }, hitstop: 8, shake: 13, zoom: 0.5, dash: false,
  grab: { bowl: 1.4, hold: 8, respectPoise: false, behind: true }, grid: 1, slowmo: { scale: 0.35, sec: 0.3 }, fx: { crescent: true },
  cancelInto: CANCEL.heavy, weight: 0.95, afterimage: true, trail: tr(18) });
// air: re-grab a thrown body and throw it again
air('th_atoss', 'th_toss', { kbY: -420 });
air('th_aheave', 'th_heave', { selfVY: -120 });
air('th_aup', 'th_up', { launch: -1150, follow: false, cancelFrom: 3 });
air('th_apile', 'th_pile', { selfVY: -360 });
air('th_abowl', 'th_bowlLo', { kbY: -180 });

// ------------------------------------------------------------------ drawings
/** Reach-and-grab (both gloves forward), then the type-specific wind-up, release and follow-through. */
const REACH: PoseSpec = { ...LOW, lean: 0.7, rootX: 10, aU: 1.5, aL: 0.25, bU: 1.35, bL: 0.4, footA: 44, footB: -40, head: -0.25 };
const HOLD: PoseSpec = { ...LOW, lean: 0.45, aU: 1.15, aL: 0.6, bU: 1.0, bL: 0.8, footA: 36, footB: -40 };
const throwAnim = (id: string, kind: 'side' | 'heave' | 'up' | 'pile' | 'bowlHi' | 'bowlLo', isAir = false) => {
  const A = isAir ? AIRP : {};
  const P = (p: PoseSpec): PoseSpec => (isAir ? { ...p, ...A, aU: p.aU, aL: p.aL, bU: p.bU, bL: p.bL, lean: p.lean, spin: p.spin, head: p.head } : p);
  const wind: Record<typeof kind, PoseSpec[]> = {
    side: [{ ...HOLD, spin: -0.25, lean: 0.2, aU: 0.6, aL: 0.9, bU: 0.4, bL: 1.0 }],
    heave: [{ ...HOLD, rootY: -20, lean: -0.1, aU: 2.4, aL: 0.5, bU: 2.3, bL: 0.6 }, { rootY: 4, lean: -0.4, aU: 3.1, aL: 0.4, bU: 3.0, bL: 0.5, footA: 30, footB: -34, head: 0.25, flex: 8, stretch: 1.05 }],
    up: [{ ...HOLD, rootY: -46, lean: 0.55, aU: 0.7, aL: 0.6, bU: 0.6, bL: 0.7 }],
    pile: [{ ...HOLD, rootY: -14, lean: -0.1, aU: 2.6, aL: 0.6, bU: 2.5, bL: 0.7 }, { rootY: 10, lean: -0.35, aU: 3.1, aL: 0.5, bU: 3.0, bL: 0.6, footA: 26, footB: -30, liftA: 12, head: 0.2, spin: -0.4, stretch: 1.06 }],
    bowlHi: [{ ...HOLD, spin: -0.4, lean: 0.1, aU: 0.2, aL: 0.6, bU: 0.0, bL: 0.8, flex: 4 }],
    bowlLo: [{ ...HOLD, rootY: -44, spin: -0.45, lean: 0.4, aU: -0.3, aL: 0.4, bU: -0.5, bL: 0.6, flex: 5 }],
  };
  const rel: Record<typeof kind, PoseSpec> = {
    side: { ...LOW, lean: 0.75, rootX: 16, aU: 1.7, aL: 0.0, bU: 1.55, bL: 0.2, footA: 48, footB: -40, spin: 0.15, head: -0.3 },
    heave: { ...LOW, rootY: -48, lean: 0.95, rootX: 20, aU: 1.3, aL: 0.0, bU: 1.2, bL: 0.1, footA: 56, footB: -46, head: -0.1, stretch: 1.1 },
    up: { rootY: 22, lean: -0.2, aU: 3.1, aL: 0.0, bU: 3.0, bL: 0.1, footA: 18, footB: -14, liftA: 6, liftB: 10, head: -0.45, stretch: 1.15 },
    pile: { ...LOW, rootY: -62, lean: 1.0, aU: 0.45, aL: 0.0, bU: 0.35, bL: 0.1, footA: 56, footB: -50, head: 0.2, spin: 0.2, stretch: 1.12 },
    bowlHi: { ...LOW, lean: 0.5, rootX: 14, aU: 2.3, aL: 0.0, bU: 2.1, bL: 0.2, footA: 46, footB: -40, spin: 0.2, head: -0.35 },
    bowlLo: { ...LOW, rootY: -50, lean: 0.9, rootX: 18, aU: 1.1, aL: 0.0, bU: 0.95, bL: 0.2, footA: 54, footB: -44, spin: 0.25, head: -0.15 },
  };
  return strikeAnim(id, m[id], {
    base: isAir ? 'air' : 'ground', strike: 'arm', reach: 'handA', smear: ['handA', 'handB'], inbetweens: kind === 'heave' || kind === 'pile' ? 1 : 0,
    antic: [P(REACH), P(HOLD), ...wind[kind].map(P)],
    hit: P(rel[kind]),
    follow: [P({ ...rel[kind], aL: 0.3, bL: 0.4, lean: (rel[kind].lean ?? 0.5) - 0.1 }), isAir ? AIRP : LOW],
  });
};
const anims = [
  throwAnim('th_toss', 'side'), throwAnim('th_heave', 'heave'), throwAnim('th_up', 'up'),
  throwAnim('th_pile', 'pile'), throwAnim('th_pileH', 'pile'), throwAnim('th_bowlHi', 'bowlHi'), throwAnim('th_bowlHiH', 'bowlHi'),
  throwAnim('th_bowlLo', 'bowlLo'), throwAnim('th_bowlLoH', 'bowlLo'),
  strikeAnim('th_longArm', m.th_longArm, { strike: 'arm', smear: ['handA'],
    antic: [{ ...LOW, lean: 0.2, aU: 0.4, aL: 1.6, rootX: -6, spin: -0.2 }, { ...LOW, lean: 0.0, aU: -0.4, aL: 1.4, rootX: -10, spin: -0.3, flex: 6 }],
    hit: { ...LOW, lean: 0.9, rootX: 16, aU: 1.62, aL: 0.0, bU: -0.6, bL: 1.2, footA: 54, footB: -46, head: -0.3, stretch: 1.3 },
    follow: [{ ...LOW, rootY: -36, lean: -0.4, rootX: -12, aU: 1.1, aL: 1.3, bU: 0.4, bL: 1.8, footA: 60, footB: -22, head: 0.15, flex: 8 }, { ...LOW, rootY: -34, lean: -0.3, aU: 1.2, aL: 1.6 }] }),
  strikeAnim('th_shoulder', m.th_shoulder, { strike: 'arm', smear: ['handA', 'handB'], inbetweens: 1,
    antic: [{ ...HOLD, spin: -0.2 }, { rootY: -6, lean: -0.3, aU: 2.9, aL: 0.5, bU: 2.8, bL: 0.6, footA: 30, footB: -34, head: 0.25, spin: -0.5, flex: 8 }, { rootY: 0, lean: -0.75, aU: 3.5, aL: 0.4, bU: 3.4, bL: 0.5, footA: 26, footB: -36, head: 0.45, spin: -0.7, flex: 12, stretch: 1.06 }],
    hit: { ...LOW, rootY: -46, lean: -1.0, rootX: -14, aU: 4.3, aL: 0.0, bU: 4.2, bL: 0.1, footA: 40, footB: -50, head: 0.5, spin: -0.4, stretch: 1.12 },
    follow: [{ ...LOW, rootY: -42, lean: -0.6, rootX: -8, aU: 3.6, aL: 0.4, bU: 3.4, bL: 0.6, head: 0.3 }, LOW] }),
  throwAnim('th_atoss', 'side', true), throwAnim('th_aheave', 'heave', true), throwAnim('th_aup', 'up', true), throwAnim('th_apile', 'pile', true), throwAnim('th_abowl', 'bowlLo', true),
];

/** Grab gloves: chunky outlined mitts with a cuff on both hands. */
function heldGloves(ctx: CanvasRenderingContext2D, f: { scale: number }, j: Float32Array, col: string, wpp: number): void {
  const s = f.scale;
  ctx.lineWidth = 2 * wpp + 0.6; ctx.strokeStyle = col; ctx.fillStyle = '#fbf8f0';
  for (const [h, e] of [[J.handA, J.elbA], [J.handB, J.elbB]] as [number, number][]) {
    const hx = j[h * 2], hy = j[h * 2 + 1];
    let dx = hx - j[e * 2], dy = hy - j[e * 2 + 1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    ctx.beginPath(); ctx.arc(hx + dx * 2 * s, hy + dy * 2 * s, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx - dx * 6 * s - dy * 6 * s, hy - dy * 6 * s + dx * 6 * s); ctx.lineTo(hx - dx * 6 * s + dy * 6 * s, hy - dy * 6 * s - dx * 6 * s); ctx.stroke();
  }
}

export const throwGloves: WeaponDef = {
  id: 'throw',
  name: 'Throw',
  desc: 'Grab gloves: grab anyone and throw them where you swipe. Bowl them into the crowd.',
  ground: {
    side: { light: 'th_toss', heavy: 'th_heave' },
    upDiag: { light: 'th_bowlHi', heavy: 'th_bowlHiH' },
    up: { light: 'th_up', heavy: 'th_longArm' },
    downDiag: { light: 'th_bowlLo', heavy: 'th_bowlLoH' },
    down: { light: 'th_pile', heavy: 'th_pileH' },
  },
  air: {
    side: { light: 'th_atoss', heavy: 'th_aheave' },
    upDiag: { light: 'th_aup', heavy: 'th_aup' },
    up: { light: 'th_aup', heavy: 'th_aup' },
    downDiag: { light: 'th_abowl', heavy: 'th_abowl' },
    down: { light: 'th_apile', heavy: 'th_apile' },
  },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false },
  ropeStyle: 'arm',
  range: PLAYER.targetRange,
  anims,
  smears: {
    th_heave: { chain: 4, radius: 1.3 }, th_pile: { chain: 4, radius: 1.2 }, th_pileH: { chain: 4, radius: 1.3 },
    th_bowlLoH: { chain: 4 }, th_bowlHiH: { chain: 4 }, th_up: { chain: 3 }, th_shoulder: { chain: 4 }, th_longArm: { chain: 2 },
  },
  tips: ['Swipe = dash, grab, throw that way', '↑ TOSS UP launcher · heavy: LONG ARM grab + over-the-shoulder slam', '↓ pile-driver', '↗ ↘ bowling throws into the crowd', 'Swipe at a flying body to re-grab it', 'Brutes: break their poise first'],
  icon(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - s * 0.08, y + s * 0.02, s * 0.24, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.3, y + s * 0.3); ctx.lineTo(x + s * 0.12, y + s * 0.3);
    ctx.moveTo(x + s * 0.2, y - s * 0.22); ctx.quadraticCurveTo(x + s * 0.42, y - s * 0.36, x + s * 0.42, y - s * 0.06);
    ctx.moveTo(x + s * 0.42, y - s * 0.06); ctx.lineTo(x + s * 0.36, y - s * 0.14); ctx.moveTo(x + s * 0.42, y - s * 0.06); ctx.lineTo(x + s * 0.47, y - s * 0.15);
    ctx.stroke();
  },
  held: heldGloves,
};
