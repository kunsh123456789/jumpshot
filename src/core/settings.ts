/** Persistent user settings (localStorage). */
import { HERO_LOOK, applyHero, heroDefault, sanitizeHero, type HeroSave } from '../data/hero';

export interface Settings {
  masterVolume: number;   // 0..1
  musicVolume: number;    // 0..1
  shake: number;          // 0..1.5 multiplier
  hitstop: number;        // 0..1.5 multiplier
  sensitivity: number;    // 0.5..1.6 (higher = softer/shorter flicks attack)
  padRegion: number;      // 0.35..0.6 fraction of the screen (from the bottom) used as the pad
  leftHanded: boolean;
  debug: boolean;
  reduceFlashes: boolean;
  /** Rhythm Mode (true) or Classic Mode (false). */
  rhythmMode: boolean;
  /** Rhythm Mode input latency calibration (ms, + = inputs register late). */
  rhythmOffset: number;
  /** Last built-in song picked in Rhythm Mode. */
  songId: string;
  /** Show the beat-track HUD in Rhythm Mode. */
  beatHud: boolean;
  /** Animation Style: stepped hand-drawn drawings, or the interpolated pose-to-pose system. */
  animStyle: 'drawn' | 'smooth';
  /** Hand-Drawn step rate (drawings per second, 8-20). */
  stepRate: number;
  /** Render look: low-res 1-bit ink page / the same ink page at full resolution / the previous smooth neon look. */
  look: 'pixel' | 'crisp' | 'smooth';
  /** Pixel Look resolution as a fraction of the 1280x720 logical view. */
  pixelRes: number;
  /** Hand-Drawn attacks: generated in-betweens and smear chains. */
  attackSmooth: 'low' | 'normal' | 'high';
  /** Fists drawings: the Reference v2 set (default) or the Legacy pass 5-7 drawings. */
  fistAnims: 'v2' | 'legacy';
  /** Sound effects: recorded samples (CC0, Freesound) or the original synthesized set. */
  sfxStyle: 'recorded' | 'synth';
  /** Weapon movesets: the reworked signature sets (default) or the original ones. */
  movesets: 'new' | 'original';
  /** What a tap / Space does: jump (double-tap or Shift+Space / F = dodge & parry), or the original dodge & parry. */
  tapAction: 'jump' | 'dodge';
  /** Cheats (all off by default; runs with any cheat on don't set high scores). */
  cheatGod: boolean;
  cheatRayGun: boolean;
  cheatNuke: boolean;
  /** Paper page: 'auto' rotates by wave (kraft on boss waves). */
  page: 'auto' | 'blank' | 'lined' | 'graph' | 'sketch' | 'kraft';
  /** Doodle / UI line boil (re-drawn at ~7 fps). */
  boil: boolean;
  /** High contrast: plain white paper, no doodles, darker lines. */
  highContrast: boolean;
  /**
   * Mobile Performance: renders at 1x pixel density, skips the Pixel Look's per-frame palette
   * snap (a GPU read-back), floor reflections and the menu blur. On by default on touch devices.
   */
  mobilePerf: boolean;
  /** Special: Assist = wider trace band + a longer fuse. */
  specialAssist: boolean;
}

/** Touch-first device (phones / tablets): turns Mobile Performance on by default. */
export function isTouchDevice(): boolean {
  try { return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820); } catch { return false; }
}

const KEY = 'jumpshot.settings.v1';

export const settings: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.45,
  shake: 1,
  hitstop: 1,
  sensitivity: 1,
  padRegion: 0.5,
  leftHanded: false,
  debug: false,
  reduceFlashes: false,
  rhythmMode: true,
  rhythmOffset: 0,
  songId: 'neon',
  beatHud: true,
  animStyle: 'drawn',
  stepRate: 12,
  look: 'pixel',
  pixelRes: 0.4,
  attackSmooth: 'low',
  fistAnims: 'v2',
  sfxStyle: 'recorded',
  movesets: 'new',
  tapAction: 'jump',
  cheatGod: false,
  cheatRayGun: false,
  cheatNuke: false,
  page: 'auto',
  boil: true,
  highContrast: false,
  mobilePerf: false,
  specialAssist: false,
};

