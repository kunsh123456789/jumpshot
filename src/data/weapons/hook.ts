import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { strikeAnim, LOW, AIRP } from './author';
import { J, type PoseSpec } from '../../render/rig';
import { PLAYER } from '../tuning';

/**
 * GRAPPLING HOOK: mobility and control. A hook on a sketchy chain fires at
 * the best target in the swipe direction (generous auto-aim). Light = PULL
 * (yank the enemy in, then an automatic follow-up hit); heavy = ZIP (the
 * hero is reeled to the enemy, echo copies, and lands a flying kick). N hooks
 * and launches the target and zips up after it (the air-combo starter); S
 * slams the target into the floor (ground bounce + crack); diagonals SWING the
 * hero around the target in an arc, kicking everything on the way. Tap = an
 * evasive hook-zip dodge. Reeling enemies through others counts as bowling.
 */
const C = '#9fd8ff';
const tr = (limb: 'handA' | 'footA' = 'handA', w = 12) => ({ limb, color: C, width: w });
const RANGE = 620;
const ranged = { ranged: RANGE, dash: false, aimCone: 50, hitbox: { x: 50, y: 92, r: 1 }, reach: 300, sound: 'punch' as const };

const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const air = (id: string, src: string, o: Partial<MoveInput> = {}) => {
  const s = m[src];
  add({ ...s, id, tags: [...s.tags.filter((t) => t !== 'air'), 'air'], selfVY: -160, cancelInto: CANCEL.air, ...o } as MoveInput);
};

add({ ...ranged, id: 'hk_pull', family: 'hk_pull', name: 'Yank', tags: ['light'], startup: 7, active: 3, recovery: 20,
  damage: 5, hitstun: 40, kbX: 0, kbY: 0, hitstop: 4, shake: 4, tether: { mode: 'pull', frames: 14 }, then: 'hk_pullHit', grid: 2,
  slowmo: { scale: 0.45, sec: 0.18 }, cancelFrom: 99, cancelInto: [], weight: 0.4, trail: tr() });
add({ id: 'hk_pullHit', family: 'hk_pullHit', name: 'Reel-In Punch', tags: ['light'], startup: 3, active: 3, recovery: 14,
  damage: 9, hitstun: 26, kbX: 420, kbY: -180, hitstop: 5, shake: 5, zoom: 0.15, hitbox: { x: 58, y: 92, r: 42 }, reach: 66,
  cancelInto: CANCEL.light, sound: 'punch', weight: 0.5, trail: tr() });
add({ id: 'hk_zip', family: 'hk_zip', name: 'Zip Kick', tags: ['heavy'], startup: 10, active: 4, recovery: 18,
  damage: 14, hitstun: 34, kbX: 860, kbY: -260, hitstop: 8, shake: 10, zoom: 0.4, poise: 2.2, hitbox: { x: 56, y: 80, r: 50 }, reach: 54,
  tether: { mode: 'zip', frames: 0 }, aimCone: 50, grid: 1, cancelInto: CANCEL.heavy, sound: 'kick', weight: 0.9, afterimage: true, trail: tr('footA', 16) });
add({ ...ranged, id: 'hk_air', family: 'hk_air', name: 'Air Hook', tags: ['launcher'], startup: 8, active: 3, recovery: 16,
  damage: 9, hitstun: 40, kbX: 30, kbY: 0, hitstop: 6, shake: 7, zoom: 0.3, launch: -1250, follow: true, aimCone: 118,
  tether: { mode: 'air', frames: 10 }, grid: 1, slowmo: { scale: 0.4, sec: 0.2 }, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.65, afterimage: true, trail: tr() });
add({ ...ranged, id: 'hk_airH', family: 'hk_air', name: 'Air Hook+', tags: ['launcher', 'heavy'], startup: 11, active: 3, recovery: 18,
  damage: 12, hitstun: 44, kbX: 30, kbY: 0, hitstop: 8, shake: 10, zoom: 0.5, launch: -1460, follow: true, aimCone: 118,
  tether: { mode: 'air', frames: 12 }, grid: 1, slowmo: { scale: 0.35, sec: 0.25 }, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.9, afterimage: true, trail: tr() });
add({ ...ranged, id: 'hk_slam', family: 'hk_slam', name: 'Slam Yank', tags: ['light', 'down'], startup: 8, active: 3, recovery: 18,
  damage: 11, hitstun: 40, kbX: 120, kbY: 1800, spike: true, hitstop: 7, shake: 11, zoom: 0.4, poise: 2, aimCone: 118,
  tether: { mode: 'slam', frames: 10 }, grid: 1, cancelInto: CANCEL.light, sound: 'spike', weight: 0.85, afterimage: true, trail: tr() });
