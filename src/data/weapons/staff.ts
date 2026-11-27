import type { WeaponDef } from './types';
import { addMove, CANCEL } from '../moves';
import { strikeAnim, LOW, AIRP } from './author';
import { J } from '../../render/rig';
import { PLAYER, WORLD } from '../tuning';
import type { Fighter } from '../../sim/fighter';

/**
 * STAFF: reach, sweeps and style. A long thin staff in both hands: more reach
 * than fists, most swings hit several enemies in an arc, ground sweeps trip,
 * the helicopter spin blocks darts, and the pole-vault launcher sends the
 * target skyward while the hero vaults up after it.
 */
const C = '#9fd8ff';
const tr = (w = 14) => ({ limb: 'handA' as const, color: C, width: w });

// ------------------------------------------------------------------ moves
const twirl1 = addMove({ id: 'st_twirl1', family: 'st_twirl', name: 'Twirl', tags: ['light', 'string'],
  startup: 5, active: 4, recovery: 14, damage: 7, hitstun: 22, kbX: 190, kbY: 0, hitstop: 3, shake: 3,
  hitbox: { x: 92, y: 92, r: 50 }, reach: 104, maxTargets: 2, cancelInto: CANCEL.light, next: 'st_twirl2',
  sound: 'slash', weight: 0.3, trail: tr() });
const twirl2 = addMove({ id: 'st_twirl2', family: 'st_twirl', name: 'Twirl', tags: ['light', 'string'],
  startup: 5, active: 4, recovery: 14, damage: 7, hitstun: 22, kbX: 200, kbY: -60, hitstop: 3, shake: 3,
  hitbox: { x: 90, y: 66, r: 54 }, reach: 104, maxTargets: 2, cancelInto: CANCEL.light, next: 'st_twirl3',
  sound: 'slash', weight: 0.3, trail: tr() });
const twirl3 = addMove({ id: 'st_twirl3', family: 'st_twirl', name: 'Twirl Finish', tags: ['light', 'string'],
  startup: 6, active: 5, recovery: 18, damage: 11, hitstun: 28, kbX: 440, kbY: -140, hitstop: 5, shake: 6, zoom: 0.15,
  hitbox: { x: 96, y: 86, r: 56 }, reach: 104, maxTargets: 4, cancelInto: CANCEL.light, next: 'st_twirl1',
  sound: 'slash', weight: 0.55, afterimage: true, trail: tr(16) });
const spin = addMove({ id: 'st_spin', name: 'Spinning Sweep', tags: ['heavy', 'sweep', 'guardbreak'],
  startup: 10, active: 8, recovery: 20, damage: 15, hitstun: 34, kbX: 520, kbY: -330, hitstop: 7, shake: 10, zoom: 0.35, poise: 2.2,
  hitbox: { x: 0, y: 40, r: 0 }, aoe: 210, reach: 90, maxTargets: 10, knockdown: true, fx: { crescent: true }, cancelInto: CANCEL.heavy,
  sound: 'heavy', weight: 0.85, afterimage: true, trail: tr(18) });
const vault = addMove({ id: 'st_vault', family: 'st_vault', name: 'Pole Vault', tags: ['launcher'],
  startup: 8, active: 4, recovery: 16, damage: 11, hitstun: 40, kbX: 40, kbY: 0, hitstop: 6, shake: 7, zoom: 0.3, poise: 1.6,
  hitbox: { x: 66, y: 96, r: 52 }, reach: 80, launch: -1260, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'],
  sound: 'launch', weight: 0.65, afterimage: true, trail: tr(16), slowmo: { scale: 0.35, sec: 0.3, at: 'apex' } });
const vaultH = addMove({ id: 'st_vaultH', family: 'st_vault', name: 'Pole Vault+', tags: ['launcher', 'heavy'],
  startup: 11, active: 4, recovery: 18, damage: 14, hitstun: 44, kbX: 40, kbY: 0, hitstop: 8, shake: 10, zoom: 0.5, poise: 2.5,
  hitbox: { x: 66, y: 96, r: 54 }, reach: 80, launch: -1470, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'],
  sound: 'launch', weight: 0.9, afterimage: true, trail: tr(18), slowmo: { scale: 0.3, sec: 0.4, at: 'apex' } });
