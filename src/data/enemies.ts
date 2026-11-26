import { makePose, type PoseSpec } from '../render/rig';

/** Enemy attack definition. kbX along enemy facing, kbY negative = up. */
export interface EnemyAttack {
  id: string;
  /** Telegraph: wind-up frames with red glow. */
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Hitbox relative to enemy feet: x forward, y up, r radius. */
  hitbox: { x: number; y: number; r: number };
  /** Distance at which the enemy starts the windup. */
  range: number;
  /** Forward velocity during active frames (lunges). */
  lunge: number;
  /** Forward velocity during windup (step-in). */
  stepIn: number;
  kbX: number;
  kbY: number;
  /** Spawns a projectile instead of a melee hitbox (count > 1 fans them out vertically by `spread` px/s). */
  projectile?: { speed: number; damage: number; y: number; count?: number; spread?: number };
  /** A charge across the arena: running into a wall stuns the attacker (a punish window). */
  charge?: boolean;
  /** Animation id to play (default: the attack id). Lets new attacks reuse existing drawings. */
  anim?: string;
  /** Spawns ground shockwaves traveling outward on strike. */
  shockwave?: { speed: number; damage: number; life: number };
  sound: 'punch' | 'kick' | 'heavy' | 'throw' | 'slam';
  poses: { antic: Float32Array; strike: Float32Array; follow: Float32Array };
}

export type EnemyKind = 'dummy' | 'grunt' | 'rusher' | 'brute' | 'kicker' | 'thrower' | 'shield' | 'elite' | 'boss' | 'witch' | 'juggernaut' | 'shadow';

/**
 * Boss behavior (data-driven). Every boss has three phases (BOSS.phase2/phase3 HP fractions),
 * a poise-break stagger window, a boss bar, and these extras.
 */
export interface BossSpec {
  /** Intro popup. */
  title: string;
  sub: string;
  /** From phase 2: falling strikes at the player every N frames (0 = none); two at once in phase 3. */
  meteors: number;
  /** From phase 2: summon helpers every N frames while fewer than 3 are alive. */
  summon: { every: number; kinds: [EnemyKind, EnemyKind] } | null;
  /** Teleports to the far side when the player gets this close (cooldown frames). */
  blink: { range: number; cooldown: number } | null;
  /** Chance to slip away from a hit (outside a stagger). */
  dodge: number;
  /** Drawn accessory. */
  prop: 'horns' | 'hat' | 'helm' | 'band';
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  /** Armor: hits don't cause hitstun until poise breaks. 0 = none. */
  poise: number;
  poiseRegenFrames: number;
  scale: number;
  thickness: number;
  color: string;
  accent: string;
  walkSpeed: number;
  /** Preferred distance while waiting for an attack token. */
  holdDist: number;
  attacks: EnemyAttack[];
  /** Knockback taken multiplier. */
  weight: number;
  launchMult: number;
  burstThreshold: number;
  blocksFront: boolean;
  /** Cooldown frames between attacks for this enemy. */
  cooldown: number;
  score: number;
  hpBar: boolean;
  scarf: boolean;
  /** Cost used by the wave budget generator. */
  cost: number;
  /** Set on bosses. */
  boss?: BossSpec;
}

function atk(a: Omit<EnemyAttack, 'poses'> & { poses: { antic: PoseSpec; strike: PoseSpec; follow: PoseSpec } }): EnemyAttack {
  return {
    ...a,
    poses: { antic: makePose(a.poses.antic), strike: makePose(a.poses.strike), follow: makePose(a.poses.follow) },
  };
}

