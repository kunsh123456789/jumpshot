import { bossForWave, type EnemyKind } from './enemies';

/**
 * Wave composition. Waves 1-10 are hand-authored to introduce enemies;
 * later waves are generated from a growing budget. Every 5th wave has an
 * elite, every 10th a boss. The player never gets stronger during a run, so
 * the difficulty curve comes only from here: composition, a gentle HP and
 * damage ramp, and the attack-token count in WAVES_T.
 */
export interface WaveDef { enemies: EnemyKind[]; elite: boolean; boss: boolean }

const AUTHORED: EnemyKind[][] = [
  ['grunt', 'grunt', 'grunt'],
  ['grunt', 'grunt', 'rusher', 'grunt'],
  ['grunt', 'kicker', 'grunt', 'rusher', 'grunt'],
  ['brute', 'grunt', 'grunt', 'rusher', 'kicker'],
  ['elite', 'grunt', 'grunt', 'grunt'],
  ['thrower', 'grunt', 'grunt', 'kicker', 'rusher', 'grunt', 'kicker'],
  ['shield', 'grunt', 'grunt', 'thrower', 'grunt', 'rusher', 'kicker'],
  ['brute', 'shield', 'kicker', 'grunt', 'grunt', 'thrower', 'rusher', 'grunt'],
  ['brute', 'brute', 'grunt', 'grunt', 'rusher', 'rusher', 'kicker', 'thrower', 'shield'],
  ['boss', 'grunt'],
];

const POOL: { kind: EnemyKind; cost: number; from: number }[] = [
  { kind: 'grunt', cost: 1, from: 1 },
  { kind: 'rusher', cost: 1.4, from: 2 },
  { kind: 'kicker', cost: 1.5, from: 3 },
  { kind: 'brute', cost: 3, from: 4 },
  { kind: 'thrower', cost: 1.6, from: 6 },
  { kind: 'shield', cost: 2.2, from: 7 },
];

export const WAVE_GEN = {
  baseBudget: 6,
  budgetPerWave: 1.0,
  maxEnemies: 16,
  /** Enemy HP multiplier: +hpScalePerWave per wave after hpScaleFrom. */
  hpScaleFrom: 5,
  hpScalePerWave: 0.035,
  /** Enemy damage multiplier: +dmgScalePerWave per wave after wave 1, capped. */
  dmgScalePerWave: 0.025,
  dmgScaleMax: 1.6,
};

export function waveDef(wave: number, rand: () => number): WaveDef {
  const boss = wave % 10 === 0;
  const elite = !boss && wave % 5 === 0;
  if (wave <= AUTHORED.length) return { enemies: AUTHORED[wave - 1].slice(), elite, boss };
  let budget = WAVE_GEN.baseBudget + wave * WAVE_GEN.budgetPerWave;
  const list: EnemyKind[] = [];
  if (boss) { list.push(bossForWave(wave)); budget *= 0.35; }
  else if (elite) { list.push('elite'); budget -= 4; }
  const avail = POOL.filter((p) => p.from <= wave);
  while (budget > 0.9 && list.length < WAVE_GEN.maxEnemies) {
    const p = avail[Math.floor(rand() * avail.length)];
    if (p.cost > budget + 0.5) { if (p.kind === 'grunt') break; continue; }
    list.push(p.kind);
    budget -= p.cost;
  }
  return { enemies: list, elite, boss };
}

export function hpScale(wave: number): number {
  return 1 + Math.max(0, wave - WAVE_GEN.hpScaleFrom) * WAVE_GEN.hpScalePerWave;
}

export function dmgScale(wave: number): number {
  return Math.min(WAVE_GEN.dmgScaleMax, 1 + Math.max(0, wave - 1) * WAVE_GEN.dmgScalePerWave);
}

/** Hand-authored composition of waves 1-10 (null later: those are generated from the budget). */
export function authoredWave(wave: number): EnemyKind[] | null {
  return wave >= 1 && wave <= AUTHORED.length ? AUTHORED[wave - 1].slice() : null;
}

/** Enemy kinds a generated wave can draw from, and the kind (if any) that first appears on this wave. */
export function poolFor(wave: number): EnemyKind[] { return POOL.filter((p) => p.from <= wave).map((p) => p.kind); }
export function introducedOn(wave: number): EnemyKind | null { return POOL.find((p) => p.from === wave)?.kind ?? null; }

