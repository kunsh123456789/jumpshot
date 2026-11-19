/**
 * Roguelite upgrades. Each modifies the shared Stats object that the sim reads.
 * Stats default to neutral values; upgrades stack up to maxStacks.
 */
export interface Stats {
  cancelEarly: number;        // frames earlier cancel windows open
  launchMult: number;         // launcher velocity multiplier
  airStallBonus: number;      // extra stall frames per air hit
  extraGroundBounces: number;
  extraWallBounces: number;
  spikeShockRadius: number;   // 0 = no shockwave on regular spikes
  finisherRadiusMult: number;
  parryWindowBonus: number;
  bowlMult: number;           // enemy-enemy collision damage/knockback multiplier
  superGain: number;
  finisherHeal: number;       // fraction of max HP healed per finisher
  chainLightning: number;     // number of arcs on heavy hits
  dashRange: number;          // targeting/magnet range multiplier
  heavyDamage: number;
  comboTimeoutBonus: number;  // frames
  styleGain: number;
  maxHpBonus: number;
  juggleDecayMult: number;    // < 1 = juggles last longer
  critChance: number;
  critWindowBonus: number;    // frames added to post-parry crit window
  parryHeal: number;          // hp per perfect parry
  dodgeStrike: number;        // damage dealt to enemies you dodge through
  koBlast: number;            // radius of explosion when an enemy is KO'd (0 = none)
  lightDamage: number;
}