const PUNCH = atk({
  id: 'punch', windup: 22, active: 4, recovery: 22, damage: 8,
  hitbox: { x: 58, y: 92, r: 34 }, range: 95, lunge: 260, stepIn: 60, kbX: 300, kbY: -120, sound: 'punch',
  poses: {
    antic: { lean: -0.12, aU: -0.3, aL: 2.4, rootX: -8, rootY: -8, head: 0.1 },
    strike: { lean: 0.38, aU: 1.6, aL: 0.05, rootX: 14, footA: 30 },
    follow: { lean: 0.32, aU: 1.45, aL: 0.4, rootX: 12, footA: 28 },
  },
});
const LUNGE = atk({
  id: 'lunge', windup: 18, active: 12, recovery: 26, damage: 10,
  hitbox: { x: 50, y: 88, r: 40 }, range: 340, lunge: 1150, stepIn: -40, kbX: 420, kbY: -180, sound: 'heavy',
  poses: {
    antic: { lean: 0.6, rootY: -26, aU: -1.2, aL: 0.6, bU: -1.0, bL: 0.6, footA: 30, footB: -30 },
    strike: { lean: 0.75, rootY: -18, aU: 1.55, aL: 0.0, bU: -1.2, bL: 0.5, plant: 0.3, laU: 1.2, laL: -1.0, lbU: -0.8 },
    follow: { lean: 0.5, rootY: -14, aU: 1.3, aL: 0.4, footA: 32 },
  },
});
const SLAM = atk({
  id: 'slam', windup: 30, active: 5, recovery: 34, damage: 20,
  hitbox: { x: 72, y: 50, r: 62 }, range: 120, lunge: 120, stepIn: 30, kbX: 560, kbY: -480, sound: 'slam',
  poses: {
    antic: { lean: -0.3, aU: 3.0, aL: 0.4, bU: 2.9, bL: 0.5, rootY: 6, head: 0.2, flex: 5 },
    strike: { lean: 0.75, aU: 1.0, aL: 0.1, bU: 0.9, bL: 0.2, rootY: -24, footA: 34 },
    follow: { lean: 0.65, aU: 0.8, aL: 0.3, bU: 0.7, rootY: -22, footA: 32 },
  },
});
const KICK = atk({
  id: 'kick', windup: 17, active: 5, recovery: 22, damage: 9,
  hitbox: { x: 110, y: 72, r: 36 }, range: 160, lunge: 200, stepIn: 20, kbX: 380, kbY: -160, sound: 'kick',
  poses: {
    antic: { laU: 1.2, laL: -2.2, plant: 0.4, lean: -0.15, aU: 1.2, aL: 1.6 },
    strike: { laU: 1.65, laL: 0.0, plant: 0.5, lean: -0.35, aU: -0.5, aL: 1.2, bU: 1.6, bL: 1.2 },
    follow: { laU: 1.5, laL: -0.3, plant: 0.6, lean: -0.3 },
  },
});
const THROW = atk({
  id: 'throw', windup: 24, active: 2, recovery: 30, damage: 8,
  hitbox: { x: 30, y: 100, r: 10 }, range: 720, lunge: 0, stepIn: -30, kbX: 260, kbY: -120, sound: 'throw',
  projectile: { speed: 760, damage: 8, y: 98 },
  poses: {
    antic: { lean: -0.25, aU: -2.3, aL: 0.6, bU: 1.2, bL: 0.6, head: 0.1, footB: -26 },
    strike: { lean: 0.35, aU: 1.75, aL: 0.1, bU: -0.5, rootX: 8, footA: 30 },
    follow: { lean: 0.3, aU: 1.5, aL: 0.3, rootX: 6 },
  },
});
const BASH = atk({
  id: 'bash', windup: 20, active: 5, recovery: 24, damage: 10,
  hitbox: { x: 56, y: 80, r: 44 }, range: 100, lunge: 380, stepIn: 40, kbX: 480, kbY: -160, sound: 'heavy',
  poses: {
    antic: { lean: -0.1, aU: 1.0, aL: 1.6, rootX: -8, rootY: -10 },
    strike: { lean: 0.45, aU: 1.55, aL: 0.6, rootX: 18, footA: 34 },
    follow: { lean: 0.4, aU: 1.45, aL: 0.8, rootX: 16 },
  },
});

// Elite: faster versions.
const E_COMBO = atk({ ...PUNCH, id: 'ePunch', windup: 15, damage: 9, recovery: 12, lunge: 340,
  poses: { antic: { lean: -0.12, aU: -0.3, aL: 2.4, rootX: -8, rootY: -8 }, strike: { lean: 0.38, aU: 1.6, aL: 0.05, rootX: 14, footA: 30 }, follow: { lean: 0.32, aU: 1.45, aL: 0.4, rootX: 12 } } });
