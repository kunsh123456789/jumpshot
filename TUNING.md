# Tuning reference

Every gameplay and feel number lives in `src/data/`. You can change any of them without touching logic. Units: **world units** (the logical view is 1280×720), **frames** (60 Hz sim frames, 1 f ≈ 16.7 ms), **seconds**, or **px** (CSS pixels on the pad).

The player can also change these in-game settings: **Flick sensitivity** (divides `flickSpeed`, `flickMinDist`, `heavyDist` and `heavySpeed`) and **Touch area** (`settings.padRegion`, 0.35–0.6).

| File | Contents |
|---|---|
| `data/tuning.ts` | Global feel constants (tables below) |
| `data/moves.ts` | Every player move: frame data, damage, knockback, hit-stop, shake, cancels, poses, trails |
| `data/enemies.ts` | Enemy stats, attacks (telegraph/active/recovery), boss phases, projectiles |
| `data/waves.ts` | Authored waves 1–10, the budget generator, and the per-wave enemy HP and damage ramps |
| `data/weapons/*.ts` | One file per weapon: moveset, frame data, drawings, smear configs, held object, icon (see **Weapons** below) |
| `data/weapons/tuning.ts` | Shared weapon-system tunables (`WEAPON_T`) |
| `data/rhythm.ts` | Rhythm Mode: judgement windows, rewards, streaks, attack snapping, enemy beat sync, section intensity, groove, scheduler, calibration |
| `data/inkLook.ts` | Ink page look: line weights, floor, reflection, locked camera (INKLOOK) and hand-drawn FX (INKFX) |
| `data/anims/handDrawn.ts` | The Hand-Drawn animation set: drawings + holds |
| `data/songs.ts` | Built-in songs: sections (bars, BPM, time signature, intensity, chords), key and scale |

## WORLD
| Key | Purpose |
|---|---|
| viewW, viewH | Logical view size (1280×720), scaled to fit with letterboxing |
| arenaW | Arena width between walls (wider than the view, so the camera pans) |
| groundY | Ground line in world space |
| groundScreenY | Screen row (logical) where the ground sits. The camera keeps it there, so aerial play zooms out instead of panning the floor down into the pad |
| wallMargin | Inset of the walls from the arena edges |

## PHYS
| Key | Purpose |
|---|---|
| gravity, maxFall | Gravity (u/s²) and terminal fall speed |
| groundFriction | Per-frame velocity multiplier while sliding in hitstun |
| airDrag | Per-frame horizontal drag for airborne enemies |
| stallGravity | Gravity multiplier during an air-stall |
| stallFrames | Base stall frames applied to an enemy on an air hit (decays with juggle depth) |
| playerAirStallFrames | Stall frames for the player after landing an air hit |
| groundBounceMinVy, groundBounceVy | Minimum fall speed for a spike to ground-bounce, and the bounce velocity |
| wallBounceMinVx, wallBounceVxFactor, wallBounceVy | Wall bounce threshold, rebound factor, and pop-up velocity |
| bowlMinSpeed, bowlDamage, bowlKnockback | Enemy-into-enemy collision speed threshold, damage and knockback |
| separationPush | Strength of the push that stops standing enemies from overlapping |

## PAD (touch area and flick detection)
| Key | Purpose |
|---|---|
| regionDefault, regionMin, regionMax | The pad is the full-width bottom band of the screen. These set its default height and the range of the **Touch area** setting (fractions of the screen height) |
| portraitViewW, portraitViewTop | Portrait crop of the logical view (visible width and top edge). It keeps fighters readable |
| flickWindowMs | Window of recent pointer samples used to detect a flick |
| flickSpeed, flickMinDist | Over that window, a stroke faster than this (px/s) and longer than this (px) is an ATTACK. Anything slower is movement. Both are divided by the **Flick sensitivity** setting |
| rearmFrac, rearmMinMs | After a flick, the stroke re-arms once the finger slows below this fraction of flickSpeed, and no sooner than this many ms. One flick can never fire twice |
| heavyDist, heavySpeed, heavyPromoteFrames | A flick that keeps going this far (px) at this average speed (px/s) within this many frames is promoted to HEAVY |
| sectorHalfDeg, cardinalBiasDeg | 8-way direction sectors, plus extra tolerance toward N, S, E and W |
| chainTurnDeg | While still fast, a turn sharper than this fires the next attack (zig-zag chains) |
| tapMaxDist, tapMaxMs | Maximum travel (px) and duration for a tap (dodge/parry) |
| trailFadeMs | Lifetime of the finger trail |

