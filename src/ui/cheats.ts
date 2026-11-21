import { settings, saveSettings, save, writeSave } from '../core/settings';

/**
 * Easter-egg cheat codes. Type a code anywhere (keyboard), or tap the title
 * logo 5 times for a code box (touch). A code toggles its cheat; the first
 * time it also unlocks the cheat's switch in Settings -> Cheats, which stays
 * hidden until something is unlocked. Cheated runs never set records.
 */
export type CheatKey = 'cheatRayGun' | 'cheatNuke' | 'cheatGod';
export const CHEATS: { code: string; key: CheatKey; name: string }[] = [
  { code: 'RAYGUN', key: 'cheatRayGun', name: 'RAY GUN' },
  { code: 'NUKE', key: 'cheatNuke', name: 'NUKE' },
  { code: 'IMMORTAL', key: 'cheatGod', name: 'NEVER DIE' },
];
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

export function isUnlocked(key: CheatKey): boolean { return save.cheatsUnlocked.includes(key); }
export function anyUnlocked(): boolean { return save.cheatsUnlocked.length > 0; }

/** Locked cheats are always off (e.g. switches left on by an older build). */
export function enforceLocks(): void {
  let changed = false;
  for (const c of CHEATS) if (settings[c.key] && !isUnlocked(c.key)) { settings[c.key] = false; changed = true; }
  if (changed) saveSettings();
}

function toggle(c: (typeof CHEATS)[number], force?: boolean): string {
  if (!isUnlocked(c.key)) { save.cheatsUnlocked.push(c.key); writeSave(); }
  settings[c.key] = force ?? !settings[c.key];
  saveSettings();
  return `${c.name} ${settings[c.key] ? 'ON' : 'OFF'}`;
}

/** Enter a typed code. Returns a message, or null if it isn't a code. */
export function enterCode(text: string): string | null {
  const t = text.toUpperCase().replace(/[^A-Z]/g, '');
  const c = CHEATS.find((x) => x.code === t);
  return c ? toggle(c) : null;
}

/** Watches keystrokes for codes typed anywhere. */
export class CodeListener {
  private buf = '';
  private keys: string[] = [];
  constructor(private onMessage: (msg: string) => void) {}
  feed(code: string, key: string): void {
    this.keys.push(code);
    if (this.keys.length > KONAMI.length) this.keys.shift();
    if (this.keys.length === KONAMI.length && this.keys.every((k, i) => k === KONAMI[i])) {
      this.keys.length = 0;
      for (const c of CHEATS) toggle(c, true);
      this.onMessage('ALL CHEATS ON');
      return;
    }
    if (key.length !== 1 || !/[a-z]/i.test(key)) return;
    this.buf = (this.buf + key.toUpperCase()).slice(-12);
    for (const c of CHEATS) {
      if (this.buf.endsWith(c.code)) { this.buf = ''; this.onMessage(toggle(c)); return; }
    }
  }
}
