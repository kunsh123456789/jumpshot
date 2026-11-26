import { makePose, type PoseSpec } from '../render/rig';

/**
 * Player move set. All combat tunables live here as data.
 * Frames are 60 Hz sim frames. Knockback: kbX along facing, kbY negative = up.
 * Hitbox: x forward of the feet, y UP from the feet, r radius (world units).
 */
export type MoveTag =
  | 'light' | 'heavy' | 'launcher' | 'air' | 'down' | 'sweep' | 'string'
  | 'dodge' | 'special' | 'finisher' | 'guardbreak' | 'rising';

export type SoundId = 'punch' | 'kick' | 'heavy' | 'launch' | 'spike' | 'stomp' | 'slash' | 'finisher';
export type TrailLimb = 'handA' | 'handB' | 'footA' | 'footB' | 'kneeA';

export interface MoveDef {
  id: string;
  /** Moves sharing a family count as the same move for variety/repeat penalties. */
  family: string;
  name: string;
  tags: MoveTag[];
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  kbX: number;
  kbY: number;
  hitstop: number;
  shake: number;
  /** Camera punch-in amount (0..1, scaled by JUICE.punchZoomMax). */
  zoom: number;
  /** Poise damage multiplier (heavy moves break armor faster). */
  poise: number;
  hitbox: { x: number; y: number; r: number };
  maxTargets: number;
  /** Ideal horizontal distance to the target when the strike lands. */
  reach: number;
  /** Whether attack magnetism dashes to the target. */
  dash: boolean;
  /** Distance traveled forward during active frames (slides, flying knee). */
  travel: number;
  /** Launch velocity applied to the victim (vy, negative = up). 0 = none. */
  launch: number;
  /** Player leaps after the launched enemy. */
  follow: boolean;
  knockdown: boolean;
  spike: boolean;
  /** Radius AOE around the attacker instead of a hitbox. */
  aoe: number;
  /** Self vertical velocity applied at strike (air moves). */
  selfVY: number;
  /** Cancel window opens this many frames after active starts. */
  cancelFrom: number;
  cancelInto: MoveTag[];
  /** Next move in an auto-string when the same input repeats. */
  next?: string;
  multiHit?: { interval: number; count: number; then?: string };
  sound: SoundId;
  /** 0..1 swing weight for whoosh/afterimage. */
  weight: number;
  trail: { limb: TrailLimb; color: string; width: number };
  afterimage: boolean;
  /** Shockwave on victim ground impact (finisher). */
  impactShock?: { radius: number; damage: number };
  // ---- Generic weapon hooks (revision pass 7). Every hook acts on the CONTACT frame (startup end),
  //      so Rhythm Mode snapping lands it on the grid with no extra work. ----
  /** Ranged: no magnetism dash; the target is picked within this range (world units). */
  ranged?: number;
  /** Aimed: the strike direction is the swipe direction, auto-aimed onto the target within aimCone (deg). */
  aimCone?: number;
  /** Beam/bolt: hits along a line from the hand (pierce = every enemy on the line, else the first). */
  beam?: BeamSpec;
  /** Grab: the target is caught at the end of the dash and held until contact, then released (thrown). */
  grab?: GrabSpec;
  /** Tether (grappling hook): a rope connects at contact and pulls the victim or the player. */
  tether?: TetherSpec;
  /** Plant: a floor shockwave and crack at contact (staff plant, pile-driver, ground blast). */
  plant?: { radius: number; damage: number; x: number };
  /** Thrown weapon (reference gif2 54-58): the weapon spins out along the aim for `range`, then returns,
   *  hitting everything it passes once per leg. The held weapon is hidden while it is out. */
  toss?: { speed: number; range: number; radius: number; bounce?: number; floor?: boolean; draw?: 'staff' | 'shield' | 'yoyo' | 'scythe' };
  /** Player projectiles fired along the aim (see sim/weaponExtra.ts). */
  shoot?: ShootSpec;
  /** Ground spikes erupting one after another in front of the hero. */
  spikes?: { count: number; spacing: number; start: number; delay: number };
  /** Status applied to victims: bleed (damage over time), freeze (next hit shatters), bubble (floats; next hit pops), snare. */
  status?: { kind: 'bleed' | 'freeze' | 'bubble' | 'snare'; frames: number };
  /** Chain lightning from the victim to nearby enemies (`dmg` = fraction of the hit's damage). */
  chain?: { arcs: number; dmg: number };
  /** The magnetism dash lands behind the target (daggers' blink-slash). */
  behind?: boolean;
  /** Blocks enemy projectiles while active. */
  deflect?: boolean;
  /** Weapon slow-mo moment (time scale, seconds): at contact, or at the apex of the follow leap. */
  slowmo?: { scale: number; sec: number; at?: 'apex' };
  /** Rhythm Mode: the coarsest grid (divisions per beat) the contact snaps to; default RHYTHM.snapDiv. */
  grid?: number;
  /** Presentation-only effects (reference FX): lightning strikes the victims, a whirlwind ball while
   *  active (radius), the white-crescent impact frame. No gameplay effect. */
  fx?: { lightning?: boolean; whirl?: number; crescent?: boolean };
  /** Laser heat added when the move fires. */
  heat?: number;
  /** Move started automatically when this one ends (tether follow-ups). */
  then?: string;
  poses?: { antic: Float32Array; strike: Float32Array; follow: Float32Array; strikeAlt?: Float32Array };
  /** New-moveset mechanics (sim/moveset2.ts). Only the reworked movesets use these. */
  x2?: X2Spec;
  /** Play another move's drawings (variants of an existing move reuse its animation). */
  anim?: string;
}

