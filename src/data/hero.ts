/**
 * The player's character: cosmetics (what the hero looks like) and traits (two slots of small
 * trade-off modifiers). Cosmetics are render-only (the renderers read HERO_LOOK); traits are applied
 * by the sim through one modifiers object (World.traits), which is exactly the identity when no
 * trait is equipped, so a run without traits plays frame for frame as it always did.
 */
export type BandId = 'red' | 'blue' | 'black' | 'none';
export type GearId = 'none' | 'cap' | 'tophat' | 'crown' | 'halo' | 'ears' | 'goggles';
export type HandsId = 'none' | 'wraps' | 'mitts';

export interface HeroSave { band: BandId; headgear: GearId; hands: HandsId; traits: (string | null)[] }

/** Cosmetic options. The Pixel look has four colours, so colour choices stick to its ink colours; the rest are shapes. */
export const BANDS: { id: BandId; name: string }[] = [
  { id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }, { id: 'black', name: 'Black' }, { id: 'none', name: 'None' },
];
export const GEAR: { id: GearId; name: string }[] = [
  { id: 'none', name: 'None' }, { id: 'cap', name: 'Cap' }, { id: 'tophat', name: 'Top hat' }, { id: 'crown', name: 'Crown' },
  { id: 'halo', name: 'Halo' }, { id: 'ears', name: 'Cat ears' }, { id: 'goggles', name: 'Goggles' },
];
export const HANDS: { id: HandsId; name: string }[] = [
  { id: 'none', name: 'Bare' }, { id: 'wraps', name: 'Wraps' }, { id: 'mitts', name: 'Mitts' },
];

/** What the renderers draw (kept in step with the save by applyHero). */
export const HERO_LOOK: { band: BandId; headgear: GearId; hands: HandsId } = { band: 'red', headgear: 'none', hands: 'none' };

export const TRAIT_SLOTS = 2;

export interface TraitMods {
  /** Max HP multiplier. */ hp: number;
  /** Damage dealt multiplier, and an extra multiplier against enemies under 30% HP. */ dmgOut: number; dmgLow: number;
  /** Damage taken multiplier. */ dmgIn: number;
  /** Run speed multiplier. */ run: number;
  /** Special-bar gain multiplier. */ special: number;
  /** Parry window multiplier. */ parry: number;
  /** Extra mid-air jumps. */ airJumps: number;
  /** Fraction of damage dealt returned as HP. */ lifesteal: number;
  /** 1 = Laser Eyes: hover on a fuel tank and fire eye beams while flying (sim/powers.ts). */ fly: number;
}
export const IDENTITY: TraitMods = { hp: 1, dmgOut: 1, dmgLow: 1, dmgIn: 1, run: 1, special: 1, parry: 1, airJumps: 0, lifesteal: 0, fly: 0 };

export interface TraitDef { id: string; name: string; up: string; down: string; mods: Partial<TraitMods> }
/** Every trait is a trade-off: a real upside and a real cost. */
export const TRAITS: TraitDef[] = [
  { id: 'iron', name: 'Iron Skin', up: '+25% max HP', down: '-10% run speed', mods: { hp: 1.25, run: 0.9 } },
  { id: 'glass', name: 'Glass Cannon', up: '+20% damage dealt', down: '+25% damage taken', mods: { dmgOut: 1.2, dmgIn: 1.25 } },
  { id: 'adrenaline', name: 'Adrenaline', up: 'Special bar fills 40% faster', down: '-10% max HP', mods: { special: 1.4, hp: 0.9 } },
  { id: 'lightfoot', name: 'Lightfoot', up: '+1 air jump, +10% run speed', down: '-10% damage dealt', mods: { airJumps: 1, run: 1.1, dmgOut: 0.9 } },
  { id: 'parry', name: 'Steady Nerves', up: 'Parry window +50%', down: '-10% damage dealt', mods: { parry: 1.5, dmgOut: 0.9 } },
  { id: 'vampire', name: 'Leech', up: 'Heal 5% of damage dealt', down: '-20% max HP', mods: { lifesteal: 0.05, hp: 0.8 } },
  { id: 'eyes', name: 'Laser Eyes', up: 'Hold jump to FLY; eye beams burn what you face', down: '-15% max HP, -10% damage dealt', mods: { fly: 1, hp: 0.85, dmgOut: 0.9 } },
  { id: 'exec', name: 'Executioner', up: '+55% damage to enemies under 30% HP', down: '-10% damage to healthy ones', mods: { dmgLow: 1.55, dmgOut: 0.9 } },
];
export const traitById = (id: string | null | undefined): TraitDef | null => TRAITS.find((t) => t.id === id) ?? null;

/** Combine the equipped traits' modifiers (multiplicative, additive for jumps and lifesteal). */
export function combineTraits(ids: (string | null)[]): TraitMods {
  const m: TraitMods = { ...IDENTITY };
  const seen = new Set<string>();
  for (const id of ids) {
    const t = traitById(id);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    const x = t.mods;
    if (x.hp) m.hp *= x.hp; if (x.dmgOut) m.dmgOut *= x.dmgOut; if (x.dmgLow) m.dmgLow *= x.dmgLow; if (x.dmgIn) m.dmgIn *= x.dmgIn;
    if (x.run) m.run *= x.run; if (x.special) m.special *= x.special; if (x.parry) m.parry *= x.parry;
    if (x.airJumps) m.airJumps += x.airJumps; if (x.lifesteal) m.lifesteal += x.lifesteal; if (x.fly) m.fly = 1;
  }
  return m;
}

export const HERO_DEFAULT: HeroSave = { band: 'red', headgear: 'none', hands: 'none', traits: [null, null] };

/** Validate a saved hero: unknown ids fall back to defaults, duplicate or unknown traits are dropped. */
export function sanitizeHero(raw: unknown): HeroSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HeroSave>;
  const pick = <T extends string>(v: unknown, list: { id: T }[], d: T): T => (list.some((o) => o.id === v) ? (v as T) : d);
  const traits: (string | null)[] = [];
  for (let i = 0; i < TRAIT_SLOTS; i++) {
    const id = Array.isArray(r.traits) ? r.traits[i] : null;
    traits.push(traitById(id) && !traits.includes(id as string) ? (id as string) : null);
  }
  return { band: pick(r.band, BANDS, 'red'), headgear: pick(r.headgear, GEAR, 'none'), hands: pick(r.hands, HANDS, 'none'), traits };
}
export function applyHero(h: HeroSave): void { HERO_LOOK.band = h.band; HERO_LOOK.headgear = h.headgear; HERO_LOOK.hands = h.hands; }
