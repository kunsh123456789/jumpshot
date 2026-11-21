import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { pole, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** GIANT HAMMER: slow, enormous hits; breaks armor fast; ↑ heavy is a ground-pound that launches everyone near you. */
const C = '#ffa040', tr = (w = 18) => ({ limb: 'handA' as const, color: C, width: w });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
add({ id: 'hm_swing', family: 'hm_swing', name: 'Hammer Swing', tags: ['light'], startup: 9, active: 4, recovery: 18, damage: 14, hitstun: 30, kbX: 620, kbY: -160, hitstop: 7, shake: 8, zoom: 0.2, poise: 3, hitbox: { x: 86, y: 80, r: 60 }, reach: 92, maxTargets: 4, cancelInto: CANCEL.light, sound: 'heavy', weight: 0.75, trail: tr(), afterimage: true });
add({ id: 'hm_smash', name: 'Home Run Smash', tags: ['heavy'], startup: 18, active: 4, recovery: 26, damage: 24, hitstun: 40, kbX: 1150, kbY: -520, hitstop: 10, shake: 16, zoom: 0.6, poise: 4.5, hitbox: { x: 90, y: 84, r: 66 }, reach: 96, maxTargets: 6, slowmo: { scale: 0.35, sec: 0.3 }, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 1, afterimage: true, trail: tr(22), fx: { crescent: true } });
add({ id: 'hm_upper', family: 'hm_upper', name: 'Skyward Swing', tags: ['launcher'], startup: 11, active: 4, recovery: 18, damage: 15, hitstun: 42, kbX: 40, kbY: 0, hitstop: 7, shake: 9, zoom: 0.35, poise: 3, hitbox: { x: 70, y: 96, r: 60 }, reach: 80, launch: -1220, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.8, afterimage: true, trail: tr() });
add({ id: 'hm_pound', name: 'Ground Pound', tags: ['launcher', 'heavy'], startup: 22, active: 4, recovery: 26, damage: 16, hitstun: 44, kbX: 60, kbY: 0, hitstop: 9, shake: 18, zoom: 0.6, poise: 4, hitbox: { x: 0, y: 30, r: 0 }, aoe: 260, reach: 80, maxTargets: 10, launch: -1150, plant: { radius: 280, damage: 0, x: 60 }, slowmo: { scale: 0.35, sec: 0.3 }, cancelFrom: 3, cancelInto: ['air', 'dodge', 'special'], sound: 'stomp', weight: 1, afterimage: true, trail: tr(22), fx: { crescent: true } });
add({ id: 'hm_spin', name: 'Hammer Spin', tags: ['heavy'], startup: 12, active: 10, recovery: 22, damage: 11, hitstun: 34, kbX: 700, kbY: -380, hitstop: 6, shake: 10, poise: 3, hitbox: { x: 0, y: 70, r: 0 }, aoe: 200, reach: 80, maxTargets: 10, multiHit: { interval: 5, count: 2 }, knockdown: true, cancelFrom: 10, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.85, trail: tr(), fx: { whirl: 150 } });
add({ id: 'hm_sweep', name: 'Ankle Breaker', tags: ['light', 'sweep', 'guardbreak'], startup: 10, active: 4, recovery: 18, damage: 12, hitstun: 34, kbX: 420, kbY: -420, hitstop: 6, shake: 8, poise: 3, hitbox: { x: 86, y: 24, r: 56 }, reach: 92, maxTargets: 6, knockdown: true, cancelInto: CANCEL.light, sound: 'heavy', weight: 0.7, trail: tr() });
add({ id: 'hm_slam', name: 'Quake', tags: ['light', 'down'], startup: 13, active: 3, recovery: 22, damage: 14, hitstun: 34, kbX: 420, kbY: -480, hitstop: 8, shake: 14, zoom: 0.4, poise: 3, hitbox: { x: 0, y: 30, r: 0 }, aoe: 220, reach: 90, maxTargets: 10, knockdown: true, plant: { radius: 260, damage: 6, x: 90 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.95, afterimage: true, trail: tr() });
add({ id: 'hm_aswing', name: 'Air Swing', tags: ['air', 'heavy'], startup: 9, active: 4, recovery: 16, damage: 14, hitstun: 36, kbX: 1000, kbY: -200, hitstop: 8, shake: 11, poise: 3, hitbox: { x: 86, y: 74, r: 60 }, reach: 92, selfVY: -120, cancelInto: CANCEL.air, sound: 'heavy', weight: 0.9, trail: tr() });
add({ id: 'hm_aup', name: 'Air Upswing', tags: ['air', 'light', 'rising'], startup: 7, active: 4, recovery: 14, damage: 10, hitstun: 36, kbX: 40, kbY: -900, selfVY: -700, hitbox: { x: 40, y: 110, r: 64 }, reach: 60, cancelInto: CANCEL.air, sound: 'launch', weight: 0.6, trail: tr() });
add({ id: 'hm_meteor', family: 'spike', name: 'Meteor Hammer', tags: ['air', 'down', 'heavy'], startup: 9, active: 3, recovery: 20, damage: 15, hitstun: 44, kbX: 200, kbY: 2000, spike: true, impactShock: { radius: 260, damage: 10 }, hitstop: 9, shake: 15, zoom: 0.5, poise: 3, hitbox: { x: 60, y: 50, r: 60 }, reach: 64, selfVY: -420, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 1, afterimage: true, trail: tr(22) });
const anims = [
  tplAnim('hm_swing', m.hm_swing, 'slash', {}, 1), tplAnim('hm_smash', m.hm_smash, 'overhead', { aU: 1.4, rootY: -40 }, 1), tplAnim('hm_upper', m.hm_upper, 'upper'),
  tplAnim('hm_pound', m.hm_pound, 'slam', {}, 1), tplAnim('hm_spin', m.hm_spin, 'spin'), tplAnim('hm_sweep', m.hm_sweep, 'low'), tplAnim('hm_slam', m.hm_slam, 'slam'),
  tplAnim('hm_aswing', m.hm_aswing, 'air'), tplAnim('hm_aup', m.hm_aup, 'airUp'), tplAnim('hm_meteor', m.hm_meteor, 'airDown'),
];
const seg = new Float32Array(6);
export const hammer: WeaponDef = {
  id: 'hammer', name: 'Giant Hammer', desc: 'Slow, huge hits that crack armor; ↑ heavy ground-pound launches everyone nearby.',
  ground: { side: { light: 'hm_swing', heavy: 'hm_smash' }, upDiag: { light: 'hm_spin', heavy: 'hm_spin' }, up: { light: 'hm_upper', heavy: 'hm_pound' }, downDiag: { light: 'hm_sweep', heavy: 'hm_sweep' }, down: { light: 'hm_slam', heavy: 'hm_pound' } },
  air: { side: { light: 'hm_aswing', heavy: 'hm_aswing' }, upDiag: { light: 'hm_aup', heavy: 'hm_aup' }, up: { light: 'hm_aup', heavy: 'hm_aup' }, downDiag: { light: 'hm_meteor', heavy: 'hm_meteor' }, down: { light: 'hm_meteor', heavy: 'hm_meteor' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames + 2, rope: false }, anims,
  smears: { hm_swing: { chain: 4, radius: 1.3 }, hm_smash: { chain: 4, radius: 1.4 }, hm_spin: { chain: 4 } },
  tips: ['→ heavy swings · heavy: home-run smash', '↑ skyward swing launcher · heavy: GROUND POUND', '↗ hammer spin · ↘ ankle breaker', '↓ quake · in the air: meteor hammer'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.38); ctx.lineTo(x + s * 0.1, y - s * 0.1); ctx.rect(x - s * 0.05, y - s * 0.42, s * 0.42, s * 0.26); ctx.stroke(); },
  sweep(j, scale, out) { pole(j, 130 * scale, 0.75, seg); out[0] = seg[0]; out[1] = seg[1]; out[2] = seg[2]; out[3] = seg[3]; },
  held(ctx, f, j, col, wpp) {
    pole(j, 130 * f.scale, 0.75, seg);
    stroke(ctx, col, 2.6 * wpp + 0.8);
    ctx.beginPath(); ctx.moveTo(seg[4], seg[5]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
    const dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, s = f.scale;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(seg[2] + nx * 26 * s, seg[3] + ny * 26 * s); ctx.lineTo(seg[2] - nx * 26 * s, seg[3] - ny * 26 * s);
    ctx.lineTo(seg[2] - nx * 26 * s + (dx / L) * 22 * s, seg[3] - ny * 26 * s + (dy / L) * 22 * s); ctx.lineTo(seg[2] + nx * 26 * s + (dx / L) * 22 * s, seg[3] + ny * 26 * s + (dy / L) * 22 * s);
    ctx.closePath(); ctx.fill();
  },
};
