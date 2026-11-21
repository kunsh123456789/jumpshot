import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { pole, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** ICE SPEAR: jabs freeze enemies solid; the next hit SHATTERS them for big damage. Freeze, then shatter. */
const C = '#2436e6', tr = (w = 12) => ({ limb: 'handA' as const, color: C, width: w });
const frz = (f = 90) => ({ kind: 'freeze' as const, frames: f });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
add({ id: 'ic_jab', family: 'ic_jab', name: 'Frost Jab', tags: ['light'], startup: 5, active: 3, recovery: 13, damage: 7, hitstun: 24, kbX: 160, kbY: 0, hitbox: { x: 100, y: 92, r: 40 }, reach: 110, status: frz(80), cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr() });
add({ id: 'ic_lance', name: 'Ice Lance', tags: ['heavy'], startup: 12, active: 4, recovery: 18, damage: 12, hitstun: 34, kbX: 520, kbY: -160, hitstop: 7, shake: 9, zoom: 0.3, poise: 2.2, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 560, dash: false, aimCone: 35, maxTargets: 8, beam: { len: 560, width: 34, pierce: true, color: '#2436e6', style: 'ice' }, status: frz(120), cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.85, trail: tr(16) });
add({ id: 'ic_pillar', family: 'ic_pillar', name: 'Ice Pillar', tags: ['launcher'], startup: 7, active: 3, recovery: 16, damage: 9, hitstun: 40, kbX: 30, kbY: 0, launch: -1240, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 520, dash: false, aimCone: 60, spikes: { count: 1, spacing: 0, start: 100, delay: 0 }, grid: 1, cancelFrom: 2, cancelInto: ['air', 'light', 'heavy', 'dodge', 'special'], sound: 'launch', weight: 0.6, trail: tr() });
add({ id: 'ic_shards', name: 'Shard Fan', tags: ['light'], startup: 6, active: 2, recovery: 14, damage: 5, hitstun: 24, kbX: 140, kbY: -120, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 560, dash: false, aimCone: 80, shoot: { kind: 'shard', speed: 1200, count: 3, spread: 30, gravity: 0, homing: 0, pierce: 1, life: 45, radius: 12 }, status: frz(70), cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr() });
add({ id: 'ic_sweep', name: 'Glacier Sweep', tags: ['light', 'sweep'], startup: 6, active: 4, recovery: 15, damage: 7, hitstun: 30, kbX: 220, kbY: -360, knockdown: true, hitbox: { x: 96, y: 24, r: 46 }, reach: 104, maxTargets: 4, status: frz(60), cancelInto: CANCEL.light, sound: 'kick', weight: 0.4, trail: tr() });
add({ id: 'ic_field', name: 'Frost Field', tags: ['heavy', 'down'], startup: 12, active: 3, recovery: 20, damage: 6, hitstun: 30, kbX: 80, kbY: 0, hitstop: 6, shake: 8, hitbox: { x: 0, y: 30, r: 0 }, aoe: 230, reach: 60, maxTargets: 10, status: frz(130), plant: { radius: 240, damage: 0, x: 0 }, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.7, trail: tr() });
add({ id: 'ic_stab', name: 'Downstab', tags: ['light', 'down'], startup: 7, active: 3, recovery: 16, damage: 9, hitstun: 30, kbX: 220, kbY: -380, knockdown: true, hitbox: { x: 70, y: 30, r: 46 }, reach: 80, maxTargets: 3, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.55, trail: tr() });
add({ id: 'ic_ajab', name: 'Air Frost Jab', tags: ['air', 'light'], startup: 4, active: 3, recovery: 12, damage: 7, hitstun: 30, kbX: 160, kbY: -320, selfVY: -160, hitbox: { x: 96, y: 74, r: 42 }, reach: 104, status: frz(70), cancelInto: CANCEL.air, sound: 'slash', weight: 0.35, trail: tr() });
add({ id: 'ic_arise', name: 'Rising Icicle', tags: ['air', 'light', 'rising'], startup: 5, active: 3, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -720, hitbox: { x: 40, y: 120, r: 50 }, reach: 56, cancelInto: CANCEL.air, sound: 'launch', weight: 0.5, trail: tr() });
add({ id: 'ic_aspike', family: 'spike', name: 'Icefall', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 200, kbY: 1700, spike: true, selfVY: -380, hitbox: { x: 50, y: 40, r: 54 }, reach: 60, status: frz(80), cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, trail: tr(14) });
const anims = [
  tplAnim('ic_jab', m.ic_jab, 'jab', { stretch: 1.14 }), tplAnim('ic_lance', m.ic_lance, 'jab', { stretch: 1.18 }, 1), tplAnim('ic_pillar', m.ic_pillar, 'slam'), tplAnim('ic_shards', m.ic_shards, 'throw'),
  tplAnim('ic_sweep', m.ic_sweep, 'low'), tplAnim('ic_field', m.ic_field, 'slam'), tplAnim('ic_stab', m.ic_stab, 'low', { aU: 0.4 }),
  tplAnim('ic_ajab', m.ic_ajab, 'air'), tplAnim('ic_arise', m.ic_arise, 'airUp'), tplAnim('ic_aspike', m.ic_aspike, 'airDown'),
];
const seg = new Float32Array(6);
export const ice: WeaponDef = {
  id: 'ice', name: 'Ice Spear', desc: 'Freeze, then shatter: frozen enemies take big damage from the next hit.',
  ground: { side: { light: 'ic_jab', heavy: 'ic_lance' }, upDiag: { light: 'ic_shards', heavy: 'ic_lance' }, up: { light: 'ic_pillar', heavy: 'ic_pillar' }, downDiag: { light: 'ic_sweep', heavy: 'ic_field' }, down: { light: 'ic_stab', heavy: 'ic_field' } },
  air: { side: { light: 'ic_ajab', heavy: 'ic_ajab' }, upDiag: { light: 'ic_arise', heavy: 'ic_arise' }, up: { light: 'ic_arise', heavy: 'ic_arise' }, downDiag: { light: 'ic_aspike', heavy: 'ic_aspike' }, down: { light: 'ic_aspike', heavy: 'ic_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false }, range: 560, anims, smears: {},
  tips: ['Hits FREEZE enemies; the next hit SHATTERS them', '→ frost jab · heavy: ice lance', '↑ ICE PILLAR launcher', '↓ downstab · heavy: frost field freezes everyone'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.35); ctx.lineTo(x + s * 0.18, y - s * 0.18); ctx.stroke(); ctx.strokeStyle = '#2436e6'; ctx.beginPath(); ctx.moveTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x + s * 0.1, y - s * 0.26); ctx.lineTo(x + s * 0.18, y - s * 0.18); ctx.lineTo(x + s * 0.26, y - s * 0.1); ctx.closePath(); ctx.stroke(); },
  sweep(j, scale, out) { pole(j, 160 * scale, 0.65, seg); out[0] = seg[0]; out[1] = seg[1]; out[2] = seg[2]; out[3] = seg[3]; },
  held(ctx, f, j, col, wpp) {
    pole(j, 160 * f.scale, 0.65, seg);
    stroke(ctx, col, 2.2 * wpp + 0.7); ctx.beginPath(); ctx.moveTo(seg[4], seg[5]); ctx.lineTo(seg[2], seg[3]); ctx.stroke();
    const dx = seg[2] - seg[0], dy = seg[3] - seg[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s = f.scale;
    ctx.strokeStyle = '#2436e6'; ctx.fillStyle = '#fbf8f0';
    ctx.beginPath(); ctx.moveTo(seg[2] + ux * 20 * s, seg[3] + uy * 20 * s); ctx.lineTo(seg[2] - uy * 7 * s, seg[3] + ux * 7 * s); ctx.lineTo(seg[2] - ux * 4 * s, seg[3] - uy * 4 * s); ctx.lineTo(seg[2] + uy * 7 * s, seg[3] - ux * 7 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  },
};
