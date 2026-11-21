import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { J } from '../../render/rig';
import { PLAYER } from '../tuning';

/** LIGHTNING FIST: punches that chain lightning to nearby enemies, a thunder uppercut, a slam that calls down bolts. */
const C = '#2436e6', tr = (w = 11) => ({ limb: 'handA' as const, color: C, width: w });
const chain = (arcs = 2, dmg = 0.5) => ({ arcs, dmg });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const P = { hitbox: { x: 58, y: 92, r: 38 }, reach: 70, sound: 'punch' as const };
add({ ...P, id: 'lf_jab1', family: 'lf_jab', name: 'Spark Jab', tags: ['light', 'string'], startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 20, kbX: 160, kbY: 0, chain: chain(), next: 'lf_jab2', cancelInto: CANCEL.light, weight: 0.3, trail: tr() });
add({ ...P, id: 'lf_jab2', family: 'lf_jab', name: 'Spark Cross', tags: ['light', 'string'], startup: 4, active: 3, recovery: 14, damage: 8, hitstun: 24, kbX: 300, kbY: -60, chain: chain(3), next: 'lf_jab1', cancelInto: CANCEL.light, weight: 0.4, trail: { limb: 'handB', color: C, width: 11 } });
add({ id: 'lf_bolt', name: 'Thunderbolt', tags: ['heavy'], startup: 12, active: 4, recovery: 18, damage: 13, hitstun: 34, kbX: 600, kbY: -200, hitstop: 7, shake: 10, zoom: 0.35, poise: 2.2, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 600, dash: false, aimCone: 35, maxTargets: 8, beam: { len: 620, width: 40, pierce: true, color: '#2436e6', style: 'lightning' }, chain: chain(3, 0.4), cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.85, trail: tr(16), fx: { crescent: true } });
add({ ...P, id: 'lf_upper', family: 'lf_upper', name: 'Thunder Uppercut', tags: ['launcher'], startup: 6, active: 4, recovery: 16, damage: 10, hitstun: 40, kbX: 40, kbY: 0, launch: -1240, follow: true, hitstop: 6, shake: 7, hitbox: { x: 50, y: 100, r: 46 }, chain: chain(2), cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.65, afterimage: true, trail: tr(14), fx: { lightning: true } });
add({ ...P, id: 'lf_hook', name: 'Static Hook', tags: ['light', 'rising'], startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 28, kbX: 180, kbY: -540, hitbox: { x: 54, y: 104, r: 42 }, chain: chain(2), cancelInto: CANCEL.light, weight: 0.45, trail: tr() });
add({ ...P, id: 'lf_sweep', name: 'Ground Current', tags: ['light', 'sweep'], startup: 5, active: 4, recovery: 15, damage: 7, hitstun: 30, kbX: 160, kbY: -380, knockdown: true, hitbox: { x: 62, y: 22, r: 42 }, chain: chain(2, 0.4), cancelInto: CANCEL.light, weight: 0.4, trail: tr() });
add({ id: 'lf_slam', name: 'Storm Call', tags: ['heavy', 'down'], startup: 12, active: 3, recovery: 20, damage: 12, hitstun: 34, kbX: 380, kbY: -480, hitstop: 8, shake: 13, zoom: 0.4, poise: 2.4, hitbox: { x: 0, y: 30, r: 0 }, aoe: 230, reach: 70, maxTargets: 10, knockdown: true, plant: { radius: 240, damage: 0, x: 40 }, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.95, trail: tr(16), fx: { lightning: true } });
add({ ...P, id: 'lf_stomp', name: 'Shock Stomp', tags: ['light', 'down'], startup: 7, active: 3, recovery: 16, damage: 8, hitstun: 28, kbX: 260, kbY: -300, aoe: 150, maxTargets: 6, hitbox: { x: 0, y: 30, r: 0 }, chain: chain(1, 0.5), cancelInto: CANCEL.light, sound: 'stomp', weight: 0.55, trail: tr() });
add({ ...P, id: 'lf_akick', name: 'Air Spark', tags: ['air', 'light'], startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 30, kbX: 140, kbY: -340, selfVY: -150, hitbox: { x: 58, y: 70, r: 42 }, chain: chain(2, 0.4), cancelInto: CANCEL.air, sound: 'kick', weight: 0.3, trail: tr() });
add({ ...P, id: 'lf_arise', name: 'Air Thunder', tags: ['air', 'light', 'rising'], startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -800, hitbox: { x: 40, y: 100, r: 46 }, chain: chain(1), cancelInto: CANCEL.air, sound: 'launch', weight: 0.55, trail: tr() });
add({ ...P, id: 'lf_aspike', family: 'spike', name: 'Thunder Drop', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 12, hitstun: 40, kbX: 280, kbY: 1750, spike: true, selfVY: -380, hitbox: { x: 50, y: 66, r: 48 }, chain: chain(2), cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, afterimage: true, trail: tr(16), fx: { lightning: true } });
const anims = [
  tplAnim('lf_jab1', m.lf_jab1, 'jab'), tplAnim('lf_jab2', m.lf_jab2, 'jab', { aU: 0.3, aL: 2.2, bU: 1.6, bL: 0 }), tplAnim('lf_bolt', m.lf_bolt, 'shoot', { stretch: 1.1 }, 1),
  tplAnim('lf_upper', m.lf_upper, 'upper'), tplAnim('lf_hook', m.lf_hook, 'upper', { rootY: 0, aU: 2.4, aL: 1.0 }), tplAnim('lf_sweep', m.lf_sweep, 'low'),
  tplAnim('lf_slam', m.lf_slam, 'slam'), tplAnim('lf_stomp', m.lf_stomp, 'stomp'), tplAnim('lf_akick', m.lf_akick, 'air'), tplAnim('lf_arise', m.lf_arise, 'airUp'), tplAnim('lf_aspike', m.lf_aspike, 'airDown'),
];
export const thunder: WeaponDef = {
  id: 'thunder', name: 'Lightning Fist', desc: 'Every punch chains lightning to nearby enemies; the slam calls down bolts.',
  ground: { side: { light: 'lf_jab1', heavy: 'lf_bolt' }, upDiag: { light: 'lf_hook', heavy: 'lf_bolt' }, up: { light: 'lf_upper', heavy: 'lf_upper' }, downDiag: { light: 'lf_sweep', heavy: 'lf_slam' }, down: { light: 'lf_stomp', heavy: 'lf_slam' } },
  air: { side: { light: 'lf_akick', heavy: 'lf_akick' }, upDiag: { light: 'lf_arise', heavy: 'lf_arise' }, up: { light: 'lf_arise', heavy: 'lf_arise' }, downDiag: { light: 'lf_aspike', heavy: 'lf_aspike' }, down: { light: 'lf_aspike', heavy: 'lf_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, anims, smears: {},
  tips: ['Punches CHAIN lightning to nearby enemies', '→ spark jabs · heavy: THUNDERBOLT', '↑ thunder uppercut launcher', '↓ shock stomp · heavy: STORM CALL'],
  icon(ctx, x, y, s, col) { stroke(ctx, '#2436e6', Math.max(1.5, s * 0.08)); ctx.beginPath(); ctx.moveTo(x + s * 0.12, y - s * 0.42); ctx.lineTo(x - s * 0.14, y + s * 0.02); ctx.lineTo(x + s * 0.08, y + s * 0.02); ctx.lineTo(x - s * 0.12, y + s * 0.42); ctx.stroke(); stroke(ctx, col, Math.max(1.2, s * 0.05)); },
  held(ctx, f, j, _col, wpp) {
    const s = f.scale;
    stroke(ctx, '#2436e6', 1.4 * wpp + 0.4);
    ctx.beginPath();
    for (const [h, e] of [[J.handA, J.elbA], [J.handB, J.elbB]] as [number, number][]) {
      const [hx, hy] = forearm(j, h, e);
      ctx.moveTo(hx - 8 * s, hy - 6 * s); ctx.lineTo(hx - 2 * s, hy - 2 * s); ctx.lineTo(hx - 5 * s, hy + 1 * s); ctx.lineTo(hx + 4 * s, hy + 6 * s);
      ctx.moveTo(hx + 7 * s, hy - 7 * s); ctx.lineTo(hx + 3 * s, hy - 1 * s);
    }
    ctx.stroke();
  },
};