/** Signature mechanics of the reworked movesets (sim/moveset2.ts). All act on the contact frame unless noted. */
export interface X2Spec {
  /** Hammer: the move can't be interrupted (hits taken do half damage and no flinch). */
  armor?: boolean;
  /** Hammer: shockwaves run along the floor from the contact point (both ways unless `forward`). */
  wave?: { dmg: number; range: number; speed: number; launch: number; forward?: boolean };
  /** Hammer: the same shockwaves when the hero lands after this (air) move. */
  landWave?: { dmg: number; range: number; speed: number; launch: number };
  /** Ice: an ice patch on the floor (radius, frames); `trail` lays patches along the move's travel. */
  ice?: { r: number; frames: number; trail?: boolean };
  /** Ice: a wall of ice in front of the hero (frames); enemies can't pass it and touching it freezes. */
  iceWall?: { frames: number; dist: number };
  /** Laser: the point-blank variant used when the target is this close and in front. */
  close?: { move: string; range: number };
  /** Daggers: vanish in smoke for `frames` (invisible, untouchable); the move's `then` reappears. */
  vanish?: number;
  /** Daggers: victims the dash passes take the hit this many frames later (cuts appear after you). */
  delayed?: number;
  /** Daggers: detonate every bleed on screen (damage per remaining bleed frame). */
  detonate?: number;
  /** Scythe: each hit adds a doom mark; the third reaps. */
  doom?: boolean;
  /** Scythe: hands from the floor hold grounded enemies within `r` for `frames`. */
  grave?: { r: number; frames: number };
  /** Hook: tie the two enemies nearest the target together for `frames`. */
  tie?: number;
  /** Whip: hits at the tip (outer part of the beam) crack for double damage. */
  tipCrack?: boolean;
  /** Stun the victims for this many frames (sonic crack). */
  stun?: number;
  /** Whip lasso: the grabbed body orbits the hero during the hold, bowling everyone it touches. */
  orbit?: boolean;
  /** Staff: keeps spinning while the attack is held (after `min` frames, releasing plays `then`). */
  spin?: { min: number; then: string };
  /** Fists power cross: a shockwave puff of this radius at the victim. */
  puff?: number;
  /** Self-launch at contact (blast jump, pole rocket, dragon uppercut carry). */
  self?: { vx: number; vy: number };
}

export interface BeamSpec { len: number; width: number; pierce: boolean; color: string; hits?: number; style?: 'laser' | 'whip' | 'lightning' | 'ice' | 'ink' | 'scythe' }
export interface ShootSpec {
  kind: 'blob' | 'plane' | 'fist' | 'bubble' | 'shard';
  speed: number; count: number; spread: number; gravity: number; homing: number; pierce: number; life: number; radius: number;
  /** Rain down from the top of the page instead (paper-plane dive bomb). */
  fromSky?: boolean;
}
export interface GrabSpec {
  /** Thrown body: bowling damage multiplier and whether it bounces off walls. */
  bowl: number;
  /** Heavy enemies with poise can't be thrown until it is broken. */
  respectPoise: boolean;
  /** Frames the body is held (lifted / wound up) between the catch and the release. */
  hold: number;
  /** Over-the-shoulder: the body is released behind the hero instead of in the swipe direction. */
  behind?: boolean;
}
export interface TetherSpec {
  mode: 'pull' | 'zip' | 'swing' | 'slam' | 'air';
  /** Frames the rope pulls for (pull/swing). */
  frames: number;
}