add({ ...ranged, id: 'hk_slamH', family: 'hk_slam', name: 'Crater Yank', tags: ['heavy', 'down'], startup: 11, active: 3, recovery: 20,
  damage: 14, hitstun: 44, kbX: 120, kbY: 2100, spike: true, impactShock: { radius: 220, damage: 9 }, hitstop: 8, shake: 14, zoom: 0.5, poise: 2.4, aimCone: 118,
  tether: { mode: 'slam', frames: 12 }, grid: 1, slowmo: { scale: 0.35, sec: 0.25 }, cancelInto: CANCEL.heavy, sound: 'spike', weight: 0.95, afterimage: true, trail: tr() });
add({ ...ranged, id: 'hk_swing', family: 'hk_swing', name: 'Swing', tags: ['light'], startup: 7, active: 16, recovery: 12,
  damage: 8, hitstun: 32, kbX: 520, kbY: -380, hitstop: 4, shake: 5, hitbox: { x: 20, y: 60, r: 72 }, reach: 60, maxTargets: 6,
  aimCone: undefined, tether: { mode: 'swing', frames: 16 }, grid: 2, cancelFrom: 16, cancelInto: CANCEL.light, sound: 'kick', weight: 0.55, afterimage: true, trail: tr('footA', 14) });
add({ ...ranged, id: 'hk_swingH', family: 'hk_swing', name: 'Pendulum', tags: ['heavy'], startup: 9, active: 22, recovery: 14,
  damage: 11, hitstun: 36, kbX: 760, kbY: -460, hitstop: 6, shake: 8, zoom: 0.3, hitbox: { x: 20, y: 60, r: 84 }, reach: 60, maxTargets: 8,
  aimCone: undefined, tether: { mode: 'swing', frames: 22 }, grid: 1, cancelFrom: 22, cancelInto: CANCEL.heavy, sound: 'kick', weight: 0.85, afterimage: true, trail: tr('footA', 16) });
// air
air('hk_apull', 'hk_pull');
air('hk_azip', 'hk_zip', { selfVY: -100 });
air('hk_aair', 'hk_air', { launch: -1050, follow: false, cancelFrom: 3 });
air('hk_aslam', 'hk_slam', { selfVY: -360 });
air('hk_aswing', 'hk_swing');

