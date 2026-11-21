import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { J } from '../../render/rig';
import { PLAYER } from '../tuning';

/** ROCKET GLOVES: launch your fists as projectiles; the rocket uppercut carries you up with the enemy. Mobility plus burst. */
const C = '#ffa040', tr = (w = 12) => ({ limb: 'handA' as const, color: C, width: w });
const fist = (count = 1, spread = 0, pierce = 1) => ({ kind: 'fist' as const, speed: 1500, count, spread, gravity: 0, homing: 0, pierce, life: 40, radius: 18 });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const R = { hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 600, dash: false, aimCone: 40, sound: 'heavy' as const };
add({ ...R, id: 'rk_jab', family: 'rk_jab', name: 'Rocket Jab', tags: ['light'], startup: 5, active: 2, recovery: 12, damage: 9, hitstun: 26, kbX: 520, kbY: -80, hitstop: 4, shake: 5, shoot: fist(), cancelInto: CANCEL.light, weight: 0.5, trail: tr() });
add({ ...R, id: 'rk_barrage', name: 'Rocket Barrage', tags: ['heavy'], startup: 10, active: 2, recovery: 16, damage: 9, hitstun: 30, kbX: 640, kbY: -160, hitstop: 5, shake: 8, zoom: 0.3, aimCone: 25, shoot: fist(3, 18, 2), cancelInto: CANCEL.heavy, weight: 0.85, trail: tr(16), fx: { crescent: true } });
add({ id: 'rk_upper', family: 'rk_upper', name: 'Rocket Uppercut', tags: ['launcher'], startup: 6, active: 4, recovery: 16, damage: 11, hitstun: 42, kbX: 40, kbY: 0, launch: -1380, follow: true, hitstop: 6, shake: 8, zoom: 0.3, hitbox: { x: 50, y: 100, r: 48 }, reach: 62, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.7, afterimage: true, trail: tr(14) });
add({ id: 'rk_upperH', family: 'rk_upper', name: 'Rocket Uppercut+', tags: ['launcher', 'heavy'], startup: 9, active: 4, recovery: 18, damage: 15, hitstun: 46, kbX: 40, kbY: 0, launch: -1560, follow: true, hitstop: 8, shake: 11, zoom: 0.5, poise: 2.4, hitbox: { x: 50, y: 100, r: 50 }, reach: 62, slowmo: { scale: 0.35, sec: 0.25 }, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.95, afterimage: true, trail: tr(18) });
add({ ...R, id: 'rk_sky', name: 'Sky Rocket', tags: ['light', 'rising'], startup: 5, active: 2, recovery: 12, damage: 8, hitstun: 30, kbX: 200, kbY: -520, aimCone: 70, shoot: fist(), cancelInto: CANCEL.light, weight: 0.45, trail: tr() });
add({ id: 'rk_dash', name: 'Jet Dash', tags: ['heavy', 'sweep'], startup: 6, active: 12, recovery: 14, damage: 11, hitstun: 32, kbX: 560, kbY: -420, hitstop: 5, shake: 7, hitbox: { x: 50, y: 80, r: 50 }, reach: 20, travel: 340, maxTargets: 6, knockdown: true, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.8, afterimage: true, trail: tr(16) });
add({ id: 'rk_slam', name: 'Rocket Slam', tags: ['light', 'down'], startup: 9, active: 3, recovery: 18, damage: 12, hitstun: 32, kbX: 340, kbY: -460, hitstop: 7, shake: 10, hitbox: { x: 0, y: 30, r: 0 }, aoe: 200, reach: 70, maxTargets: 8, knockdown: true, plant: { radius: 220, damage: 0, x: 50 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.75, trail: tr() });
add({ ...R, id: 'rk_afist', family: 'rk_jab', name: 'Air Rocket', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12, damage: 8, hitstun: 30, kbX: 420, kbY: -260, selfVY: -150, shoot: fist(), cancelInto: CANCEL.air, weight: 0.45, trail: tr() });
add({ id: 'rk_aupper', name: 'Air Rocket Uppercut', tags: ['air', 'light', 'rising'], startup: 5, active: 4, recovery: 14, damage: 9, hitstun: 36, kbX: 40, kbY: -950, selfVY: -880, hitbox: { x: 40, y: 104, r: 50 }, reach: 56, cancelInto: CANCEL.air, sound: 'launch', weight: 0.6, afterimage: true, trail: tr() });
add({ id: 'rk_dive', family: 'spike', name: 'Rocket Dive', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 12, hitstun: 40, kbX: 240, kbY: 1850, spike: true, impactShock: { radius: 220, damage: 8 }, selfVY: -380, hitbox: { x: 50, y: 50, r: 56 }, reach: 56, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.9, afterimage: true, trail: tr(16) });
const anims = [
  tplAnim('rk_jab', m.rk_jab, 'jab'), tplAnim('rk_barrage', m.rk_barrage, 'jab', { bU: 1.6, bL: 0 }), tplAnim('rk_upper', m.rk_upper, 'upper'), tplAnim('rk_upperH', m.rk_upperH, 'upper', { rootY: 40, stretch: 1.28 }, 1),
  tplAnim('rk_sky', m.rk_sky, 'shootUp'), tplAnim('rk_dash', m.rk_dash, 'dash'), tplAnim('rk_slam', m.rk_slam, 'slam'),
  tplAnim('rk_afist', m.rk_afist, 'airShoot'), tplAnim('rk_aupper', m.rk_aupper, 'airUp'), tplAnim('rk_dive', m.rk_dive, 'airDown'),
];
export const rocket: WeaponDef = {
  id: 'rocket', name: 'Rocket Gloves', desc: 'Fists you can fire: rocket jabs, a barrage, and an uppercut that carries you up.',
  ground: { side: { light: 'rk_jab', heavy: 'rk_barrage' }, upDiag: { light: 'rk_sky', heavy: 'rk_sky' }, up: { light: 'rk_upper', heavy: 'rk_upperH' }, downDiag: { light: 'rk_dash', heavy: 'rk_dash' }, down: { light: 'rk_slam', heavy: 'rk_slam' } },
  air: { side: { light: 'rk_afist', heavy: 'rk_afist' }, upDiag: { light: 'rk_aupper', heavy: 'rk_aupper' }, up: { light: 'rk_aupper', heavy: 'rk_aupper' }, downDiag: { light: 'rk_dive', heavy: 'rk_dive' }, down: { light: 'rk_dive', heavy: 'rk_dive' } },
  dodge: { distance: PLAYER.dodgeDistance * 1.4, frames: PLAYER.dodgeFrames, rope: false }, range: 600, anims, smears: { rk_upperH: { chain: 4 } },
  tips: ['→ rocket jab (fires your fist) · heavy: barrage', '↑ ROCKET UPPERCUT carries you up', '↗ sky rocket · ↘ jet dash', '↓ rocket slam · in the air: rocket dive'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.arc(x + s * 0.1, y, s * 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#e8822a'; ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(x - s * 0.12, y + i * s * 0.1); ctx.lineTo(x - s * 0.42, y + i * s * 0.16); } ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    const s = f.scale;
    stroke(ctx, col, 2 * wpp + 0.6); ctx.fillStyle = '#fbf8f0';
    for (const [h, e] of [[J.handA, J.elbA], [J.handB, J.elbB]] as [number, number][]) {
      const [hx, hy, dx, dy] = forearm(j, h, e);
      ctx.beginPath(); ctx.arc(hx + dx * 3 * s, hy + dy * 3 * s, 8 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - dx * 8 * s - dy * 6 * s, hy - dy * 8 * s + dx * 6 * s); ctx.lineTo(hx - dx * 8 * s + dy * 6 * s, hy - dy * 8 * s - dx * 6 * s); ctx.stroke();
    }
  },
};