const heli = addMove({ id: 'st_heli', family: 'st_heli', name: 'Helicopter', tags: ['light'],
  startup: 7, active: 12, recovery: 14, damage: 3, hitstun: 24, kbX: 140, kbY: -260, hitstop: 2, shake: 3, poise: 1.2,
  hitbox: { x: 0, y: 116, r: 112 }, reach: 60, maxTargets: 6, multiHit: { interval: 4, count: 3 }, deflect: true, fx: { whirl: 110 },
  cancelFrom: 12, cancelInto: CANCEL.light, sound: 'slash', weight: 0.35, trail: tr(14) });
const heliH = addMove({ id: 'st_heliH', family: 'st_heli', name: 'Helicopter+', tags: ['heavy'],
  startup: 9, active: 20, recovery: 16, damage: 4, hitstun: 26, kbX: 220, kbY: -340, hitstop: 2, shake: 4, poise: 1.6,
  hitbox: { x: 0, y: 116, r: 130 }, reach: 60, maxTargets: 8, multiHit: { interval: 4, count: 5 }, deflect: true, fx: { whirl: 130 },
  cancelFrom: 20, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.5, afterimage: true, trail: tr(16) });
const plant = addMove({ id: 'st_plant', family: 'st_plant', name: 'Plant Slam', tags: ['light', 'down'],
  startup: 9, active: 3, recovery: 18, damage: 10, hitstun: 30, kbX: 280, kbY: -430, hitstop: 6, shake: 9, zoom: 0.2, poise: 1.5,
  hitbox: { x: 0, y: 30, r: 0 }, aoe: 200, reach: 84, maxTargets: 8, knockdown: true, plant: { radius: 220, damage: 0, x: 70 },
  cancelInto: CANCEL.light, sound: 'stomp', weight: 0.65, trail: tr(14) });
const plantH = addMove({ id: 'st_plantH', family: 'st_plant', name: 'Earth Splitter', tags: ['heavy', 'down'],
  startup: 13, active: 3, recovery: 22, damage: 14, hitstun: 36, kbX: 440, kbY: -500, hitstop: 8, shake: 14, zoom: 0.45, poise: 2.5,
  hitbox: { x: 0, y: 30, r: 0 }, aoe: 270, reach: 90, maxTargets: 10, knockdown: true, plant: { radius: 320, damage: 7, x: 80 },
  cancelInto: CANCEL.heavy, sound: 'stomp', weight: 0.95, afterimage: true, trail: tr(18) });
const toss = addMove({ id: 'st_toss', name: 'Staff Boomerang', tags: ['heavy'],
  startup: 10, active: 3, recovery: 16, damage: 9, hitstun: 30, kbX: 320, kbY: -300, hitstop: 4, shake: 6, zoom: 0.2, poise: 1.6,
  hitbox: { x: 40, y: 96, r: 1 }, reach: 300, ranged: 640, dash: false, aimCone: 75, maxTargets: 12,
  toss: { speed: 1350, range: 560, radius: 46 }, grid: 1, cancelFrom: 3, cancelInto: CANCEL.heavy,
  sound: 'slash', weight: 0.7, afterimage: true, trail: tr(16) });
// air
const aswing = addMove({ id: 'st_aswing', family: 'st_aswing', name: 'Air Arc', tags: ['air', 'light'],
  startup: 5, active: 5, recovery: 13, damage: 7, hitstun: 32, kbX: 150, kbY: -360, hitstop: 4, shake: 3,
  hitbox: { x: 82, y: 72, r: 60 }, reach: 92, maxTargets: 3, selfVY: -170, cancelInto: CANCEL.air, next: 'st_aswing2',
  sound: 'slash', weight: 0.35, trail: tr() });
const aswing2 = addMove({ id: 'st_aswing2', family: 'st_aswing', name: 'Air Arc', tags: ['air', 'light'],
  startup: 5, active: 5, recovery: 13, damage: 8, hitstun: 32, kbX: 220, kbY: -360, hitstop: 4, shake: 4,
  hitbox: { x: 82, y: 80, r: 60 }, reach: 92, maxTargets: 3, selfVY: -170, cancelInto: CANCEL.air, next: 'st_aswing',
  sound: 'slash', weight: 0.4, trail: tr() });
