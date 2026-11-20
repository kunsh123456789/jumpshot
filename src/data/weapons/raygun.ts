import type { WeaponDef } from './types';
import { addMove, CANCEL, type MoveInput } from '../moves';
import { strikeAnim, LOW, AIRP } from './author';
import { J, type PoseSpec } from '../../render/rig';
import { PLAYER } from '../tuning';

/**
 * RAY GUN (cheat; only in the loadout when Settings -> Cheats -> Ray gun is on).
 * Every swipe fires an arena-wide piercing ray that deletes everything on the
 * line; heavy fires a fan of three. No heat. Clears any wave in a couple of
 * seconds by design.
 */
const BLUE = '#2436e6';
const beam = (w: number) => ({ len: 2600, width: w, pierce: true, color: BLUE });
const base = {
  tags: ['light'] as MoveInput['tags'], startup: 3, active: 2, recovery: 6, damage: 999, hitstun: 30, kbX: 900, kbY: -420, hitstop: 3, shake: 8,
  hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 2600, dash: false, aimCone: 70, maxTargets: 99, beam: beam(110), grid: 4,
  cancelFrom: 1, cancelInto: [...CANCEL.light, 'air'] as MoveInput['cancelInto'], sound: 'heavy' as const, weight: 0.9,
  trail: { limb: 'handA' as const, color: BLUE, width: 12 }, fx: { crescent: true },
};
const shot = addMove({ ...base, id: 'rg_shot', family: 'rg', name: 'Ray' });
const fan = addMove({ ...base, id: 'rg_fan', family: 'rg', name: 'Ray Fan', tags: ['heavy'], active: 9, multiHit: { interval: 3, count: 3 }, aimCone: 180, beam: beam(150) });
const ashot = addMove({ ...base, id: 'rg_air', family: 'rg', name: 'Air Ray', tags: ['air', 'light'], selfVY: -120, cancelInto: CANCEL.air });

const aim = (a: number, x: PoseSpec = {}): PoseSpec => ({ ...LOW, rootY: -24, aU: a, aL: 0, bU: a - 0.1, bL: 0.4, lean: 0.3, head: -0.15, ...x });
const anims = [
  strikeAnim('rg_shot', shot, { antic: [aim(1.3, { aL: 0.6 })], hit: aim(1.57, { rootX: -8, stretch: 1.06 }), follow: [aim(1.8, { rootX: -6 }), LOW] }),
  strikeAnim('rg_fan', fan, { antic: [aim(1.2, { aL: 0.8 })], hit: aim(1.9, { rootX: -10 }), hit2: aim(1.2, { rootX: -12 }), follow: [aim(1.57), LOW] }),
  strikeAnim('rg_air', ashot, { base: 'air', antic: [{ ...AIRP, aU: 1.3, aL: 0.6 }], hit: { ...AIRP, aU: 1.57, aL: 0, bU: 1.47, bL: 0.4 }, follow: [AIRP] }),
];

export const raygun: WeaponDef = {
  id: 'raygun',
  name: 'Ray Gun',
  desc: 'CHEAT: an arena-wide piercing ray. Clears a wave in seconds.',
  ground: { side: { light: 'rg_shot', heavy: 'rg_fan' }, upDiag: { light: 'rg_shot', heavy: 'rg_fan' }, up: { light: 'rg_shot', heavy: 'rg_fan' }, downDiag: { light: 'rg_shot', heavy: 'rg_fan' }, down: { light: 'rg_shot', heavy: 'rg_fan' } },
  air: { side: { light: 'rg_air', heavy: 'rg_air' }, upDiag: { light: 'rg_air', heavy: 'rg_air' }, up: { light: 'rg_air', heavy: 'rg_air' }, downDiag: { light: 'rg_air', heavy: 'rg_air' }, down: { light: 'rg_air', heavy: 'rg_air' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false },
  range: 2600,
  anims,
  smears: {},
  tips: ['CHEAT: every swipe fires an arena-wide ray', 'Heavy: a fan of three rays'],
  icon(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - s * 0.12, y - s * 0.06, s * 0.16, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.04, y - s * 0.06); ctx.lineTo(x + s * 0.3, y - s * 0.06);
    ctx.moveTo(x - s * 0.18, y + s * 0.1); ctx.lineTo(x - s * 0.24, y + s * 0.34);
    ctx.stroke();
    ctx.strokeStyle = BLUE;
    ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(x + s * 0.34, y - s * 0.06 + (i - 1) * s * 0.08); ctx.lineTo(x + s * 0.46, y - s * 0.06 + (i - 1) * s * 0.12); } ctx.stroke();
  },
  held(ctx, f, j, col, wpp) {
    const hx = j[J.handA * 2], hy = j[J.handA * 2 + 1];
    let dx = hx - j[J.elbA * 2], dy = hy - j[J.elbA * 2 + 1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const s = f.scale;
    ctx.strokeStyle = col; ctx.lineWidth = 2 * wpp + 0.6;
    ctx.beginPath(); ctx.arc(hx + dx * 4 * s, hy + dy * 4 * s, 6 * s, 0, Math.PI * 2);
    ctx.moveTo(hx + dx * 10 * s, hy + dy * 10 * s); ctx.lineTo(hx + dx * 22 * s, hy + dy * 22 * s); ctx.stroke();
    ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(hx + dx * 24 * s, hy + dy * 24 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  },
};
