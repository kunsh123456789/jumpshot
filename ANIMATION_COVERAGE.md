# Animation coverage (revision pass 8)

Every animation in the game, with its status. **Done** = authored in the Hand-Drawn system (drawings with holds, anticipation, a bold contact pose, follow-through, in-betweens on fast parts, smear chains, seeded scribble FX and sounds). **Reviewed** = checked in the Animation Lab at 0.1x and at full speed (`F2` or `#lab`); the ten most important ones also have frame sheets in [`docs/animation-review/`](docs/animation-review/).

**How weapons share the body (A0).** Body animations are authored once. Each weapon adds a **grip layer** (`src/data/weapons/grips.ts`): arm poses per locomotion state (idle, run, air, crouch, landing), laid over the body drawing by the animator. The held object is solved from the hand joints every frame (a pole is drawn *through* both hands; single-hand objects hang off the lead hand), so the hands always stay on the weapon. Weapon attacks, finishers and Specials are authored per weapon.

| Grip set | Weapons | Silhouette |
|---|---|---|
| none (the arms are the weapon) | Fists, Throw, Rocket Gloves, Lightning Fist | the body drawings as authored |
| pole | Staff, Ice Spear, Scythe | held diagonally at idle, across the body on the run |
| pistol | Laser Blast, Bubble Gun, Ray Gun | pistol raised at idle, low ready on the run |
| heavy | Giant Hammer | on the shoulder (idle, run), swung down on landings |
| blades | Twin Daggers | reverse grip low, swept back on the run |
| shield | Boomerang Shield | shield forward |
| rope | Grappling Hook, Chain Whip, Yo-Yo | coiled at the hip |
| pen / raised | Ink Brush / Paper Plane Swarm | brush raised like a pen / plane held up |

## A1. Jump (hero, every weapon via the grip layer)

| Animation | Id | Status |
|---|---|---|
| Jump anticipation (crouch, arms swing back; 2 drawings over the 3-frame jump squat) | `jumpSquat` | Done · Reviewed |
| Launch stretch (+ dust, floor crack via `jump` event) | `jumpLaunch` | Done · Reviewed |
| Rise | `jumpRise` | Done · Reviewed |
| Apex hang (long held floaty drawing) | `jumpApex` | Done · Reviewed |
| Fall (limbs flailing up) | `jumpFall` | Done · Reviewed |
| Landing squash (+ dust, specks) | `jumpLand` | Done · Reviewed |
| Hard landing (long fall / slam; three-point landing) | `jumpHardLand` | Done · Reviewed |
| Double jump burst (echo copies) | `airJump` | Done · Reviewed |
| Air-drift lean forward / back | `airDriftF`, `airDriftB` | Done · Reviewed |
| Tuck-spin flip (Jumpshot launcher leap, staff vault) | `jumpFlip` | Done · Reviewed |
| Dodge hop (air dodge) | `airDodge` | Done · Reviewed |
| Wired into: drag / tap / key jump, air jump, launcher leap (flip), staff vault (flip), hook zip (zip move, then the fall set), launched (enemy `launched` / `tumble`), air dodge (hop) | `render/poser.ts` `airborne()` | Done · Reviewed |

## A2. Hero movement and reactions

