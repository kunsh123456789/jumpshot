import type { WeaponV2 } from './types';
import { addMove, CANCEL, MOVES, type MoveDef, type MoveInput } from '../moves';
import { tplAnim } from './author';
import { PLAYER } from '../tuning';
import { drawn, type AnimDef } from '../anims/types';

/**
 * The reworked movesets (approved list, pass 9): every weapon gets a signature
 * mechanic (sim/moveset2.ts) and its own dodge, on top of the moves that stay.
 * Settings -> Movesets switches between these and the original sets.
 *
 * A move here is either a VARIANT of an existing one (same numbers, drawings and
 * timing, plus an `x2` mechanic or a tweak) or a NEW move drawn from a template.
 */
const anims: Record<string, AnimDef[]> = {};
function add(weapon: string, x: MoveInput, tpl?: Parameters<typeof tplAnim>[2], pose = {}, inb = 0): MoveDef {
  const m = addMove(x);
  if (tpl) (anims[weapon] ??= []).push(tplAnim(m.id, m, tpl, pose, inb));
  return m;
}
/** A copy of an existing move under a new id (reusing its drawings), with changes. */
function variant(base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef {
  const b = MOVES[base];
  if (!b) throw new Error('movesets2: missing base move ' + base);
  const m: MoveDef = { ...b, ...patch, id, anim: b.anim ?? b.id };
  MOVES[id] = m;
  return m;
}
/** Variant a whole auto-string (base -> next -> ...), relinking `next` to the new ids. */
function chain(base: string, prefix: string, patch: Partial<MoveDef>): string {
  let id: string | undefined = base, prev: MoveDef | null = null;
  const first = prefix + base;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const m = variant(id, prefix + id, patch);
    if (prev) prev.next = m.id;
    prev = m;
    id = MOVES[id].next;
  }
  if (prev) prev.next = undefined;
  return first;
}
const tr = (color: string, w = 14, limb: 'handA' | 'footA' = 'handA') => ({ limb, color, width: w });

// ====================================================================== FISTS: Brawler
// Fury (passive): hits fill it; while it burns, punches hit harder and boom louder.
add('fists', { id: 'fs2_jab1', family: 'fs2_jab', name: 'Jab', anim: 'jab1', tags: ['light', 'string'], startup: 4, active: 3, recovery: 13, damage: 6, hitstun: 20, kbX: 140, kbY: 0, hitbox: { x: 58, y: 92, r: 36 }, reach: 72, cancelInto: CANCEL.light, next: 'fs2_jab2', sound: 'punch', weight: 0.25, trail: tr('#bff4ff', 9) });
add('fists', { id: 'fs2_jab2', family: 'fs2_jab', name: 'Jab', anim: 'jab2', tags: ['light', 'string'], startup: 4, active: 3, recovery: 13, damage: 6, hitstun: 22, kbX: 160, kbY: 0, hitbox: { x: 58, y: 92, r: 36 }, reach: 72, cancelInto: CANCEL.light, next: 'fs2_cross', sound: 'punch', weight: 0.3, trail: tr('#bff4ff', 9) });
add('fists', { id: 'fs2_cross', family: 'fs2_jab', name: 'Power Cross', anim: 'cross', tags: ['light', 'string'], startup: 5, active: 3, recovery: 18, damage: 11, hitstun: 30, kbX: 560, kbY: -90, hitstop: 6, shake: 7, zoom: 0.25, hitbox: { x: 62, y: 92, r: 40 }, reach: 76, cancelInto: CANCEL.light, sound: 'punch', weight: 0.65, trail: tr('#ff4040', 12), x2: { puff: 140 } });
add('fists', { id: 'fs2_hay', name: 'Haymaker', anim: 'backfist', tags: ['heavy'], startup: 16, active: 4, recovery: 24, damage: 22, hitstun: 44, kbX: 1350, kbY: -260, hitstop: 10, shake: 15, zoom: 0.55, poise: 4, hitbox: { x: 66, y: 92, r: 46 }, reach: 80, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 1, afterimage: true, trail: tr('#ff4040', 18), slowmo: { scale: 0.35, sec: 0.25 }, fx: { crescent: true } });
add('fists', { id: 'fs2_dragon', name: 'Dragon Uppercut', anim: 'launcherH', tags: ['launcher', 'heavy'], startup: 10, active: 5, recovery: 22, damage: 16, hitstun: 44, kbX: 60, kbY: 0, hitstop: 8, shake: 12, zoom: 0.45, poise: 3, hitbox: { x: 46, y: 110, r: 50 }, reach: 64, launch: -1350, follow: true, cancelFrom: 3, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.95, afterimage: true, trail: tr('#ff8a2a', 18), fx: { lightning: true }, x2: { self: { vx: 90, vy: -1250 } } });
add('fists', { id: 'fs2_elbow', family: 'spike', name: 'Meteor Elbow', anim: 'spike', tags: ['air', 'down', 'heavy'], startup: 8, active: 3, recovery: 18, damage: 14, hitstun: 44, kbX: 160, kbY: 2200, spike: true, impactShock: { radius: 260, damage: 10 }, hitstop: 9, shake: 14, zoom: 0.45, poise: 3, hitbox: { x: 40, y: 50, r: 56 }, reach: 60, selfVY: -380, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 1, afterimage: true, trail: tr('#ff4040', 18) });
add('fists', { id: 'fs2_counter', name: 'Slip Counter', anim: 'cross', tags: ['light'], startup: 2, active: 3, recovery: 14, damage: 14, hitstun: 40, kbX: 900, kbY: -220, hitstop: 8, shake: 9, zoom: 0.35, hitbox: { x: 62, y: 92, r: 44 }, reach: 74, cancelInto: CANCEL.light, sound: 'punch', weight: 0.85, afterimage: true, trail: tr('#ffd23f', 14), fx: { crescent: true } });
const fists2: WeaponV2 = {
  desc: 'Brawler: hits build FURY (harder, louder punches); slip an attack to counter it.',
  ground: { side: { light: 'fs2_jab1', heavy: 'fs2_hay' }, upDiag: { light: 'knee', heavy: 'knee' }, up: { light: 'launcher', heavy: 'fs2_dragon' }, downDiag: { light: 'sweep', heavy: 'slide' }, down: { light: 'stomp', heavy: 'stompH' } },
  air: { side: { light: 'akick1', heavy: 'aheavy' }, upDiag: { light: 'aslash', heavy: 'aslashH' }, up: { light: 'arise', heavy: 'arise' }, downDiag: { light: 'fs2_elbow', heavy: 'fs2_elbow' }, down: { light: 'fs2_elbow', heavy: 'fs2_elbow' } },
  dodge: { distance: 40, frames: PLAYER.dodgeFrames, rope: false, kind: 'slip' },
  passive: { fury: true },
  tips: ['→ jab, jab, POWER CROSS · heavy: HAYMAKER', '↑ launcher · heavy: DRAGON UPPERCUT', '↗ knee · ↘ sweep · ↓ stomp · air ↓ METEOR ELBOW', 'Dodge = SLIP: dodge a hit to counter it · hits build FURY'],
  anims: [],
};

