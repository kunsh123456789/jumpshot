import type { WeaponDef, WeaponId } from './types';
import { registerAnims } from '../anims';
import { SMEAR_BY_ANIM } from '../smears';
import { fists } from './fists';
import { staff } from './staff';
import { laser } from './laser';
import { hook } from './hook';
import { raygun } from './raygun';
import { whip } from './whip';
import { hammer } from './hammer';
import { daggers } from './daggers';
import { ice } from './ice';
import { scythe } from './scythe';
import { cape, fan, earth } from './clip3Weapons';
import { settings } from '../../core/settings';
import { reactionAnims } from './reactions';
import { MOVESETS2 } from './movesets2';

/** Every weapon, in loadout order. All are unlocked from the start. */
export const WEAPON_ORDER: WeaponId[] = ['fists', 'hook', 'staff', 'laser', 'whip', 'hammer', 'daggers', 'ice', 'scythe'];
export const WEAPONS: Record<WeaponId, WeaponDef> = {} as Record<WeaponId, WeaponDef>;
for (const w of [fists, hook, staff, laser, raygun, whip, hammer, daggers, ice, scythe, cape, fan, earth]) {
  WEAPONS[w.id] = w;
  if (MOVESETS2[w.id]) w.v2 = MOVESETS2[w.id];
  registerAnims(w.anims, `weapon: ${w.name}`);
  Object.assign(SMEAR_BY_ANIM, w.smears);
  if (w.v2) { registerAnims(w.v2.anims, `weapon: ${w.name} (new moveset)`); Object.assign(SMEAR_BY_ANIM, w.v2.smears ?? {}); }
}

/** The weapon as played: the reworked moveset swapped in when Settings -> Movesets is New. */
const ACTIVE = new Map<string, WeaponDef>();
export function activeDef(w: WeaponDef): WeaponDef {
  if (settings.movesets === 'original' || !w.v2) return w;
  let a = ACTIVE.get(w.id);
  if (!a) {
    const v = w.v2;
    a = { ...w, desc: v.desc, ground: v.ground, air: v.air, dodge: v.dodge, tips: v.tips, passive: v.passive };
    ACTIVE.set(w.id, a);
  }
  return a;
}

registerAnims(reactionAnims, 'weapon: enemy reactions');

/** Weapons offered in the loadout and the swap strip (the Ray Gun only with its cheat on). */
/** Clip 3 weapons: offered only in the Pixel look (the player's rule: new things go to the Pixel style). */
export const PIXEL_WEAPONS: WeaponId[] = ['cape', 'fan', 'earth'];
export function availableWeapons(): WeaponId[] {
  const base = settings.look === 'pixel' ? [...WEAPON_ORDER, ...PIXEL_WEAPONS] : WEAPON_ORDER;
  return settings.cheatRayGun ? [...base, 'raygun'] : base;
}

export function weaponById(id: string): WeaponDef {
  if (id === 'raygun' && !settings.cheatRayGun) return activeDef(WEAPONS.fists);
  if ((PIXEL_WEAPONS as string[]).includes(id) && settings.look !== 'pixel') return activeDef(WEAPONS.fists);
  return activeDef(WEAPONS[id as WeaponId] ?? WEAPONS.fists);
}
export type { WeaponDef, WeaponId } from './types';
