import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { J } from '../../render/rig';
import { PLAYER } from '../tuning';

/** PAPER PLANE SWARM: fold and throw homing paper planes; a flock, a dive-bomb from the top of the page. Safe ranged pressure, weak up close. */
const C = '#7d7a73', tr = (w = 10) => ({ limb: 'handA' as const, color: C, width: w });
const plane = (count = 1, spread = 0, homing = 0.06, speed = 820) => ({ kind: 'plane' as const, speed, count, spread, gravity: 0, homing, pierce: 1, life: 100, radius: 14 });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const R = { hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 900, dash: false, aimCone: 50, sound: 'slash' as const };
add({ ...R, id: 'pp_throw', family: 'pp_throw', name: 'Paper Plane', tags: ['light'], startup: 4, active: 2, recovery: 12, damage: 6, hitstun: 22, kbX: 180, kbY: -60, shoot: plane(), cancelInto: CANCEL.light, weight: 0.3, trail: tr() });
add({ ...R, id: 'pp_flock', name: 'Flock', tags: ['heavy'], startup: 10, active: 2, recovery: 16, damage: 5, hitstun: 24, kbX: 160, kbY: -100, aimCone: 30, shoot: plane(6, 60, 0.05, 760), cancelInto: CANCEL.heavy, weight: 0.6, trail: tr(14) });
add({ id: 'pp_gust', name: 'Updraft', tags: ['launcher'], startup: 6, active: 4, recovery: 16, damage: 7, hitstun: 40, kbX: 30, kbY: 0, launch: -1180, hitbox: { x: 60, y: 100, r: 60 }, reach: 70, cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], sound: 'launch', weight: 0.5, trail: tr(), fx: { whirl: 90 } });
add({ ...R, id: 'pp_loop', name: 'Loop-the-Loop', tags: ['light'], startup: 5, active: 2, recovery: 12, damage: 6, hitstun: 26, kbX: 160, kbY: -300, aimCone: 70, shoot: plane(2, 30, 0.09, 760), cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...R, id: 'pp_skim', name: 'Floor Skimmer', tags: ['light', 'sweep'], startup: 5, active: 2, recovery: 12, damage: 6, hitstun: 28, kbX: 160, kbY: -320, knockdown: true, aimCone: 70, shoot: { ...plane(1, 0, 0.02, 900), pierce: 3 }, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...R, id: 'pp_bomb', name: 'Dive Bomb', tags: ['heavy', 'down'], startup: 12, active: 2, recovery: 18, damage: 8, hitstun: 30, kbX: 200, kbY: -360, hitstop: 4, shake: 6, knockdown: true, shoot: { ...plane(5, 0, 0.12, 1000), fromSky: true }, cancelInto: CANCEL.heavy, weight: 0.7, trail: tr() });
add({ id: 'pp_swat', name: 'Paper Cut', tags: ['light', 'down'], startup: 4, active: 3, recovery: 11, damage: 5, hitstun: 22, kbX: 260, kbY: -100, hitbox: { x: 50, y: 90, r: 40 }, reach: 60, status: { kind: 'bleed', frames: 60 }, cancelInto: CANCEL.light, sound: 'slash', weight: 0.3, trail: tr() });
add({ ...R, id: 'pp_athrow', family: 'pp_throw', name: 'Air Plane', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12, damage: 6, hitstun: 30, kbX: 160, kbY: -280, selfVY: -150, shoot: plane(), cancelInto: CANCEL.air, weight: 0.3, trail: tr() });
add({ id: 'pp_alift', name: 'Air Updraft', tags: ['air', 'light', 'rising'], startup: 5, active: 4, recovery: 14, damage: 7, hitstun: 36, kbX: 40, kbY: -900, selfVY: -720, hitbox: { x: 40, y: 104, r: 56 }, reach: 56, cancelInto: CANCEL.air, sound: 'launch', weight: 0.45, trail: tr() });
add({ ...R, id: 'pp_adive', family: 'spike', name: 'Plane Drop', tags: ['air', 'down', 'light'], startup: 6, active: 2, recovery: 16, damage: 8, hitstun: 40, kbX: 200, kbY: 1500, spike: true, selfVY: -360, aimCone: 60, shoot: plane(3, 30, 0.06, 900), cancelInto: ['dodge', 'special'], weight: 0.7, trail: tr() });
const anims = [
  tplAnim('pp_throw', m.pp_throw, 'throw'), tplAnim('pp_flock', m.pp_flock, 'throw', { aU: 2.0, stretch: 1.12 }), tplAnim('pp_gust', m.pp_gust, 'upper'), tplAnim('pp_loop', m.pp_loop, 'throw', { aU: 2.4 }),
  tplAnim('pp_skim', m.pp_skim, 'low'), tplAnim('pp_bomb', m.pp_bomb, 'shootUp'), tplAnim('pp_swat', m.pp_swat, 'slash'),
  tplAnim('pp_athrow', m.pp_athrow, 'airShoot'), tplAnim('pp_alift', m.pp_alift, 'airUp'), tplAnim('pp_adive', m.pp_adive, 'airDown'),
];
export const planes: WeaponDef = {
  id: 'planes', name: 'Paper Plane Swarm', desc: 'Homing paper planes, a whole flock, a dive-bomb from above. Weak up close.',
  ground: { side: { light: 'pp_throw', heavy: 'pp_flock' }, upDiag: { light: 'pp_loop', heavy: 'pp_flock' }, up: { light: 'pp_gust', heavy: 'pp_gust' }, downDiag: { light: 'pp_skim', heavy: 'pp_bomb' }, down: { light: 'pp_swat', heavy: 'pp_bomb' } },
  air: { side: { light: 'pp_athrow', heavy: 'pp_athrow' }, upDiag: { light: 'pp_alift', heavy: 'pp_alift' }, up: { light: 'pp_alift', heavy: 'pp_alift' }, downDiag: { light: 'pp_adive', heavy: 'pp_adive' }, down: { light: 'pp_adive', heavy: 'pp_adive' } },
  dodge: { distance: PLAYER.dodgeDistance * 1.2, frames: PLAYER.dodgeFrames, rope: false }, range: 900, anims, smears: {},
  tips: ['→ homing paper plane · heavy: a FLOCK of six', '↑ updraft launcher', '↘ floor skimmer · heavy: DIVE BOMB from above', '↓ paper cut (bleeds)'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x + s * 0.4, y - s * 0.2); ctx.lineTo(x - s * 0.38, y - s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.05); ctx.lineTo(x - s * 0.04, y + s * 0.32); ctx.closePath(); ctx.moveTo(x + s * 0.4, y - s * 0.2); ctx.lineTo(x - s * 0.1, y + s * 0.05); ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    const [hx, hy] = forearm(j, J.handB, J.elbB); const s = f.scale;
    stroke(ctx, col, 1.6 * wpp + 0.5); ctx.fillStyle = '#fbf8f0';
    ctx.beginPath(); ctx.moveTo(hx + 12 * s, hy - 4 * s); ctx.lineTo(hx - 8 * s, hy - 10 * s); ctx.lineTo(hx - 4 * s, hy); ctx.lineTo(hx - 8 * s, hy + 6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  },
};
