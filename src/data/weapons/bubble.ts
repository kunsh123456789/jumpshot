import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** BUBBLE GUN (silly): bubbles trap enemies and float them up helpless; any hit pops them for bonus damage, or bowl a bubbled enemy into others. */
const C = '#2436e6', tr = (w = 10) => ({ limb: 'handA' as const, color: C, width: w });
const bub = (count = 1, spread = 0, speed = 720) => ({ kind: 'bubble' as const, speed, count, spread, gravity: -60, homing: 0, pierce: 1, life: 90, radius: 22 });
const trap = (f = 150) => ({ kind: 'bubble' as const, frames: f });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const R = { hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 700, dash: false, aimCone: 40, sound: 'punch' as const };
add({ ...R, id: 'bb_shot', family: 'bb_shot', name: 'Bubble', tags: ['light'], startup: 4, active: 2, recovery: 12, damage: 5, hitstun: 30, kbX: 40, kbY: 0, shoot: bub(), status: trap(), cancelInto: CANCEL.light, weight: 0.25, trail: tr() });
add({ ...R, id: 'bb_burst', name: 'Bubble Burst', tags: ['heavy'], startup: 9, active: 2, recovery: 16, damage: 4, hitstun: 30, kbX: 40, kbY: 0, aimCone: 30, shoot: bub(5, 44, 680), status: trap(130), cancelInto: CANCEL.heavy, weight: 0.5, trail: tr(12) });
add({ id: 'bb_up', name: 'Bubble Lift', tags: ['launcher'], startup: 6, active: 3, recovery: 16, damage: 5, hitstun: 40, kbX: 20, kbY: 0, launch: -900, hitbox: { x: 56, y: 96, r: 52 }, reach: 64, status: trap(170), cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], sound: 'launch', weight: 0.45, trail: tr() });
add({ ...R, id: 'bb_arc', name: 'Bubble Arc', tags: ['light'], startup: 5, active: 2, recovery: 12, damage: 3, hitstun: 30, kbX: 40, kbY: 0, aimCone: 80, shoot: bub(2, 30, 640), status: trap(), cancelInto: CANCEL.light, weight: 0.3, trail: tr() });
add({ ...R, id: 'bb_roll', name: 'Bubble Roll', tags: ['light', 'sweep'], startup: 5, active: 2, recovery: 12, damage: 3, hitstun: 30, kbX: 40, kbY: 0, aimCone: 80, shoot: { ...bub(1, 0, 600), gravity: 0 }, status: trap(), cancelInto: CANCEL.light, weight: 0.3, trail: tr() });
add({ id: 'bb_pop', name: 'Pop Party', tags: ['heavy', 'down'], startup: 8, active: 3, recovery: 16, damage: 14, hitstun: 30, kbX: 420, kbY: -380, hitstop: 5, shake: 7, hitbox: { x: 0, y: 70, r: 0 }, aoe: 230, reach: 60, maxTargets: 10, knockdown: true, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.7, trail: tr() });
add({ id: 'bb_swat', name: 'Swat', tags: ['light', 'down'], startup: 5, active: 3, recovery: 12, damage: 6, hitstun: 24, kbX: 520, kbY: -200, hitbox: { x: 56, y: 90, r: 44 }, reach: 64, cancelInto: CANCEL.light, sound: 'punch', weight: 0.4, trail: tr() });
add({ ...R, id: 'bb_ashot', family: 'bb_shot', name: 'Air Bubble', tags: ['air', 'light'], startup: 4, active: 2, recovery: 12, damage: 3, hitstun: 30, kbX: 40, kbY: 0, selfVY: -150, shoot: bub(), status: trap(), cancelInto: CANCEL.air, weight: 0.25, trail: tr() });
add({ ...R, id: 'bb_adrop', family: 'spike', name: 'Bubble Bomb', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 10, hitstun: 40, kbX: 200, kbY: 1600, spike: true, selfVY: -380, aimCone: 60, beam: { len: 800, width: 40, pierce: false, color: '#2436e6', style: 'ice' }, cancelInto: ['dodge', 'special'], weight: 0.8, trail: tr(14) });
add({ id: 'bb_aup', name: 'Air Swat', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14, damage: 7, hitstun: 36, kbX: 40, kbY: -900, selfVY: -700, hitbox: { x: 40, y: 104, r: 52 }, reach: 56, cancelInto: CANCEL.air, sound: 'punch', weight: 0.45, trail: tr() });
const anims = [
  tplAnim('bb_shot', m.bb_shot, 'shoot'), tplAnim('bb_burst', m.bb_burst, 'shoot', { stretch: 1.08 }), tplAnim('bb_up', m.bb_up, 'upper'), tplAnim('bb_arc', m.bb_arc, 'shootUp'),
  tplAnim('bb_roll', m.bb_roll, 'shootDown'), tplAnim('bb_pop', m.bb_pop, 'spin'), tplAnim('bb_swat', m.bb_swat, 'slash'),
  tplAnim('bb_ashot', m.bb_ashot, 'airShoot'), tplAnim('bb_adrop', m.bb_adrop, 'airDown'), tplAnim('bb_aup', m.bb_aup, 'airUp'),
];
export const bubble: WeaponDef = {
  id: 'bubble', name: 'Bubble Gun', desc: 'Silly: bubbles float enemies up helpless; pop them for bonus damage or bowl them.',
  ground: { side: { light: 'bb_shot', heavy: 'bb_burst' }, upDiag: { light: 'bb_arc', heavy: 'bb_burst' }, up: { light: 'bb_up', heavy: 'bb_up' }, downDiag: { light: 'bb_roll', heavy: 'bb_pop' }, down: { light: 'bb_swat', heavy: 'bb_pop' } },
  air: { side: { light: 'bb_ashot', heavy: 'bb_ashot' }, upDiag: { light: 'bb_aup', heavy: 'bb_aup' }, up: { light: 'bb_aup', heavy: 'bb_aup' }, downDiag: { light: 'bb_adrop', heavy: 'bb_adrop' }, down: { light: 'bb_adrop', heavy: 'bb_adrop' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, range: 700, anims, smears: {},
  tips: ['Bubbles trap enemies: any hit POPS them (bonus damage)', '→ bubble · heavy: bubble burst', '↑ bubble lift launcher', '↓ swat · heavy: pop party'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.rect(x - s * 0.38, y - s * 0.05, s * 0.34, s * 0.16); ctx.moveTo(x - s * 0.3, y + s * 0.11); ctx.lineTo(x - s * 0.34, y + s * 0.34); ctx.stroke(); ctx.strokeStyle = '#2436e6'; ctx.beginPath(); ctx.arc(x + s * 0.16, y - s * 0.12, s * 0.16, 0, Math.PI * 2); ctx.moveTo(x + s * 0.42, y - s * 0.34); ctx.arc(x + s * 0.36, y - s * 0.34, s * 0.06, 0, Math.PI * 2); ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    const [hx, hy, dx, dy] = forearm(j); const s = f.scale;
    stroke(ctx, col, 2 * wpp + 0.6); ctx.beginPath(); ctx.moveTo(hx - dx * 6 * s, hy - dy * 6 * s); ctx.lineTo(hx + dx * 18 * s, hy + dy * 18 * s); ctx.stroke();
    ctx.strokeStyle = '#2436e6'; ctx.beginPath(); ctx.arc(hx - dy * 9 * s, hy + dx * 9 * s - 8 * s, 7 * s, 0, Math.PI * 2); ctx.stroke();
  },
};