### Jump and long-press (pass 8)
| Key | Purpose |
|---|---|
| jumpDragPx | A slow upward drag this far above the finger's lowest point jumps (divided by the sensitivity setting) |
| jumpMinSlope | The drag must be mostly vertical: rise >= sideways x this |
| jumpMaxSpeedFrac | ...and slower than flickSpeed x this. A fast stroke is the flick-up launcher (flick detection runs first, so the two never collide) |
| jumpBoostPx | Dragging this much further raises the jump to full height (`PLAYER.jumpVelMax`) |
| jumpRearmPx, jumpAfterFlickMs | Re-arms after the finger moves back down this far; never fires this soon after a flick |
| holdMs, holdMaxDist | Long-press in place for the Special: held this long without moving more than this |
| crouchPx | Low stance (presentation): finger slid this far down from its anchor |

## MOVE (drag-to-move)
| Key | Purpose |
|---|---|
| deadZone, maxRadius | Floating-stick dead zone, and the radius that reaches full speed (px). The anchor follows the finger beyond the radius |
| freezeSpeed | While the finger moves faster than this (px/s), the stick output is held, so the start of a flick never shoves the player |
| suppressFrames | After a flick, movement is suppressed and re-anchored for this many frames (post-flick finger drift) |
| runSpeed, accel, decel | Ground speed (units/s) and acceleration/deceleration (units/s²) |
| airAccel, airMax | Gentle air control while falling |
| wallSoft | Speed eases to zero within this distance of a wall |
| runThreshold | Below this speed the run animation hands back to idle |

## ANIM (pose-to-pose playback and presentation)
| Key | Purpose |
|---|---|
| fadeFrames, fadeCancel, fadeHit, fadeLand | Interruption crossfade lengths. These are the ONLY blends: snap-out from the current pose into the new animation |
| leadHips, leadTorso, leadUpperArm, lagHead | Staggered timing (frames): hips, torso and upper arms sample slightly ahead of the clock, and the head trails. The striking forearm or leg is exact, so contact stays on its frame |
| turnFrames, turnFramesAttack | Eased facing turn |
| headLook | Head tilt toward the target in idle |
| runRateMin, runRateMax | The run/walk loop plays at speed ÷ runSpeed, clamped |
| skidMinSpeed | Speed above which stopping plays the skid animation |
| tauntIdleFrames | Idle time before the player taunts |
| smearSamples, smearAlpha, smearTailAlpha | Smear-frame sampling and opacity |
| invertSec, speedLineSec, speedLines | Impact frames: inverted flash (heavy hits) and speed-line bursts |
| reflectAlpha, reflectSquash | Ground reflection |
| lineScale | Uniform line width multiplier |
| apexBand, apexGravity, stallEaseIn, stallEaseOut | Jump-arc weight (hang at the apex, eased air-stall gravity) |
| popAngle, popSpin, popRoot, impactSnapFrames | Pop detector thresholds |
| hitstopShakeAmp, hitstopShakeHz | Victim vibration during hit-stop |
| trailLife, ghostInterval | Trail ribbon length and whole-body echo spacing |

### ANIM additions (pass 8)
| Key | Purpose |
|---|---|
| boredIdleFrames | No input for this long (5 s) and the hero slips into the bored idle |

## Weapon grip layer (`data/weapons/grips.ts`, pass 8)
Per weapon: arm poses (aU, aL, bU, bL) for idle / run / air / crouch / land, laid over the body drawing; `w` / `runW` blend weights (1 = the grip owns the arms). `WEAPON_VICTORY` picks each weapon's wave-clear pose.

## data/anims/ (authored animations)
Each animation is `anim({ id, len, loop?, base?, strike?, reach?, keys })`. Each key is `{ f, p, e?, hold?, smear?, impact?, trail?, sfx? }`:

| Field | Meaning |
|---|---|
| `f` | Frame (60 Hz ticks) |
| `p` | The pose, layered over the `base` pose (`ground` stance, `air` or `lying`). The channels are: rootX, rootY, lean, head, aU, aL, bU, bL, laU, laL, lbU, lbL, spin, plant, footA, footB, flex, liftA, liftB, stretch. Angles are absolute from straight down (+ is toward facing); elbows and knees are relative |
| `e` | Easing into the key: snapIn, snapOut, inOut, out, in, overshoot, hold |
| `smear` | Limbs drawn as smears on the frame before the key and on the key itself |
| `impact` | The contact key. For player attacks it lands on the move's first active frame; for enemy attacks the anticipation before it is stretched over the windup |

The proportions of each fighter kind are in `RIGS` in `render/rig.ts`. The easiest way to edit poses is the Animation Lab (`#lab`), whose export uses this exact format.

## INPUT
| Key | Purpose |
|---|---|
| bufferSize | Maximum number of queued swipes |
| bufferFrames | Lifetime (~200 ms) of a queued swipe once the player could act. It doesn't age during hit-stop or a committed startup |
| keyChordMs | Window for two keys to combine into a diagonal |