const C_LIGHT = '#bff4ff';
const C_HEAVY = '#ffa040';
const C_LAUNCH = '#ffe14a';
const C_AIR = '#9fd8ff';
const C_SPIKE = '#ff5a3c';

const LIGHT_CANCEL: MoveTag[] = ['light', 'heavy', 'launcher', 'down', 'sweep', 'dodge', 'special', 'air'];
const HEAVY_CANCEL: MoveTag[] = ['launcher', 'down', 'dodge', 'special'];
const AIR_CANCEL: MoveTag[] = ['air', 'down', 'dodge', 'special'];

type MoveInput = Omit<MoveDef, 'poses' | 'family' | 'zoom' | 'poise' | 'maxTargets' | 'dash' | 'travel' | 'launch' |
  'follow' | 'knockdown' | 'spike' | 'aoe' | 'selfVY' | 'afterimage' | 'cancelFrom' | 'hitstop' | 'shake'> & {
  /** Hit-stop and shake default to 3 when a move leaves them out. */
  hitstop?: number; shake?: number;
  family?: string; zoom?: number; poise?: number; maxTargets?: number; dash?: boolean; travel?: number;
  launch?: number; follow?: boolean; knockdown?: boolean; spike?: boolean; aoe?: number; selfVY?: number;
  afterimage?: boolean; cancelFrom?: number;
  poses?: { antic: PoseSpec; strike: PoseSpec; follow: PoseSpec; strikeAlt?: PoseSpec };
};

const AIR_BASE: PoseSpec = {
  rootX: 0, rootY: 0, lean: 0.05, head: -0.05, aU: 1.0, aL: 1.7, bU: 0.4, bL: 1.9,
  laU: 0.9, laL: -1.5, lbU: 0.2, lbL: -1.1, spin: 0, plant: 0, footA: 18, footB: -18, flex: 0,
};

function def(m: MoveInput): MoveDef {
  const air = m.tags.includes('air');
  const base = air ? AIR_BASE : undefined;
  return {
    family: m.family ?? m.id,
    zoom: 0, poise: 1, maxTargets: 1, dash: true, travel: 0, launch: 0, follow: false,
    knockdown: false, spike: false, aoe: 0, selfVY: 0, afterimage: false, hitstop: 3, shake: 3,
    cancelFrom: Math.max(1, m.active - 1),
    ...m,
    poses: m.poses && {
      antic: makePose(m.poses.antic, base),
      strike: makePose(m.poses.strike, base),
      follow: makePose(m.poses.follow, base),
      strikeAlt: m.poses.strikeAlt ? makePose(m.poses.strikeAlt, base) : undefined,
    },
  };
}

export const MOVES: Record<string, MoveDef> = {};
/** Register a move (weapon files add theirs through this too). */
export function addMove(m: MoveInput): MoveDef { const d = def(m); MOVES[d.id] = d; return d; }
const add = addMove;
export type { MoveInput };
/** Shared cancel lists (weapon files use these too). */
export const CANCEL = { light: LIGHT_CANCEL, heavy: HEAVY_CANCEL, air: AIR_CANCEL };

