/** Persistent user settings (localStorage). */
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
  cheatGod: false,
  cheatRayGun: false,
  cheatNuke: false,
  page: 'auto',
  boil: true,
  highContrast: false,
};

const DEFAULTS_REV = 2;

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings> & { defaultsRev?: number };
      // Defaults revision 2: step rate 12 fps and Low attack smoothness. Older saves picked up the
      // previous defaults (20 fps / Normal) automatically, so they move to the new defaults once.
      if ((saved.defaultsRev ?? 0) < DEFAULTS_REV) { delete saved.stepRate; delete saved.attackSmooth; }
      Object.assign(settings, saved);
    }
  } catch { /* ignore */ }
}
export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...settings, defaultsRev: DEFAULTS_REV })); } catch { /* ignore */ }
}

const SAVE_KEY = 'jumpshot.save.v1';
export interface SaveData {
  highScore: number; tutorialDone: boolean; bestCombo: number; bestWave: number; padHintSeen: boolean;
  /** Equipped weapon (last loadout choice) and the weapons whose first-time tooltip was shown. */
  weapon: string; weaponTips: string[];
}
export const save: SaveData = { highScore: 0, tutorialDone: false, bestCombo: 0, bestWave: 0, padHintSeen: false, weapon: 'fists', weaponTips: [] };
export function loadSave(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(save, JSON.parse(raw));
  } catch { /* ignore */ }
}
export function writeSave(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
