# Level roadmap

Every wave from 1 to 40 (one full cycle of the four bosses). It is **generated from the game's own tables** (`src/data/roadmap.ts` reads the wave, enemy, paper-page and arena data), and the same data drives the in-game **ROADMAP** screen (title screen → ROADMAP). Waves 1-10 are hand-authored; from wave 11 each wave is built from a growing budget out of the enemy kinds unlocked so far.

- **Elite** (★): every 5th wave (not boss waves). **Boss** (☠): every 10th wave.
- **Arena** (the backdrop) changes every 3 waves; **page** (the paper) every 3 waves, and boss waves always use the kraft page.
- Enemy HP and damage scale with the wave (shown as % of wave-1 values).

## Stage 1: waves 1-10 (boss: THE COLOSSUS)

| Wave | Type | Enemies | New | Arena | Page | HP / dmg |
|---|---|---|---|---|---|---|
| 1 |  | 3× Grunt | Grunt | dojo | Blank Page | 100% / 100% |
| 2 |  | 3× Grunt, Rusher | Rusher | dojo | Blank Page | 100% / 102% |
| 3 |  | 3× Grunt, Kicker, Rusher | Kicker | dojo | Blank Page | 100% / 105% |
| 4 |  | Brute, 2× Grunt, Rusher, Kicker | Brute | rooftop | Lined Notebook | 100% / 108% |
| 5 | ★ elite | Ronin, 3× Grunt | Ronin (elite) | rooftop | Lined Notebook | 100% / 110% |
| 6 |  | Thrower, 3× Grunt, 2× Kicker, Rusher | Thrower | rooftop | Lined Notebook | 103% / 113% |
| 7 |  | Shield, 3× Grunt, Thrower, Rusher, Kicker | Shield | neon | Graph Paper | 107% / 115% |
| 8 |  | Brute, Shield, Kicker, 3× Grunt, Thrower, Rusher |  | neon | Graph Paper | 111% / 118% |
| 9 |  | 2× Brute, 2× Grunt, 2× Rusher, Kicker, Thrower, Shield |  | neon | Graph Paper | 114% / 120% |
| 10 | ☠ BOSS | **THE COLOSSUS**: from phase 2 it calls METEORS: a red zone and a countdown show where and when (jump them) · summons Grunt and Rusher |  | volcano | Kraft Paper | 118% / 123% |

## Stage 2: waves 11-20 (boss: SCRIBBLA)

| Wave | Type | Enemies | New | Arena | Page | HP / dmg |
|---|---|---|---|---|---|---|
| 11 |  | a mixed crowd (budget 17) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 121% / 125% |
| 12 |  | a mixed crowd (budget 18) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 125% / 127% |
| 13 |  | a mixed crowd (budget 19) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 128% / 130% |
| 14 |  | a mixed crowd (budget 20) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 132% / 133% |
| 15 | ★ elite | Ronin + a mixed crowd (budget 21) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 135% / 135% |
| 16 |  | a mixed crowd (budget 22) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | rooftop | Lined Notebook | 139% / 138% |
| 17 |  | a mixed crowd (budget 23) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | rooftop | Lined Notebook | 142% / 140% |
| 18 |  | a mixed crowd (budget 24) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | rooftop | Lined Notebook | 146% / 143% |
| 19 |  | a mixed crowd (budget 25) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | neon | Graph Paper | 149% / 145% |
| 20 | ☠ BOSS | **SCRIBBLA** (the ink witch): from phase 2 it calls METEORS: a red zone and a countdown show where and when (jump them) · summons Thrower and Shield · teleports away when you get close |  | neon | Kraft Paper | 153% / 148% |

## Stage 3: waves 21-30 (boss: THE JUGGERNAUT)

| Wave | Type | Enemies | New | Arena | Page | HP / dmg |
|---|---|---|---|---|---|---|
| 21 |  | a mixed crowd (budget 27) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | neon | Graph Paper | 156% / 150% |
| 22 |  | a mixed crowd (budget 28) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 160% / 153% |
| 23 |  | a mixed crowd (budget 29) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 163% / 155% |
| 24 |  | a mixed crowd (budget 30) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 167% / 158% |
| 25 | ★ elite | Ronin + a mixed crowd (budget 31) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 170% / 160% |
| 26 |  | a mixed crowd (budget 32) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 174% / 160% |
| 27 |  | a mixed crowd (budget 33) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 177% / 160% |
| 28 |  | a mixed crowd (budget 34) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | rooftop | Lined Notebook | 181% / 160% |
| 29 |  | a mixed crowd (budget 35) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | rooftop | Lined Notebook | 184% / 160% |
| 30 | ☠ BOSS | **THE JUGGERNAUT** (dodge the charge): summons Brute and Rusher · armored charges: dodge one and he crashes into the wall, stunned |  | rooftop | Kraft Paper | 188% / 160% |

## Stage 4: waves 31-40 (boss: SHADOW)

| Wave | Type | Enemies | New | Arena | Page | HP / dmg |
|---|---|---|---|---|---|---|
| 31 |  | a mixed crowd (budget 37) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | neon | Graph Paper | 191% / 160% |
| 32 |  | a mixed crowd (budget 38) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | neon | Graph Paper | 195% / 160% |
| 33 |  | a mixed crowd (budget 39) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | neon | Graph Paper | 198% / 160% |
| 34 |  | a mixed crowd (budget 40) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 202% / 160% |
| 35 | ★ elite | Ronin + a mixed crowd (budget 41) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 205% / 160% |
| 36 |  | a mixed crowd (budget 42) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | volcano | Sketchbook | 209% / 160% |
| 37 |  | a mixed crowd (budget 43) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 212% / 160% |
| 38 |  | a mixed crowd (budget 44) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 216% / 160% |
| 39 |  | a mixed crowd (budget 45) of Grunt, Rusher, Kicker, Brute, Thrower, Shield |  | dojo | Blank Page | 219% / 160% |
| 40 | ☠ BOSS | **SHADOW** (your ink double): from phase 2 it calls METEORS: a red zone and a countdown show where and when (jump them) · slips some hits |  | rooftop | Kraft Paper | 223% / 160% |

## After wave 40

After wave 40 the bosses come back in the same order (Colossus at 50), every wave keeps scaling, and there is no final wave.
