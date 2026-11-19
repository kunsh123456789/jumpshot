# Animation smoothness

This file covers three things: what made Jumpshot's animation look choppy, what changed, how smoothness is measured now, and which values control the feel. Every tunable lives in `ANIM` and `CAMERA` in `src/data/tuning.ts`.

## Before and after

The same scripted input was run against the previous build and this one: a long string, a launcher, a juggle, a spike, cancels, and direction changes. Both builds were scored by an external measurement with identical rules: per sim tick, the largest change of any joint angle, the body spin and the root position, for the player and the nearest enemy. Hit-stop, strike-contact frames and hit-reaction frames are excluded.

| Measure (about 480 ticks) | Before | After |
|---|---|---|
| Joint-angle pops (> 0.5 rad in one tick) | 44–47 | 0–1 (at most 0.51 rad) |
| Largest single-tick joint jump | 2.98 rad (171°) | 0.48–0.51 rad |
| Spin pops | 3–6 | 0–1 |
| Instant mirror flips when turning | 3–4 | 0 (every turn is eased over 4–5 frames) |

The in-game pop detector, under its own stricter rules, reports **0 pops** in all of these:

- the scripted suite at emulated **60 Hz and 144 Hz**: run starts and stops, quick direction reversals, a long string, launcher → juggle → spike, the Jumpshot finisher, and getting hit mid-attack
- about **3,500 ticks of randomized bot play** across waves 1–3, with random attacks, heavies and movement

At 144 Hz, steady running advances the rendered player by an identical amount every frame (standard deviation 0.000 world units), so the interpolation has no judder.

## What was causing the choppiness

I audited the whole pipeline. Every cause below was found in the code and fixed.

| # | Cause | Fix |
|---|---|---|
| 1 | **Joints were interpolated as straight lines between two 60 Hz skeletons.** Fast-rotating limbs cut the corner and visibly shortened between ticks, and the joint angles themselves were never interpolated. | Rendering now interpolates the pose channels (angles), the feet position, the facing turn and the squash, then runs forward kinematics at render time (`render/stickman.ts: interpJoints`). Limbs sweep along true arcs at any refresh rate. |
| 2 | **Moves never crossfaded.** The clip restart for an attack was gated on `stateFrame === 0`, but the sim had already advanced it, so every attack and cancel started from wherever the previous clip was, with no blend. This was the single largest source of pops. | Each move instance now has a serial number, and the animator restarts its crossfade whenever that number changes. |
| 3 | **Linear crossfades with no inertia.** Some transitions blended over only 1–2 frames (wall-splat 1, flinch 2, land 2). | Each tick now runs a crossfade layer and then a critically damped spring per channel. The outgoing pose keeps its momentum (clamped) while it fades. The blend length adapts so no joint is asked to move faster than `blendMaxRate`, and it is sized against the pose the move is heading for (its wind-up). |
| 4 | **The shortest arc flipped sides during a crossfade.** When a moving target crossed the angle opposite the start, the shortest path switched sides and the arm jumped (found by the pop detector). | The blend arc is chosen once and the target is unwrapped continuously. Limbs use the natural path: the direct path, or the shortest arc only on a real wraparound. |
| 5 | **Instant facing flip.** The rig mirrored in a single tick. | Facing is an eased turn (`turnFrames` 5, 4 when attacking). The body rotates through the camera plane, so the side spread of shoulders and hips collapses and re-opens. |
| 6 | **Feet slid.** The walk cycle was driven by time, not by distance, and the feet weren't planted. | The run cycle's phase advances by distance travelled. Stance feet are IK-planted and sweep back exactly as fast as the body moves forward. Stride grows with speed, swing feet lift on an eased arc, and lean follows speed and acceleration (start lean, braking skid). |
| 7 | **Spin popped on KO and tumbles.** Physics wrapped `spinAngle` by 2π, and the next tumble's target used a stale `spinAngle` against an unwound pose, so the spring chased a full turn backwards. | There is no wrapping in physics, spin resets on landing, the tumble target continues from the current pose, and a KO keeps the existing spin direction. |
| 8 | **Air-dash wind-ups jumped.** When the dash display ended, the target jumped into a half-finished anticipation. | The anticipation now continues from the dash pose. The dash pose is pre-blended toward the wind-up, and every wind-up after a dash gets at least `minAnticFrames` frames. |
| 9 | **Hit-stop vibration was a 30 Hz square wave computed in the sim.** It stuttered at high refresh rates. | The vibration is a smooth sine evaluated at render time (`hitstopShakeHz`, `hitstopShakeAmp`), applied only to the victim. |
| 10 | **Trails were a polyline of 60 Hz samples.** The newest point lagged the limb. Afterimages were also snapshots at sim ticks. | Trails are sampled every render frame from the interpolated skeleton, smoothed with Catmull-Rom curves, and drawn as a tapered ribbon with an eased alpha falloff. Afterimages are emitted at render rate from interpolated poses. |
| 11 | **The camera used a first-order follow and an instant punch-in,** and aimed at enemy positions that weren't interpolated (a stair-stepped target). | The camera's position, zoom, finisher focus and punch-in are all critically damped springs. The punch target spikes and decays, so the punch eases both in and out. The camera aims at interpolated positions. The shake was already smooth noise plus a damped spring, and is unchanged. |
| 12 | **Dash launch was nearly a teleport.** The ease-out-cubic curve covered about 30% of the distance on its first tick (up to about 120 units). | The dash now uses an ease-out-quad velocity curve with a lower average speed, which peaks at about 80 units per tick. |
| 13 | **Air-stall gravity switched on and off abruptly,** and air attacks stopped the player dead in mid-air. | Stall gravity blends in over `stallEaseIn` frames and out over `stallEaseOut` frames. An apex hang softens the top of every arc. The air hang decays velocity instead of zeroing it. |
| 14 | **Meteors fell in whole ticks.** | The meteor drawing uses sub-tick time. |
| 15 | **The keyboard chord timer used `setTimeout`.** | Chords are now polled every sim tick. Gameplay has no timers left. |

