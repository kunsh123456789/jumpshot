import type { Fighter } from './fighter';
import type { MoveDef } from '../data/moves';

/** Events emitted by the simulation for presentation (fx, audio, HUD). */
export interface HitEvent {
  attacker: Fighter;
  victim: Fighter;
  x: number; y: number;
  dirX: number; dirY: number;
  /** 0..1+ weight for juice scaling. */
  weight: number;
  damage: number;
  crit: boolean;
  move: MoveDef | null;
  combo: number;
  kind: 'normal' | 'launch' | 'spike' | 'finisher' | 'bowl' | 'shock' | 'reflect' | 'armor' | 'enemy';
  shake: number;
  hitstop: number;
  zoom: number;
}

export interface SimEvents {
  hit: HitEvent;
  block: { x: number; y: number; victim: Fighter };
  whoosh: { x: number; y: number; weight: number; fighter: Fighter };
  afterimage: { fighter: Fighter };
  groundImpact: { x: number; y: number; power: number; fighter: Fighter; bounce: boolean };
  wallImpact: { x: number; y: number; power: number; dir: number };
  shockwave: { x: number; y: number; radius: number; color: string; power: number };
  ko: { x: number; y: number; victim: Fighter; last: boolean };
  dissolve: { x: number; y: number; victim: Fighter };
  playerHurt: { damage: number; x: number; y: number; dirX: number };
  parry: { x: number; y: number; projectile: boolean };
  dodge: { x: number; y: number };
  telegraph: { enemy: Fighter };
  burst: { x: number; y: number; enemy: Fighter };
  poiseBreak: { x: number; y: number; enemy: Fighter };
  guardBreak: { x: number; y: number; enemy: Fighter };
  finisher: { kind: 'jumpshot' | 'flurry'; x: number; y: number };
  rankUp: { rank: number };
  comboEnd: { hits: number; damage: number; maxRank: number; bonus: number; finisher: boolean };
  pickup: { kind: 'health' | 'orb'; x: number; y: number };
  projectile: { x: number; y: number; kind: 'throw' | 'reflect' };
  meteorWarn: { x: number };
  meteor: { x: number; y: number };
  waveStart: { wave: number; boss: boolean; elite: boolean };
  waveClear: { wave: number };
  bossPhase: { phase: number };
  spawn: { enemy: Fighter };
  chain: { x1: number; y1: number; x2: number; y2: number };
  text: { text: string; x: number; y: number; color: string; size: number };
}