// ------------------------------------------------------------------ drawings
/** Fire the hook: arm thrown out along the aim, rear hand guarding. */
const fire = (a: number, x: PoseSpec = {}): PoseSpec => ({ ...LOW, aU: a, aL: 0.0, bU: 0.6, bL: 2.0, lean: 0.45 - (a - 1.57) * 0.15, head: -0.15 - (a - 1.57) * 0.2, ...x });
const fireAir = (a: number, x: PoseSpec = {}): PoseSpec => ({ ...AIRP, aU: a, aL: 0.0, bU: 0.6, bL: 2.0, lean: 0.25 - (a - 1.57) * 0.15, ...x });
const shoot = (id: string, a: number, isAir: boolean, after: PoseSpec[]) => {
  const F = isAir ? fireAir : fire;
  return strikeAnim(id, m[id], {
    base: isAir ? 'air' : 'ground', strike: 'arm', smear: ['handA'],
    antic: [F(a - 1.2, { aL: 1.4, rootX: -4, spin: -0.15 }), F(a - 0.9, { aL: 1.2, rootX: -8, spin: -0.25, stretch: 0.95 })],
    hit: F(a, { rootX: 8, stretch: 1.06 }),
    follow: after.length ? after : [F(a - 0.4, { aL: 0.8 }), isAir ? AIRP : LOW],
  });
};
const YANK: PoseSpec = { ...LOW, rootY: -36, lean: -0.35, rootX: -14, aU: 1.0, aL: 1.4, bU: 0.4, bL: 1.8, footA: 60, footB: -22, head: 0.15, flex: 8 };
const anims = [
  shoot('hk_pull', 1.57, false, [YANK, { ...YANK, rootX: -10, lean: -0.25, aL: 1.7 }, LOW]),
  strikeAnim('hk_pullHit', m.hk_pullHit, { reach: 'handB', smear: ['handB'],
    antic: [{ ...LOW, lean: 0.1, bU: 0.3, bL: 2.3, rootX: -4 }],
    hit: { ...LOW, lean: 0.62, rootX: 18, bU: 1.6, bL: 0.02, aU: 0.7, aL: 2.1, footA: 46, footB: -38, head: -0.25, stretch: 1.06 },
    follow: [{ ...LOW, lean: 0.55, rootX: 15, bU: 1.45, bL: 0.4 }, LOW] }),
  strikeAnim('hk_zip', m.hk_zip, { strike: 'leg', reach: 'footA', smear: ['footA'], inbetweens: 1,
    antic: [fire(1.6, { rootX: 6 }), { lean: 0.9, rootY: -6, aU: 1.6, aL: 0.0, bU: -0.8, bL: 0.6, laU: 1.0, laL: -2.0, lbU: -0.4, lbL: -0.6, plant: 0, head: -0.3 }],
    hit: { lean: -0.3, rootY: -10, aU: -0.6, aL: 0.8, bU: 2.0, bL: 0.6, laU: 1.7, laL: 0.0, lbU: -0.5, lbL: -1.0, plant: 0, spin: -0.1, head: -0.1, stretch: 1.1 },
    follow: [{ lean: -0.2, rootY: -6, aU: -0.4, aL: 1.0, laU: 1.4, laL: -0.5, lbU: -0.4, lbL: -1.1, plant: 0.4 }, LOW] }),
  shoot('hk_air', 2.75, false, [{ rootY: 10, lean: -0.1, aU: 3.0, aL: 0.1, bU: 2.4, bL: 0.6, footA: 20, footB: -16, liftA: 10, liftB: 18, head: -0.45, stretch: 1.12 }, LOW]),
  shoot('hk_airH', 2.8, false, [{ rootY: 16, lean: -0.15, aU: 3.05, aL: 0.05, bU: 2.5, bL: 0.6, footA: 18, footB: -14, liftA: 14, liftB: 22, head: -0.5, stretch: 1.16 }, LOW]),
  shoot('hk_slam', 2.4, false, [{ ...LOW, rootY: -52, lean: 0.9, aU: 0.6, aL: 0.3, bU: 0.4, bL: 0.6, footA: 50, footB: -44, head: 0.15 }, LOW]),
  shoot('hk_slamH', 2.5, false, [{ ...LOW, rootY: -58, lean: 1.0, aU: 0.5, aL: 0.2, bU: 0.35, bL: 0.5, footA: 54, footB: -48, head: 0.2, stretch: 1.08 }, { ...LOW, rootY: -50, lean: 0.8 }, LOW]),
  strikeAnim('hk_swing', m.hk_swing, { base: 'air', strike: 'leg', smear: ['footA', 'footB'],
    antic: [fireAir(2.4, { rootX: -4 }), fireAir(2.6, { laU: 1.2, laL: -2.0 })],
    hit: { ...AIRP, aU: 2.9, aL: 0.0, bU: 2.6, bL: 0.4, laU: 1.6, laL: 0.0, lbU: 1.2, lbL: -0.3, lean: -0.5, head: -0.3, stretch: 1.08 },
    hit2: { ...AIRP, aU: 2.95, aL: 0.0, bU: 2.7, bL: 0.4, laU: 1.9, laL: -0.1, lbU: 1.5, lbL: -0.2, lean: -0.7, head: -0.35 },
    follow: [{ ...AIRP, aU: 2.0, aL: 0.6, laU: 1.2, laL: -1.4, lean: 0.1 }, LOW] }),
  strikeAnim('hk_swingH', m.hk_swingH, { base: 'air', strike: 'leg', smear: ['footA', 'footB'], inbetweens: 1,
    antic: [fireAir(2.4, { rootX: -6 }), fireAir(2.7, { laU: 1.3, laL: -2.1, spin: -0.2 })],
    hit: { ...AIRP, aU: 2.95, aL: 0.0, bU: 2.7, bL: 0.3, laU: 1.7, laL: 0.0, lbU: 1.4, lbL: -0.2, lean: -0.6, head: -0.35, stretch: 1.12 },
    hit2: { ...AIRP, aU: 3.0, aL: 0.0, bU: 2.8, bL: 0.3, laU: 2.0, laL: -0.1, lbU: 1.7, lbL: -0.2, lean: -0.85, spin: 0.2 },
    follow: [{ ...AIRP, aU: 2.0, aL: 0.6, laU: 1.2, laL: -1.4, lean: 0.1, spin: 0.1 }, LOW] }),
  shoot('hk_apull', 1.57, true, [{ ...AIRP, lean: -0.35, aU: 1.0, aL: 1.4, bU: 0.4, bL: 1.8, head: 0.15 }, AIRP]),
  strikeAnim('hk_azip', m.hk_azip, { base: 'air', strike: 'leg', reach: 'footA', smear: ['footA'],
    antic: [fireAir(1.6), { ...AIRP, lean: 0.8, aU: 1.6, aL: 0.0, laU: 1.0, laL: -2.0 }],
    hit: { ...AIRP, lean: -0.35, aU: -0.6, aL: 0.8, bU: 2.0, laU: 1.7, laL: 0.0, lbU: -0.5, lbL: -1.0, stretch: 1.1 },
    follow: [{ ...AIRP, lean: -0.25, laU: 1.4, laL: -0.5 }] }),
  shoot('hk_aair', 2.75, true, []),
  shoot('hk_aslam', 0.5, true, [{ ...AIRP, aU: 0.4, aL: 0.4, lean: 0.6, spin: 0.2 }, AIRP]),
  strikeAnim('hk_aswing', m.hk_aswing, { base: 'air', strike: 'leg', smear: ['footA', 'footB'],
    antic: [fireAir(2.4), fireAir(2.6, { laU: 1.2, laL: -2.0 })],
    hit: { ...AIRP, aU: 2.9, aL: 0.0, bU: 2.6, laU: 1.6, laL: 0.0, lbU: 1.2, lbL: -0.3, lean: -0.5, stretch: 1.08 },
    hit2: { ...AIRP, aU: 2.95, aL: 0.0, bU: 2.7, laU: 1.9, laL: -0.1, lbU: 1.5, lbL: -0.2, lean: -0.7 },
    follow: [{ ...AIRP, aU: 2.0, aL: 0.6, laU: 1.2, laL: -1.4 }] }),
];