// ====================================================================== HOOK: Spider
// Tie two enemies together; trip line; grapple dive; zip up to dodge.
add('hook', { id: 'hk2_tie', name: 'Tether', tags: ['heavy'], startup: 9, active: 3, recovery: 18, damage: 6, hitstun: 40, kbX: 0, kbY: 0, hitbox: { x: 50, y: 92, r: 1 }, reach: 300, ranged: 440, dash: false, aimCone: 45, beam: { len: 440, width: 26, pierce: false, color: '#1b1a17', style: 'whip' }, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.5, trail: tr('#ffd23f', 10), x2: { tie: 420 } }, 'throw');
add('hook', { id: 'hk2_trip', name: 'Trip Line', tags: ['light', 'sweep'], startup: 7, active: 4, recovery: 18, damage: 8, hitstun: 34, kbX: 300, kbY: -420, knockdown: true, hitbox: { x: 120, y: 20, r: 90 }, reach: 130, maxTargets: 6, cancelInto: CANCEL.light, sound: 'slash', weight: 0.55, trail: tr('#ffd23f', 10) }, 'low');
add('hook', { id: 'hk2_dive', name: 'Grapple Dive', tags: ['air', 'down', 'heavy'], startup: 6, active: 6, recovery: 16, damage: 12, hitstun: 40, kbX: 260, kbY: -500, knockdown: true, hitstop: 8, shake: 12, hitbox: { x: 30, y: 20, r: 80 }, reach: 40, dash: false, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.9, afterimage: true, trail: tr('#ffd23f', 14), x2: { self: { vx: 0, vy: 1700 }, landWave: { dmg: 6, range: 220, speed: 900, launch: -520 } } }, 'airDown');
// Grappling mobility (sim/grapple.ts): the body kick while swinging, and the dive kick off a wall.
variant('hk_aswing', 'hk3_kick', { name: 'Swing Kick', damage: 9, hitstun: 34, kbX: 700, kbY: -420, hitstop: 5, shake: 6, zoom: 0.15, sound: 'kick', weight: 0.6 });
// Move-list names for the ↗ slot (the grapple takes the input before these could run).
variant('hk_swing', 'hk3_web', { name: 'Web Swing' });
variant('hk_aswing', 'hk3_aweb', { name: 'Web Swing' });
variant('hk_azip', 'hk3_wallKick', { name: 'Wall Dive', damage: 18, hitstun: 38, kbX: 1000, kbY: -320, hitstop: 9, shake: 12, zoom: 0.45 });
const hook2: WeaponV2 = {
  desc: 'Spider: swing from the roof, zip to the walls and stick; yank, zip and TETHER enemies.',
  ground: { side: { light: 'hk_pull', heavy: 'hk_zip' }, upDiag: { light: 'hk3_web', heavy: 'hk2_tie' }, up: { light: 'hk_air', heavy: 'hk_airH' }, downDiag: { light: 'hk2_trip', heavy: 'hk2_trip' }, down: { light: 'hk_slam', heavy: 'hk_slamH' } },
  air: { side: { light: 'hk_apull', heavy: 'hk_azip' }, upDiag: { light: 'hk3_aweb', heavy: 'hk3_aweb' }, up: { light: 'hk_aair', heavy: 'hk_aair' }, downDiag: { light: 'hk2_dive', heavy: 'hk2_dive' }, down: { light: 'hk2_dive', heavy: 'hk2_dive' } },
  dodge: { distance: 0, frames: PLAYER.dodgeFrames + 4, rope: false, kind: 'zipUp' },
  passive: { grapple: true },
  tips: ['↗ ↖ SWING from the roof (keep holding to keep swinging, flick again to chain) · you kick whoever you swing through', '← → with nobody that side: ZIP to the wall and stick · tap or swipe away to WALL JUMP, at an enemy: WALL DIVE', '→ at an enemy: yank + punch · heavy: zip kick · ground ↗ heavy: TETHER two enemies', '↘ TRIP LINE · ↓ slam yank · air ↓ GRAPPLE DIVE · dodge = zip up and hang'],
  anims: [],
};