const E_LUNGE = atk({ ...LUNGE, id: 'eLunge', windup: 16, damage: 12, lunge: 1300,
  poses: { antic: { lean: 0.6, rootY: -26, aU: -1.2, aL: 0.6, bU: -1.0, bL: 0.6, footA: 30, footB: -30 }, strike: { lean: 0.75, rootY: -18, aU: 1.55, aL: 0.0, bU: -1.2, plant: 0.3, laU: 1.2, laL: -1.0 }, follow: { lean: 0.5, rootY: -14, aU: 1.3, aL: 0.4 } } });
const E_KICK = atk({ ...KICK, id: 'eKick', windup: 15, damage: 12, kbY: -420,
  poses: { antic: { laU: 1.2, laL: -2.2, plant: 0.4, lean: -0.15 }, strike: { laU: 1.75, laL: 0.0, plant: 0.4, lean: -0.4, spin: -0.15, aU: -0.5, bU: 1.6 }, follow: { laU: 1.5, laL: -0.3, plant: 0.6, lean: -0.3 } } });

// Boss.
const B_HAMMER = atk({
  id: 'hammer', windup: 36, active: 5, recovery: 40, damage: 18,
  hitbox: { x: 90, y: 40, r: 80 }, range: 190, lunge: 0, stepIn: 20, kbX: 620, kbY: -560, sound: 'slam',
  shockwave: { speed: 820, damage: 10, life: 60 },
  poses: {
    antic: { lean: -0.35, aU: 3.05, aL: 0.2, bU: 3.0, bL: 0.2, rootY: 8, flex: 6, head: 0.25 },
    strike: { lean: 0.85, aU: 1.1, aL: 0.0, bU: 1.0, bL: 0.0, rootY: -30, footA: 36 },
    follow: { lean: 0.75, aU: 0.9, aL: 0.2, bU: 0.8, rootY: -28, footA: 34 },
  },
});
const B_SWEEP = atk({
  id: 'bSweep', windup: 26, active: 7, recovery: 30, damage: 16,
  hitbox: { x: 120, y: 30, r: 70 }, range: 240, lunge: 200, stepIn: 0, kbX: 520, kbY: -520, sound: 'kick',
  poses: {
    antic: { rootY: -20, lean: 0.3, laU: 0.6, laL: -1.6, aU: 0.8, aL: 1.0 },
    strike: { rootY: -34, plant: 0.1, lean: 0.55, laU: 1.62, laL: 0.0, lbU: -1.0, lbL: -1.3, aU: 1.1, bU: -0.6 },
    follow: { rootY: -32, plant: 0.25, lean: 0.5, laU: 1.5, laL: -0.2 },
  },
});
const B_RUSH = atk({ ...LUNGE, id: 'bRush', windup: 22, damage: 15, lunge: 1250, hitbox: { x: 70, y: 90, r: 60 }, range: 520,
  poses: { antic: { lean: 0.6, rootY: -26, aU: -1.2, aL: 0.6, bU: -1.0, bL: 0.6, footA: 30, footB: -30 }, strike: { lean: 0.75, rootY: -18, aU: 1.55, aL: 0.0, bU: -1.2, plant: 0.3, laU: 1.2, laL: -1.0 }, follow: { lean: 0.5, rootY: -14, aU: 1.3, aL: 0.4 } } });

/** A variant of an existing attack (keeps its compiled poses). */
const vary = (a: EnemyAttack, o: Partial<EnemyAttack>): EnemyAttack => ({ ...a, ...o });
// ---- Wave 20: SCRIBBLA, the Ink Witch (ranged: dart fans, blinks away, ink rain) ----
const W_VOLLEY = vary(THROW, { id: 'wVolley', anim: 'throw', windup: 28, recovery: 28, damage: 7, range: 900,
  projectile: { speed: 640, damage: 7, y: 110, count: 3, spread: 150 } });
const W_SLASH = vary(PUNCH, { id: 'wSlash', anim: 'ePunch', windup: 16, active: 6, recovery: 22, damage: 14, lunge: 420,
  hitbox: { x: 80, y: 80, r: 60 }, range: 170, kbX: 600, kbY: -380 });