| Animation | Id | Status |
|---|---|---|
| Idle stance / bored idle after 5 s | `idle` / `idleBored` | Done · Reviewed |
| Walk / run, run start, stop-skid, turn | `run`, `runStart`, `runStop`, `runTurn` | Done · Reviewed |
| Crouch / low stance (pad slid down, S / ↓) | `crouch` | Done · Reviewed |
| Dash / air dash (magnetism lunge) | `dash`, `airDash` | Done · Reviewed |
| Dodge (ground / air) | `dodge` / `airDodge` | Done · Reviewed |
| Parry, perfect-parry flash pose | `parry` (attempt = dodge) / `parryFlash` | Done · Reviewed |
| Weapon holster + draw on swap | `weaponSwap` | Done · Reviewed |
| Hit react: light, heavy, from behind, from above, while airborne | `hurtLight`, `hurtHeavy`, `hurtBehind`, `hurtAbove`, `hurtAir` | Done · Reviewed |
| Airborne tumble, wall bounce, ground bounce, knockdown | `tumble`, `wallSplat`, `groundBounce`, `knockdown` (shared rig set) | Done · Reviewed |
| Get-up quick (kip-up) / slow | `getupQuick` / `getup` | Done · Reviewed |
| Stun (orbiting stars drawn over the head) | `stunned` + `ink.ts` stars | Done · Reviewed |
| Taunt | `taunt` | Done · Reviewed |
| Wave-clear victory pose (one per weapon: six drawings sets, each weapon's grip + held object makes its own) | `victory_pump`, `victory_twirl`, `victory_aim`, `victory_shoulder`, `victory_bow`, `victory_flex`; map in `grips.ts` `WEAPON_VICTORY` | Done · Reviewed |
| Spawn-in / entrance (drops onto the page) | `entrance` | Done · Reviewed |
| Death (game over) collapse | `deathCollapse` | Done · Reviewed |

## A3. Attacks per weapon (audit)

Audit script: every move in every weapon's ground and air movesets, strings and chains (211 moves, 18 weapons incl. the cheat Ray Gun). The pass 8 `refine()` step in `data/weapons/author.ts` gives every template attack a two-step anticipation (a settle breakdown plus a tightened extreme on longer startups), an overshoot drawing right after contact, a smear on the striking limb and generated in-betweens on heavy / launcher / spike moves. Contact still lands exactly on the first active frame.

| Weapon | Moves | 8 directions x light/heavy | Launcher | Air chain | Spike / slam | Unique moves | Status |
|---|---|---|---|---|---|---|---|
| Fists | 20 | yes | yes | yes | yes | strings, flurry drawings (boss KO) | Done · Reviewed |
| Grappling Hook | 14 | yes | yes | yes | yes | zip, swing, pull | Done · Reviewed |
| Throw | 16 | yes | yes | yes | yes | long-arm grab, over-shoulder, bowling | Done · Reviewed |
| Staff | 17 | yes | yes (vault) | yes | yes (plunge) | heli, plant, boomerang toss | Done · Reviewed |
| Laser Blast | 17 | yes | yes | yes | yes | beam, overheat bash | Done · Reviewed |
| Chain Whip, Giant Hammer, Twin Daggers, Boomerang Shield, Ink Brush, Yo-Yo, Bubble Gun, Rocket Gloves, Ice Spear, Paper Plane Swarm, Lightning Fist, Scythe | 9-12 each | yes | yes | yes | yes | see README | Done · Reviewed |

Audit result after the refine pass: 0 missing animations, 0 without anticipation, 0 without follow-through, 0 without a smear. One major move has 5 authored drawings: `dg_rise`, whose 4-frame startup leaves room for only one anticipation drawing. Its generated in-betweens bring it to 6 or more on screen.

## A4. Finishers (per weapon family; other weapons use the closest family with their own held weapon)

| Weapon | Air Finisher (S swipe in the air after a 5+ hit air juggle) | Last-Hit KO finisher (skippable) | Boss KO |
|---|---|---|---|
| Fists | JUMPSHOT FINISHER: flip, meteor axe kick, floor-cracking shockwave (`jumpFlip`, `cine_axeWind`, `cine_axeHit`) | Spinning roundhouse (`cine_roundhouse`) | hundred-fist FLURRY, then the roundhouse |
| Staff | Pole-plant dive: spinning, dive-bomb, radial crack (`st_aheli`, `st_plunge`, `cine_plant`) | X-slash with inverted flash lines, collapse (`cine_xslash`) | 3 heavy blows, then X-slash |
| Laser | Point-blank downward mega-beam (`lz_spikeH`, `cine_beam`) | Point-blank blast, sparks trail (`lz_blastH`) | 3 heavy blows, then the blast |
| Hook | Rope ring slam (`hk_air`, `hk_swingH`, `hk_slamH`) | Pull + uppercut + rope snap (`hk_pull`, `launcher`) | 3 heavy blows, then pull + uppercut |
| Throw | Spinning pile-driver (`th_pile`, `cine_pile`) | Spin and bowling toss off the page edge with a star (`cine_spin`, `cine_hurl`) | 3 heavy blows, then the toss |

Status: all Done · Reviewed (Lab sheets 04, 05, 06, 08; in-game screenshots during the finisher tests).

## B4. Special cinematics

| Family (weapons) | Special | Drawings used | Status |
|---|---|---|---|
| Fists (Fists, Rocket Gloves, Giant Hammer) | MEGA JUMPSHOT / ROCKET BARRAGE / EARTHSPLITTER | `cine_erupt`, `jumpFlip`, `akick1-3` (one per QTE hit), `cine_axeWind`, `cine_axeHit` | Done · Reviewed |
| Staff (Staff, Twin Daggers, Bubble Gun) | CYCLONE / BLADE STORM / BUBBLE STORM | `st_heliH` loop + tornado FX, `cine_plant` | Done · Reviewed |
| Laser (Laser, Ice Spear, Ink Brush, Lightning Fist, Ray Gun) | OVERLOAD BEAM / GLACIER BEAM / INK TSUNAMI / THUNDER GOD / DEATH RAY | `cine_charge` (orb), `cine_beam` (fire), horizontal blast FX | Done · Reviewed |
| Hook (Hook, Chain Whip, Yo-Yo, Paper Planes, Scythe) | WEB TAKEDOWN / WHIP WEB / STRING STORM / PAPER WEB / REAPER WEB | `hk_air`, `hk_pull`, `hk_slamH` + ropes FX | Done · Reviewed |
| Throw (Throw, Boomerang Shield) | HAMMER SWING / SHIELD BOWL | `th_longArm`, `cine_spin`, `cine_hurl` | Done · Reviewed |
| Activation pose (ground / air) | all | `cine_activate`, `cine_activateAir` | Done · Reviewed |

## A5. Enemies (Grunt, Rusher, Brute, Kicker, Thrower, Shield, Elite, Boss + Witch / Juggernaut / Shadow)

| Animation | Ids | Status |
|---|---|---|
| Spawn-in (dithered gray fade to solid when first in view) | render (`spawnFade`) + `enemy.spawn` pose | Done · Reviewed |
| Idle with personality (Grunt bobs, Rusher fidgets, Brute heaves, Kicker bounces on its toes, Shield hunkers, Thrower tosses a dart, Elite cocky) | `grunt.idle`, `rusher.idle`, `brute.idle`, `kicker.idle`, `shield.idle`, `thrower.idle`, `elite.idle` (bosses: pass 7 sets) | Done · Reviewed |
| Walk / circle (Brute stomps, Rusher scurries, Kicker hops, Shield shuffles) | `rusher.walk`, `brute.walk`, `kicker.walk`, `shield.walk`, `enemy.walk` | Done · Reviewed |
| Taunt per type | `grunt.taunt`, `rusher.taunt`, `brute.taunt`, `kicker.taunt`, `shield.taunt`, `thrower.taunt`, `elite.taunt` | Done · Reviewed |
| Every attack with a big telegraph (stretched wind-up, red flicker, burst) | `enemies.ts` attacks (`punch`, `lunge`, `slam`, `hammer`, `kick`, `eKick`, `bSweep`, `throw`, `bash`, boss sets) | Done · Reviewed |
| Hit react light / heavy / launched, get-up, tumble, wall / ground bounce, stun | shared reaction set | Done · Reviewed |
| Grabbed / held / pulled (weapons) | `held`, `pulled` (weapons/reactions.ts) | Done · Reviewed |
| Death, 3 variants: flat collapse / launched off the page with a star / scribbled out | `ko` → `knockdown` + `lying`; `DEATH` launch + `koStar`; `scribbleOut()` | Done · Reviewed |

## FX

| Effect | Where | Status |
|---|---|---|
| Inverted impact frames, white crescent | `weaponFx.ts`, cinematic `invert` cue | Done · Reviewed |
| Floor cracks (small, big radial, floor split) | `inkFx.floorMark`, cinematic `crack` / `bigCrack` | Done · Reviewed |
| Scribble energy, lightning, whirlwind, star bursts, sparks, dust | `inkFx`, `weaponFx` | Done · Reviewed |
| Cinematic shapes: mega-beam, ropes, tornado, X-slash lines, freeze bubble | `render/cineFx.ts` | Done · Reviewed |
| Echo copies, smear chains, dithered reflection | animator / `ink.ts` | Done · Reviewed |