// ====================================================================== STAFF: Spin Master
// Momentum spin: hold after the flick to keep spinning; let go to fling.
add('staff', { id: 'st2_spin', name: 'Momentum Spin', tags: ['light'], startup: 6, active: 160, recovery: 10, damage: 4, hitstun: 24, kbX: 260, kbY: -140, hitbox: { x: 0, y: 80, r: 0 }, aoe: 170, reach: 80, maxTargets: 10, multiHit: { interval: 8, count: 20 }, deflect: true, cancelFrom: 8, cancelInto: ['dodge', 'special'], sound: 'slash', weight: 0.45, trail: tr('#bff4ff', 12), fx: { whirl: 150 }, x2: { spin: { min: 20, then: 'st2_fling' } }, then: 'st2_fling' }, 'spin');
add('staff', { id: 'st2_fling', name: 'Spin Fling', tags: ['heavy'], startup: 3, active: 4, recovery: 18, damage: 14, hitstun: 40, kbX: 1150, kbY: -440, hitstop: 8, shake: 12, zoom: 0.4, hitbox: { x: 0, y: 80, r: 0 }, aoe: 210, reach: 80, maxTargets: 10, knockdown: true, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.95, afterimage: true, trail: tr('#ffd23f', 16), fx: { crescent: true } }, 'spin');
add('staff', { id: 'st2_rocket', name: 'Pole Rocket', tags: ['launcher', 'heavy'], startup: 10, active: 4, recovery: 14, damage: 12, hitstun: 44, kbX: 40, kbY: 0, hitstop: 7, shake: 10, hitbox: { x: 50, y: 100, r: 60 }, reach: 70, launch: -1250, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.85, afterimage: true, trail: tr('#ffd23f', 16), x2: { self: { vx: 80, vy: -1500 } }, then: 'st_plunge' }, 'upper');
add('staff', { id: 'st2_lowspin', name: 'Low Spin', tags: ['light', 'sweep'], startup: 7, active: 8, recovery: 16, damage: 6, hitstun: 30, kbX: 360, kbY: -380, knockdown: true, hitbox: { x: 0, y: 30, r: 0 }, aoe: 180, reach: 80, maxTargets: 8, multiHit: { interval: 4, count: 2 }, cancelInto: CANCEL.light, sound: 'slash', weight: 0.6, trail: tr('#bff4ff', 12) }, 'low');
add('staff', { id: 'st2_polekick', name: 'Pole Kick', tags: ['heavy', 'down'], startup: 12, active: 18, recovery: 20, damage: 7, hitstun: 32, kbX: 700, kbY: -360, knockdown: true, hitstop: 6, shake: 9, hitbox: { x: 0, y: 70, r: 0 }, aoe: 230, reach: 80, maxTargets: 10, multiHit: { interval: 6, count: 3 }, cancelInto: CANCEL.heavy, sound: 'kick', weight: 0.85, trail: tr('#ffd23f', 14, 'footA'), fx: { whirl: 190 } }, 'twirl');
add('staff', { id: 'st2_windmill', name: 'Windmill', tags: ['air', 'light'], startup: 5, active: 16, recovery: 12, damage: 4, hitstun: 30, kbX: 220, kbY: -260, hitbox: { x: 50, y: 86, r: 70 }, reach: 70, maxTargets: 6, multiHit: { interval: 5, count: 4 }, cancelInto: CANCEL.air, sound: 'slash', weight: 0.5, trail: tr('#bff4ff', 12) }, 'air');
add('staff', { id: 'st2_drill', name: 'Drill Dive', tags: ['air', 'down'], startup: 6, active: 16, recovery: 14, damage: 4, hitstun: 32, kbX: 60, kbY: 520, hitbox: { x: 20, y: 30, r: 72 }, reach: 40, maxTargets: 6, multiHit: { interval: 4, count: 4 }, selfVY: 260, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.7, trail: tr('#ffd23f', 14) }, 'airDown');
// Pole Vault Kick (ground → heavy): run in, plant the staff, vault up off it and drive both feet in.
// The vault is real: at contact the hero launches up and forward (x2.self) while the kick lands.
add('staff', { id: 'st2_vaultKick', name: 'Pole Vault Kick', tags: ['heavy'], startup: 9, active: 8, recovery: 18, damage: 19, hitstun: 44, kbX: 1350, kbY: -420, knockdown: true, hitstop: 10, shake: 14, zoom: 0.45, poise: 3, hitbox: { x: 46, y: 78, r: 62 }, reach: 125, maxTargets: 4, cancelInto: CANCEL.heavy, sound: 'kick', weight: 1, afterimage: true, trail: tr('#ffd23f', 18, 'footA'), fx: { crescent: true }, slowmo: { scale: 0.4, sec: 0.16 }, x2: { self: { vx: 520, vy: -920, free: true } } });
(anims.staff ??= []).push(drawn({ id: 'st2_vaultKick', strike: 'leg', reach: 'footA', drawings: [
  // run-in plant: staff jabbed into the floor ahead, weight driving onto it
  { hold: 5, p: { rootY: -22, lean: 0.62, head: -0.15, aU: 1.05, aL: -0.15, bU: 0.85, bL: 0.0, footA: 30, footB: -46, flex: -5 } },
  // lift off the pole: hips swing up, knees tucked to the chest
  { hold: 4, p: { plant: 0, rootY: -46, lean: -0.35, head: 0.1, aU: 0.55, aL: 0.1, bU: 0.4, bL: 0.15, laU: 1.7, laL: -2.1, lbU: 1.45, lbL: -1.95, flex: 5, stretch: 0.95 }, smear: ['footA', 'footB'] },
  // the kick: laid back along the pole, both feet shot straight out
  { hold: 8, p: { plant: 0, rootY: -24, lean: -1.0, head: 0.45, aU: -0.45, aL: 0.25, bU: -0.25, bL: 0.3, laU: 1.95, laL: -0.04, lbU: 1.78, lbL: 0.06, stretch: 1.12 }, smear: ['footA', 'footB'], impact: true },
  // follow-through: tumbling over the top
  { hold: 10, p: { plant: 0, rootY: -10, lean: -0.35, head: 0.2, aU: 2.2, aL: 0.6, bU: 1.6, bL: 0.8, laU: 1.1, laL: -1.4, lbU: 0.7, lbL: -1.0 } },
  // ready to land
  { hold: 8, p: { plant: 0, rootY: 0, lean: 0.2, head: -0.1, aU: 1.3, aL: 1.2, bU: 0.6, bL: 1.6, laU: 0.4, laL: -0.6, lbU: -0.1, lbL: -0.4 } },
] }));
const staff2: WeaponV2 = {
  desc: 'Spin Master: HOLD after ↗ to keep the staff spinning (it deflects shots); let go to fling.',
  ground: { side: { light: 'st_twirl1', heavy: 'st2_vaultKick' }, upDiag: { light: 'st2_spin', heavy: 'st_toss' }, up: { light: 'st_vault', heavy: 'st2_rocket' }, downDiag: { light: 'st2_lowspin', heavy: 'st_heliH' }, down: { light: 'st_plant', heavy: 'st2_polekick' } },
  air: { side: { light: 'st2_windmill', heavy: 'st_aswingH' }, upDiag: { light: 'st_aheli', heavy: 'st_aheli' }, up: { light: 'st_arise', heavy: 'st_arise' }, downDiag: { light: 'st2_drill', heavy: 'st_plunge' }, down: { light: 'st2_drill', heavy: 'st_plunge' } },
  dodge: { distance: 200, frames: PLAYER.dodgeFrames + 4, rope: false, kind: 'vault' },
  tips: ['↗ MOMENTUM SPIN: keep holding to spin, let go to fling · heavy: boomerang', '↑ vault · heavy: POLE ROCKET (sky-high, then crash)', '↘ low spin · ↓ plant · heavy: POLE KICK', '→ twirl string · heavy: POLE VAULT KICK · air → windmill · air ↓ drill · Dodge = vault over'],
  anims: [],
};

