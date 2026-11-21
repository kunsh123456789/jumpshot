import type { WeaponDef, WeaponId } from './types';
import { registerAnims } from '../anims';
import { SMEAR_BY_ANIM } from '../smears';
import { fists } from './fists';
import { staff } from './staff';
import { laser } from './laser';
import { throwGloves } from './throw';
import { hook } from './hook';
import { raygun } from './raygun';
import { whip } from './whip';
import { hammer } from './hammer';
import { daggers } from './daggers';
import { shield } from './shield';
import { brush } from './brush';
import { yoyo } from './yoyo';
import { bubble } from './bubble';
import { rocket } from './rocket';
import { ice } from './ice';
import { planes } from './planes';
import { thunder } from './thunder';
import { scythe } from './scythe';
import { settings } from '../../core/settings';
import { reactionAnims } from './reactions';

/** Every weapon, in loadout order. All are unlocked from the start. */
export const WEAPON_ORDER: WeaponId[] = ['fists', 'hook', 'throw', 'staff', 'laser', 'whip', 'hammer', 'daggers', 'shield', 'brush', 'yoyo', 'bubble', 'rocket', 'ice', 'planes', 'thunder', 'scythe'];
export const WEAPONS: Record<WeaponId, WeaponDef> = {} as Record<WeaponId, WeaponDef>;
for (const w of [fists, hook, throwGloves, staff, laser, raygun, whip, hammer, daggers, shield, brush, yoyo, bubble, rocket, ice, planes, thunder, scythe]) {
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
