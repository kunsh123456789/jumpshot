/**
 * Built-in Rhythm Mode songs. A song is a list of sections; each section has
 * its own tempo, time signature, chord progression and fight intensity. After
 * the last section the song loops back to `loopFrom`, so it never runs out
 * mid-fight. The synth patterns live in rhythm/synth.ts and read `kind` and
 * `intensity`.
 */
export type SectionKind = 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'bridge';

export interface SectionDef {
  name: string;
  kind: SectionKind;
  bars: number;
  bpm: number;
  /** Beats per bar (time signature numerator over a quarter-note pulse). */
  beatsPerBar: number;
  /** 0..1: music layers, enemy aggression, groove pulse. */
  intensity: number;
  /** Chord root per bar, in semitones above the song key (cycled). */
  chords: number[];
}

export interface SongDef {
  id: string;
  name: string;
  desc: string;
  style: 'dojo' | 'neon' | 'volcano';
  /** Key root (Hz) for bass; melodies and tuned hits are built from it. */
  keyHz: number;
  /** Scale degrees in semitones (tuned hit sounds walk this scale). */
  scale: number[];
  sections: SectionDef[];
  loopFrom: number;
}

const MINOR_PENT = [0, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

export const SONGS: SongDef[] = [
  {
    id: 'dojo', name: 'DOJO PULSE', desc: '100 BPM · easiest · has a 3/4 bridge', style: 'dojo',
    keyHz: 65.41, scale: MINOR_PENT, loopFrom: 1,
    sections: [
      { name: 'INTRO', kind: 'intro', bars: 4, bpm: 100, beatsPerBar: 4, intensity: 0.25, chords: [0, 0, 3, -2] },
      { name: 'VERSE', kind: 'verse', bars: 8, bpm: 100, beatsPerBar: 4, intensity: 0.45, chords: [0, 0, 3, -2, 0, 0, 5, 3] },
      { name: 'BUILD', kind: 'build', bars: 4, bpm: 100, beatsPerBar: 4, intensity: 0.7, chords: [5, 5, 7, 7] },
      { name: 'DROP', kind: 'drop', bars: 8, bpm: 100, beatsPerBar: 4, intensity: 1, chords: [0, 3, 5, 3, 0, 3, 7, 5] },
      { name: 'WALTZ BRIDGE', kind: 'bridge', bars: 8, bpm: 100, beatsPerBar: 3, intensity: 0.35, chords: [0, 0, 3, 3, 5, 5, 3, -2] },
      { name: 'DROP II', kind: 'drop', bars: 8, bpm: 100, beatsPerBar: 4, intensity: 1, chords: [0, 3, 5, 3, 0, 3, 7, 5] },
      { name: 'BREAK', kind: 'break', bars: 4, bpm: 100, beatsPerBar: 4, intensity: 0.2, chords: [0, -2, -4, -2] },
    ],
  },
  {
    id: 'neon', name: 'NEON RUSH', desc: '124 BPM · four-on-the-floor', style: 'neon',
    keyHz: 55, scale: DORIAN, loopFrom: 1,
    sections: [
      { name: 'INTRO', kind: 'intro', bars: 4, bpm: 124, beatsPerBar: 4, intensity: 0.3, chords: [0, 0, -4, -2] },
      { name: 'VERSE', kind: 'verse', bars: 8, bpm: 124, beatsPerBar: 4, intensity: 0.5, chords: [0, 0, -4, -2] },
      { name: 'BUILD', kind: 'build', bars: 4, bpm: 124, beatsPerBar: 4, intensity: 0.75, chords: [-4, -2, 0, 2] },
      { name: 'DROP', kind: 'drop', bars: 8, bpm: 124, beatsPerBar: 4, intensity: 1, chords: [0, 0, -4, -2, 0, 3, -4, -2] },
      { name: 'BREAKDOWN', kind: 'break', bars: 4, bpm: 124, beatsPerBar: 4, intensity: 0.2, chords: [-4, -4, -2, -2] },
      { name: 'DROP II', kind: 'drop', bars: 8, bpm: 124, beatsPerBar: 4, intensity: 1, chords: [0, 0, -4, -2, 0, 3, -4, -2] },
    ],
  },
  {
    id: 'volcano', name: 'VOLCANO BREAKER', desc: '140 → 150 BPM · hardest · tempo change', style: 'volcano',
    keyHz: 41.2, scale: MINOR_PENT, loopFrom: 1,
    sections: [
      { name: 'INTRO', kind: 'intro', bars: 4, bpm: 140, beatsPerBar: 4, intensity: 0.35, chords: [0, 0, 3, -2] },
      { name: 'VERSE', kind: 'verse', bars: 8, bpm: 140, beatsPerBar: 4, intensity: 0.6, chords: [0, 0, 3, -2] },
      { name: 'BUILD', kind: 'build', bars: 4, bpm: 140, beatsPerBar: 4, intensity: 0.8, chords: [5, 5, 7, 7] },
      { name: 'ERUPTION', kind: 'drop', bars: 8, bpm: 140, beatsPerBar: 4, intensity: 1, chords: [0, 3, -2, 5] },
      { name: 'CALDERA', kind: 'break', bars: 4, bpm: 140, beatsPerBar: 4, intensity: 0.25, chords: [0, -2, -4, -5] },
      { name: 'OVERDRIVE', kind: 'drop', bars: 8, bpm: 150, beatsPerBar: 4, intensity: 1, chords: [0, 3, -2, 5] },
    ],
  },
];

/** Calibration metronome: one endless 4/4 section, clicks only. */
export const METRONOME_SONG = (bpm: number): SongDef => ({
  id: 'metronome', name: 'METRONOME', desc: '', style: 'neon', keyHz: 55, scale: [0], loopFrom: 0,
  sections: [{ name: 'CLICK', kind: 'verse', bars: 64, bpm, beatsPerBar: 4, intensity: 0, chords: [0] }],
});