## PLAYER
| Key | Purpose |
|---|---|
| maxHp, hpRegenSRank | Health, and regeneration (HP/s) while at S rank or above |
| hurtInvulnFrames, hurtStunFrames, hurtKnockback | What happens when the player gets hit |
| dodgeFrames, dodgeInvulnFrames, dodgeDistance | Dodge timing, invulnerability and distance |
| parryWindowFrames, parryRangeBonus | Perfect-parry window at the start of a dodge, and its extra catch radius |
| parryCritFrames, critMult | Auto-crit window after a parry, and the crit damage multiplier |
| parrySlowmoScale, parrySlowmoSec | Parry slow-motion amount and duration |
| targetRange, targetConeDeg | Auto-target range and cone half-angle |
| dashSpeed, dashMaxFrames, dashMinDistance, airDashMaxFrames | Attack magnetism dash: average speed (the ease-out curve peaks at 2× for one tick) and length limits |
| whiffStep | Step-forward distance when there is no target |
| airborneHeight | A target higher than this triggers jump-up attacks |
| maxAirStalls | Air hits per airtime that keep the player hovering |
| landingRecovery | Landing lag (it can be cancelled) |
| scale | Player rig scale |
| jumpVel, airJumps, airJumpVel | Tap / Space jump speed, mid-air jumps, the air jump's speed |
| jumpVelMin, jumpVelMax, jumpBoostFrames | Drag jump (pass 8): take-off at jumpVelMin; while the finger keeps dragging up (or W / ↑ is held) for jumpBoostFrames it grows toward jumpVelMax (computed as if it had left the floor at the charged speed) |
| jumpSquatFrames | The jump's anticipation crouch before take-off |
| hardLandVy | Landing faster than this plays the hard landing (and a floor impact) |
| apexVy | |vy| below this shows the apex-hang drawing |

## COMBO
| Key | Purpose |
|---|---|
| timeoutFrames | The combo drops after this long without a hit |
| idleDropFrames | The combo drops if no enemy is in a hit state for this long |
| scaleFreeHits, scalePerHit, scaleFloor | Damage scaling: `max(floor, 1 − perHit·(hits − free))` |
| repeatPenalty, repeatWindow, repeatFloor | Penalty for reusing the same move family within the last N moves |
| hitstunScalePerHit, hitstunScaleFloor | Hitstun shrink per hit an enemy takes |
| juggleKbDecay, juggleKbFloor | Upward knockback decay per juggle hit |
| juggleGravityPerHit, juggleStallDecay | Gravity increase and stall decrease per juggle hit (juggles end naturally) |
| juggleCeiling, juggleCeilingFade | Upward knockback fades above this height (keeps the action on screen) |
| burstChance, burstPush, airBurstFactor | Enemy escape bursts: chance per hit after the enemy's `burstThreshold` (×airBurstFactor in the air), and the push-back |
| groundBounces, wallBounces | Bounces allowed per combo |
| summaryMinHits | Minimum hits before a combo shows its end-of-combo summary |

## STYLE
| Key | Purpose |
|---|---|
| ranks, thresholds | Rank letters and the style points needed for each |
| scoreMult | Score multiplier per rank |
| max | Style point cap |
| perHit, varietyBonus, airBonus, multiBonus, bounceBonus, launcherBonus, koBonus | Style gained per hit and its bonuses |
| parryBonus, finisherBonus | Style gained from a parry and from a finisher |
| passiveDelayFrames, decayPerFrame | Decay that starts after this much passivity during a combo |
| comboEndDecayPerFrame | Faster decay once the combo has ended |
| hurtKeep | Fraction of style kept when the player is hit |

## Special Bar and Specials (`data/special.ts`, revision pass 8)
The super meter is gone; the **Special Bar** replaces it.

| Key | Purpose |
|---|---|
| full, segments | One full charge (100); how many charges the bar can store (1 by default; 2-3 keep overflow for the next) |
| perHit, perComboHit, comboCap, airBonus, multiBonus | Charge per landed hit: perHit x (1 + combo hits x perComboHit, capped at comboCap), plus bonuses for air hits and multi-enemy hits |
| rhythmBonus | Rhythm Mode: extra charge per judged swipe (Miss, Good, Great, Perfect) |
| parry, orb | Charge from a perfect parry and from an orb pickup (the "Jackpot" drop) |
| kill, killElite, killBoss | Charge per KO |
| perDamageTaken | Catch-up charge per point of damage taken |
| introFrames, bubbleRadius | The activation beat (sim frames) and the freeze bubble size |
| inputTimeoutFrames | Safety: no result within this many sim frames resolves SLOPPY (never soft-locks) |
| traceSec, traceSecAssist | Trace time limit (s); Assist's longer limit. Rhythm Mode rounds it to whole beats |
| tolerance, toleranceAssist | Trace band (fraction of the smaller screen side) and the Assist multiplier |
| wCoverage, wAccuracy, wSpeed | Trace score weights |
| pickSec | The Special picker auto-uses the highlighted (equipped) weapon after this many seconds |
| tierClean, tierPerfect | The trace score alone grades it: SLOPPY < tierClean <= CLEAN < tierPerfect <= PERFECT |
| tierDamage, tierNames | Damage multiplier per tier; the tier words |
| rangeFists, rangeStaff, rangeThrow | Who gets caught by the Mega Jumpshot / Cyclone, and the Hammer Swing's grab range |