// ====================================================================== LASER: Gunslinger
// Range matters: up close, shots become point-blank face blasts. Overheat vents steam.
add('laser', { id: 'lz2_pb', name: 'Point-Blank Blast', tags: ['light'], startup: 6, active: 3, recovery: 18, damage: 18, hitstun: 36, kbX: 1250, kbY: -380, knockdown: true, hitstop: 9, shake: 14, zoom: 0.5, poise: 3, hitbox: { x: 72, y: 92, r: 80 }, reach: 80, maxTargets: 4, dash: false, heat: 0.22, cancelInto: CANCEL.light, sound: 'heavy', weight: 1, afterimage: true, trail: tr('#ff2a1f', 18), fx: { crescent: true }, x2: { puff: 120 } }, 'shoot');
add('laser', { id: 'lz2_muzzle', name: 'Muzzle Slam', tags: ['light', 'down'], startup: 5, active: 3, recovery: 18, damage: 15, hitstun: 40, kbX: 300, kbY: -820, hitstop: 8, shake: 11, hitbox: { x: 62, y: 60, r: 70 }, reach: 70, maxTargets: 3, dash: false, heat: 0.15, plant: { radius: 140, damage: 6, x: 40 }, cancelInto: CANCEL.light, sound: 'heavy', weight: 0.85, trail: tr('#ff2a1f', 14) }, 'slam');
add('laser', { id: 'lz2_jump', name: 'Blast Jump', tags: ['light', 'rising'], startup: 5, active: 2, recovery: 14, damage: 7, hitstun: 26, kbX: 300, kbY: -420, hitbox: { x: -10, y: 20, r: 70 }, reach: 40, maxTargets: 4, dash: false, heat: 0.15, plant: { radius: 150, damage: 4, x: -20 }, cancelInto: ['air', 'dodge', 'special'], sound: 'launch', weight: 0.6, trail: tr('#ff2a1f', 12), x2: { self: { vx: 520, vy: -1100 } } }, 'shootDown');
variant('lz_bolt', 'lz2_bolt', { x2: { close: { move: 'lz2_pb', range: 150 } } });
variant('lz_blast', 'lz2_blast', { x2: { close: { move: 'lz2_muzzle', range: 140 } } });
const laser2: WeaponV2 = {
  desc: 'Gunslinger: bolts at range; up close every shot is a POINT-BLANK face blast.',
  ground: { side: { light: 'lz2_bolt', heavy: 'lz_beam' }, upDiag: { light: 'lz2_jump', heavy: 'lz_riseH' }, up: { light: 'lz_sky', heavy: 'lz_skyH' }, downDiag: { light: 'lz_low', heavy: 'lz_lowH' }, down: { light: 'lz2_blast', heavy: 'lz_blastH' } },
  air: { side: { light: 'lz_abolt', heavy: 'lz_abeam' }, upDiag: { light: 'lz_adiag', heavy: 'lz_adiag' }, up: { light: 'lz_asky', heavy: 'lz_asky' }, downDiag: { light: 'lz_spike', heavy: 'lz_spikeH' }, down: { light: 'lz_spike', heavy: 'lz_spikeH' } },
  dodge: { distance: Math.round(PLAYER.dodgeDistance * 1.3), frames: PLAYER.dodgeFrames, rope: false, kind: 'recoil' },
  passive: { vent: true },
  tips: ['→ bolt · CLOSE UP: POINT-BLANK BLAST · heavy: charged beam', '↗ BLAST JUMP (rocket yourself up) · ↑ sky blast', '↓ ground blast · CLOSE UP: MUZZLE SLAM', 'Dodge = RECOIL DASH · overheating vents a steam burst'],
  anims: [],
};