export function baseStats(): Stats {
  return {
    cancelEarly: 0, launchMult: 1, airStallBonus: 0, extraGroundBounces: 0, extraWallBounces: 0,
    spikeShockRadius: 0, finisherRadiusMult: 1, parryWindowBonus: 0, bowlMult: 1, superGain: 1,
    finisherHeal: 0, chainLightning: 0, dashRange: 1, heavyDamage: 1, comboTimeoutBonus: 0,
    styleGain: 1, maxHpBonus: 0, juggleDecayMult: 1, critChance: 0, critWindowBonus: 0,
    parryHeal: 0, dodgeStrike: 0, koBlast: 0, lightDamage: 1,
  };
}

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tag: 'COMBO' | 'AIR' | 'DEFENSE' | 'POWER' | 'STYLE' | 'CROWD';
  maxStacks: number;
  weight: number;
  apply: (s: Stats) => void;
  /** Applied once to the player when picked (heals etc). */
  onPick?: 'fullHeal';
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'quickHands', name: 'Quick Hands', icon: '⚡', tag: 'COMBO', maxStacks: 3, weight: 1,
    desc: 'Cancel windows open 3 frames earlier. Chains flow faster.', apply: (s) => { s.cancelEarly += 3; } },
  { id: 'skyHigh', name: 'Sky High', icon: '🚀', tag: 'AIR', maxStacks: 3, weight: 1,
    desc: 'Launchers send enemies 18% higher. More room to juggle.', apply: (s) => { s.launchMult += 0.18; } },
  { id: 'featherFall', name: 'Feather Fall', icon: '🪶', tag: 'AIR', maxStacks: 3, weight: 1,
    desc: '+6 frames of air-stall on every air hit. Floaty juggles.', apply: (s) => { s.airStallBonus += 6; } },
  { id: 'rubberFloor', name: 'Rubber Floor', icon: '🏀', tag: 'AIR', maxStacks: 2, weight: 1,
    desc: '+1 ground bounce per combo. Spikes bounce back up again.', apply: (s) => { s.extraGroundBounces += 1; } },
  { id: 'pinball', name: 'Pinball', icon: '🧱', tag: 'CROWD', maxStacks: 2, weight: 1,
    desc: '+1 wall bounce per combo. Send them flying off the walls.', apply: (s) => { s.extraWallBounces += 1; } },
  { id: 'craterMaker', name: 'Crater Maker', icon: '☄️', tag: 'POWER', maxStacks: 3, weight: 1,
    desc: 'Spikes create a shockwave on impact (bigger each stack). Finisher radius +25%.', apply: (s) => { s.spikeShockRadius += 120; s.finisherRadiusMult += 0.25; } },
  { id: 'ironReflex', name: 'Iron Reflex', icon: '🛡️', tag: 'DEFENSE', maxStacks: 3, weight: 1,
    desc: 'Perfect-parry window +4 frames.', apply: (s) => { s.parryWindowBonus += 4; } },
  { id: 'bowlingChamp', name: 'Bowling Champ', icon: '🎳', tag: 'CROWD', maxStacks: 3, weight: 1,
    desc: 'Enemy-into-enemy collisions deal double damage and knock harder.', apply: (s) => { s.bowlMult += 1; } },
  { id: 'overdrive', name: 'Overdrive', icon: '🔋', tag: 'STYLE', maxStacks: 3, weight: 1,
    desc: 'Super Meter gain +40%. Finishers come sooner.', apply: (s) => { s.superGain += 0.4; } },
  { id: 'vampire', name: 'Vampire Finish', icon: '🩸', tag: 'DEFENSE', maxStacks: 2, weight: 0.9,
    desc: 'Finishers heal 15% of max HP.', apply: (s) => { s.finisherHeal += 0.15; } },
  { id: 'chainLightning', name: 'Chain Lightning', icon: '🌩️', tag: 'CROWD', maxStacks: 3, weight: 1,
    desc: 'Heavy hits arc lightning to 2 more nearby enemies (+1 per stack).', apply: (s) => { s.chainLightning += s.chainLightning === 0 ? 2 : 1; } },
  { id: 'longReach', name: 'Long Reach', icon: '🎯', tag: 'COMBO', maxStacks: 2, weight: 1,
    desc: 'Attack magnetism range +35%. Dash onto far targets.', apply: (s) => { s.dashRange += 0.35; } },
  { id: 'heavyHands', name: 'Heavy Hands', icon: '🥊', tag: 'POWER', maxStacks: 3, weight: 1,
    desc: 'Heavy moves deal +30% damage.', apply: (s) => { s.heavyDamage += 0.3; } },
  { id: 'comboKeeper', name: 'Combo Keeper', icon: '⏳', tag: 'STYLE', maxStacks: 2, weight: 1,
    desc: 'Combos last 0.75s longer without a hit.', apply: (s) => { s.comboTimeoutBonus += 45; } },
  { id: 'showboat', name: 'Showboat', icon: '🌟', tag: 'STYLE', maxStacks: 3, weight: 1,
    desc: 'Style gain +30%. Hit SSS faster.', apply: (s) => { s.styleGain += 0.3; } },
  { id: 'secondWind', name: 'Second Wind', icon: '❤️', tag: 'DEFENSE', maxStacks: 3, weight: 0.9,
    desc: '+25 max HP and fully heal now.', apply: (s) => { s.maxHpBonus += 25; }, onPick: 'fullHeal' },
  { id: 'juggler', name: 'Juggler', icon: '🤹', tag: 'AIR', maxStacks: 2, weight: 1,
    desc: 'Juggle decay reduced by 35%. Air combos last longer.', apply: (s) => { s.juggleDecayMult *= 0.65; } },
  { id: 'criticalEye', name: 'Critical Eye', icon: '👁️', tag: 'POWER', maxStacks: 3, weight: 1,
    desc: '+10% chance for any hit to crit (1.8x damage).', apply: (s) => { s.critChance += 0.1; } },
  { id: 'counterSurge', name: 'Counter Surge', icon: '🔁', tag: 'DEFENSE', maxStacks: 2, weight: 0.9,
    desc: 'Post-parry crit window +0.5s and parries heal 6 HP.', apply: (s) => { s.critWindowBonus += 30; s.parryHeal += 6; } },
  { id: 'afterburn', name: 'Afterburn', icon: '🔥', tag: 'DEFENSE', maxStacks: 2, weight: 0.9,
    desc: 'Dodging through enemies burns them for 8 damage.', apply: (s) => { s.dodgeStrike += 8; } },
  { id: 'koBlast', name: 'KO Blast', icon: '💥', tag: 'CROWD', maxStacks: 2, weight: 1,
    desc: 'KO\'d enemies explode, launching everything nearby.', apply: (s) => { s.koBlast += 160; } },
  { id: 'quickJab', name: 'Lightning Jabs', icon: '👊', tag: 'COMBO', maxStacks: 3, weight: 1,
    desc: 'Light moves deal +20% damage.', apply: (s) => { s.lightDamage += 0.2; } },
];