// ---------------- Grounded: E / W ----------------
add({
  id: 'jab1', family: 'jab', name: 'Jab', tags: ['light', 'string'],
  startup: 4, active: 3, recovery: 13, damage: 6, hitstun: 20, kbX: 140, kbY: 0,
  hitstop: 3, shake: 2.5, hitbox: { x: 58, y: 92, r: 36 }, reach: 72,
  cancelInto: LIGHT_CANCEL, next: 'jab2', sound: 'punch', weight: 0.25,
  trail: { limb: 'handA', color: C_LIGHT, width: 9 },
  poses: {
    antic: { lean: 0.06, aU: 0.75, aL: 2.25, rootX: -3 },
    strike: { lean: 0.34, rootX: 11, aU: 1.58, aL: 0.04, bU: 0.5, bL: 2.2, footA: 30, footB: -16, head: -0.16 },
    follow: { lean: 0.28, rootX: 9, aU: 1.45, aL: 0.45, footA: 28, footB: -17 },
  },
});
add({
  id: 'jab2', family: 'jab', name: 'Jab', tags: ['light', 'string'],
  startup: 4, active: 3, recovery: 13, damage: 6, hitstun: 20, kbX: 150, kbY: 0,
  hitstop: 3, shake: 2.5, hitbox: { x: 58, y: 92, r: 36 }, reach: 72,
  cancelInto: LIGHT_CANCEL, next: 'cross', sound: 'punch', weight: 0.25,
  trail: { limb: 'handB', color: C_LIGHT, width: 9 },
  poses: {
    antic: { lean: 0.1, aU: 1.1, aL: 1.8, bU: 0.3, bL: 2.4, rootX: -2 },
    strike: { lean: 0.38, rootX: 13, bU: 1.58, bL: 0.04, aU: 0.75, aL: 2.1, footA: 30, footB: -14, head: -0.15 },
    follow: { lean: 0.32, rootX: 11, bU: 1.45, bL: 0.5, aU: 0.8, aL: 2.0, footA: 28 },
  },
});
add({
  id: 'cross', family: 'jab', name: 'Cross', tags: ['light', 'string'],
  startup: 5, active: 3, recovery: 16, damage: 10, hitstun: 26, kbX: 330, kbY: -40,
  hitstop: 5, shake: 5, zoom: 0.15, hitbox: { x: 62, y: 92, r: 38 }, reach: 76,
  cancelInto: LIGHT_CANCEL, next: 'jab1', sound: 'punch', weight: 0.45,
  trail: { limb: 'handA', color: C_LIGHT, width: 11 },
  poses: {
    antic: { lean: 0.0, aU: 0.5, aL: 2.4, rootX: -6, rootY: -9, footA: 20 },
    strike: { lean: 0.5, rootX: 20, rootY: -12, aU: 1.62, aL: 0.0, bU: 0.3, bL: 2.3, footA: 38, footB: -10, head: -0.2, flex: -4 },
    follow: { lean: 0.42, rootX: 17, rootY: -10, aU: 1.5, aL: 0.35, footA: 36, footB: -12 },
  },
});
add({
  id: 'backfist', name: 'Spinning Backfist', tags: ['heavy'],
  startup: 10, active: 4, recovery: 20, damage: 18, hitstun: 32, kbX: 820, kbY: -170,
  hitstop: 8, shake: 11, zoom: 0.5, poise: 2.2, hitbox: { x: 66, y: 94, r: 42 }, reach: 78,
  cancelInto: HEAVY_CANCEL, sound: 'heavy', weight: 0.85, afterimage: true,
  trail: { limb: 'handA', color: C_HEAVY, width: 15 },
  poses: {
    antic: { lean: -0.12, aU: -0.7, aL: 2.3, bU: 1.1, bL: 1.4, rootX: -8, rootY: -10, spin: -0.22, footA: 14, footB: -26, head: 0.1 },
    strike: { spin: 0.08, lean: 0.36, aU: 1.78, aL: 0.1, bU: -0.5, bL: 1.1, rootX: 18, rootY: -8, footA: 34, footB: -22, head: -0.2 },
    follow: { spin: 0.05, lean: 0.3, aU: 1.95, aL: 0.45, bU: -0.3, bL: 1.3, rootX: 15, rootY: -7, footA: 32, footB: -22 },
  },
});

// ---------------- Grounded: NE / NW ----------------
add({
  id: 'hook', name: 'Rising Hook', tags: ['light', 'rising'],
  startup: 5, active: 4, recovery: 15, damage: 9, hitstun: 28, kbX: 170, kbY: -560,
  hitstop: 5, shake: 5, zoom: 0.15, hitbox: { x: 54, y: 104, r: 40 }, reach: 68,
  cancelInto: LIGHT_CANCEL, sound: 'punch', weight: 0.45,
  trail: { limb: 'handA', color: C_LIGHT, width: 11 },
  poses: {
    antic: { rootY: -18, lean: 0.24, aU: 0.35, aL: 1.6, rootX: -2 },
    strike: { rootY: 4, lean: -0.06, aU: 2.55, aL: 0.85, bU: 0.4, bL: 2.1, footA: 24, rootX: 8, head: -0.28 },
    follow: { rootY: 2, lean: -0.04, aU: 2.75, aL: 1.05, footA: 22, rootX: 7, head: -0.25 },
  },
});
add({
  id: 'knee', name: 'Flying Knee', tags: ['heavy'],
  startup: 8, active: 7, recovery: 18, damage: 16, hitstun: 32, kbX: 560, kbY: -420,
  hitstop: 7, shake: 9, zoom: 0.35, poise: 2, hitbox: { x: 40, y: 90, r: 50 }, reach: 30,
  travel: 190, maxTargets: 4, cancelInto: HEAVY_CANCEL, sound: 'heavy', weight: 0.8, afterimage: true,
  trail: { limb: 'kneeA', color: C_HEAVY, width: 14 },
  poses: {
    antic: { rootY: -16, lean: 0.3, laU: 0.3, aU: -0.5, aL: 1.0, bU: -0.6, bL: 1.0, rootX: -4 },
    strike: { rootY: 26, plant: 0, laU: 1.8, laL: -2.45, lbU: -0.55, lbL: -0.7, lean: -0.08, aU: -0.9, aL: 0.9, bU: 2.7, bL: 0.4, head: -0.15 },
    follow: { rootY: 18, plant: 0.3, laU: 1.5, laL: -2.2, lbU: -0.4, lbL: -0.6, lean: 0.0, aU: -0.6, aL: 1.0, bU: 2.3, bL: 0.6 },
  },
});