const aswingH = addMove({ id: 'st_aswingH', name: 'Air Home Run', tags: ['air', 'heavy'],
  startup: 8, active: 5, recovery: 16, damage: 13, hitstun: 36, kbX: 1000, kbY: -200, hitstop: 8, shake: 11, zoom: 0.45, poise: 2.2,
  hitbox: { x: 86, y: 74, r: 62 }, reach: 94, maxTargets: 4, selfVY: -120, cancelInto: CANCEL.air,
  sound: 'heavy', weight: 0.9, afterimage: true, trail: tr(18) });
const arise = addMove({ id: 'st_arise', name: 'Rising Spin', tags: ['air', 'light', 'rising'],
  startup: 5, active: 5, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -920, hitstop: 5, shake: 6, zoom: 0.2,
  hitbox: { x: 30, y: 110, r: 70 }, reach: 50, maxTargets: 4, selfVY: -820, cancelInto: CANCEL.air,
  sound: 'launch', weight: 0.55, afterimage: true, trail: tr(16) });
const aheli = addMove({ id: 'st_aheli', name: 'Air Helicopter', tags: ['air', 'light'],
  startup: 6, active: 12, recovery: 14, damage: 3, hitstun: 30, kbX: 120, kbY: -380, hitstop: 2, shake: 3,
  hitbox: { x: 0, y: 80, r: 106 }, reach: 50, maxTargets: 6, multiHit: { interval: 4, count: 3 }, deflect: true, selfVY: -260, fx: { whirl: 100 },
  cancelFrom: 12, cancelInto: CANCEL.air, sound: 'slash', weight: 0.35, trail: tr() });
const plunge = addMove({ id: 'st_plunge', family: 'spike', name: 'Staff Plunge', tags: ['air', 'down', 'light'],
  startup: 6, active: 3, recovery: 18, damage: 12, hitstun: 40, kbX: 260, kbY: 1750, hitstop: 8, shake: 12, zoom: 0.45, poise: 2,
  hitbox: { x: 60, y: 50, r: 56 }, reach: 64, spike: true, selfVY: -380, cancelInto: ['dodge', 'special'],
  sound: 'spike', weight: 0.85, afterimage: true, trail: tr(18) });

