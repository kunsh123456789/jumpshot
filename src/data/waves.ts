import type { EnemyKind } from './enemies';

/**
 * Wave composition. Waves 1-10 are hand-authored to introduce enemies;
 * later waves are generated from a growing budget. Every 5th wave has an
 * elite, every 10th a boss.
 */
export interface WaveDef { enemies: EnemyKind[]; elite: boolean; boss: boolean }

const AUTHORED: EnemyKind[][] = [
  ['grunt', 'grunt', 'grunt'],
  ['grunt', 'grunt', 'rusher', 'grunt'],
  ['grunt', 'kicker', 'grunt', 'rusher', 'grunt'],
  ['brute', 'grunt', 'grunt', 'rusher', 'kicker'],
  ['elite', 'grunt', 'grunt', 'grunt'],
  ['thrower', 'grunt', 'grunt', 'kicker', 'rusher', 'grunt'],
  ['shield', 'grunt', 'grunt', 'thrower', 'grunt', 'rusher'],
  ['brute', 'shield', 'kicker', 'grunt', 'grunt', 'thrower', 'rusher'],
  ['brute', 'brute', 'grunt', 'grunt', 'rusher', 'rusher', 'kicker', 'thrower'],
  ['boss', 'grunt', 'grunt'],
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
  budgetPerWave: 1.15,
  maxEnemies: 16,
  /** HP multiplier per wave after 10. */
  hpScalePerWave: 0.06,
};

export function waveDef(wave: number, rand: () => number): WaveDef {
  const boss = wave % 10 === 0;
  const elite = !boss && wave % 5 === 0;
  if (wave <= AUTHORED.length) return { enemies: AUTHORED[wave - 1].slice(), elite, boss };
  let budget = WAVE_GEN.baseBudget + wave * WAVE_GEN.budgetPerWave;
  const list: EnemyKind[] = [];
  if (boss) { list.push('boss'); budget *= 0.35; }
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
  return 1 + Math.max(0, wave - 10) * WAVE_GEN.hpScalePerWave;
}