// ---------------- Grounded: N (JUMPSHOT LAUNCHER) ----------------
add({
  id: 'launcher', family: 'launcher', name: 'Jumpshot', tags: ['launcher'],
  startup: 6, active: 4, recovery: 16, damage: 10, hitstun: 40, kbX: 40, kbY: 0,
  hitstop: 6, shake: 7, zoom: 0.3, poise: 1.6, hitbox: { x: 50, y: 96, r: 44 }, reach: 64,
  launch: -1180, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'],
  sound: 'launch', weight: 0.6, afterimage: true,
  trail: { limb: 'handA', color: C_LAUNCH, width: 14 },
  poses: {
    antic: { rootY: -22, lean: 0.38, aU: 0.25, aL: 1.9, bU: 0.6, bL: 2.0, footA: 26, footB: -18, rootX: -2 },
    strike: { rootY: 14, lean: -0.12, aU: 3.02, aL: 0.22, bU: 0.2, bL: 1.6, footA: 14, footB: -10, head: -0.35, flex: 5 },
    follow: { rootY: 16, lean: -0.1, aU: 3.1, aL: 0.2, bU: 0.3, bL: 1.7, plant: 0.4, head: -0.3 },
  },
});
add({
  id: 'launcherH', family: 'launcher', name: 'Jumpshot+', tags: ['launcher', 'heavy'],
  startup: 9, active: 4, recovery: 18, damage: 14, hitstun: 44, kbX: 40, kbY: 0,
  hitstop: 8, shake: 10, zoom: 0.5, poise: 2.5, hitbox: { x: 50, y: 96, r: 46 }, reach: 64,
  launch: -1460, follow: true, cancelFrom: 2, cancelInto: ['air', 'dodge', 'special'],
  sound: 'launch', weight: 0.9, afterimage: true,
  trail: { limb: 'handA', color: C_LAUNCH, width: 18 },
  poses: {
    antic: { rootY: -30, lean: 0.46, aU: 0.1, aL: 2.1, bU: 0.5, bL: 2.0, footA: 30, footB: -20, rootX: -4, flex: -3 },
    strike: { rootY: 18, lean: -0.16, aU: 3.08, aL: 0.12, bU: 0.0, bL: 1.4, footA: 12, footB: -10, head: -0.4, flex: 7, spin: -0.06 },
    follow: { rootY: 20, lean: -0.12, aU: 3.12, aL: 0.15, bU: 0.2, bL: 1.6, plant: 0.3, head: -0.35 },
  },
});

// ---------------- Grounded: SE / SW ----------------
add({
  id: 'sweep', name: 'Leg Sweep', tags: ['light', 'sweep', 'guardbreak'],
  startup: 5, active: 4, recovery: 16, damage: 8, hitstun: 30, kbX: 160, kbY: -380,
  hitstop: 4, shake: 4, hitbox: { x: 62, y: 22, r: 40 }, reach: 70, knockdown: true,
  cancelInto: LIGHT_CANCEL, sound: 'kick', weight: 0.4,
  trail: { limb: 'footA', color: C_LIGHT, width: 11 },
  poses: {
    antic: { rootY: -26, lean: 0.4, aU: 0.9, aL: 1.4, footA: 10, footB: -24 },
    strike: { rootY: -34, plant: 0.15, lean: 0.55, laU: 1.62, laL: 0.0, lbU: -1.0, lbL: -1.35, aU: 1.1, aL: 1.0, bU: -0.6, bL: 1.1, rootX: 4 },
    follow: { rootY: -32, plant: 0.25, lean: 0.5, laU: 1.5, laL: -0.2, lbU: -0.9, lbL: -1.4, aU: 1.0, aL: 1.2, bU: -0.5 },
  },
});
add({
  id: 'slide', name: 'Slide Kick', tags: ['heavy', 'sweep', 'guardbreak'],
  startup: 7, active: 11, recovery: 16, damage: 12, hitstun: 34, kbX: 380, kbY: -460,
  hitstop: 6, shake: 8, zoom: 0.25, poise: 2, hitbox: { x: 56, y: 20, r: 46 }, reach: 20,
  travel: 300, maxTargets: 6, knockdown: true, cancelInto: HEAVY_CANCEL, sound: 'kick', weight: 0.75,
  afterimage: true, trail: { limb: 'footA', color: C_HEAVY, width: 15 },
  poses: {
    antic: { rootY: -22, lean: 0.42, aU: 0.4, bU: -0.3, footA: 26, footB: -14 },
    strike: { rootY: -42, plant: 0, lean: -0.5, laU: 1.45, laL: 0.0, lbU: 0.95, lbL: -1.9, aU: -1.25, aL: 0.5, bU: -0.95, bL: 0.4, head: 0.2 },
    follow: { rootY: -38, plant: 0.2, lean: -0.35, laU: 1.35, laL: -0.2, lbU: 0.8, lbL: -1.8, aU: -1.1, aL: 0.6 },
  },
});

