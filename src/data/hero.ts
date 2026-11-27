/**
 * The player's character: cosmetics (what the hero looks like) and traits (two slots of small
 * trade-off modifiers). Cosmetics are render-only (the renderers read HERO_LOOK); traits are applied
 * by the sim through one modifiers object (World.traits), which is exactly the identity when no
 * trait is equipped, so a run without traits plays frame for frame as it always did.
 */
export type BandId = 'red' | 'blue' | 'black' | 'none';
export type GearId = 'none' | 'cap' | 'tophat' | 'crown' | 'halo' | 'ears' | 'goggles';
export type HandsId = 'none' | 'wraps' | 'mitts' | 'fingerless' | 'spiked' | 'glowband' | 'brass' | 'flaming';
export type BodyId = 'male' | 'female';
export type BackId = 'none' | 'scarf' | 'ninja' | 'cape' | 'tattered' | 'page' | 'ribbon' | 'backpack' | 'wings';
export type FeetId = 'none' | 'sneakers' | 'boots' | 'bandaged' | 'rocket' | 'flipflops';
export type BadgeId = 'none' | 'belt' | 'sheriff' | 'rank';
/** Weapons with skins, and each one's skin ids ('default' = the weapon's own drawing). */
export type SkinWeapon = 'staff' | 'laser' | 'hook' | 'fists';

export interface HeroSave {
  band: BandId; headgear: GearId; hands: HandsId; traits: (string | null)[];
  body: BodyId; back: BackId; feet: FeetId; badge: BadgeId;
  skins: Record<SkinWeapon, string>;
}

/** Cosmetic options. The Pixel look has four colours, so colour choices stick to its ink colours; the rest are shapes. */
export const BANDS: { id: BandId; name: string }[] = [
  { id: 'red', name: 'Red' }, { id: 'blue', name: 'Blue' }, { id: 'black', name: 'Black' }, { id: 'none', name: 'None' },
];
export const GEAR: { id: GearId; name: string }[] = [
  { id: 'none', name: 'None' }, { id: 'cap', name: 'Cap' }, { id: 'tophat', name: 'Top hat' }, { id: 'crown', name: 'Crown' },
  { id: 'halo', name: 'Halo' }, { id: 'ears', name: 'Cat ears' }, { id: 'goggles', name: 'Goggles' },
];
export const HANDS: { id: HandsId; name: string }[] = [
  { id: 'none', name: 'Bare' }, { id: 'wraps', name: 'Tape wraps' }, { id: 'mitts', name: 'Mitts' }, { id: 'fingerless', name: 'Fingerless' },
  { id: 'spiked', name: 'Spiked gauntlets' }, { id: 'glowband', name: 'Glow band' }, { id: 'brass', name: 'Brass knuckles' }, { id: 'flaming', name: 'Flaming fists' },
];
export const BODIES: { id: BodyId; name: string }[] = [{ id: 'male', name: 'Male' }, { id: 'female', name: 'Female' }];
export const BACKS: { id: BackId; name: string }[] = [
  { id: 'none', name: 'None' }, { id: 'scarf', name: 'Red scarf' }, { id: 'ninja', name: 'Ninja scarf' }, { id: 'cape', name: 'Cape' },
  { id: 'tattered', name: 'Tattered cape' }, { id: 'page', name: 'Notebook cape' }, { id: 'ribbon', name: 'Ribbon' }, { id: 'backpack', name: 'Backpack' }, { id: 'wings', name: 'Wings' },
];
export const FEET: { id: FeetId; name: string }[] = [
  { id: 'none', name: 'Bare' }, { id: 'sneakers', name: 'Sneakers' }, { id: 'boots', name: 'Boots' }, { id: 'bandaged', name: 'Bandaged' },
  { id: 'rocket', name: 'Rocket shoes' }, { id: 'flipflops', name: 'Flip-flops' },
];
export const BADGES: { id: BadgeId; name: string }[] = [
  { id: 'none', name: 'None' }, { id: 'belt', name: 'Champion belt' }, { id: 'sheriff', name: 'Sheriff star' }, { id: 'rank', name: 'Rank pin' },
];
export const SKINS: Record<SkinWeapon, { id: string; name: string }[]> = {
  staff: [{ id: 'default', name: 'Staff' }, { id: 'bamboo', name: 'Bamboo' }, { id: 'bone', name: 'Bone' }, { id: 'candy', name: 'Candy cane' }, { id: 'glow', name: 'Glow staff' }, { id: 'brush', name: 'Paintbrush' }, { id: 'broom', name: 'Broom' }],
  laser: [{ id: 'default', name: 'Blaster' }, { id: 'toy', name: 'Toy ray gun' }, { id: 'banana', name: 'Banana' }, { id: 'cannon', name: 'Hand cannon' }, { id: 'scrB', name: 'Scribble blue' }, { id: 'scrR', name: 'Scribble red' }, { id: 'scrG', name: 'Scribble green' }],
  hook: [{ id: 'default', name: 'Hook' }, { id: 'pirate', name: 'Pirate hook' }, { id: 'chain', name: 'Chain' }, { id: 'rod', name: 'Fishing rod' }, { id: 'anchor', name: 'Rope + anchor' }],
  fists: [{ id: 'default', name: 'Bare' }, { id: 'boxing', name: 'Boxing gloves' }, { id: 'oven', name: 'Oven mitts' }, { id: 'lobster', name: 'Lobster claws' }, { id: 'foam', name: 'Foam hands' }],
};
export const SKIN_WEAPONS: { id: SkinWeapon; name: string }[] = [{ id: 'fists', name: 'Fists' }, { id: 'staff', name: 'Staff' }, { id: 'laser', name: 'Laser' }, { id: 'hook', name: 'Hook' }];