// ---- Wave 30: THE JUGGERNAUT (armored charges; dodge one and he hits the wall, stunned) ----
const J_CHARGE = vary(LUNGE, { id: 'jCharge', anim: 'bRush', windup: 38, active: 40, recovery: 30, damage: 15, lunge: 1500, stepIn: -60,
  hitbox: { x: 60, y: 90, r: 70 }, range: 1000, kbX: 900, kbY: -600, charge: true });
const J_STOMP = vary(B_HAMMER, { id: 'jStomp', anim: 'hammer', windup: 34, damage: 12, hitbox: { x: 70, y: 30, r: 90 }, range: 200,
  shockwave: { speed: 720, damage: 8, life: 70 } });
const J_SWAT = vary(B_SWEEP, { id: 'jSwat', anim: 'bSweep', windup: 24, active: 6, recovery: 28, damage: 12, hitbox: { x: 110, y: 70, r: 70 },
  range: 230, lunge: 200, kbX: 700, kbY: -400 });
// ---- Wave 40: SHADOW, your ink double (fast combos, slips your hits, ink strikes) ----
const S_JAB = vary(E_COMBO, { id: 'sJab', anim: 'ePunch', windup: 12, damage: 10, recovery: 10 });
const S_KICK = vary(E_KICK, { id: 'sKick', anim: 'eKick', windup: 14, damage: 13 });
const S_LUNGE = vary(E_LUNGE, { id: 'sLunge', anim: 'eLunge', windup: 14, damage: 14, range: 540 });

/** Shield enemies: weaker than they were, and the guard gives way (a heavy hit, or a few blocked hits). */
export const SHIELD = {
  hp: 70,
  /** Blocked hits before the shield cracks open (any heavy move breaks it at once). */
  blocksToBreak: 3,
} as const;