// ---------------- Grounded: S ----------------
add({
  id: 'stomp', family: 'stomp', name: 'Quake Stomp', tags: ['light', 'down'],
  startup: 7, active: 3, recovery: 18, damage: 9, hitstun: 28, kbX: 260, kbY: -300,
  hitstop: 6, shake: 9, zoom: 0.2, poise: 1.4, hitbox: { x: 0, y: 30, r: 0 }, reach: 70,
  aoe: 160, maxTargets: 8, dash: true, cancelInto: LIGHT_CANCEL, sound: 'stomp', weight: 0.6,
  trail: { limb: 'footA', color: C_LIGHT, width: 12 },
  poses: {
    antic: { rootY: 8, plant: 0.35, laU: 1.35, laL: -1.7, aU: 2.3, aL: 0.6, bU: 2.1, bL: 0.6, lean: -0.05 },
    strike: { rootY: -24, plant: 1, lean: 0.38, aU: 0.55, aL: 0.5, bU: -0.55, bL: 0.6, footA: 32, footB: -20, head: 0.1 },
    follow: { rootY: -22, plant: 1, lean: 0.3, aU: 0.6, aL: 0.7, bU: -0.4, bL: 0.7, footA: 30, footB: -20 },
  },
});
add({
  id: 'stompH', family: 'stomp', name: 'Earthbreaker', tags: ['heavy', 'down'],
  startup: 11, active: 3, recovery: 22, damage: 14, hitstun: 34, kbX: 430, kbY: -470,
  hitstop: 8, shake: 14, zoom: 0.45, poise: 2.5, hitbox: { x: 0, y: 30, r: 0 }, reach: 80,
  aoe: 240, maxTargets: 10, cancelInto: HEAVY_CANCEL, sound: 'stomp', weight: 0.95, afterimage: true,
  trail: { limb: 'footA', color: C_HEAVY, width: 16 },
  poses: {
    antic: { rootY: 14, plant: 0.2, laU: 1.6, laL: -1.9, aU: 2.9, aL: 0.3, bU: 2.8, bL: 0.3, lean: -0.12, flex: 5 },
    strike: { rootY: -30, plant: 1, lean: 0.48, aU: 0.35, aL: 0.4, bU: -0.6, bL: 0.4, footA: 36, footB: -22, head: 0.15 },
    follow: { rootY: -28, plant: 1, lean: 0.42, aU: 0.45, aL: 0.6, bU: -0.5, bL: 0.6, footA: 34, footB: -22 },
  },
});

// ---------------- Air: E / W ----------------
const airKickPose = (leg: 'A' | 'B', spin: number) => leg === 'A'
  ? {
    antic: { laU: 0.8, laL: -1.9, lbU: -0.2, lbL: -0.9, lean: -0.05, spin: spin * -0.3 },
    strike: { laU: 1.68, laL: 0.0, lbU: -0.45, lbL: -0.8, lean: -0.38, aU: -0.75, aL: 1.2, bU: 1.85, bL: 1.0, spin },
    follow: { laU: 1.5, laL: -0.45, lbU: -0.35, lbL: -0.9, lean: -0.3, aU: -0.6, aL: 1.3, bU: 1.6, spin: spin * 0.8 },
  }
  : {
    antic: { lbU: 0.7, lbL: -1.9, laU: -0.1, laL: -1.0, lean: 0.0, spin: spin * -0.3 },
    strike: { lbU: 1.72, lbL: 0.0, laU: -0.5, laL: -1.0, lean: -0.42, aU: 1.9, aL: 0.9, bU: -0.7, bL: 1.1, spin },
    follow: { lbU: 1.55, lbL: -0.4, laU: -0.4, laL: -1.0, lean: -0.34, aU: 1.7, spin: spin * 0.8 },
  };
