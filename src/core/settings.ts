/** Persistent user settings (localStorage). */
export interface Settings {
  masterVolume: number;   // 0..1
  musicVolume: number;    // 0..1
  shake: number;          // 0..1.5 multiplier
  hitstop: number;        // 0..1.5 multiplier
  sensitivity: number;    // 0.5..1.6 (higher = shorter swipes commit)
  leftHanded: boolean;
  debug: boolean;
  reduceFlashes: boolean;
}

const KEY = 'jumpshot.settings.v1';

export const settings: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.45,
  shake: 1,
  hitstop: 1,
  sensitivity: 1,
  leftHanded: false,
  debug: false,
  reduceFlashes: false,
};

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw));
  } catch { /* ignore */ }
}
export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

const SAVE_KEY = 'jumpshot.save.v1';
export interface SaveData { highScore: number; tutorialDone: boolean; bestCombo: number; bestWave: number }
export const save: SaveData = { highScore: 0, tutorialDone: false, bestCombo: 0, bestWave: 0 };
export function loadSave(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) Object.assign(save, JSON.parse(raw));
  } catch { /* ignore */ }
}
export function writeSave(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
