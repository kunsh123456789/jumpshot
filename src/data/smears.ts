/**
 * Hand-Drawn smears and in-betweens (revision pass 6). Every attack-like
 * animation gets a smear CHAIN: the fastest drawing of the strike carries the
 * densest hatch (the leading edge), the contact drawing a lighter one, and
 * 1-2 follow-through drawings a thinning trail along the same arc, so the
 * swing visibly sweeps through and dissipates. Seeds are per drawing, so
 * repeats are identical.
 */
export interface SmearCfg {
  /** Max drawings in a chain (Normal uses min(chain, 3), High the full chain, Low 1). */
  chain: number;
  /** Hatch density per chain step (1 = full). */
  density: number[];
  /** Stroke angle jitter (rad) and length jitter (0-1). */
  jitter: number;
  lenJitter: number;
  /** Arc radius multiplier: how far beyond the limb end the hatch reaches. */
  radius: number;
  /** Sweep multiplier: how much of the swept angle the hatch covers (1 = all of it). */
  sweep: number;
  /** Limb-stretch wedge on the fastest drawing (arms/legs), and a thin swoosh line along the path. */
  stretch: boolean;
  swoosh: boolean;
  /** Extra ghost arms fanned around a punch (the flurry's "hundred fists"). */
  multiArm: number;
  /** Ignore sweeps shorter than this (world units at scale 1). */
  minSweep: number;
  /** Colour override (default: the fighter's ink colour). */
  color?: string;
  /** Also fill the area the striking limb swept with a hatched crescent (Fists Reference v2 heavies). */
  crescent?: boolean;
}

export const SMEAR_DEFAULT: SmearCfg = {
  chain: 4, density: [1, 0.7, 0.42, 0.22], jitter: 0.9, lenJitter: 1,
  radius: 1.05, sweep: 1, stretch: true, swoosh: true, multiArm: 0, minSweep: 18,
};

/** Per-animation overrides (tune in the Lab). */
export const SMEAR_BY_ANIM: Record<string, Partial<SmearCfg>> = {
  launcher: { chain: 4, radius: 1.15 },
  launcherH: { chain: 4, radius: 1.2 },
  spike: { chain: 4, radius: 1.2, density: [1, 0.8, 0.5, 0.25] },
  backfist: { chain: 4, radius: 1.15 },
  jumpshotFinisher: { chain: 4, radius: 1.25, density: [1, 0.85, 0.55, 0.3] },
  flurry: { chain: 2, multiArm: 3, minSweep: 6, density: [1, 0.55, 0.3, 0.15], swoosh: false },
  flurryEnd: { chain: 4, radius: 1.3, density: [1, 0.85, 0.55, 0.3] },
  slam: { chain: 4, radius: 1.2 },
  hammer: { chain: 4, radius: 1.25 },
  jab1: { chain: 3 }, jab2: { chain: 3 }, ePunch: { chain: 3 },
};

/** Overrides that apply only while the alternate animation set (Fists Reference v2) is active. */
export const SMEAR_VARIANT: Record<string, Partial<SmearCfg>> = {};
export const smearVariant = { on: false };

export function smearCfg(id: string): SmearCfg {
  const o = SMEAR_BY_ANIM[id];
  const v = smearVariant.on ? SMEAR_VARIANT[id] : undefined;
  if (!o && !v) return SMEAR_DEFAULT;
  return { ...SMEAR_DEFAULT, ...o, ...v };
}

/** Attack Smoothness levels: generated in-betweens per moving attack segment, chain cap, strike on ones. */
export const SMOOTHNESS = {
  low: { bonus: 0, chain: 1, strikeOnes: false },
  normal: { bonus: 1, chain: 3, strikeOnes: false },
  high: { bonus: 2, chain: 4, strikeOnes: true },
} as const;
export type SmoothLevel = keyof typeof SMOOTHNESS;

/** Non-contact animations that still count as attack-like (fast travel, flips, thrown bodies). */
export const ATTACKISH = new Set(['dash', 'airDash', 'dodge', 'runStart', 'leap', 'launched', 'tumble', 'groundBounce', 'wallSplat', 'knockdown', 'parry']);
