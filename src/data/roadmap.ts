import { bossForWave, ENEMIES, type EnemyKind } from './enemies';
import { authoredWave, dmgScale, hpScale, introducedOn, poolFor, WAVE_GEN } from './waves';
import { PAGE_ORDER, PAGES, type PageId } from './paper';
import { WAVES_T } from './tuning';

/**
 * The level roadmap (title screen -> ROADMAP): every wave from 1 to 40 (one full boss cycle), built
 * from the real wave, enemy, page and arena tables so it can never drift from what the game does.
 */
export interface RoadNode {
  wave: number;
  kind: 'wave' | 'elite' | 'boss';
  /** Stage = a block of ten waves ending in a boss (1-4 in the first cycle). */
  stage: number;
  arena: string;
  page: string;
  /** Hand-authored waves list their enemies; later waves are generated from a budget. */
  enemies: string;
  /** An enemy kind that first appears on this wave. */
  newEnemy: string | null;
  boss: { name: string; sub: string; note: string } | null;
  hp: number;
  dmg: number;
}

/** 'THE COLOSSUS' -> 'Colossus', 'RONIN' -> 'Ronin', 'Grunt' -> 'Grunt'. */
const NAME = (k: EnemyKind): string => { const n = ENEMIES[k].name.replace(/^THE /, '').toLowerCase(); return n[0].toUpperCase() + n.slice(1); };

function countList(list: EnemyKind[]): string {
  const c = new Map<EnemyKind, number>();
  for (const k of list) c.set(k, (c.get(k) ?? 0) + 1);
  return [...c.entries()].map(([k, n]) => (n > 1 ? `${n}× ` : '') + NAME(k)).join(', ');
}

function bossNote(kind: EnemyKind): string {
  const b = ENEMIES[kind].boss;
  if (!b) return '';
  const bits: string[] = [];
  if (b.meteors > 0) bits.push('from phase 2 it calls METEORS: a red zone and a countdown show where and when (jump them)');
  if (b.summon) bits.push(`summons ${b.summon.kinds.map(NAME).join(' and ')}`);
  if (b.blink) bits.push('teleports away when you get close');
  if (b.dodge > 0) bits.push('slips some hits');
  if (kind === 'juggernaut') bits.push('armored charges: dodge one and he crashes into the wall, stunned');
  return bits.join(' · ');
}

export function roadNode(wave: number, arenas: readonly string[]): RoadNode {
  const boss = wave % 10 === 0;
  const elite = !boss && wave % 5 === 0;
  const a = authoredWave(wave);
  const pool = poolFor(wave).map(NAME);
  const budget = Math.round(WAVE_GEN.baseBudget + wave * WAVE_GEN.budgetPerWave);
  let enemies: string;
  if (a) enemies = countList(a);
  else if (boss) enemies = `${NAME(bossForWave(wave))} + helpers`;
  else enemies = `${elite ? 'Ronin + ' : ''}a mixed crowd (budget ${budget}) of ${pool.join(', ')}`;
  const pageId: PageId = boss ? 'kraft' : PAGE_ORDER[Math.floor((wave - 1) / WAVES_T.arenaRotateEvery) % PAGE_ORDER.length];
  const bk = bossForWave(wave);
  const spec = ENEMIES[bk].boss;
  const intro = introducedOn(wave);
  return {
    wave, kind: boss ? 'boss' : elite ? 'elite' : 'wave', stage: Math.ceil(wave / 10),
    arena: arenas[Math.floor((wave - 1) / WAVES_T.arenaRotateEvery) % arenas.length],
    page: PAGES.find((p) => p.id === pageId)?.name.replace(/ \(.*$/, '') ?? pageId,
    enemies, newEnemy: intro ? NAME(intro) : wave === 5 ? 'Ronin (elite)' : null,
    boss: boss && spec ? { name: spec.title, sub: spec.sub, note: bossNote(bk) } : null,
    hp: Math.round(hpScale(wave) * 100), dmg: Math.round(dmgScale(wave) * 100),
  };
}

/** What follows wave 40: the cycle repeats (same bosses, more HP). */
export function afterRoad(): string {
  return `After wave 40 the bosses come back in the same order (${NAME(bossForWave(50))} at 50), every wave keeps scaling, and there is no final wave.`;
}
