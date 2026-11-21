import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** YO-YO: it always comes back. Throws, walk-the-dog along the floor, around-the-world, and a sleeper that bounces them up and down. */
const C = '#e22424', tr = (w = 10) => ({ limb: 'handA' as const, color: C, width: w });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
const R = { hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 440, dash: false, aimCone: 50, sound: 'kick' as const };
add({ ...R, id: 'yy_throw', name: 'Throw Down', tags: ['light'], startup: 5, active: 3, recovery: 12, damage: 7, hitstun: 24, kbX: 240, kbY: -80, toss: { speed: 1400, range: 380, radius: 26, draw: 'yoyo' }, cancelFrom: 3, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ ...R, id: 'yy_dog', name: 'Walk the Dog', tags: ['heavy', 'sweep'], startup: 8, active: 3, recovery: 14, damage: 10, hitstun: 32, kbX: 300, kbY: -420, knockdown: true, maxTargets: 8, toss: { speed: 1050, range: 540, radius: 34, floor: true, draw: 'yoyo' }, cancelFrom: 3, cancelInto: CANCEL.heavy, weight: 0.6, trail: tr() });
add({ id: 'yy_sleeper', name: 'Sleeper', tags: ['launcher'], startup: 5, active: 15, recovery: 12, damage: 4, hitstun: 40, kbX: 20, kbY: 0, launch: -720, hitbox: { x: 60, y: 100, r: 60 }, reach: 70, multiHit: { interval: 5, count: 3 }, cancelFrom: 15, cancelInto: ['air', 'light', 'dodge', 'special'], sound: 'kick', weight: 0.45, trail: tr() });
add({ id: 'yy_world', name: 'Around the World', tags: ['heavy'], startup: 7, active: 16, recovery: 12, damage: 5, hitstun: 30, kbX: 300, kbY: -320, hitstop: 2, hitbox: { x: 0, y: 100, r: 150 }, reach: 60, maxTargets: 8, multiHit: { interval: 4, count: 4 }, deflect: true, cancelFrom: 16, cancelInto: CANCEL.heavy, sound: 'kick', weight: 0.5, trail: tr(), fx: { whirl: 150 } });
add({ ...R, id: 'yy_trip', name: 'Creeper', tags: ['light', 'sweep'], startup: 5, active: 3, recovery: 12, damage: 6, hitstun: 28, kbX: 160, kbY: -340, knockdown: true, maxTargets: 4, toss: { speed: 1000, range: 300, radius: 30, floor: true, draw: 'yoyo' }, cancelFrom: 3, cancelInto: CANCEL.light, weight: 0.35, trail: tr() });
add({ id: 'yy_drop', name: 'Gravity Pull', tags: ['light', 'down'], startup: 7, active: 4, recovery: 16, damage: 9, hitstun: 30, kbX: 260, kbY: -400, hitstop: 5, shake: 6, hitbox: { x: 0, y: 30, r: 0 }, aoe: 150, reach: 60, maxTargets: 6, knockdown: true, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.55, trail: tr() });
add({ ...R, id: 'yy_athrow', name: 'Air Throw', tags: ['air', 'light'], startup: 4, active: 3, recovery: 12, damage: 7, hitstun: 30, kbX: 200, kbY: -320, selfVY: -150, toss: { speed: 1400, range: 360, radius: 26, draw: 'yoyo' }, cancelFrom: 3, cancelInto: CANCEL.air, weight: 0.35, trail: tr() });
add({ id: 'yy_aworld', name: 'Air Orbit', tags: ['air', 'light'], startup: 5, active: 12, recovery: 12, damage: 4, hitstun: 32, kbX: 160, kbY: -380, hitbox: { x: 0, y: 70, r: 130 }, reach: 50, maxTargets: 6, multiHit: { interval: 4, count: 3 }, selfVY: -260, cancelFrom: 12, cancelInto: CANCEL.air, sound: 'kick', weight: 0.35, trail: tr(), fx: { whirl: 130 } });
add({ id: 'yy_aspike', family: 'spike', name: 'Yo-Yo Drop', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 200, kbY: 1700, spike: true, selfVY: -380, hitbox: { x: 50, y: 30, r: 56 }, reach: 56, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, trail: tr(14) });
const anims = [
  tplAnim('yy_throw', m.yy_throw, 'throw'), tplAnim('yy_dog', m.yy_dog, 'low'), tplAnim('yy_sleeper', m.yy_sleeper, 'upper'), tplAnim('yy_world', m.yy_world, 'twirl'),
  tplAnim('yy_trip', m.yy_trip, 'low'), tplAnim('yy_drop', m.yy_drop, 'stomp'), tplAnim('yy_athrow', m.yy_athrow, 'airShoot'), tplAnim('yy_aworld', m.yy_aworld, 'air'), tplAnim('yy_aspike', m.yy_aspike, 'airDown'),
];
export const yoyo: WeaponDef = {
  id: 'yoyo', name: 'Yo-Yo', desc: 'It always comes back: throws, walk-the-dog, around-the-world, the sleeper juggle.',
  ground: { side: { light: 'yy_throw', heavy: 'yy_dog' }, upDiag: { light: 'yy_world', heavy: 'yy_world' }, up: { light: 'yy_sleeper', heavy: 'yy_sleeper' }, downDiag: { light: 'yy_trip', heavy: 'yy_dog' }, down: { light: 'yy_drop', heavy: 'yy_drop' } },
  air: { side: { light: 'yy_athrow', heavy: 'yy_athrow' }, upDiag: { light: 'yy_aworld', heavy: 'yy_aworld' }, up: { light: 'yy_aworld', heavy: 'yy_aworld' }, downDiag: { light: 'yy_aspike', heavy: 'yy_aspike' }, down: { light: 'yy_aspike', heavy: 'yy_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, range: 460, anims, smears: {},
  tips: ['→ throw · heavy: WALK THE DOG along the floor', '↑ SLEEPER: bounces them up and down', '↗ around the world (blocks darts)', '↓ gravity pull'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 0.4); ctx.lineTo(x + s * 0.05, y + s * 0.05); ctx.moveTo(x + s * 0.27, y + s * 0.2); ctx.arc(x + s * 0.05, y + s * 0.2, s * 0.22, 0, Math.PI * 2); ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    if (f.weaponOut) return;
    const [hx, hy] = forearm(j); const s = f.scale;
    stroke(ctx, col, 1 * wpp + 0.3); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + 16 * s); ctx.stroke();
    stroke(ctx, col, 2 * wpp + 0.6); ctx.beginPath(); ctx.arc(hx, hy + 24 * s, 8 * s, 0, Math.PI * 2); ctx.stroke();
  },
};