// ====================================================================== WHIP: Tamer
// Sweet-spot crack: hits at the tip do double damage. Sonic crack stuns; lasso spin; tamer's ring.
const whLash = chain('wh_lash', 'wh2:', { x2: { tipCrack: true } });
variant('wh_crack', 'wh2_sonic', { name: 'Sonic Crack', x2: { tipCrack: true, stun: 50 } });
add('whip', { id: 'wh2_lasso', name: 'Lasso Spin', tags: ['heavy'], startup: 48, active: 4, recovery: 20, damage: 14, hitstun: 40, kbX: 950, kbY: -520, hitstop: 8, shake: 12, zoom: 0.4, hitbox: { x: 60, y: 92, r: 50 }, reach: 64, maxTargets: 3, grab: { bowl: 1.4, respectPoise: true, hold: 40 }, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.95, afterimage: true, trail: tr('#ffd23f', 12), x2: { orbit: true } }, 'spin');
add('whip', { id: 'wh2_ring', name: "Tamer's Ring", tags: ['heavy', 'down'], startup: 12, active: 14, recovery: 20, damage: 7, hitstun: 32, kbX: 820, kbY: -300, knockdown: true, hitstop: 6, shake: 9, hitbox: { x: 0, y: 60, r: 0 }, aoe: 250, reach: 80, maxTargets: 10, multiHit: { interval: 6, count: 3 }, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.85, trail: tr('#ffd23f', 12), fx: { whirl: 230 } }, 'spin');
variant('hk_aswing', 'wh2_swing', { name: 'Tarzan Swing' });
const whip2: WeaponV2 = {
  desc: 'Tamer: crack with the TIP for double damage; lasso an enemy and spin it as a weapon.',
  ground: { side: { light: whLash, heavy: 'wh2_sonic' }, upDiag: { light: 'wh_twirl', heavy: 'wh_twirl' }, up: { light: 'wh_wrap', heavy: 'wh2_lasso' }, downDiag: { light: 'wh_trip', heavy: 'wh_tripH' }, down: { light: 'wh_snap', heavy: 'wh2_ring' } },
  air: { side: { light: 'wh2_swing', heavy: 'wh_alash' }, upDiag: { light: 'wh_awrap', heavy: 'wh_awrap' }, up: { light: 'wh_awrap', heavy: 'wh_awrap' }, downDiag: { light: 'wh_aspike', heavy: 'wh_aspike' }, down: { light: 'wh_aspike', heavy: 'wh_aspike' } },
  dodge: { distance: PLAYER.dodgeDistance, frames: PLAYER.dodgeFrames + 2, rope: false, kind: 'backflip' },
  tips: ['→ lash: the TIP cracks for double · heavy: SONIC CRACK (stuns the line)', '↑ wrap & hoist · heavy: LASSO SPIN', "↘ ankle lash · ↓ floor snap · heavy: TAMER'S RING", 'Air → TARZAN SWING · Dodge = backflip'],
  anims: [],
};