## CINE (cinematics: finishers and Specials, `data/tuning.ts`)
| Key | Purpose |
|---|---|
| airMinJuggle | Air hits in the current air combo before a down swipe becomes the Air Finisher (once per air combo) |
| skipAfter | Frames before a KO finisher can be skipped by any input |
| afterInvuln | Invulnerability after a cinematic |
| bossMult, bossCapFrac, eliteMult | Cinematic damage to bosses (x bossMult, capped at bossCapFrac of max HP per cinematic) and elites |
| shockDamage | Damage of the landing shockwave a slammed victim makes |

Scripts live in `data/cines.ts` (frame numbers are 60 Hz sim ticks); `WEAPON_FAMILY` maps each weapon to one of the five scripted families and `SPECIAL_NAME` names its Special.

## DEATH (enemy death variants)
| Key | Purpose |
|---|---|
| launchVy, launchVx, launchGravity | The launched-off-the-page KO |
| exitHeight | Removed with a star twinkle once this high (or past the arena edge) |
| scribbleFrames | How long the scribble-out death takes |

## SCORE
| Key | Purpose |
|---|---|
| perDamage | Points per damage (× rank multiplier) |
| koBonus, koLaunchBonus | KO bonus, plus extra when the KO happens in the air |
| comboBonusPerHitSq | End-of-combo bonus = hits² × this × the max-rank multiplier (lost if the combo breaks) |
| parry, waveClear | Bonus per parry, and per wave cleared (× wave number) |

## JUICE
| Key | Purpose |
|---|---|
| shakeMax, shakeRotMax, shakeDecay | Screen shake caps (px, radians) and trauma decay. The shake setting multiplies these |
| punchZoomMax | Cap on the punch-in zoom from hits |
| slowmoLastEnemyScale/Sec, slowmoFinisherScale/Sec | Slow-mo on the last enemy of a wave and on finishers |
| flashFrames | Frames the victim flashes white (2, so the contact pose stays readable) |
| hitstopMaxFrames | Hit-stop cap (after the hit-stop setting multiplier) |
| comboPitchPerHit, comboPitchCap | How fast hit sounds rise in pitch as the combo grows |
| damageNumberLife | Lifetime of floating damage numbers |

## CAMERA
| Key | Purpose |
|---|---|
| followOmega, zoomOmega, zoomOutOmega | Critically damped spring frequencies (rad/s) for position and zoom. Zooming out is faster so launches stay framed |
| punchDecay, punchOmega | Punch-in: decay rate of the punch target and the spring that eases the zoom in and out |
| baseZoom, minZoom, crowdSpreadStart, crowdSpreadFull | Zoom out as the crowd spreads |
| aerialHeightStart, aerialHeadroom, minAerialZoom, aerialFollowY | Aerial framing that zooms around the ground line |
| lookAheadX | Camera offset toward the player's facing direction |

## WAVES_T
| Key | Purpose |
|---|---|
| breatherSec, healFraction | Time between waves, and the partial heal on wave clear |
| tokensBase, tokensPerWaves, tokensMax | How many enemies may attack at once as waves progress |
| maxOnScreen, spawnIntervalFrames | Spawn pacing |
| arenaRotateEvery | Waves per arena |

## PICKUPS
| Key | Purpose |
|---|---|
| healthDropChance, healthAmount | Health drops (a higher chance when the player is low) |
| orbDropChance | Super-orb drops |
| magnetRange, lifeFrames | Pickup magnetism range and despawn time |

## moves.ts fields (per move)
`startup / active / recovery` (frames), `damage`, `hitstun`, `kbX / kbY` (knockback; kbY < 0 is up), `hitstop`, `shake`, `zoom` (punch-in), `poise` (armor-break multiplier), `hitbox {x, y, r}` (forward, up and radius from the feet), `maxTargets`, `reach` (stand-off distance for the magnetism dash), `dash`, `travel` (forward movement during active frames), `launch` (victim launch velocity), `follow` (player leaps after), `knockdown`, `spike`, `aoe` (radius instead of a hitbox), `selfVY` (player hop on hit), `cancelFrom` (frames after active start), `cancelInto` (allowed tags), `next` (string continuation), `multiHit {interval, count, then}`, `sound`, `weight` (juice scale), `trail`, `afterimage`, `impactShock` (finisher shockwave), and `poses {antic, strike, follow}`.

The move lookup lives in each weapon: `ground` and `air` map a direction class (side / upDiag / up / downDiag / down) × light/heavy to a move id.

