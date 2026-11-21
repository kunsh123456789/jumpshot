import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** CHAIN WHIP: long-reach lashes that hit everything on the line; ↑ wraps and yanks the target up into a juggle. */
const C = '#9fd8ff', tr = (w = 12) => ({ limb: 'handA' as const, color: C, width: w });
const lash = (len: number, w = 34) => ({ len, width: w, pierce: true, color: '#1b1a17', style: 'whip' as const });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const B = { hitbox: { x: 40, y: 96, r: 1 }, reach: 260, ranged: 400, dash: false, aimCone: 40, sound: 'slash' as const };
add({ ...B, id: 'wh_lash', family: 'wh_lash', name: 'Lash', tags: ['light', 'string'], startup: 5, active: 3, recovery: 13, damage: 9, hitstun: 24, kbX: 240, kbY: -40, hitstop: 3, shake: 3, maxTargets: 4, beam: lash(340), next: 'wh_lash2', cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...B, id: 'wh_lash2', family: 'wh_lash', name: 'Lash', tags: ['light', 'string'], startup: 5, active: 3, recovery: 13, damage: 10, hitstun: 26, kbX: 320, kbY: -120, hitstop: 4, shake: 4, maxTargets: 4, beam: lash(340), next: 'wh_lash', cancelInto: CANCEL.light, weight: 0.4, trail: tr() });
add({ ...B, id: 'wh_crack', name: 'Crack', tags: ['heavy'], startup: 11, active: 3, recovery: 20, damage: 18, hitstun: 34, kbX: 760, kbY: -280, hitstop: 7, shake: 9, zoom: 0.3, poise: 2.2, maxTargets: 6, beam: lash(460, 40), cancelInto: CANCEL.heavy, weight: 0.85, trail: tr(16), fx: { crescent: true } });
add({ ...B, id: 'wh_wrap', family: 'wh_wrap', name: 'Wrap & Hoist', tags: ['launcher'], startup: 8, active: 3, recovery: 16, damage: 9, hitstun: 40, kbX: 30, kbY: 0, launch: -1220, follow: true, aimCone: 118, tether: { mode: 'air', frames: 10 }, grid: 1, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], weight: 0.6, trail: tr(14) });
add({ ...B, id: 'wh_wrapH', family: 'wh_wrap', name: 'Wrap & Hoist+', tags: ['launcher', 'heavy'], startup: 11, active: 3, recovery: 18, damage: 12, hitstun: 44, kbX: 30, kbY: 0, launch: -1440, follow: true, aimCone: 118, tether: { mode: 'air', frames: 12 }, grid: 1, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], weight: 0.85, trail: tr(16) });
add({ id: 'wh_twirl', family: 'wh_twirl', name: 'Whirl', tags: ['light'], startup: 6, active: 12, recovery: 12, damage: 4, hitstun: 26, kbX: 220, kbY: -260, hitstop: 2, shake: 3, hitbox: { x: 0, y: 110, r: 150 }, reach: 60, maxTargets: 8, multiHit: { interval: 4, count: 3 }, cancelFrom: 12, cancelInto: CANCEL.light, sound: 'slash', weight: 0.4, trail: tr(), fx: { whirl: 140 } });
add({ ...B, id: 'wh_trip', family: 'wh_trip', name: 'Ankle Lash', tags: ['light', 'sweep'], startup: 6, active: 3, recovery: 14, damage: 7, hitstun: 30, kbX: 200, kbY: -340, knockdown: true, maxTargets: 4, aimCone: 60, beam: lash(320), cancelInto: CANCEL.light, weight: 0.4, trail: tr() });
add({ ...B, id: 'wh_tripH', family: 'wh_trip', name: 'Floor Crack', tags: ['heavy', 'sweep', 'guardbreak'], startup: 10, active: 3, recovery: 18, damage: 12, hitstun: 34, kbX: 380, kbY: -420, knockdown: true, maxTargets: 8, aimCone: 60, beam: lash(420, 40), cancelInto: CANCEL.heavy, weight: 0.8, trail: tr(16) });
add({ id: 'wh_snap', name: 'Snap', tags: ['light', 'down'], startup: 8, active: 3, recovery: 18, damage: 10, hitstun: 30, kbX: 280, kbY: -420, hitstop: 6, shake: 8, hitbox: { x: 0, y: 30, r: 0 }, aoe: 170, reach: 80, maxTargets: 8, knockdown: true, plant: { radius: 180, damage: 0, x: 80 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.6, trail: tr() });
add({ ...B, id: 'wh_alash', family: 'wh_lash', name: 'Air Lash', tags: ['air', 'light'], startup: 4, active: 3, recovery: 12, damage: 7, hitstun: 32, kbX: 200, kbY: -360, selfVY: -170, maxTargets: 4, beam: lash(320), cancelInto: CANCEL.air, weight: 0.35, trail: tr() });
add({ ...B, id: 'wh_awrap', family: 'wh_wrap', name: 'Air Wrap', tags: ['air', 'light', 'rising'], startup: 6, active: 3, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -600, aimCone: 100, tether: { mode: 'air', frames: 10 }, cancelInto: CANCEL.air, weight: 0.5, trail: tr() });
add({ ...B, id: 'wh_aspike', family: 'spike', name: 'Down Lash', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 200, kbY: 1700, spike: true, selfVY: -380, aimCone: 60, beam: lash(320), cancelInto: ['dodge', 'special'], weight: 0.85, trail: tr(14) });
const anims = [
  tplAnim('wh_lash', m.wh_lash, 'slash'), tplAnim('wh_lash2', m.wh_lash2, 'slash', { aU: 1.5 }), tplAnim('wh_crack', m.wh_crack, 'overhead', { aU: 1.3, rootY: -40 }, 1),
  tplAnim('wh_wrap', m.wh_wrap, 'shootUp'), tplAnim('wh_wrapH', m.wh_wrapH, 'upper'), tplAnim('wh_twirl', m.wh_twirl, 'twirl'),
  tplAnim('wh_trip', m.wh_trip, 'low'), tplAnim('wh_tripH', m.wh_tripH, 'low', { stretch: 1.12 }), tplAnim('wh_snap', m.wh_snap, 'slam'),
  tplAnim('wh_alash', m.wh_alash, 'air'), tplAnim('wh_awrap', m.wh_awrap, 'airUp'), tplAnim('wh_aspike', m.wh_aspike, 'airDown'),
];
export const whip: WeaponDef = {
  id: 'whip', name: 'Chain Whip', desc: 'Long-reach lashes through the whole line; ↑ wraps and hoists them up.',
  ground: { side: { light: 'wh_lash', heavy: 'wh_crack' }, upDiag: { light: 'wh_twirl', heavy: 'wh_twirl' }, up: { light: 'wh_wrap', heavy: 'wh_wrapH' }, downDiag: { light: 'wh_trip', heavy: 'wh_tripH' }, down: { light: 'wh_snap', heavy: 'wh_snap' } },
  air: { side: { light: 'wh_alash', heavy: 'wh_alash' }, upDiag: { light: 'wh_awrap', heavy: 'wh_awrap' }, up: { light: 'wh_awrap', heavy: 'wh_awrap' }, downDiag: { light: 'wh_aspike', heavy: 'wh_aspike' }, down: { light: 'wh_aspike', heavy: 'wh_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, ropeStyle: 'whip', range: 420, anims, smears: {},
  tips: ['→ lash string through the line · heavy: crack', '↑ WRAP & HOIST launcher', '↗ whirl overhead · ↘ ankle lash (trips)', '↓ snap the floor'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.3); ctx.lineTo(x - s * 0.15, y + s * 0.1); ctx.bezierCurveTo(x + s * 0.3, y - s * 0.4, x + s * 0.5, y + s * 0.3, x + s * 0.1, y - s * 0.05); ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    const [hx, hy, dx, dy] = forearm(j); const s = f.scale;
    stroke(ctx, col, 2.6 * wpp + 0.6);
    ctx.beginPath(); ctx.moveTo(hx - dx * 4 * s, hy - dy * 4 * s); ctx.lineTo(hx + dx * 10 * s, hy + dy * 10 * s); ctx.stroke();
    stroke(ctx, col, 1.4 * wpp + 0.4);
    ctx.beginPath(); ctx.moveTo(hx + dx * 10 * s, hy + dy * 10 * s); ctx.bezierCurveTo(hx + dx * 24 * s, hy + 30 * s, hx - 14 * s, hy + 40 * s, hx - 6 * s, hy + 56 * s); ctx.stroke();
  },
};
