# Tuning reference

Every gameplay and feel number lives in `src/data/`. You can change any of them without touching logic. Units: **world units** (the logical view is 1280×720), **frames** (60 Hz sim frames, 1 f ≈ 16.7 ms), **seconds**, or **px** (CSS pixels on the pad).

The player can also change these in-game settings: **Flick sensitivity** (divides `flickSpeed`, `flickMinDist`, `heavyDist` and `heavySpeed`) and **Touch area** (`settings.padRegion`, 0.35–0.6).

| File | Contents |
|---|---|
| `data/tuning.ts` | Global feel constants (tables below) |
| `data/moves.ts` | Every player move: frame data, damage, knockback, hit-stop, shake, cancels, poses, trails |
| `data/enemies.ts` | Enemy stats, attacks (telegraph/active/recovery), boss phases, projectiles |
| `data/waves.ts` | Authored waves 1–10, the budget generator, and HP scaling |
| `data/upgrades.ts` | The 22 roguelite upgrades and the `Stats` they modify |
| `data/rhythm.ts` | Rhythm mode: judgement windows, grade rewards, streak tiers, enemy beat-sync limits, built-in tracks |

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
| heavyDist, heavySpeed, heavyUpgradeFrames | A flick that keeps going this far (px) at this average speed (px/s) within this many frames upgrades to HEAVY |
| sectorHalfDeg, cardinalBiasDeg | 8-way direction sectors, plus extra tolerance toward N, S, E and W |
| chainTurnDeg | While still fast, a turn sharper than this fires the next attack (zig-zag chains) |
| tapMaxDist, tapMaxMs | Maximum travel (px) and duration for a tap (dodge/parry) |
| trailFadeMs | Lifetime of the finger trail |

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
| groundBounces, wallBounces | Bounces allowed per combo (upgrades add more) |
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

## SUPER
| Key | Purpose |
|---|---|
| max, finisherCost | Meter size and the cost of each finisher (2 can be stored) |
| perHitBase, rankMult | Gain per hit, multiplied by the current rank |
| parryGain, orbGain | Gain from a parry and from a super-orb pickup |
| jumpshotMinJuggle | Air hits needed in the current airtime for the Jumpshot finisher |
| flurryMinCombo | Combo length needed for the Flurry |

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

`MOVE_MAP` maps a direction class (side / upDiag / up / downDiag / down) × light/heavy to a move, for the ground and the air.

## enemies.ts fields
- **Per enemy:** `hp`, `poise` and `poiseRegenFrames` (armor), `scale`, `thickness`, `color`, `walkSpeed`, `holdDist` (waiting distance without a token), `weight` (knockback taken), `launchMult`, `burstThreshold`, `blocksFront`, `cooldown`, `score`, `hpBar`, `scarf`, `cost` (wave budget).
- **Per attack:** `windup` (the telegraph), `active`, `recovery`, `damage`, `hitbox`, `range`, `lunge` and `stepIn` speeds, knockback, an optional `projectile` and `shockwave`, and poses.
- **`BOSS`:** phase HP thresholds, meteor timing, damage and radius, summon interval, stagger length, and the phase 3 speed-up.
- **`PROJECTILE`:** radius, reflect speed and damage, and lifetime.

## waves.ts / upgrades.ts
- **`WAVE_GEN`:** budget growth, enemy cap, and HP scaling after wave 10.
- **Upgrades:** each has `maxStacks`, a pick `weight`, and an `apply(stats)` function. The `Stats` fields are documented inline in `upgrades.ts`.

## RHYTHM (`data/rhythm.ts`)
All times are in ms, measured between the moment a beat is **heard** (output latency compensated) and the moment the pad recognized the input (pointer-event timestamp). The player's calibration offset (`settings.rhythmOffset`, −200..+200) is subtracted from the input time first.

| Key | Purpose |
|---|---|
| perfectMs, greatMs, goodMs | ± window to the nearest beat for PERFECT, GREAT and GOOD (50 / 85 / 115) |
| halfBeatMs, halfBeatMaxFrac | Off-beat (8th-note) inputs within ±55 ms of the half-beat, capped at 12% of the beat length, also count as GOOD. This keeps fast juggles viable |
| damageMult | Damage multiplier for the move an input started: [OFF, GOOD, GREAT, PERFECT] = [0.7, 1, 1.2, 1.45] |
| superBonus, styleBonus | Extra super meter and style, paid once per move when it first connects |
| streakTiers, streakScoreMult, streakStyleMult | Streak lengths 0/8/16/32 → score ×1/1.25/1.5/2 and style gain ×1/1.15/1.3/1.5 |
| streakBreakMin | An OFF only shows "STREAK LOST" if the streak was at least this long |
| rhythmParryStyle, rhythmParryScore | Bonus for a parry whose tap was GREAT or better |
| enemyWindMinFrac, enemyWindMaxExtra | Enemy wind-ups are stretched so the strike lands on a beat: never shorter than 75% of the authored wind-up, never more than 40 frames longer (otherwise the wind-up is left unsynced) |
| minBpm, maxBpm | Detected tempos are folded into 72–168 BPM by halving or doubling |
| hudLookaheadMs | How far ahead the beat track shows beats |
| calibrateBpm, offsetMin, offsetMax | Calibration metronome tempo and offset limits. A calibration needs 12 inputs after a 4-click count-in |
| TRACKS | Built-in tracks: id, name, BPM and style (dojo / neon / volcano patterns in `music/tracks.ts`) |

Beat-detection constants live next to the code:

| Where | Constants |
|---|---|
| `music/analyze.ts` | 22.05 kHz mono, 1024-pt FFT, 256 hop (11.6 ms); 0.4 s detrend; tempo prior centered at 120 BPM with σ = 0.9 octaves; DP tightness 100; grid snap when the robust line fit has RMS < 15 ms and ≥ 90% inliers; BIAS_SEC alignment +8 ms |
| `music/live.ts` | 1024-pt analyser, flux ≤ 6 kHz; 8 s window at 100 Hz bins, estimated every 250 ms; tempo PLL gain 0.15, phase gain 0.35; a new tempo must repeat 4× (≈1 s) before the grid jumps; locks after 1.5 s stable at confidence > 0.08 |

