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
  comboEnd: { hits: number; damage: number; maxRank: number; bonus: number; finisher: boolean; dropped: boolean };
  pickup: { kind: 'health' | 'orb'; x: number; y: number };
  projectile: { x: number; y: number; kind: 'throw' | 'reflect' };
  meteorWarn: { x: number };
  meteor: { x: number; y: number };
  waveStart: { wave: number; boss: boolean; elite: boolean };
  waveClear: { wave: number };
  bossPhase: { phase: number };
  spawn: { enemy: Fighter };
  text: { text: string; x: number; y: number; color: string; size: number };
  // ---- weapons (revision pass 7) ----
  beam: { x1: number; y1: number; x2: number; y2: number; width: number; heavy: boolean; color: string; hit: boolean };
  overheat: { x: number; y: number };
  grab: { x: number; y: number; victim: Fighter };
  throw: { x: number; y: number; victim: Fighter; heavy: boolean };
  hookFire: { x: number; y: number; x2: number; y2: number; hit: boolean };
  pullArrive: { x: number; y: number; victim: Fighter };
  deflect: { x: number; y: number };
  /** A weapon's signature slow-mo moment (hook yank, big throw, charged beam, vault apex). */
  weaponMoment: { scale: number; sec: number; x: number; y: number };
  weaponSwap: { id: string };
}