const DEFAULTS_REV = 2;
const FACTORY: Settings = { ...settings };

/**
 * Put every setting back to its default (the cheat switches go off too). The Rhythm latency offset is kept:
 * it is a measurement of this device, not a preference. Saves, the hero and unlocked codes are untouched.
 */
export function resetSettingsToDefaults(): void {
  const offset = settings.rhythmOffset;
  Object.assign(settings, FACTORY);
  settings.rhythmOffset = offset;
  settings.mobilePerf = isTouchDevice();
  saveSettings();
}

export function loadSettings(): void {
  let hasChoice = false;
  try {
    const raw = localStorage.getItem(KEY);
    hasChoice = !!raw && 'mobilePerf' in JSON.parse(raw);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings> & { defaultsRev?: number };
      // Defaults revision 2: step rate 12 fps and Low attack smoothness. Older saves picked up the
      // previous defaults (20 fps / Normal) automatically, so they move to the new defaults once.
      if ((saved.defaultsRev ?? 0) < DEFAULTS_REV) { delete saved.stepRate; delete saved.attackSmooth; }
      Object.assign(settings, saved);
    }
  } catch { /* ignore */ }
  // Never chosen yet (new players and saves from before the setting): follow the device.
  if (!hasChoice) settings.mobilePerf = isTouchDevice();
}
export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...settings, defaultsRev: DEFAULTS_REV })); } catch { /* ignore */ }
}

const SAVE_KEY = 'jumpshot.save.v1';
export interface SaveData {
  highScore: number; tutorialDone: boolean; bestCombo: number; bestWave: number; padHintSeen: boolean;
  /** Equipped weapon (last loadout choice) and the weapons whose first-time tooltip was shown. */
  weapon: string; weaponTips: string[];
  /** Easter-egg cheats unlocked by code (their Settings switches stay hidden until then). */
  cheatsUnlocked: string[];
  /** The first-READY Special hint was shown. */
  specialHintSeen?: boolean;
  /** The character: cosmetics and the two trait slots (data/hero.ts). */
  hero: HeroSave;
  /** Training room: the last target picked ('dummy' | 'bag' | '' for the stick figure). */
  trainTarget?: '' | 'dummy' | 'bag';
  /** Best style rank ever reached (index into STYLE.ranks): the Rank pin cosmetic shows it. */
  bestRank?: number;
}
export const save: SaveData = { highScore: 0, tutorialDone: false, bestCombo: 0, bestWave: 0, padHintSeen: false, weapon: 'fists', weaponTips: [], cheatsUnlocked: [], hero: heroDefault() };
export function loadSave(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(save, JSON.parse(raw));
  } catch { /* ignore */ }
  save.hero = sanitizeHero(save.hero);
  applyHero(save.hero);
  HERO_LOOK.rank = typeof save.bestRank === 'number' ? save.bestRank : 0;
}
/** Remember a new best style rank (for the Rank pin). */
export function noteRank(rank: number): void {
  if (rank <= (save.bestRank ?? 0)) return;
  save.bestRank = rank; HERO_LOOK.rank = rank; writeSave();
}
/**
 * Reset the whole game: delete everything it ever stored in this browser (settings, high score,
 * tutorial progress, unlocked codes, weapon choice), then reload as a first launch.
 */
export function wipeAllAndReload(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('jumpshot')) keys.push(k); }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* storage blocked: nothing was saved anyway */ }
  location.reload();
}
/** Change the hero's cosmetics or traits: validated, applied to the renderers and saved. */
export function updateHero(patch: Partial<HeroSave>): void {
  save.hero = sanitizeHero({ ...save.hero, ...patch });
  applyHero(save.hero);
  writeSave();
}
/** Reset the character: every cosmetic, colour, skin and both trait slots back to the defaults. */
export function resetHero(): void {
  save.hero = heroDefault();
  applyHero(save.hero);
  writeSave();
}
export function writeSave(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