const base = {
  poise: 0, poiseRegenFrames: 120, scale: 1.06, thickness: 5.5, walkSpeed: 150, holdDist: 230,
  weight: 1, launchMult: 1, burstThreshold: 11, blocksFront: false, cooldown: 70, hpBar: false, scarf: false,
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  dummy: { ...base, kind: 'dummy', name: 'Dummy', hp: 99999, color: '#c9b48a', accent: '#8a7a5a', attacks: [PUNCH], score: 0, cost: 0, cooldown: 140, burstThreshold: 999 },
  grunt: { ...base, kind: 'grunt', name: 'Grunt', hp: 72, color: '#ff5f5f', accent: '#b83a3a', attacks: [PUNCH], score: 100, cost: 1 },
  rusher: { ...base, kind: 'rusher', name: 'Rusher', hp: 52, color: '#ff9a3a', accent: '#b8601a', walkSpeed: 230, holdDist: 360, attacks: [LUNGE], score: 140, cost: 1.4, thickness: 4.5, cooldown: 90 },
  brute: { ...base, kind: 'brute', name: 'Brute', hp: 180, poise: 26, scale: 1.32, thickness: 8.5, color: '#b276ff', accent: '#6c3fb0', walkSpeed: 95, holdDist: 200, attacks: [SLAM], weight: 0.62, launchMult: 0.8, burstThreshold: 8, score: 300, cost: 3, cooldown: 100 },
  kicker: { ...base, kind: 'kicker', name: 'Kicker', hp: 74, color: '#4dff9a', accent: '#28a862', walkSpeed: 190, holdDist: 210, attacks: [KICK], score: 150, cost: 1.5, cooldown: 60 },
  thrower: { ...base, kind: 'thrower', name: 'Thrower', hp: 58, color: '#3fe0ff', accent: '#1f8aa8', walkSpeed: 160, holdDist: 470, attacks: [THROW], score: 160, cost: 1.6, thickness: 4.5, cooldown: 110 },
  shield: { ...base, kind: 'shield', name: 'Shield', hp: SHIELD.hp, color: '#6f9bff', accent: '#3a5ab8', walkSpeed: 120, holdDist: 170, attacks: [BASH], blocksFront: true, score: 220, cost: 2.2, thickness: 6, cooldown: 85 },
  elite: { ...base, kind: 'elite', name: 'RONIN', hp: 340, poise: 18, poiseRegenFrames: 100, scale: 1.12, thickness: 6.5, color: '#ff4dd2', accent: '#ffd0f4', walkSpeed: 210, holdDist: 200, attacks: [E_COMBO, E_LUNGE, E_KICK], weight: 0.85, burstThreshold: 9, score: 1500, cost: 6, cooldown: 45, hpBar: true, scarf: true },
  boss: { ...base, kind: 'boss', name: 'THE COLOSSUS', boss: { title: 'THE COLOSSUS', sub: 'BOSS', meteors: 190, summon: { every: 540, kinds: ['grunt', 'rusher'] }, blink: null, dodge: 0, prop: 'horns' }, hp: 1000, poise: 70, poiseRegenFrames: 200, scale: 2.0, thickness: 12, color: '#ffd23f', accent: '#ff3b3b', walkSpeed: 90, holdDist: 230, attacks: [B_HAMMER, B_SWEEP, B_RUSH], weight: 0.38, launchMult: 0.7, burstThreshold: 7, score: 8000, cost: 20, cooldown: 40, hpBar: true, scarf: true },
  witch: { ...base, kind: 'witch', name: 'SCRIBBLA', hp: 800, poise: 30, poiseRegenFrames: 160, scale: 1.35, thickness: 6, color: '#3a3a5a', accent: '#e22424',
    walkSpeed: 150, holdDist: 460, attacks: [W_VOLLEY, W_SLASH], weight: 0.6, launchMult: 0.8, burstThreshold: 8, score: 9000, cost: 20, cooldown: 62, hpBar: true, scarf: true,
    boss: { title: 'SCRIBBLA', sub: 'THE INK WITCH', meteors: 200, summon: { every: 600, kinds: ['thrower', 'shield'] }, blink: { range: 200, cooldown: 150 }, dodge: 0, prop: 'hat' } },
  juggernaut: { ...base, kind: 'juggernaut', name: 'THE JUGGERNAUT', hp: 780, poise: 110, poiseRegenFrames: 220, scale: 2.1, thickness: 13, color: '#c0392b', accent: '#1b1a17',
    walkSpeed: 80, holdDist: 260, attacks: [J_STOMP, J_SWAT, J_CHARGE], weight: 0.3, launchMult: 0.6, burstThreshold: 7, score: 10000, cost: 20, cooldown: 66, hpBar: true, scarf: false,
    boss: { title: 'THE JUGGERNAUT', sub: 'DODGE THE CHARGE', meteors: 0, summon: { every: 840, kinds: ['brute', 'rusher'] }, blink: null, dodge: 0, prop: 'helm' } },
  shadow: { ...base, kind: 'shadow', name: 'SHADOW', hp: 650, poise: 20, poiseRegenFrames: 120, scale: 1.0, thickness: 6, color: '#1b1a17', accent: '#e22424',
    walkSpeed: 260, holdDist: 200, attacks: [S_JAB, S_KICK, S_LUNGE], weight: 0.9, launchMult: 0.9, burstThreshold: 9, score: 11000, cost: 20, cooldown: 30, hpBar: true, scarf: true,
    boss: { title: 'SHADOW', sub: 'YOUR INK DOUBLE', meteors: 170, summon: null, blink: null, dodge: 0.22, prop: 'band' } },
};

/** Boss for a boss wave (every 10th): Colossus, Witch, Juggernaut, Shadow, then around again (HP keeps scaling). */
export const BOSS_ORDER: EnemyKind[] = ['boss', 'witch', 'juggernaut', 'shadow'];
export function bossForWave(wave: number): EnemyKind {
  return BOSS_ORDER[(Math.max(1, Math.floor(wave / 10)) - 1) % BOSS_ORDER.length];
}
export function isBoss(f: { def: EnemyDef | null }): boolean { return !!f.def?.boss; }

export const BOSS = {
  /** HP fractions where phases begin. */
  phase2: 0.62,
  phase3: 0.3,
  meteorWarn: 55,
  meteorDamage: 11,
  meteorRadius: 70,
  staggerFrames: 170,
  /** Windup multiplier in phase 3 (faster). */
  p3Speed: 0.75,
} as const;

export const PROJECTILE = {
  radius: 12,
  reflectSpeedMult: 1.7,
  reflectDamage: 18,
  life: 180,
} as const;