// ====================================================================== HAMMER: Earthshaker
// Floor shockwaves on every slam (jump them!); swings can't be interrupted.
variant('hm_swing', 'hm2_swing', { x2: { armor: true } });
variant('hm_smash', 'hm2_smash', { x2: { armor: true } });
variant('hm_spin', 'hm2_spin', { x2: { armor: true } });
variant('hm_pound', 'hm2_pound', { x2: { armor: true, wave: { dmg: 6, range: 560, speed: 950, launch: -720 } } });
variant('hm_slam', 'hm2_quake', { name: 'Quake', x2: { wave: { dmg: 8, range: 700, speed: 1050, launch: -780 } } });
add('hammer', { id: 'hm2_fault', name: 'Fault Line', tags: ['heavy', 'down'], startup: 18, active: 4, recovery: 26, damage: 12, hitstun: 40, kbX: 160, kbY: -980, knockdown: true, hitstop: 8, shake: 14, zoom: 0.4, poise: 3, hitbox: { x: 90, y: 30, r: 60 }, reach: 96, maxTargets: 8, spikes: { count: 6, spacing: 75, start: 90, delay: 4 }, cancelInto: CANCEL.heavy, sound: 'stomp', weight: 1, afterimage: true, trail: tr('#ffa040', 20), x2: { armor: true, wave: { dmg: 6, range: 520, speed: 1100, launch: -700, forward: true } } }, 'slam', {}, 1);
variant('hm_meteor', 'hm2_meteor', { x2: { landWave: { dmg: 8, range: 640, speed: 1050, launch: -800 } } });
const hammer2: WeaponV2 = {
  desc: 'Earthshaker: slams send SHOCKWAVES along the floor (jump them!); swings can\'t be interrupted.',
  ground: { side: { light: 'hm2_swing', heavy: 'hm2_smash' }, upDiag: { light: 'hm2_spin', heavy: 'hm2_spin' }, up: { light: 'hm_upper', heavy: 'hm2_pound' }, downDiag: { light: 'hm_sweep', heavy: 'hm_sweep' }, down: { light: 'hm2_quake', heavy: 'hm2_fault' } },
  air: { side: { light: 'hm_aswing', heavy: 'hm_aswing' }, upDiag: { light: 'hm_aup', heavy: 'hm_aup' }, up: { light: 'hm_aup', heavy: 'hm_aup' }, downDiag: { light: 'hm2_meteor', heavy: 'hm2_meteor' }, down: { light: 'hm2_meteor', heavy: 'hm2_meteor' } },
  dodge: { distance: 220, frames: PLAYER.dodgeFrames + 4, rope: false, kind: 'vault' },
  tips: ['→ swing · heavy: home-run smash (SUPER ARMOR)', '↑ skyward swing · heavy: GROUND POUND + shockwaves', '↓ QUAKE: shockwaves both ways · heavy: FAULT LINE', 'Air ↓ meteor hammer (huge shockwaves) · Dodge = hammer hop'],
  anims: [],
};