add({
  id: 'akick1', family: 'akick', name: 'Air Kick', tags: ['air', 'light'],
  startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 30, kbX: 110, kbY: -340,
  hitstop: 4, shake: 3, hitbox: { x: 58, y: 70, r: 42 }, reach: 68, selfVY: -150,
  cancelInto: AIR_CANCEL, next: 'akick2', sound: 'kick', weight: 0.3,
  trail: { limb: 'footA', color: C_AIR, width: 11 }, poses: airKickPose('A', 0.05),
});
add({
  id: 'akick2', family: 'akick', name: 'Air Kick', tags: ['air', 'light'],
  startup: 4, active: 3, recovery: 12, damage: 6, hitstun: 30, kbX: 120, kbY: -340,
  hitstop: 4, shake: 3, hitbox: { x: 58, y: 70, r: 42 }, reach: 68, selfVY: -150,
  cancelInto: AIR_CANCEL, next: 'akick3', sound: 'kick', weight: 0.3,
  trail: { limb: 'footB', color: C_AIR, width: 11 }, poses: airKickPose('B', 0.1),
});
add({
  id: 'akick3', family: 'akick', name: 'Air Roundhouse', tags: ['air', 'light'],
  startup: 5, active: 3, recovery: 14, damage: 9, hitstun: 32, kbX: 260, kbY: -360,
  hitstop: 5, shake: 5, zoom: 0.15, hitbox: { x: 60, y: 72, r: 44 }, reach: 70, selfVY: -170,
  cancelInto: AIR_CANCEL, next: 'akick1', sound: 'kick', weight: 0.45, afterimage: true,
  trail: { limb: 'footA', color: C_AIR, width: 13 }, poses: airKickPose('A', 0.45),
});
add({
  id: 'aheavy', name: 'Air Cannon', tags: ['air', 'heavy'],
  startup: 7, active: 4, recovery: 16, damage: 13, hitstun: 36, kbX: 980, kbY: -160,
  hitstop: 8, shake: 11, zoom: 0.45, poise: 2.2, hitbox: { x: 62, y: 72, r: 46 }, reach: 70, selfVY: -120,
  cancelInto: AIR_CANCEL, sound: 'heavy', weight: 0.85, afterimage: true,
  trail: { limb: 'footB', color: C_HEAVY, width: 16 },
  poses: {
    antic: { spin: -0.5, lbU: 0.5, lbL: -2.2, laU: 0.6, laL: -1.6, lean: 0.2, aU: 2.2 },
    strike: { spin: 0.2, lbU: 1.65, lbL: 0.0, laU: -0.2, laL: -1.4, lean: -0.55, aU: -0.9, aL: 1.0, bU: 2.3, bL: 0.4 },
    follow: { spin: 0.15, lbU: 1.5, lbL: -0.3, laU: -0.1, lean: -0.45, aU: -0.7 },
  },
});

// ---------------- Air: NE / NW ----------------
add({
  id: 'aslash', name: 'Sky Slash', tags: ['air', 'light'],
  startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 34, kbX: 430, kbY: -430,
  hitstop: 5, shake: 5, zoom: 0.15, hitbox: { x: 58, y: 78, r: 46 }, reach: 66, selfVY: -260,
  cancelInto: AIR_CANCEL, sound: 'slash', weight: 0.5, afterimage: true,
  trail: { limb: 'handA', color: C_AIR, width: 14 },
  poses: {
    antic: { aU: -0.1, aL: 0.9, bU: 0.2, spin: -0.25, lean: 0.25, laU: 1.2, laL: -2.0 },
    strike: { aU: 2.65, aL: 0.08, bU: -0.6, bL: 0.9, spin: 0.3, lean: 0.15, laU: 1.0, laL: -1.8, lbU: -0.3 },
    follow: { aU: 2.8, aL: 0.3, bU: -0.5, spin: 0.25, lean: 0.1 },
  },
});
add({
  id: 'aslashH', family: 'aslash', name: 'Gale Slash', tags: ['air', 'heavy'],
  startup: 7, active: 4, recovery: 16, damage: 12, hitstun: 36, kbX: 720, kbY: -560,
  hitstop: 7, shake: 9, zoom: 0.35, poise: 2, hitbox: { x: 60, y: 78, r: 48 }, reach: 68, selfVY: -320,
  cancelInto: AIR_CANCEL, sound: 'slash', weight: 0.8, afterimage: true,
  trail: { limb: 'handA', color: C_HEAVY, width: 17 },
  poses: {
    antic: { aU: -0.4, aL: 0.8, spin: -0.45, lean: 0.3, laU: 1.3, laL: -2.1 },
    strike: { aU: 2.75, aL: 0.05, bU: -0.7, spin: 0.55, lean: 0.1, laU: 0.9, laL: -1.7 },
    follow: { aU: 2.9, aL: 0.25, spin: 0.5, lean: 0.05 },
  },
});