Checked and already correct: the fixed 60 Hz step with an accumulator and interpolation alpha, delta time taken from the rAF timestamp and clamped to 0.1 s, no rounding of draw positions, and particles integrated at render rate with time-scaled dt.

## The animation pipeline now

```
sim tick (60 Hz)
  poser            -> target pose + spring stiffness for this phase (+ intentional-snap flag)
  crossfade layer  -> outgoing pose (with decaying, clamped momentum) blends into the incoming target,
                      on a locked arc, over an adaptive number of frames
  spring layer     -> critically damped spring per channel (exact solution, stable)
                      with per-part lag: head 0.6x, rear arm 0.78x, lean 0.85x
  secondary        -> head spring, verlet scarf, squash & stretch, eased facing turn
render frame (any Hz)
  interpolate pose channels / feet / facing / squash by alpha -> FK -> draw
  sample motion trail + afterimages from that interpolated skeleton
```

Each move plays as: anticipation (ease-in-out, starting from the dash pose if there was one) → snap into contact (`outBack` overshoot, stiff spring) → carry-past follow-through (`carryPast`) → follow pose → slow ease back to neutral (soft spring). Shoulders turn into the strike and hips counter-rotate. The head looks at the target.

## Verification tools (in the build)

- **`` ` `` (backquote): debug panel.** Shows render FPS, sim ticks per second, the interpolation alpha, a frame-time graph (with lines at 16.7 ms and 6.9 ms), and the input mode, drag vector, stick output and recent finger speed. It also shows the **pop detector**: total pops, rolling maximum angle and root deltas, and the last events, each with the state, move frame, clip transition and channel.
- **`[`** toggles 0.1× slow motion. **`]`** freezes the game and steps one sim frame per press. **`\`** resumes normal speed.
- **`?manual`** URL flag: the loop is driven by `window.__advance(ms)` with synthetic timestamps, so tests can emulate 60 Hz, 144 Hz or any other refresh rate deterministically.
- The pop detector (`src/ui/popDetector.ts`) flags a tick when a joint angle changes by more than `popAngle` (0.5 rad), the spin by more than `popSpin` (0.9 rad), or the root by more than `popRoot` (120 units), outside hit-stop and intentional snaps. Intentional snaps are strike contact and the first `impactSnapFrames` (5) ticks of a hit reaction.

## Feel tunables (`ANIM` / `CAMERA` in `src/data/tuning.ts`)

| Key | Default | Effect |
|---|---|---|
| springStrike | 95 | Spring stiffness (rad/s) on strike frames. Higher is snappier. |
| springAnticipation | 55 | Stiffness during wind-ups and dashes. |
| springHitReact | 60 | Stiffness on flinches, launches and tumbles. |
| springLocomotion | 38 | Stiffness for run and get-up. |
| springRecovery | 30 | Stiffness for follow-through and recovery (softer). |
| springIdle | 22 | Stiffness for idle breathing (softest). |
| headLag, rearArmLag, leanLag | 0.6, 0.78, 0.85 | Overlapping action: how much each part trails the torso. |
| blendDefault, blendMoveMin/Max, blendHitReact, blendLand, blendGetup | 5, 3/5, 4, 3, 6 | Base crossfade lengths (frames). |
| blendMaxRate, blendExtraMax | 0.42 rad/frame, 6 | Adaptive crossfade: the maximum joint speed, and how many frames the blend may be extended. |
| outgoingMomentum, outgoingMaxVel | 0.55, 6 rad/s | How long the outgoing pose keeps moving during a crossfade. |
| turnFrames, turnFramesAttack | 5, 4 | Length of the eased facing turn. |
| carryPast, carryFrac | 0.14, 0.3 | How far the follow-through carries past contact, and for how long. |
| minAnticFrames, dashTowardAntic | 6, 0.45 | Wind-up length after a dash, and how far the dash pose is pre-blended toward it. |
| headLook | 0.35 rad | Maximum head tilt toward the target. |
| strideBase, stridePerSpeed, strideMax, footLift, runBounce | 40, 0.1, 90, 15, 5 | The run cycle. |
| runLeanPerSpeed, accelLean, maxAccelLean | 0.0006, 0.00012, 0.28 | Lean into speed, start lean and braking skid. |
| apexBand, apexGravity | 220, 0.6 | Apex hang at the top of arcs. |
| stallEaseIn, stallEaseOut | 2, 7 | Frames for the air-stall gravity to blend in and out. |
| hitstopShakeAmp, hitstopShakeHz | 3 px, 38 Hz | Vibration of the victim during hit-stop. |
| trailLife, ghostInterval | 0.11 s, 0.022 s | Motion-trail length and afterimage spacing. |
| popAngle, popSpin, popRoot, impactSnapFrames | 0.5, 0.9, 120, 5 | Pop detector thresholds. |
| CAMERA.followOmega, zoomOmega, zoomOutOmega | 7, 4.5, 9 | Camera springs (rad/s). |
| CAMERA.punchDecay, punchOmega | 7, 32 | Punch-in decay rate and its eased spring. |