## enemies.ts fields
- **Per enemy:** `hp`, `poise` and `poiseRegenFrames` (armor), `scale`, `thickness`, `color`, `walkSpeed`, `holdDist` (waiting distance without a token), `weight` (knockback taken), `launchMult`, `burstThreshold`, `blocksFront`, `cooldown`, `score`, `hpBar`, `scarf`, `cost` (wave budget).
- **Per attack:** `windup` (the telegraph), `active`, `recovery`, `damage`, `hitbox`, `range`, `lunge` and `stepIn` speeds, knockback, an optional `projectile` and `shockwave`, and poses.
- **`BOSS`:** phase HP thresholds, meteor timing, damage and radius, summon interval, stagger length, and the phase 3 speed-up.
- **`PROJECTILE`:** radius, reflect speed and damage, and lifetime.

## waves.ts
The player never gets stronger during a run, so the difficulty curve comes only from the waves.
- **`AUTHORED`:** waves 1–10 (1–5 introduce the enemies; 5 = elite, 10 = boss).
- **`WAVE_GEN`:** `baseBudget`, `budgetPerWave` and `maxEnemies` for generated waves; `hpScaleFrom`/`hpScalePerWave` (enemy HP +3.5% per wave after wave 5); `dmgScalePerWave`/`dmgScaleMax` (enemy damage +2.5% per wave, capped at ×1.6, applied in `hurtPlayer`).
- **`WAVES_T`** (`tuning.ts`): `breatherSec` (3 s between waves), `countdownSec` (the next wave's title), `healFraction` (0.35), attack tokens by wave, on-screen cap, spawn interval.

## RHYTHM (`data/rhythm.ts`)
Times are in ms on the heard audio timeline, after the player's latency offset. "Beat" means a quarter note.

| Key | Purpose |
|---|---|
| perfectMs, greatMs, goodMs | ± window to the nearest beat for PERFECT / GREAT / GOOD (45 / 90 / 140) |
| eighthGoodMs | Inputs within ±60 ms of the off-beat 8th also count as GOOD, so fast strings keep the streak |
| damageMult | Damage for the move an input started: [MISS, GOOD, GREAT, PERFECT] = [1, 1.1, 1.3, 1.6]. MISS is the baseline, never a penalty |
| scoreBonus, styleBonus | Paid once per move when it first connects (whiffs can't farm them). Special charge per judged swipe is `SPECIAL.rhythmBonus` |
| streakTiers, streakMult | Streak 0/8/16/32 multiplies bonus score by 1/1.5/2/3 |
| streakBreakShowMin | "STREAK LOST" only shows for streaks at least this long |
| beatParryStyle, beatParryScore | Bonus for a parry whose tap was GREAT or better |
| snapDiv | Grid the contact frame snaps to (4 = 16th notes) |
| snapMaxDelayMs | The longest a strike may be delayed to reach the grid (slower grids fall back to a finer one) |
| snapMinStartupFrac, snapMinStartupFrames | How far startup may be compressed to reach an earlier grid point |
| enemyMinBeats, enemyMaxBeats | Enemy wind-ups last a whole number of beats in this range (nearest to the authored wind-up) |
| enemyMaxWaitFrames | The longest an attack-ready enemy waits for a beat before starting anyway (the strike still lands on a beat) |
| intensityTokenBonus | Extra attack tokens at section intensity 1 |
| cooldownAtLow, cooldownAtHigh | Enemy cooldown multiplier at intensity 0 → 1 |
| beatZoomPulse, beatFlash | Camera zoom pulse and arena flash per beat, scaled by intensity (downbeats ×1.6) |
| hudLookaheadMs | How far ahead the beat track shows beats |
| schedulerTickMs, scheduleAheadSec | Lookahead scheduler timer period and horizon |
| startDelaySec | Gap between starting a run and beat 0 |
| calibrateBpm, calibrateCountIn, calibrateTaps, offsetMin/Max | Calibration metronome and limits |
| minBpm, maxBpm | Imported and heard tempos are folded into this range |

## Songs (`data/songs.ts`)
A song has a `keyHz`, a `scale` (semitones, used for tuned hits and melody), a list of sections and `loopFrom` (the section the song loops back to). Each section has `name`, `kind` (intro / verse / build / drop / break / bridge: drives patterns, builds and drop impacts), `bars`, `bpm`, `beatsPerBar` (time signature), `intensity` (0..1: layers, aggression, groove) and `chords` (bar roots in semitones, cycled). The patterns themselves live in `rhythm/synth.ts`.

Beat-detection constants live in `rhythm/analyze.ts` and `rhythm/live.ts`. They are the same as in the first attempt and are documented in DECISIONS.md.

## Hand-Drawn animation and ink look

**Settings:** `animStyle` ('drawn' | 'smooth'), `attackSmooth` ('low' | 'normal' | 'high', default 'low'), `stepRate` (8–20 fps, default 12, so a step is 60 / rate ticks, clamped to 3–8), `look` ('pixel' | 'crisp' | 'smooth'), `pixelRes` (0.3–0.55 of the logical view).

**Drawings.** `drawn({ id, base, drawings: [{ hold, p, smear?, impact?, sfx?, ones?, inbetween? }] })`:
- `hold`: ticks on screen. Attack drawings sum to the move's length, and the contact drawing starts exactly on the move's startup frame.
- `ones: true`: the segment after this drawing plays interpolated at full rate.
- `inbetween: n` (0–2): generated in-between drawings on that segment.

**Display latch** (`render/animator.ts`): the drawn pose and root change only on:
- a step tick (loops and root travel), or
- a sacred event: an animation starts, the contact drawing, or any authored drawing change in a one-shot (attacks, reactions). These always show on their exact tick and hold through hit-stop.

In Rhythm Mode the step falls on the subdivision (2/3/4/6/8 per beat) nearest the step rate.

**INKLOOK** (`data/inkLook.ts`)

| Key | Purpose |
|---|---|
| heroLimbPx, heroHeadPx, enemyLimbPx | Line weights in low-res pixels (Brute/Boss limbs ×1.35) |
| headScale | Head size multiplier |
| refRes | Resolution the px weights are authored at (Crisp keeps the same world widths) |
| floorPx, reflectSquash, floorDoodles | Floor line thickness, reflection vertical scale, fixed doodles on the Blank Page |
| zoom, groundScreenFrac | Locked camera zoom (figures ≈ 13–14% of screen height) and floor position (0.79) |
| deadzoneFrac, driftOmega, punchScale | Camera drifts only when the player leaves the central dead zone; the drift spring; punch-ins scaled down |

**INKFX**

| Key | Purpose |
|---|---|
| smearMin, smearMax | Hatch strokes per smear (scaled by the sweep length) |
| scribbleSec, scribbleLoops, fragments | Scribble-energy lifetime before it breaks apart, loop count, fragment count |

**Palette** (`render/ink.ts`): paper white, ink black, blue #2436e6, red #e22424, and the reflection's dither-key gray #b0a8c8, which the Pixel post-pass turns into a checkerboard stipple. Anti-aliased edges snap to the nearest palette color through a 4096-entry lookup table.


## Smears and in-betweens (`data/smears.ts`)

**SMOOTHNESS** (the Attack Smoothness setting)

| Level | bonus | chain | strikeOnes |
|---|---|---|---|
| low | 0 extra in-betweens per moving attack segment | smear chain capped at 1 drawing | no |
| normal | +1 | 3 | no |
| high | +2 | 4 | strike segment plays on ones (every tick) |

In-betweens are generated per segment by type: anticipation (eased, clustered near the keys), strike (accelerating; the fastest in-between is stretched ×1.08) and follow-through (overshoot ease). A key marked `breakdown: true` (authored in the Lab with "Add breakdown") suppresses generation on the segments it touches. Contact key times are never moved. `SMOOTH_CHAIN.max` in `render/animator.ts` is a global cap on chain length.

**SmearCfg** (`SMEAR_DEFAULT`, per-animation overrides in `SMEAR_BY_ANIM`)

| Key | Purpose |
|---|---|
| chain | Max drawings in a smear chain (fastest in-between → contact → follow-through) |
| density | Hatch density per chain step (1 = full) |
| jitter, lenJitter | Stroke angle jitter (rad) and length jitter |
| radius, sweep | How far past the limb end the hatch reaches; how much of the swept angle it covers |
| stretch, swoosh | Limb-stretch wedge on the fastest drawing; thin swoosh line along the path |
| multiArm | Ghost arms fanned around a punch (flurry: 3) |
| minSweep | Sweeps shorter than this get no smear |
| color | Override (default: the fighter's ink color) |

`ATTACKISH` lists non-attack animations that still get the attack treatment (dashes, dodges, flips, thrown bodies).

## Paper world (`data/paper.ts`)

| Key | Purpose |
|---|---|
| paper | Paper color per page (blank, lined, graph, sketch, kraft) |
| ink, pencil, blue, red, highlighter | The pen palette, shared by the world, HUD and CSS (`--ink`, `--pencil`, … in `ui/style.css`) |
| doodleAlpha, doodleWidth | Background doodle opacity and stroke width; they must never fight the fighters |
| fibers, grain, vignette | Paper texture density, grain alpha, edge vignette |
| cleanAbove, cleanBelow | No doodles in this band around the floor (fraction of screen height) |
| boilVariants, boilFps | Baked doodle variants and how often a new one is shown |
| ruleGap, gridGap | Lined page rule spacing and graph page grid size (css px) |
| flipSec, clearedSec, crumpleSec, transitionFps | Wave-start page flip, wave-cleared check, game-over crumple; stepped at this rate |

`PAGE_ORDER` is the rotation; `game.ts` `pageFor(wave)` picks kraft every 10th wave, else rotates every `arenaRotateEvery` (3) waves. The Paper page setting overrides it.

**Sketch helpers** (`render/sketch.ts`): `penLine(wob, over)`, `penRect`, `penCircle`, `penArrow`, `penCheck`, `penScribble(step, slant)`, `penHatch(gap)`. All are seeded with `seedSketch(n)`; the HUD uses seed + boil index so strokes boil with the page. DOM borders (`ui/sketchDom.ts`) use the same idea in SVG, seeded from the element's text and size.

**Fonts:** `HAND` (Patrick Hand) for labels and numbers, `MARKER` (Permanent Marker) for titles, ranks and judgments. Both are imported in `main.ts` and inlined by `vite.config.ts` `assetsInlineLimit`.

## Weapons (`data/weapons/`)

A weapon is a `WeaponDef` (`types.ts`): `id`, `name`, `desc`, `ground` and `air` movesets (direction class × light/heavy → move id), `dodge` (`distance`, `frames`, `rope`), `range` (auto-targeting range), optional `heat`, `anims`, `smears` (merged into `SMEAR_BY_ANIM`), `tips` (first-time tooltip), `icon` and `held` (draw routines). **Add a weapon** by adding a file and listing it in `index.ts` (`WEAPON_ORDER` sets the loadout order and the 1–5 keys).

Weapon moves are ordinary `MoveDef`s (`addMove`) with these generic hooks, all resolved on the move's **contact frame** (so Rhythm Mode lands them on the grid):

| Field | Purpose |
|---|---|
| ranged | No magnetism dash; the target is picked within this range |
| aimCone | Aim along the swipe direction, snapped onto the target when it is inside this cone (degrees) |
| beam | `{ len, width, pierce, color }`: hitscan line from the hand. Not piercing = first enemy only |
| grab | `{ bowl, hold, respectPoise, behind? }` (`behind`: over-the-shoulder, released behind the hero): catch the target when the dash arrives, hold/wind up for `hold` frames, throw at contact. `bowl` multiplies bowling damage while the body flies |
| tether | `{ mode: pull / zip / swing / slam / air, frames }`: grappling hook |
| plant | `{ radius, damage, x }`: floor shockwave + crack at contact |
| deflect | Enemy darts bounce off while the move is active |
| toss | `{ speed, range, radius, bounce?, floor?, draw? }` (`bounce`: ricochet to N more enemies; `floor`: skims the floor): the weapon is thrown, spins out along the aim and returns, hitting everything once per leg (staff boomerang). Any other move recalls it |
| shoot | `{ kind, speed, count, spread, gravity, homing, pierce, life, radius, fromSky? }`: player projectiles (ink blob, paper plane, rocket fist, bubble, ice shard) |
| spikes | `{ count, spacing, start, delay }`: ground spikes erupting one after another (a single spike erupts under the target) |
| status | `{ kind: bleed / freeze / bubble / snare, frames }` applied on hit. Frozen victims shatter (×`shatterMult`) and bubbled ones pop (×`popMult`) on the next hit; bosses resist freeze / bubble / snare |
| chain | `{ arcs, dmg }`: chain lightning to nearby enemies (`chainRange`) |
| behind | The magnetism dash lands behind the target |
| fx | Presentation only: `lightning` (bolts strike the victims), `whirl` (whirlwind radius while active), `crescent` (white-crescent impact frame) |
| heat | Laser heat added per shot (0..1) |
| slowmo | `{ scale, sec, at? }`: the weapon's slow-mo moment, at contact or at the apex of the follow leap |
| grid | Rhythm Mode: coarsest grid the contact snaps to (1 = beat, 2 = 8th, 4 = 16th) |
| then | Move started automatically when this one ends (the hook's reel-in punch) |

**`HeatSpec`** (laser): `decayPerSec` (0.55), `overheatSec` (1.1), `resumeAt` (heat left after overheating), `perfectVent` (heat vented by a Perfect shot in Rhythm Mode), `bash` (the melee move used while overheated).

**`WEAPON_T`** (`tuning.ts`)

| Key | Purpose |
|---|---|
| heroMaxHeight | Highest the hero can get above the floor (chained air grabs and zips stop here) |
| ropePoints, hookMissFrames | Verlet rope points; how long a missed hook stays out |
| pullStop, pullStun | Where a yanked enemy stops in front of you, and its hit-stun on arrival |
| grabReach | Grab reach once the dash has arrived (+ the victim's hurt radius) |
| thrownFalloff | Bowling damage multiplier per extra collision of a thrown body |
| beamWallReflect | Stretch goal: piercing beams reflect once off the arena walls (off) |
| beamFrames, beamHeavyFrames | Beam flash length |
| tipMs | First-time weapon tooltip duration |
| shatterMult, popMult | Damage multiplier when a frozen enemy shatters / a bubbled enemy pops |
| chainRange | Chain-lightning jump distance |
| bleedEvery, bleedDamage | Bleed ticks (frames, damage) |
| bubbleHeight | How high a bubbled enemy floats |
| spikeWidth, spikeFrames | Ground-spike hit width and lifetime |

**`WeaponDef` extras:** `sweep(j, scale, out)` returns the weapon's striking segment; smeared drawings then fill the area it swept with a hatched crescent. `ropeStyle: 'arm'` draws the tether as a stretched arm (Throw's long arm) instead of a chain.

**Fists Reference v2** (`data/anims/fistsV2.ts`): `FIST_IDS` are rebuilt from the Legacy drawings by `refine()` (deeper crouches ×1.16, coiled pre-contact drawing, +0.06 stretch on contact, contact held up to 2 ticks longer); `CONTACT` holds per-move touches; `CRESCENT` lists moves with limb crescents (`SmearCfg.crescent`); `FIST_FX` the finisher FX. Setting `fistAnims` ('v2' | 'legacy').

**Templates:** the third batch draws every move from `author.ts` `tplAnim(id, move, template, patch)` (jab, slash, overhead, upper, low, spin, twirl, throw, shoot, shootUp, shootDown, slam, stomp, dash, air, airDown, airUp, airShoot), so the contact drawing still lands exactly on the first active frame. **DodgeSpec** also takes `blink` (teleport) and `parry` (a block that stands its ground).

**Authoring drawings:** `author.ts` `strikeAnim(id, move, { antic, hit, hit2?, follow, smear, inbetweens, ones })` spreads the drawings over the move's frame data so the contact drawing starts exactly on the first active frame. Weapon animations are listed per weapon in the Animation Lab (`weapon: <name>`), with the held weapon drawn.


## New movesets (`V2` in data/weapons/tuning.ts)

| Key | What it does |
|---|---|
| tipFrac, tipMult | Whip: hits past this fraction of the lash's length crack for tipMult damage |
| furyPerHit, furyFrames, furyDmg, furyKb | Fists Fury: fill per hit, how long it burns, damage and knockback while it burns |
| reapDelay, reapDmg | Scythe: delay after the third doom mark, and the reap's damage |
| soulHeal, deathsDoor, lifesteal | Scythe: heal per soul; below deathsDoor HP, hits heal lifesteal x damage |
| executeBase | Daggers Execute: base damage (plus `x2.detonate` per remaining bleed frame) |
| tieRange, tieLen, tieShare | Hook Tether: partner range, rope length, share of a hit passed down the rope |
| orbitDmg | Whip Lasso Spin: damage to each enemy the swung body hits |
| slideShatterSpeed, slideShatterDmg, wallFreeze | Ice: sliding faster than this on ice shatters into the next enemy; freeze from a rising wall |
| iceFriction, skateMult | Ice: friction on ice patches (normal floor 0.82) and the hero's run speed on ice |
| slipCounter | Fists: the move thrown after a slipped or parried attack |

Per-move numbers (damage, frames, shockwave range/speed, ice radius/frames, vanish frames, delays) live in `data/weapons/movesets2.ts`.

## Grappling hook mobility (`GRAPPLE` in data/weapons/tuning.ts)

| Key | What it does |
|---|---|
| roofHeight | The roof the hook bites: this far above the floor (470) |
| hipH, handOff | Rig geometry: the hip above the feet, and the hands above the hip with arms up (the rope runs to the hands) |
| minLen, maxLen | Rope length to the hip: tight hang / longest swing |
| ahead, aheadGround, aheadPerSpeed, aheadMax | How far ahead the rope lands (in the air / from the floor), plus some of the current speed |
| yank, groundClear | From the floor: the running start along the arc, and how high above the floor the first swing's bottom passes |
| gravity, pump, steer, reel, reelUp, maxSpeed | Swing physics: gravity, the forward push on the downswing, stick steering, reel speeds (normal / zip-up), top speed |
| releaseAt | A flick lets go once this far past the anchor (as a fraction of the rope) while rising |
| maxHold, maxAuto | Longest held swing / longest un-held swing (frames) |
| pop, jumpPop, fling, flingDrag | Let-go pop, web-jump pop, frames of low air drag after letting go, and that drag |
| hang | Dodge / ↑ zip-up: frames hanging under the roof before dropping (unless held) |
| zipSpeed, clingSlide, clingSlip, clingMax | Wall zip speed; the cling's slide speed, when the slide speeds up, and how long you can stay |
| wallJumpVx/Vy, wallFlatVx/Vy | Wall jump launch (up and away) and the flat side kick-off |
| kickSpeed, kickR | Body kicks while swinging: minimum speed and radius (move `hk3_kick`) |
| sideClear | ← → zips to the wall only when no enemy is on that side within this range |