// ---------------- Air: N ----------------
add({
  id: 'arise', family: 'arise', name: 'Rising Strike', tags: ['air', 'light', 'rising'],
  startup: 5, active: 4, recovery: 14, damage: 8, hitstun: 36, kbX: 40, kbY: -900,
  hitstop: 5, shake: 6, zoom: 0.2, hitbox: { x: 40, y: 100, r: 46 }, reach: 52, selfVY: -820,
  cancelInto: AIR_CANCEL, sound: 'launch', weight: 0.55, afterimage: true,
  trail: { limb: 'handA', color: C_LAUNCH, width: 13 },
  poses: {
    antic: { aU: 0.4, aL: 1.9, laU: 0.5, laL: -1.0, lean: 0.3 },
    strike: { aU: 3.05, aL: 0.1, bU: 0.3, bL: 1.5, laU: 1.3, laL: -1.9, lbU: -0.2, lbL: -0.4, lean: -0.2, head: -0.35 },
    follow: { aU: 3.1, aL: 0.15, laU: 1.1, laL: -1.7, lean: -0.15 },
  },
});

// ---------------- Air: S (SPIKE) ----------------
add({
  id: 'spike', family: 'spike', name: 'Spike', tags: ['air', 'down', 'light'],
  startup: 6, active: 3, recovery: 18, damage: 12, hitstun: 40, kbX: 280, kbY: 1750,
  hitstop: 8, shake: 12, zoom: 0.45, poise: 2, hitbox: { x: 50, y: 66, r: 48 }, reach: 56,
  spike: true, selfVY: -380, cancelInto: ['dodge', 'special'], sound: 'spike', weight: 0.85, afterimage: true,
  trail: { limb: 'footA', color: C_SPIKE, width: 16 },
  poses: {
    antic: { spin: -0.55, laU: 2.35, laL: -0.3, lbU: 0.2, lbL: -1.2, aU: 2.2, aL: 0.5, bU: 2.0, lean: -0.2 },
    strike: { spin: 0.5, laU: 0.85, laL: 0.0, lbU: -0.4, lbL: -1.0, lean: 0.48, aU: -0.6, aL: 0.9, bU: -0.85, bL: 0.8 },
    follow: { spin: 0.35, laU: 0.9, laL: -0.3, lean: 0.4, aU: -0.4, bU: -0.6 },
  },
});

// ---------------- Specials ----------------
// Revision pass 8: the old super-meter Jumpshot Finisher and Flurry moves are gone. The Jumpshot
// finisher lives on as the Fists AIR FINISHER cinematic and the Flurry as the Fists boss-KO flurry
// (data/cines.ts); their drawings stay in the animation set for those cinematics.

/** Direction indices: 0=E,1=NE,2=N,3=NW,4=W,5=SW,6=S,7=SE (counter-clockwise, screen-up = N). */
export const DIR_NAMES = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;
/** Unit vectors per direction (screen space, +y down). */
export const DIR_VX = [1, 0.707, 0, -0.707, -1, -0.707, 0, 0.707];
export const DIR_VY = [0, -0.707, -1, -0.707, 0, 0.707, 1, 0.707];

export type DirClass = 'side' | 'upDiag' | 'up' | 'downDiag' | 'down';
export function dirClass(dir: number): DirClass {
  switch (dir) {
    case 0: case 4: return 'side';
    case 1: case 3: return 'upDiag';
    case 2: return 'up';
    case 5: case 7: return 'downDiag';
    default: return 'down';
  }
}
/** Horizontal sign of a direction (0 for pure vertical). */
export function dirSignX(dir: number): number {
  if (dir === 2 || dir === 6) return 0;
  return dir === 0 || dir === 1 || dir === 7 ? 1 : -1;
}