// ------------------------------------------------------------------ drawings
// Staff grips: lead hand forward, rear hand back on the same pole.
const GRIP = { aU: 1.25, aL: 0.55, bU: 0.95, bL: 1.25 };
const anims = [
  strikeAnim('st_twirl1', twirl1, { reach: 'handA', smear: ['handA', 'handB'],
    antic: [{ ...LOW, ...GRIP, lean: 0.2, aU: 0.5, aL: 1.4, bU: 0.2, bL: 1.6, rootX: -6 }, { ...LOW, lean: 0.1, aU: 0.1, aL: 1.6, bU: -0.3, bL: 1.6, spin: -0.15, rootX: -8 }],
    hit: { ...LOW, lean: 0.6, rootX: 16, aU: 1.62, aL: 0.02, bU: 1.35, bL: 0.4, footA: 44, footB: -36, head: -0.25 },
    follow: [{ ...LOW, lean: 0.55, rootX: 14, aU: 1.9, aL: 0.2, bU: 1.5, bL: 0.5, footA: 42 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_twirl2', twirl2, { reach: 'handA', smear: ['handA', 'handB'],
    antic: [{ ...LOW, lean: 0.4, aU: 2.4, aL: 0.4, bU: 2.0, bL: 0.6, rootX: 4 }, { ...LOW, lean: 0.35, aU: 2.8, aL: 0.3, bU: 2.4, bL: 0.4, spin: 0.1 }],
    hit: { ...LOW, rootY: -40, lean: 0.75, rootX: 18, aU: 1.2, aL: 0.0, bU: 0.9, bL: 0.4, footA: 46, footB: -40, head: -0.2 },
    follow: [{ ...LOW, rootY: -38, lean: 0.7, rootX: 16, aU: 0.9, aL: 0.2, bU: 0.6, bL: 0.6 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_twirl3', twirl3, { reach: 'handA', smear: ['handA', 'handB'], inbetweens: 1,
    antic: [{ ...LOW, lean: 0.1, aU: -0.4, aL: 1.0, bU: -0.7, bL: 1.2, spin: -0.3, rootX: -10, flex: 4 }, { ...LOW, lean: -0.05, aU: -1.0, aL: 0.6, bU: -1.2, bL: 0.8, spin: -0.45, rootX: -12, flex: 6 }],
    hit: { ...LOW, lean: 0.78, rootX: 24, aU: 1.7, aL: 0.0, bU: 1.45, bL: 0.2, footA: 52, footB: -40, head: -0.3, spin: 0.12, stretch: 1.08 },
    follow: [{ ...LOW, lean: 0.7, rootX: 22, aU: 2.2, aL: 0.2, bU: 1.9, bL: 0.4, footA: 50, spin: 0.1 }, { ...LOW, ...GRIP, rootX: 8 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_spin', spin, { strike: 'body', smear: ['handA', 'handB'], inbetweens: 1,
    antic: [{ ...LOW, rootY: -40, lean: 0.3, aU: -0.8, aL: 0.4, bU: -1.0, bL: 0.6, spin: -0.15, flex: 6 }, { ...LOW, rootY: -46, lean: 0.25, aU: -1.3, aL: 0.2, bU: -1.5, bL: 0.4, spin: -0.2, flex: 8 }],
    hit: { ...LOW, rootY: -54, lean: 0.6, aU: 1.62, aL: 0.0, bU: 1.45, bL: 0.15, spin: 0.15, footA: 58, footB: -54, head: -0.1, stretch: 1.1 },
    hit2: { ...LOW, rootY: -54, lean: 0.35, aU: 0.9, aL: 0.0, bU: -0.6, bL: 0.2, spin: -0.1, footA: 58, footB: -54, head: 0.0 },
    follow: [{ ...LOW, rootY: -48, lean: 0.25, aU: -0.9, aL: 0.2, bU: -1.2, bL: 0.3 }, { ...LOW, rootY: -40, lean: 0.4, aU: 0.6, aL: 0.5, bU: 0.3, bL: 0.8 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_vault', vault, { strike: 'body', reach: 'handA', smear: ['footA', 'footB'],
    antic: [{ ...LOW, rootY: -44, lean: 0.7, aU: 1.0, aL: 0.2, bU: 0.75, bL: 0.4 }, { rootY: 34, lean: -0.1, aU: 3.05, aL: 0.1, bU: 2.95, bL: 0.2, laU: 1.6, laL: -2.2, lbU: 1.2, lbL: -2.0, plant: 0, head: -0.1 }],
    hit: { rootY: 56, lean: -0.45, aU: 0.35, aL: 0.0, bU: 0.25, bL: 0.1, laU: 2.5, laL: -0.2, lbU: 2.1, lbL: -0.5, plant: 0, head: -0.4, stretch: 1.15 },
    follow: [{ rootY: 46, lean: -0.6, aU: 0.6, aL: 0.3, laU: 2.8, laL: -0.4, lbU: 2.4, lbL: -0.7, plant: 0, head: -0.3 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_vaultH', vaultH, { strike: 'body', reach: 'handA', smear: ['footA', 'footB'], inbetweens: 1,
    antic: [{ ...LOW, rootY: -48, lean: 0.75, aU: 1.0, aL: 0.2, bU: 0.75, bL: 0.4, flex: -6 }, { rootY: 40, lean: -0.15, aU: 3.08, aL: 0.05, bU: 3.0, bL: 0.15, laU: 1.7, laL: -2.3, lbU: 1.3, lbL: -2.1, plant: 0, head: -0.1 }],
    hit: { rootY: 64, lean: -0.55, aU: 0.3, aL: 0.0, bU: 0.2, bL: 0.1, laU: 2.7, laL: -0.1, lbU: 2.3, lbL: -0.4, plant: 0, head: -0.45, stretch: 1.22 },
    follow: [{ rootY: 52, lean: -0.7, aU: 0.6, aL: 0.3, laU: 3.0, laL: -0.3, lbU: 2.6, lbL: -0.6, plant: 0, head: -0.35 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_heli', heli, { strike: 'body', smear: ['handA', 'handB'],
    antic: [{ ...LOW, aU: 2.6, aL: 0.4, bU: 2.4, bL: 0.6, lean: 0.2 }],
    hit: { ...LOW, rootY: -20, aU: 3.0, aL: 0.1, bU: 2.4, bL: 0.6, lean: 0.12, spin: 0.1, head: -0.3 },
    hit2: { ...LOW, rootY: -20, aU: 2.3, aL: 0.2, bU: 3.0, bL: 0.1, lean: 0.12, spin: -0.1, head: -0.3 },
    follow: [{ ...LOW, aU: 2.7, aL: 0.3, bU: 2.5, bL: 0.4 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_heliH', heliH, { strike: 'body', smear: ['handA', 'handB'],
    antic: [{ ...LOW, rootY: -36, aU: 2.6, aL: 0.4, bU: 2.4, bL: 0.6, lean: 0.25 }, { ...LOW, rootY: -40, aU: 2.9, aL: 0.2, bU: 2.7, bL: 0.4, lean: 0.2, spin: -0.4 }],
    hit: { ...LOW, rootY: -24, aU: 3.05, aL: 0.05, bU: 2.4, bL: 0.6, lean: 0.1, spin: 0.12, head: -0.35 },
    hit2: { ...LOW, rootY: -24, aU: 2.3, aL: 0.2, bU: 3.05, bL: 0.05, lean: 0.1, spin: -0.12, head: -0.35 },
    follow: [{ ...LOW, aU: 2.7, aL: 0.3, bU: 2.5, bL: 0.4, spin: 0.3 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_toss', toss, { strike: 'arm', smear: ['handA'],
    antic: [{ ...LOW, ...GRIP, spin: -0.2, rootX: -6 }, { ...LOW, lean: -0.1, aU: -1.2, aL: 0.4, bU: -1.0, bL: 0.6, spin: -0.4, rootX: -12, flex: 6, stretch: 0.94 }],
    hit: { ...LOW, lean: 0.8, rootX: 16, aU: 1.9, aL: 0.0, bU: 0.4, bL: 1.6, footA: 52, footB: -44, head: -0.3, spin: 0.15, stretch: 1.1 },
    follow: [{ ...LOW, lean: 0.6, rootX: 12, aU: 1.6, aL: 0.3, bU: 0.5, bL: 1.8 }, { ...LOW, aU: 1.3, aL: 1.0, bU: 0.6, bL: 2.0 }] }),
  strikeAnim('st_plant', plant, { strike: 'arm', smear: ['handA'],
    antic: [{ ...LOW, rootY: -10, lean: 0.1, aU: 2.8, aL: 0.2, bU: 2.6, bL: 0.4, head: -0.2 }, { rootY: 0, lean: -0.1, aU: 3.1, aL: 0.1, bU: 3.0, bL: 0.2, footA: 30, footB: -30, liftA: 10, head: -0.3 }],
    hit: { ...LOW, rootY: -50, lean: 0.85, aU: 0.9, aL: 0.0, bU: 0.6, bL: 0.2, footA: 50, footB: -44, head: 0.1, stretch: 1.08 },
    follow: [{ ...LOW, rootY: -46, lean: 0.8, aU: 0.8, aL: 0.1, bU: 0.5, bL: 0.3 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_plantH', plantH, { strike: 'arm', smear: ['handA', 'handB'], inbetweens: 1,
    antic: [{ ...LOW, rootY: -20, lean: 0.2, aU: 2.6, aL: 0.3, bU: 2.4, bL: 0.5 }, { rootY: 10, lean: -0.25, aU: 3.2, aL: 0.0, bU: 3.15, bL: 0.1, footA: 30, footB: -30, liftA: 18, head: -0.35, flex: 6, stretch: 1.06 }],
    hit: { ...LOW, rootY: -58, lean: 0.95, aU: 0.75, aL: 0.0, bU: 0.5, bL: 0.1, footA: 56, footB: -48, head: 0.15, stretch: 1.12 },
    follow: [{ ...LOW, rootY: -54, lean: 0.9, aU: 0.7, aL: 0.1, bU: 0.45, bL: 0.2 }, { ...LOW, rootY: -40, lean: 0.6 }, { ...LOW, ...GRIP }] }),
  strikeAnim('st_aswing', aswing, { base: 'air', reach: 'handA', smear: ['handA', 'handB'],
    antic: [{ ...AIRP, aU: 2.7, aL: 0.3, bU: 2.4, bL: 0.5, lean: -0.2, spin: -0.2 }],
    hit: { ...AIRP, aU: 1.3, aL: 0.0, bU: 1.0, bL: 0.3, lean: 0.4, spin: 0.2, laU: 1.2, laL: -1.6 },
    follow: [{ ...AIRP, aU: 0.8, aL: 0.2, bU: 0.6, bL: 0.4, lean: 0.35, spin: 0.15 }] }),
  strikeAnim('st_aswing2', aswing2, { base: 'air', reach: 'handA', smear: ['handA', 'handB'],
    antic: [{ ...AIRP, aU: 0.3, aL: 0.6, bU: 0.1, bL: 0.8, lean: 0.3, spin: 0.2 }],
    hit: { ...AIRP, aU: 2.3, aL: 0.0, bU: 2.0, bL: 0.3, lean: -0.3, spin: -0.25, lbU: 1.2, lbL: -1.4 },
    follow: [{ ...AIRP, aU: 2.6, aL: 0.2, bU: 2.3, bL: 0.4, lean: -0.25 }] }),
  strikeAnim('st_aswingH', aswingH, { base: 'air', reach: 'handA', smear: ['handA', 'handB'], inbetweens: 1,
    antic: [{ ...AIRP, aU: -0.8, aL: 0.4, bU: -1.0, bL: 0.6, lean: -0.3, spin: -0.5 }, { ...AIRP, aU: -1.4, aL: 0.2, bU: -1.6, bL: 0.4, lean: -0.4, spin: -0.7 }],
    hit: { ...AIRP, aU: 1.7, aL: 0.0, bU: 1.5, bL: 0.1, lean: 0.5, spin: 0.4, laU: 1.4, laL: -1.2, stretch: 1.1 },
    follow: [{ ...AIRP, aU: 2.3, aL: 0.1, bU: 2.1, bL: 0.2, lean: 0.4, spin: 0.35 }, { ...AIRP, ...GRIP }] }),
  strikeAnim('st_arise', arise, { base: 'air', strike: 'body', smear: ['handA', 'handB'],
    antic: [{ ...AIRP, aU: 0.6, aL: 0.5, bU: 0.4, bL: 0.7, lean: 0.3, laU: 1.4, laL: -2.0 }],
    hit: { ...AIRP, aU: 3.05, aL: 0.0, bU: 2.95, bL: 0.1, lean: -0.15, spin: 1.0, laU: 0.4, laL: -0.4, head: -0.4 },
    follow: [{ ...AIRP, aU: 3.0, aL: 0.1, bU: 2.9, bL: 0.2, spin: 2.0 }, { ...AIRP, ...GRIP, spin: 0 }] }),
  strikeAnim('st_aheli', aheli, { base: 'air', strike: 'body', smear: ['handA', 'handB'],
    antic: [{ ...AIRP, aU: 2.6, aL: 0.4, bU: 2.4, bL: 0.6 }],
    hit: { ...AIRP, aU: 3.05, aL: 0.05, bU: 2.4, bL: 0.6, spin: 0.15, head: -0.3 },
    hit2: { ...AIRP, aU: 2.3, aL: 0.2, bU: 3.05, bL: 0.05, spin: -0.15, head: -0.3 },
    follow: [{ ...AIRP, aU: 2.7, aL: 0.3, bU: 2.5, bL: 0.4 }] }),
  strikeAnim('st_plunge', plunge, { base: 'air', strike: 'arm', smear: ['handA', 'handB'],
    antic: [{ ...AIRP, aU: 3.0, aL: 0.2, bU: 2.9, bL: 0.3, lean: -0.3, laU: 1.8, laL: -2.2, head: -0.2 }],
    hit: { ...AIRP, aU: 0.55, aL: 0.0, bU: 0.4, bL: 0.1, lean: 0.7, laU: 0.6, laL: -0.4, lbU: -0.3, lbL: -0.8, spin: 0.3, stretch: 1.12 },
    follow: [{ ...AIRP, aU: 0.5, aL: 0.1, bU: 0.35, bL: 0.2, lean: 0.6, spin: 0.25 }, { ...AIRP, ...GRIP }] }),
];

/** The staff line through both hands: [grip x, grip y, tip x, tip y, butt x, butt y]. */
export function staffLine(j: Float32Array, scale: number, out: Float32Array): void {
  const ax = j[J.handA * 2], ay = j[J.handA * 2 + 1], bx = j[J.handB * 2], by = j[J.handB * 2 + 1];
  let dx = ax - bx, dy = ay - by;
  let L = Math.hypot(dx, dy);
  if (L < 6) { dx = ax - j[J.elbA * 2]; dy = ay - j[J.elbA * 2 + 1]; L = Math.hypot(dx, dy) || 1; }
  dx /= L; dy /= L;
  const len = 168 * scale, cx = (ax + bx) / 2, cy = (ay + by) / 2;
  out[0] = cx; out[1] = cy;
  out[2] = cx + dx * len * 0.58; out[3] = cy + dy * len * 0.58;
  if (out.length >= 6) { out[4] = cx - dx * len * 0.42; out[5] = cy - dy * len * 0.42; }
}
const line6 = new Float32Array(6);

/** Held staff: one long line through both hands. During the vault it is planted upright in the floor (reference 36-42). */
function heldStaff(ctx: CanvasRenderingContext2D, f: Fighter, j: Float32Array, col: string, wpp: number): void {
  if (f.weaponOut) return; // thrown: the weapon FX draws it spinning
  ctx.strokeStyle = col; ctx.lineWidth = 2.4 * wpp + 0.8; ctx.lineCap = 'round';
  const a = f.anim, cur = a.cur;
  ctx.beginPath();
  if (cur && (cur.id === 'st_vault' || cur.id === 'st_vaultH') && (f.state === 'move' || f.team === 'player') && a.t >= cur.contact * 0.5 && a.t < cur.contact + 8) {
    const gx = (j[J.handA * 2] + j[J.handB * 2]) / 2, gy = Math.min(j[J.handA * 2 + 1], j[J.handB * 2 + 1]);
    ctx.moveTo(gx, WORLD.groundY); ctx.lineTo(gx + 2, gy - 18 * f.scale);
  } else {
    staffLine(j, f.scale, line6);
    ctx.moveTo(line6[4], line6[5]); ctx.lineTo(line6[2], line6[3]);
  }
  ctx.stroke();
}

export const staff: WeaponDef = {
  id: 'staff',
  name: 'Staff',
  desc: 'Reach and crowd control: wide sweeps, a pole-vault launcher, a dart-blocking spin, a boomerang throw.',
  ground: {
    side: { light: 'st_twirl1', heavy: 'st_spin' },
    upDiag: { light: 'st_heli', heavy: 'st_toss' },
    up: { light: 'st_vault', heavy: 'st_vaultH' },
    downDiag: { light: 'st_heli', heavy: 'st_heliH' },
    down: { light: 'st_plant', heavy: 'st_plantH' },
  },
  air: {
    side: { light: 'st_aswing', heavy: 'st_aswingH' },
    upDiag: { light: 'st_aheli', heavy: 'st_aheli' },
    up: { light: 'st_arise', heavy: 'st_arise' },
    downDiag: { light: 'st_plunge', heavy: 'st_plunge' },
    down: { light: 'st_plunge', heavy: 'st_plunge' },
  },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames, rope: false },
  range: PLAYER.targetRange * 1.1,
  anims,
  smears: {
    st_twirl1: { radius: 1.35, sweep: 1 }, st_twirl2: { radius: 1.35 }, st_twirl3: { chain: 4, radius: 1.45 },
    st_spin: { chain: 4, radius: 1.6, density: [1, 0.85, 0.6, 0.35] }, st_heli: { chain: 3, radius: 1.5 }, st_heliH: { chain: 4, radius: 1.6 },
    st_vault: { chain: 4 }, st_vaultH: { chain: 4 }, st_toss: { chain: 3 }, st_plant: { radius: 1.4 }, st_plantH: { chain: 4, radius: 1.5 },
    st_aswing: { radius: 1.4 }, st_aswing2: { radius: 1.4 }, st_aswingH: { chain: 4, radius: 1.5 }, st_arise: { radius: 1.4 }, st_aheli: { radius: 1.5 }, st_plunge: { chain: 4, radius: 1.4 },
  },
  tips: ['→ 3-hit twirl · heavy: spinning sweep (trips)', '↑ POLE VAULT launcher', '↗ ↘ helicopter spin (blocks darts)', '↗ heavy: boomerang throw', '↓ plant slam shockwave'],
  icon(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y + s * 0.4); ctx.lineTo(x + s * 0.4, y - s * 0.4);
    ctx.moveTo(x - s * 0.18, y + s * 0.08); ctx.lineTo(x - s * 0.08, y + s * 0.18);
    ctx.moveTo(x + s * 0.08, y - s * 0.18); ctx.lineTo(x + s * 0.18, y - s * 0.08);
    ctx.stroke();
  },
  sweep: staffLine,
  held: heldStaff,
};
