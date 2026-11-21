import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { pole, stroke } from './heldArt';
import { PLAYER, WORLD } from '../tuning';

/** SCYTHE (the reference polearm): huge crescent reaps, a reaping pull, a spinning throw, a harvest slam. */
const C = '#1b1a17', tr = (w = 16) => ({ limb: 'handA' as const, color: C, width: w });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
add({ id: 'sc_reap', family: 'sc_reap', name: 'Reap', tags: ['light', 'string'], startup: 6, active: 4, recovery: 15, damage: 9, hitstun: 26, kbX: 300, kbY: -80, hitbox: { x: 110, y: 86, r: 58 }, reach: 116, maxTargets: 4, next: 'sc_reap2', cancelInto: CANCEL.light, sound: 'slash', weight: 0.45, trail: tr() });
add({ id: 'sc_reap2', family: 'sc_reap', name: 'Backreap', tags: ['light', 'string'], startup: 6, active: 4, recovery: 16, damage: 10, hitstun: 28, kbX: 420, kbY: -240, hitbox: { x: 110, y: 70, r: 60 }, reach: 116, maxTargets: 4, next: 'sc_reap', cancelInto: CANCEL.light, sound: 'slash', weight: 0.55, trail: tr() });
add({ id: 'sc_spin', name: 'Death Spiral', tags: ['heavy', 'sweep', 'guardbreak'], startup: 11, active: 8, recovery: 20, damage: 15, hitstun: 34, kbX: 560, kbY: -360, hitstop: 7, shake: 10, zoom: 0.35, poise: 2.4, hitbox: { x: 0, y: 50, r: 0 }, aoe: 230, reach: 90, maxTargets: 10, knockdown: true, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.9, afterimage: true, trail: tr(20), fx: { crescent: true, whirl: 170 } });
add({ id: 'sc_rise', family: 'sc_rise', name: 'Rising Moon', tags: ['launcher'], startup: 8, active: 4, recovery: 16, damage: 11, hitstun: 40, kbX: 40, kbY: 0, launch: -1260, follow: true, hitstop: 6, shake: 8, zoom: 0.3, hitbox: { x: 80, y: 100, r: 56 }, reach: 92, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.7, afterimage: true, trail: tr(18) });
add({ id: 'sc_toss', name: 'Scythe Throw', tags: ['heavy'], startup: 10, active: 3, recovery: 16, damage: 10, hitstun: 30, kbX: 340, kbY: -300, hitstop: 4, shake: 6, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 640, dash: false, aimCone: 70, maxTargets: 12, toss: { speed: 1300, range: 560, radius: 52, draw: 'scythe' }, cancelFrom: 3, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.7, afterimage: true, trail: tr() });
add({ id: 'sc_pull', name: 'Reaping Pull', tags: ['light'], startup: 7, active: 3, recovery: 18, damage: 6, hitstun: 40, kbX: 0, kbY: 0, hitbox: { x: 50, y: 92, r: 1 }, reach: 300, ranged: 380, dash: false, aimCone: 60, tether: { mode: 'pull', frames: 12 }, then: 'sc_cut', cancelFrom: 99, cancelInto: [], sound: 'slash', weight: 0.45, trail: tr() });
add({ id: 'sc_cut', name: 'Harvest Cut', tags: ['light'], startup: 4, active: 4, recovery: 14, damage: 10, hitstun: 28, kbX: 460, kbY: -260, hitbox: { x: 90, y: 84, r: 56 }, reach: 96, maxTargets: 4, cancelInto: CANCEL.light, sound: 'slash', weight: 0.55, trail: tr() });
add({ id: 'sc_harvest', name: 'Harvest', tags: ['light', 'down'], startup: 10, active: 3, recovery: 18, damage: 12, hitstun: 32, kbX: 320, kbY: -460, hitstop: 7, shake: 11, poise: 2, hitbox: { x: 0, y: 30, r: 0 }, aoe: 210, reach: 90, maxTargets: 8, knockdown: true, plant: { radius: 230, damage: 0, x: 100 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.8, trail: tr() });
add({ id: 'sc_aswing', name: 'Air Reap', tags: ['air', 'light'], startup: 5, active: 5, recovery: 13, damage: 9, hitstun: 32, kbX: 220, kbY: -360, selfVY: -170, hitbox: { x: 104, y: 74, r: 60 }, reach: 112, maxTargets: 4, cancelInto: CANCEL.air, sound: 'slash', weight: 0.45, trail: tr() });
add({ id: 'sc_arise', name: 'Air Moon', tags: ['air', 'light', 'rising'], startup: 5, active: 5, recovery: 14, damage: 9, hitstun: 36, kbX: 40, kbY: -920, selfVY: -800, hitbox: { x: 60, y: 120, r: 66 }, reach: 60, maxTargets: 4, cancelInto: CANCEL.air, sound: 'launch', weight: 0.55, trail: tr() });
add({ id: 'sc_aspike', family: 'spike', name: 'Guillotine', tags: ['air', 'down', 'light'], startup: 7, active: 3, recovery: 18, damage: 13, hitstun: 40, kbX: 220, kbY: 1800, spike: true, selfVY: -380, hitbox: { x: 80, y: 40, r: 60 }, reach: 86, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.9, afterimage: true, trail: tr(20), fx: { crescent: true } });
const anims = [
  tplAnim('sc_reap', m.sc_reap, 'slash', {}, 1), tplAnim('sc_reap2', m.sc_reap2, 'spin'), tplAnim('sc_spin', m.sc_spin, 'spin', {}, 1), tplAnim('sc_rise', m.sc_rise, 'upper'),
  tplAnim('sc_toss', m.sc_toss, 'throw'), tplAnim('sc_pull', m.sc_pull, 'throw', { aU: 1.6 }), tplAnim('sc_cut', m.sc_cut, 'slash'), tplAnim('sc_harvest', m.sc_harvest, 'overhead', { aU: 1.0 }),
  tplAnim('sc_aswing', m.sc_aswing, 'air'), tplAnim('sc_arise', m.sc_arise, 'airUp'), tplAnim('sc_aspike', m.sc_aspike, 'airDown'),
];
const seg = new Float32Array(6);
export const scythe: WeaponDef = {
  id: 'scythe', name: 'Scythe', desc: 'Huge crescent reaps, a reaping pull, a spinning scythe throw (the reference polearm).',
  ground: { side: { light: 'sc_reap', heavy: 'sc_spin' }, upDiag: { light: 'sc_toss', heavy: 'sc_toss' }, up: { light: 'sc_rise', heavy: 'sc_rise' }, downDiag: { light: 'sc_pull', heavy: 'sc_spin' }, down: { light: 'sc_harvest', heavy: 'sc_harvest' } },
  air: { side: { light: 'sc_aswing', heavy: 'sc_aswing' }, upDiag: { light: 'sc_arise', heavy: 'sc_arise' }, up: { light: 'sc_arise', heavy: 'sc_arise' }, downDiag: { light: 'sc_aspike', heavy: 'sc_aspike' }, down: { light: 'sc_aspike', heavy: 'sc_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, ropeStyle: 'whip', range: PLAYER.targetRange * 1.1, anims,
  smears: { sc_reap: { chain: 4, radius: 1.4 }, sc_reap2: { chain: 4, radius: 1.4 }, sc_spin: { chain: 4, radius: 1.6 }, sc_rise: { chain: 4 } },
  tips: ['→ reap string · heavy: DEATH SPIRAL', '↑ rising moon launcher', '↗ scythe throw · ↘ REAPING PULL + harvest cut', '↓ harvest slam · in the air: guillotine'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.4); ctx.lineTo(x + s * 0.15, y - s * 0.4); ctx.moveTo(x + s * 0.15, y - s * 0.4); ctx.quadraticCurveTo(x - s * 0.25, y - s * 0.45, x - s * 0.4, y - s * 0.1); ctx.stroke(); },
  sweep(j, scale, out) { pole(j, 170 * scale, 0.6, seg); out[0] = seg[0]; out[1] = seg[1]; out[2] = seg[2]; out[3] = seg[3]; },
  held(ctx, f, j, col, wpp) {
    if (f.weaponOut) return;
    pole(j, 170 * f.scale, 0.6, seg);
    stroke(ctx, col, 2.4 * wpp + 0.8); ctx.beginPath(); ctx.moveTo(seg[4], Math.min(seg[5], WORLD.groundY)); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
    const dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s = f.scale, side = f.facing || 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(seg[2], seg[3]);
    ctx.quadraticCurveTo(seg[2] - uy * side * 40 * s + ux * 10 * s, seg[3] + ux * side * 40 * s + uy * 10 * s, seg[2] - uy * side * 52 * s - ux * 26 * s, seg[3] + ux * side * 52 * s - uy * 26 * s);
    ctx.quadraticCurveTo(seg[2] - uy * side * 30 * s - ux * 4 * s, seg[3] + ux * side * 30 * s - uy * 4 * s, seg[2] - ux * 6 * s, seg[3] - uy * 6 * s);
    ctx.closePath(); ctx.fill();
  },
};
