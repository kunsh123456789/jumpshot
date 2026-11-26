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
import { settings } from '../../core/settings';
import { reactionAnims } from './reactions';

/** Every weapon, in loadout order. All are unlocked from the start. */
export const WEAPON_ORDER: WeaponId[] = ['fists', 'hook', 'staff', 'laser', 'whip', 'hammer', 'daggers', 'ice', 'scythe'];
export const WEAPONS: Record<WeaponId, WeaponDef> = {} as Record<WeaponId, WeaponDef>;
for (const w of [fists, hook, staff, laser, raygun, whip, hammer, daggers, ice, scythe]) {
  WEAPONS[w.id] = w;
  registerAnims(w.anims, `weapon: ${w.name}`);
  Object.assign(SMEAR_BY_ANIM, w.smears);
}

registerAnims(reactionAnims, 'weapon: enemy reactions');

/** Weapons offered in the loadout and the swap strip (the Ray Gun only with its cheat on). */
export function availableWeapons(): WeaponId[] {
  return settings.cheatRayGun ? [...WEAPON_ORDER, 'raygun'] : WEAPON_ORDER;
}

export function weaponById(id: string): WeaponDef {
  if (id === 'raygun' && !settings.cheatRayGun) return WEAPONS.fists;
  return WEAPONS[id as WeaponId] ?? WEAPONS.fists;
}
export type { WeaponDef, WeaponId } from './types';