// ====================================================================== DAGGERS: Assassin
// Backstab (passive): hits from behind crit. Smoke bomb vanish, shadow dash, execute.
add('daggers', { id: 'dg2_shadow', name: 'Shadow Dash', tags: ['heavy'], startup: 6, active: 8, recovery: 16, damage: 12, hitstun: 36, kbX: 300, kbY: -220, hitstop: 4, shake: 6, hitbox: { x: 30, y: 90, r: 64 }, reach: 40, maxTargets: 8, travel: 400, dash: false, status: { kind: 'bleed', frames: 200 }, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.8, afterimage: true, trail: tr('#e22424', 12), x2: { delayed: 18 } }, 'dash');
add('daggers', { id: 'dg2_smoke', name: 'Smoke Bomb', tags: ['light', 'down'], startup: 4, active: 1, recovery: 18, damage: 0, hitstun: 0, kbX: 0, kbY: 0, hitbox: { x: 0, y: 60, r: 1 }, reach: 0, dash: false, cancelInto: ['dodge', 'special'], sound: 'slash', weight: 0.3, trail: tr('#6a6a78', 6), x2: { vanish: 22 }, then: 'dg2_backstab' }, 'stomp');
add('daggers', { id: 'dg2_backstab', name: 'Backstab', tags: ['light'], startup: 4, active: 3, recovery: 16, damage: 16, hitstun: 38, kbX: 620, kbY: -220, hitstop: 8, shake: 9, zoom: 0.35, hitbox: { x: 60, y: 92, r: 48 }, reach: 64, behind: true, status: { kind: 'bleed', frames: 220 }, cancelInto: CANCEL.light, sound: 'slash', weight: 0.85, afterimage: true, trail: tr('#e22424', 14), fx: { crescent: true } }, 'slash');
add('daggers', { id: 'dg2_execute', name: 'Execute', tags: ['heavy', 'down'], startup: 14, active: 2, recovery: 20, damage: 4, hitstun: 20, kbX: 100, kbY: 0, hitbox: { x: 40, y: 80, r: 40 }, reach: 60, dash: false, cancelInto: CANCEL.heavy, sound: 'slash', weight: 0.9, trail: tr('#e22424', 16), x2: { detonate: 0.13 } }, 'twirl');
const daggers2: WeaponV2 = {
  desc: 'Assassin: BACKSTABS always crit; vanish in smoke and reappear behind them; EXECUTE every bleed.',
  ground: { side: { light: 'dg_cut1', heavy: 'dg2_shadow' }, upDiag: { light: 'dg_fan', heavy: 'dg_fan' }, up: { light: 'dg_rise', heavy: 'dg_rise' }, downDiag: { light: 'dg_low', heavy: 'dg2_shadow' }, down: { light: 'dg2_smoke', heavy: 'dg2_execute' } },
  air: { side: { light: 'dg_acut', heavy: 'dg_acut' }, upDiag: { light: 'dg_arise', heavy: 'dg_arise' }, up: { light: 'dg_arise', heavy: 'dg_arise' }, downDiag: { light: 'dg_dive', heavy: 'dg_dive' }, down: { light: 'dg_dive', heavy: 'dg_dive' } },
  dodge: { distance: 210, frames: PLAYER.dodgeFrames - 2, rope: false, blink: true, kind: 'smoke' },
  passive: { backstab: true },
  tips: ['→ 3-cut string (bleeds) · heavy: SHADOW DASH (the cuts land after you)', '↓ SMOKE BOMB: vanish, then BACKSTAB · heavy: EXECUTE all bleeds', '↗ knife fan · ↑ rising fangs · ↘ hamstring', 'Hits from behind always CRIT · Dodge = smoke teleport'],
  anims: [],
};

// ====================================================================== ICE: Frost
// Slippery floor: ice patches make enemies slide (and shatter into each other); you skate.
add('ice', { id: 'ic2_slide', name: 'Ice Slide', tags: ['light', 'sweep'], startup: 5, active: 10, recovery: 14, damage: 9, hitstun: 32, kbX: 520, kbY: -320, knockdown: true, hitbox: { x: 40, y: 30, r: 62 }, reach: 40, maxTargets: 6, travel: 300, dash: false, cancelInto: CANCEL.light, sound: 'kick', weight: 0.6, afterimage: true, trail: tr('#3fb8ff', 12, 'footA'), x2: { ice: { r: 80, frames: 420, trail: true } } }, 'dash');
add('ice', { id: 'ic2_floor', name: 'Frost Floor', tags: ['light', 'down'], startup: 10, active: 3, recovery: 18, damage: 6, hitstun: 28, kbX: 240, kbY: -200, hitbox: { x: 0, y: 30, r: 0 }, aoe: 200, reach: 80, maxTargets: 8, plant: { radius: 200, damage: 4, x: 0 }, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.7, trail: tr('#3fb8ff', 12), x2: { ice: { r: 280, frames: 380 } } }, 'stomp');
add('ice', { id: 'ic2_wall', name: 'Glacier Wall', tags: ['heavy', 'down'], startup: 14, active: 3, recovery: 20, damage: 10, hitstun: 40, kbX: 700, kbY: -260, hitstop: 7, shake: 10, hitbox: { x: 90, y: 80, r: 60 }, reach: 96, maxTargets: 4, cancelInto: CANCEL.heavy, sound: 'heavy', weight: 0.9, trail: tr('#3fb8ff', 16), status: { kind: 'freeze', frames: 80 }, x2: { iceWall: { frames: 260, dist: 150 }, ice: { r: 160, frames: 300 } } }, 'slam');
add('ice', { id: 'ic2_icicle', name: 'Icicle Drop', tags: ['air', 'down'], startup: 6, active: 3, recovery: 16, damage: 9, hitstun: 30, kbX: 100, kbY: 400, hitbox: { x: 0, y: 0, r: 1 }, reach: 0, dash: false, status: { kind: 'freeze', frames: 90 }, shoot: { kind: 'shard', speed: 1000, count: 3, spread: 0, gravity: 0, homing: 0, pierce: 1, life: 70, radius: 20, fromSky: true }, cancelInto: CANCEL.air, sound: 'slash', weight: 0.6, trail: tr('#3fb8ff', 10) }, 'airShoot');
add('ice', { id: 'ic2_skate', name: 'Skate', tags: ['light'], startup: 1, active: 1, recovery: 1, damage: 0, hitstun: 0, kbX: 0, kbY: 0, hitbox: { x: 0, y: 0, r: 1 }, reach: 0, cancelInto: CANCEL.light, sound: 'kick', weight: 0.2, trail: tr('#3fb8ff', 6), x2: { ice: { r: 70, frames: 300, trail: true } } });
const ice2: WeaponV2 = {
  desc: 'Frost: ice moves leave SLIPPERY FLOOR: enemies slide and shatter into each other; you skate faster.',
  ground: { side: { light: 'ic_jab', heavy: 'ic_lance' }, upDiag: { light: 'ic_shards', heavy: 'ic_lance' }, up: { light: 'ic_pillar', heavy: 'ic_pillar' }, downDiag: { light: 'ic2_slide', heavy: 'ic_field' }, down: { light: 'ic2_floor', heavy: 'ic2_wall' } },
  air: { side: { light: 'ic_ajab', heavy: 'ic_ajab' }, upDiag: { light: 'ic_arise', heavy: 'ic_arise' }, up: { light: 'ic_arise', heavy: 'ic_arise' }, downDiag: { light: 'ic2_icicle', heavy: 'ic_aspike' }, down: { light: 'ic2_icicle', heavy: 'ic_aspike' } },
  dodge: { distance: Math.round(PLAYER.dodgeDistance * 1.2), frames: PLAYER.dodgeFrames + 2, rope: false, kind: 'skate' },
  passive: { skate: true },
  tips: ['→ frost jab · heavy: ice lance (FREEZE, next hit SHATTERS)', '↘ ICE SLIDE (leaves ice) · ↓ FROST FLOOR · heavy: GLACIER WALL', '↑ ice pillar · ↗ shard fan · air ↓ ICICLE DROP', 'Enemies SLIDE on ice and shatter into each other · Dodge = skate'],
  anims: [],
};

