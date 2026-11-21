import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { forearm, stroke } from './heldArt';
import { PLAYER } from '../tuning';

/** BOOMERANG SHIELD: block (tap stands your ground with a long parry window), bash, and a thrown shield that ricochets between enemies. */
const C = '#9fd8ff', tr = (w = 14) => ({ limb: 'handA' as const, color: C, width: w });
const m: Record<string, MoveDef> = {};
const add = (x: MoveInput) => { m[x.id] = addMove(x); };
add({ id: 'sh_bash', family: 'sh_bash', name: 'Shield Bash', tags: ['light', 'guardbreak'], startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 26, kbX: 460, kbY: -60, hitstop: 4, shake: 5, poise: 2, hitbox: { x: 54, y: 84, r: 48 }, reach: 64, deflect: true, cancelInto: CANCEL.light, sound: 'heavy', weight: 0.5, trail: tr() });
add({ id: 'sh_throw', name: 'Ricochet', tags: ['heavy'], startup: 9, active: 3, recovery: 14, damage: 9, hitstun: 30, kbX: 360, kbY: -220, hitstop: 4, shake: 5, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 620, dash: false, aimCone: 60, maxTargets: 6, toss: { speed: 1350, range: 520, radius: 40, bounce: 3, draw: 'shield' }, grid: 1, cancelFrom: 3, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.7, trail: tr(16) });
add({ id: 'sh_lift', name: 'Shield Lift', tags: ['launcher'], startup: 7, active: 4, recovery: 16, damage: 9, hitstun: 40, kbX: 40, kbY: 0, hitstop: 6, shake: 7, poise: 2, hitbox: { x: 50, y: 96, r: 48 }, reach: 62, launch: -1200, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.6, afterimage: true, trail: tr() });
add({ id: 'sh_toss', name: 'High Ricochet', tags: ['light'], startup: 8, active: 3, recovery: 14, damage: 7, hitstun: 30, kbX: 200, kbY: -420, hitstop: 4, shake: 4, hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 560, dash: false, aimCone: 70, maxTargets: 6, toss: { speed: 1250, range: 460, radius: 36, bounce: 2, draw: 'shield' }, cancelFrom: 3, cancelInto: CANCEL.light, sound: 'heavy', weight: 0.5, trail: tr() });
add({ id: 'sh_surf', name: 'Shield Surf', tags: ['heavy', 'sweep', 'guardbreak'], startup: 7, active: 12, recovery: 16, damage: 11, hitstun: 32, kbX: 420, kbY: -440, hitstop: 5, shake: 7, poise: 2, hitbox: { x: 50, y: 30, r: 48 }, reach: 20, travel: 300, maxTargets: 6, knockdown: true, deflect: true, cancelInto: CANCEL.heavy, sound: 'kick', weight: 0.75, afterimage: true, trail: tr() });
add({ id: 'sh_slam', name: 'Shield Slam', tags: ['light', 'down'], startup: 9, active: 3, recovery: 18, damage: 11, hitstun: 30, kbX: 300, kbY: -440, hitstop: 7, shake: 10, poise: 2.4, hitbox: { x: 0, y: 30, r: 0 }, aoe: 190, reach: 70, maxTargets: 8, knockdown: true, plant: { radius: 200, damage: 0, x: 40 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.7, trail: tr() });
add({ id: 'sh_abash', name: 'Air Bash', tags: ['air', 'light'], startup: 5, active: 4, recovery: 12, damage: 8, hitstun: 32, kbX: 300, kbY: -320, selfVY: -150, hitbox: { x: 54, y: 74, r: 48 }, reach: 62, deflect: true, cancelInto: CANCEL.air, sound: 'heavy', weight: 0.45, trail: tr() });
add({ id: 'sh_arise', name: 'Air Lift', tags: ['air', 'light', 'rising'], startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900, selfVY: -760, hitbox: { x: 40, y: 104, r: 52 }, reach: 56, cancelInto: CANCEL.air, sound: 'launch', weight: 0.5, trail: tr() });
add({ id: 'sh_dive', family: 'spike', name: 'Shield Dive', tags: ['air', 'down', 'light'], startup: 6, active: 3, recovery: 18, damage: 11, hitstun: 40, kbX: 220, kbY: 1750, spike: true, impactShock: { radius: 200, damage: 6 }, selfVY: -380, hitbox: { x: 40, y: 50, r: 56 }, reach: 56, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, afterimage: true, trail: tr(16) });
const anims = [
  tplAnim('sh_bash', m.sh_bash, 'jab', { aL: 0.4 }), tplAnim('sh_throw', m.sh_throw, 'throw'), tplAnim('sh_lift', m.sh_lift, 'upper'), tplAnim('sh_toss', m.sh_toss, 'throw', { aU: 2.3 }),
  tplAnim('sh_surf', m.sh_surf, 'dash'), tplAnim('sh_slam', m.sh_slam, 'slam'), tplAnim('sh_abash', m.sh_abash, 'air'), tplAnim('sh_arise', m.sh_arise, 'airUp'), tplAnim('sh_dive', m.sh_dive, 'airDown'),
];
export const shield: WeaponDef = {
  id: 'shield', name: 'Boomerang Shield', desc: 'Defense: tap blocks with a long parry window; throw it to ricochet between enemies.',
  ground: { side: { light: 'sh_bash', heavy: 'sh_throw' }, upDiag: { light: 'sh_toss', heavy: 'sh_throw' }, up: { light: 'sh_lift', heavy: 'sh_lift' }, downDiag: { light: 'sh_surf', heavy: 'sh_surf' }, down: { light: 'sh_slam', heavy: 'sh_slam' } },
  air: { side: { light: 'sh_abash', heavy: 'sh_abash' }, upDiag: { light: 'sh_arise', heavy: 'sh_arise' }, up: { light: 'sh_arise', heavy: 'sh_arise' }, downDiag: { light: 'sh_dive', heavy: 'sh_dive' }, down: { light: 'sh_dive', heavy: 'sh_dive' } },
  dodge: { distance: 0, frames: PLAYER.dodgeFrames, rope: false, parry: PLAYER.parryWindowFrames + 8 }, anims, smears: {},
  tips: ['Dodge = BLOCK: stand your ground, longer parry window', '→ bash (deflects darts) · heavy: RICOCHET throw', '↑ shield lift launcher · ↘ shield surf', '↓ shield slam'],
  icon(ctx, x, y, s, col) { stroke(ctx, col, Math.max(1.5, s * 0.07)); ctx.beginPath(); ctx.arc(x, y, s * 0.36, 0, Math.PI * 2); ctx.moveTo(x + s * 0.12, y); ctx.arc(x, y, s * 0.12, 0, Math.PI * 2); ctx.stroke(); },
  held(ctx, f, j, col, wpp) {
    if (f.weaponOut) return;
    const [hx, hy, dx, dy] = forearm(j); const s = f.scale;
    stroke(ctx, col, 2.2 * wpp + 0.6); ctx.fillStyle = '#fbf8f0';
    ctx.beginPath(); ctx.ellipse(hx + dx * 4 * s, hy + dy * 4 * s, 22 * s, 9 * s, Math.atan2(dy, dx) + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  },
};
