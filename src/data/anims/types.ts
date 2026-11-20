import { Ch, POSE_N, STANCE, makePose, type PoseSpec } from '../../render/rig';

/**
 * Pose-to-pose animation data. An animation is a list of KEY POSES at authored
 * frames (60 Hz sim ticks). Each key names the easing curve INTO it. Playback
 * is exactly what is authored: no springs, no smoothing.
 *
 * Easing curves (linear is not allowed for character motion):
 *  - snapOut:   very fast start, long settle (moves out of a strike, reactions)
 *  - snapIn:    slow start, hard arrival (the hit itself)
 *  - inOut:     ease-in-out (anticipation, breathing, recovery)
 *  - out / in:  gentler one-sided curves
 *  - overshoot: arrives past the key and settles back
 *  - hold:      step: keeps the previous key until this key's frame
 */
export type EaseId = 'snapOut' | 'snapIn' | 'inOut' | 'out' | 'in' | 'overshoot' | 'hold';
export type LimbId = 'handA' | 'handB' | 'footA' | 'footB';

export interface KeySpec {
  /** Frame (60 Hz ticks from the animation start). */
  f: number;
  /** Pose, layered over the animation's base pose. */
  p: PoseSpec;
  /** Easing INTO this key from the previous one. Default inOut. */
  e?: EaseId;
  /** Hold this key's pose until the next key's frame (step). */
  hold?: boolean;
  /** Limbs drawn as a smear on the segment INTO this key. */
  smear?: LimbId[];
  /** This key is the contact/impact pose (gameplay contact lands here). */
  impact?: boolean;
  /** Emit the motion trail for this limb on the segment into this key. */
  trail?: LimbId;
  /** Sound cue when playback crosses this key. */
  sfx?: 'step' | 'whoosh' | 'land';
  /** Hand-Drawn style: show the segment after this key interpolated at full rate (super-fast moments). */
  ones?: boolean;
  /** Hand-Drawn style: generate this many in-between drawings (0-2) on the segment after this key. */
  inbetween?: number;
}

/** One drawing of a Hand-Drawn animation: a full pose shown for `hold` sim ticks. */
export interface DrawingSpec extends Omit<KeySpec, 'f' | 'hold'> {
  /** How many 60 Hz ticks this drawing stays on screen (5-6 ≈ 10-12 fps). */
  hold: number;
}

/** A Hand-Drawn animation: drawings with holds (compiled into keys; Smooth style interpolates them). */
export interface DrawnSpec extends Omit<AnimSpec, 'keys' | 'len'> {
  drawings: DrawingSpec[];
  /** Total length; defaults to the sum of holds. */
  len?: number;
}

export interface AnimSpec {
  id: string;
  /** Length in frames (for attacks: startup + active + recovery of the move). */
  len: number;
  loop?: boolean;
  /** Pose layer the keys are written over. */
  base?: 'ground' | 'air' | 'lying';
  /** Which part strikes: it gets no staggered lead (lands exactly on contact). */
  strike?: 'arm' | 'leg' | 'body';
  /** IK-reach this limb to the target around the contact key. */
  reach?: LimbId;
  keys: KeySpec[];
}

export interface Key {
  f: number;
  pose: Float32Array;
  e: EaseId;
  hold: boolean;
  smear: number; // bitmask of limbs
  impact: boolean;
  trail: number;
  sfx: KeySpec['sfx'] | null;
  ones: boolean;
  inb: number;
}

export interface AnimDef {
  id: string;
  len: number;
  loop: boolean;
  base: 'ground' | 'air' | 'lying';
  strike: 'arm' | 'leg' | 'body';
  reach: number; // limb bit, 0 = none
  /** Frame of the impact key (or -1). */
  contact: number;
  keys: Key[];
  /** Source spec (kept for the lab's editor/export). */
  spec: AnimSpec;
}

export const LIMB_BIT: Record<LimbId, number> = { handA: 1, handB: 2, footA: 4, footB: 8 };

export const AIR_BASE: PoseSpec = {
  rootX: 0, rootY: 0, lean: 0.05, head: -0.05, aU: 1.1, aL: 1.6, bU: 0.5, bL: 1.8,
  laU: 0.9, laL: -1.5, lbU: 0.2, lbL: -1.1, spin: 0, plant: 0, footA: 18, footB: -18, flex: 0,
  liftA: 0, liftB: 0, stretch: 1,
};
/** Fighting stance (ground base): weight low, fists up, feet wide. */
export const GROUND_BASE: PoseSpec = {
  ...STANCE,
  rootY: -10, lean: 0.2, head: -0.1, aU: 1.15, aL: 1.85, bU: 0.55, bL: 2.2, footA: 22, footB: -24,
};
export const LYING_BASE: PoseSpec = {
  plant: 0, rootY: -50, rootX: -6, lean: -1.55, head: 0.15, aU: -2.3, aL: 0.4, bU: -2.7, bL: 0.3,
  laU: 1.5, laL: 0.05, lbU: 1.35, lbL: -0.3, spin: 0, footA: 0, footB: 0, flex: 0, liftA: 0, liftB: 0, stretch: 1,
};
const BASES = { ground: GROUND_BASE, air: AIR_BASE, lying: LYING_BASE };

const limbMask = (l?: LimbId[] | LimbId): number => {
  if (!l) return 0;
  const arr = Array.isArray(l) ? l : [l];
  let m = 0;
  for (const x of arr) m |= LIMB_BIT[x];
  return m;
};

/** Build a playable animation from its authored spec. */
export function anim(spec: AnimSpec): AnimDef {
  const base = BASES[spec.base ?? 'ground'];
  const keys = [...spec.keys].sort((a, b) => a.f - b.f).map((k): Key => ({
    f: k.f,
    pose: makePose(k.p, base),
    e: k.e ?? 'inOut',
    hold: !!k.hold,
    smear: limbMask(k.smear),
    impact: !!k.impact,
    trail: limbMask(k.trail),
    sfx: k.sfx ?? null,
    ones: !!k.ones,
    inb: Math.max(0, Math.min(2, k.inbetween ?? 0)),
  }));
  const ik = keys.find((k) => k.impact);
  return {
    id: spec.id, len: spec.len, loop: !!spec.loop, base: spec.base ?? 'ground',
    strike: spec.strike ?? 'arm', reach: spec.reach ? LIMB_BIT[spec.reach] : 0,
    contact: ik ? ik.f : -1, keys, spec,
  };
}

/**
 * Build an animation from drawings + holds. Drawing i starts at the sum of the
 * previous holds. Hand-Drawn style shows each drawing for its hold (no
 * in-betweens); Smooth style eases between them (into the contact drawing with
 * snapIn so the hit still arrives hard).
 */
export function drawn(spec: DrawnSpec): AnimDef {
  let f = 0;
  const keys: KeySpec[] = [];
  for (const d of spec.drawings) {
    const { hold, ...rest } = d;
    keys.push({ ...rest, f, e: d.e ?? (d.impact ? 'snapIn' : 'inOut') });
    f += hold;
  }
  const def = anim({ ...spec, keys, len: spec.len ?? f });
  def.spec = { ...def.spec, drawn: spec.drawings.map((d) => d.hold) } as AnimSpec;
  return def;
}

/** Rebuild an AnimDef in place after the lab edits its spec. */
export function rebuild(def: AnimDef): void {
  const fresh = anim(def.spec);
  Object.assign(def, fresh);
}

/** Pose channels with their names (for the lab editor/export). */
export const CHANNELS = Object.keys(Ch) as (keyof typeof Ch)[];
export { POSE_N };