// ====================================================================== SCYTHE: Reaper
// Doom marks (3 = reaped), souls heal, death's door life steal, grave hands, phase dodge.
const PURPLE = '#9b5cff';
const scReap = chain('sc_reap', 'sc2:', { x2: { doom: true }, trail: tr(PURPLE, 14) });
variant('sc_spin', 'sc2_spiral', { x2: { doom: true }, trail: tr(PURPLE, 16) });
variant('sc_pull', 'sc2_pull', { x2: { doom: true } });
variant('sc_harvest', 'sc2_harvest', { x2: { doom: true }, trail: tr(PURPLE, 16) });
add('scythe', { id: 'sc2_grave', name: 'Grave Rise', tags: ['light', 'down'], startup: 12, active: 3, recovery: 20, damage: 6, hitstun: 30, kbX: 0, kbY: 0, hitbox: { x: 0, y: 30, r: 0 }, aoe: 320, reach: 80, maxTargets: 10, cancelInto: CANCEL.light, sound: 'stomp', weight: 0.8, trail: tr(PURPLE, 14), x2: { grave: { r: 330, frames: 120 }, doom: true } }, 'slam');
const scythe2: WeaponV2 = {
  desc: 'Reaper: hits DOOM-mark enemies (3 = reaped); KOs drop SOULS that heal; at low HP you steal life.',
  ground: { side: { light: scReap, heavy: 'sc2_spiral' }, upDiag: { light: 'sc_toss', heavy: 'sc_toss' }, up: { light: 'sc_rise', heavy: 'sc_rise' }, downDiag: { light: 'sc2_pull', heavy: 'sc2_spiral' }, down: { light: 'sc2_grave', heavy: 'sc2_harvest' } },
  air: { side: { light: 'sc_aswing', heavy: 'sc_aswing' }, upDiag: { light: 'sc_arise', heavy: 'sc_arise' }, up: { light: 'sc_arise', heavy: 'sc_arise' }, downDiag: { light: 'sc_aspike', heavy: 'sc_aspike' }, down: { light: 'sc_aspike', heavy: 'sc_aspike' } },
  dodge: { distance: 200, frames: PLAYER.dodgeFrames + 4, rope: false, kind: 'phase' },
  passive: { souls: true },
  tips: ['→ reap string (DOOM marks: 3 = REAPED) · heavy: death spiral', '↓ GRAVE RISE: dead hands hold them · heavy: harvest', '↗ scythe throw · ↘ reaping pull · air ↓ guillotine', 'KOs drop SOULS that heal · low HP: hits steal life · Dodge = PHASE'],
  anims: [],
};

const SETS: Record<string, WeaponV2> = { fists: fists2, hook: hook2, staff: staff2, laser: laser2, whip: whip2, hammer: hammer2, daggers: daggers2, ice: ice2, scythe: scythe2 };
for (const [id, s] of Object.entries(SETS)) s.anims = anims[id] ?? [];
export const MOVESETS2 = SETS;