/** Hook launcher strapped to the lead forearm; the claw sits on its muzzle while the rope is in. */
function heldHook(ctx: CanvasRenderingContext2D, f: { scale: number; weapon: string }, j: Float32Array, col: string, wpp: number): void {
  const hx = j[J.handA * 2], hy = j[J.handA * 2 + 1];
  let dx = hx - j[J.elbA * 2], dy = hy - j[J.elbA * 2 + 1];
  const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  const s = f.scale, nx = -dy, ny = dx;
  ctx.strokeStyle = col; ctx.lineWidth = 2 * wpp + 0.6; ctx.lineCap = 'round';
  ctx.beginPath();
  // tube along the forearm
  ctx.moveTo(hx - dx * 14 * s + nx * 4 * s, hy - dy * 14 * s + ny * 4 * s); ctx.lineTo(hx + dx * 4 * s + nx * 4 * s, hy + dy * 4 * s + ny * 4 * s);
  ctx.moveTo(hx - dx * 14 * s - nx * 2 * s, hy - dy * 14 * s - ny * 2 * s); ctx.lineTo(hx + dx * 4 * s - nx * 2 * s, hy + dy * 4 * s - ny * 2 * s);
  // claw prongs at the muzzle
  const cx = hx + dx * 6 * s, cy = hy + dy * 6 * s;
  for (const k of [-1, 1]) { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * 6 * s + nx * k * 5 * s, cy + dy * 6 * s + ny * k * 5 * s); }
  ctx.stroke();
}

export const hook: WeaponDef = {
  id: 'hook',
  name: 'Grappling Hook',
  desc: 'Mobility and control: yank enemies in, zip to them, swing around them.',
  ground: {
    side: { light: 'hk_pull', heavy: 'hk_zip' },
    upDiag: { light: 'hk_swing', heavy: 'hk_swingH' },
    up: { light: 'hk_air', heavy: 'hk_airH' },
    downDiag: { light: 'hk_swing', heavy: 'hk_swingH' },
    down: { light: 'hk_slam', heavy: 'hk_slamH' },
  },
  air: {
    side: { light: 'hk_apull', heavy: 'hk_azip' },
    upDiag: { light: 'hk_aswing', heavy: 'hk_aswing' },
    up: { light: 'hk_aair', heavy: 'hk_aair' },
    downDiag: { light: 'hk_aswing', heavy: 'hk_aswing' },
    down: { light: 'hk_aslam', heavy: 'hk_aslam' },
  },
  dodge: { distance: Math.round(PLAYER.dodgeDistance * 1.8), frames: PLAYER.dodgeFrames + 3, rope: true },
  range: RANGE,
  anims,
  smears: { hk_zip: { chain: 4 }, hk_swing: { chain: 3, radius: 1.2 }, hk_swingH: { chain: 4, radius: 1.3 }, hk_slamH: { chain: 3 }, hk_pullHit: { chain: 3 } },
  tips: ['→ YANK them in (+ punch) · heavy: ZIP kick', '↑ AIR HOOK: launch + zip up after them', '↗ ↘ swing around them, kicking', '↓ slam yank into the floor', 'Tap: hook-zip dodge'],
  icon(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.08, y - s * 0.4); ctx.lineTo(x + s * 0.08, y + s * 0.12);
    ctx.arc(x - s * 0.08, y + s * 0.12, s * 0.16, 0, Math.PI * 0.9);
    ctx.moveTo(x - s * 0.24, y + s * 0.16); ctx.lineTo(x - s * 0.3, y + s * 0.04);
    for (let i = 0; i < 4; i++) { const yy = y - s * 0.42 + i * s * 0.1; ctx.moveTo(x + s * 0.03, yy); ctx.lineTo(x + s * 0.13, yy + s * 0.05); }
    ctx.stroke();
  },
  held: heldHook,
};