/** What the renderers draw (kept in step with the save by applyHero). */
export const HERO_LOOK: { band: BandId; headgear: GearId; hands: HandsId; body: BodyId; back: BackId; feet: FeetId; badge: BadgeId; skins: Record<SkinWeapon, string>; rank: number } = {
  band: 'red', headgear: 'none', hands: 'none', body: 'male', back: 'none', feet: 'none', badge: 'none', skins: { staff: 'default', laser: 'default', hook: 'default', fists: 'default' }, rank: 0,
};

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

const SKINS_DEFAULT = (): Record<SkinWeapon, string> => ({ staff: 'default', laser: 'default', hook: 'default', fists: 'default' });
export const HERO_DEFAULT: HeroSave = { band: 'red', headgear: 'none', hands: 'none', traits: [null, null], body: 'male', back: 'none', feet: 'none', badge: 'none', skins: SKINS_DEFAULT() };

/** Validate a saved hero: unknown ids fall back to defaults, duplicate or unknown traits are dropped. */
export function sanitizeHero(raw: unknown): HeroSave {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HeroSave>;
  const pick = <T extends string>(v: unknown, list: { id: T }[], d: T): T => (list.some((o) => o.id === v) ? (v as T) : d);
  const traits: (string | null)[] = [];
  for (let i = 0; i < TRAIT_SLOTS; i++) {
    const id = Array.isArray(r.traits) ? r.traits[i] : null;
    traits.push(traitById(id) && !traits.includes(id as string) ? (id as string) : null);
  }
  const skins = SKINS_DEFAULT(), rs = (r.skins && typeof r.skins === 'object' ? r.skins : {}) as Record<string, unknown>;
  for (const w of SKIN_WEAPONS) skins[w.id] = pick(rs[w.id], SKINS[w.id], 'default');
  return {
    band: pick(r.band, BANDS, 'red'), headgear: pick(r.headgear, GEAR, 'none'), hands: pick(r.hands, HANDS, 'none'), traits,
    body: pick(r.body, BODIES, 'male'), back: pick(r.back, BACKS, 'none'), feet: pick(r.feet, FEET, 'none'), badge: pick(r.badge, BADGES, 'none'), skins,
  };
}
export function applyHero(h: HeroSave): void {
  HERO_LOOK.band = h.band; HERO_LOOK.headgear = h.headgear; HERO_LOOK.hands = h.hands;
  HERO_LOOK.body = h.body; HERO_LOOK.back = h.back; HERO_LOOK.feet = h.feet; HERO_LOOK.badge = h.badge; HERO_LOOK.skins = { ...h.skins };
}
