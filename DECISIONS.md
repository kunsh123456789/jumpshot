# Design decisions

These are the judgment calls made where the brief was silent or where two requirements pulled against each other. Game feel won every tie.

## Input and the draw pad

- **Heavy detection without waiting.** The brief asks for both "commit as soon as the stroke passes the minimum distance" and "a long, fast stroke is HEAVY". Those conflict, so every swipe commits immediately as a **light** move. If the same stroke keeps going straight and fast past the heavy length within `PAD.heavyUpgradeFrames`, the pad emits an `upgrade` event. The in-flight move is then swapped for its heavy variant before its strike frame: elapsed frames are kept, the anticipation stretches, and the pose does not pop. If the light attack has already struck, the upgrade is ignored, so one stroke never produces two attacks.
- **Chaining.** A stroke tracks a sliding anchor. When the local direction differs from the committed direction by more than `chainTurnDeg` (60°), a new swipe starts at the turn point. Zig-zag scribbles fire E, W, E, W and so on.
- **Cardinal bias.** Directions use exact 22.5° sectors, plus a small bias (`cardinalBiasDeg`) that snaps toward N, S, E and W. N is the launcher and S the spike, so misreading them costs the most.
- **Slow drags are movement.** In revision 1, slow drags became drag-to-move, so the earlier rule that a slow drag commits as an attack on release was removed.
- **Extra touches are ignored.** Only the first pointer that starts inside the pad is tracked.
- **Buffer.** It holds up to 2 swipes, and when it is full the newest swipe replaces the tail, which follows the player's latest intent. A buffered swipe does not age during hit-stop, and it does not age while the player is committed to a move before its cancel window. Without that rule, a long magnetism dash or heavy startup would eat the swipe. Once the window is open, swipes expire after 12 frames (~200 ms).
- **Keyboard chords.** When two attack keys are pressed within 34 ms of each other, they form a diagonal. The chord window is polled each sim tick, not timed with `setTimeout`.

## Targeting and magnetism

- **Target choice.** The target is the nearest enemy inside a 70° cone around the swipe. If the cone is empty, the fallback is the nearest enemy on the swipe's horizontal side, then the nearest enemy anywhere. This keeps "swipe right = attack right" while never whiffing when enemies are around. N and S swipes always pick by distance, because enemies stand level with the player.
- **Dash timing.** The magnetism dash overlaps the move's startup: the strike lands at `max(startup, dashFrames)`. The fighter visibly reacts on the next sim frame, so input-to-motion latency is at most 1 frame. The debug overlay shows the measured commit-to-start latency.
- **Homing.** The dash re-aims every frame, so a moving target is still hit when the dash ends.
- **Pre-hang.** Airborne targets get a brief stall while the player winds up, so air chains connect. This stall shrinks with juggle depth so it cannot create infinites. The Jumpshot finisher freezes its target fully for the cinematic.
- **Jump-up attacks.** A ground swipe at a target that is clearly airborne turns into the matching air move, with a jump-dash.
- **Low air swipes.** When the player is airborne but low and chasing a grounded target, the matching ground move is used instead.
- **Shield cross-up.** "A swipe from the opposite direction breaks the guard" is implemented as follows: swiping *away* from a guarding Shield enemy vaults the player behind it, and the hit lands on its back. Sweeps and slide kicks also break the guard.

## Combat and juice

- **Hit-stop is per fighter.** Only the attacker and the victim freeze, and the victim jitters along the hit direction. Global slow-mo works by scaling the fixed-step accumulator, so the sim stays a deterministic 60 Hz and simply runs fewer steps per real second.
- **Cosmetic effects run at render rate.** Particles, camera shake and text use the time-scaled `dt` in the render loop, which keeps them smooth on 120/144 Hz displays. They never feed back into the sim.
- **Directional shake.** Each shake combines trauma noise with a directional spring kick and a small rotation on heavy hits. It is capped by `JUICE.shakeMax` and multiplied by the Screen shake setting. The Hit-stop strength setting scales hit-stop frames.
- **Camera framing.** In landscape, the pad overlays the floor area below the ground line. The camera therefore never pans down. Aerial play zooms out around the ground line instead, so the floor never slides under the pad. The one exception is the brief finisher close-up.
- **Anti-infinite rules.** Damage, hitstun, juggle knockback, gravity and stall all scale with hits. On top of that:
  - Only one off-the-ground (OTG) hit is allowed per knockdown.
  - Upward knockback fades above a juggle ceiling, which keeps juggles on screen.
  - Enemies can **burst** out of grounded strings after `burstThreshold` hits, and out of very long juggles after `burstThreshold × airBurstFactor` hits.

  The brief limits only enemies this way, and the player is never limited.
- **Bounces per combo.** Ground and wall bounces are counted per combo, not per enemy. Upgrades add more.
- **KO bodies.** KO'd bodies keep flying and bowl into other enemies. That collision counts toward the combo, which makes crowd hits satisfying.
- **Dropped combos.** A combo dropped by taking damage still shows its summary, labelled COMBO BROKEN, but earns no style bonus.

## Enemies and structure

- **Tokens.** The attack-token count grows from 1 to 3 over the waves. Bosses don't use tokens.
- **Telegraphs.** Every windup has a red glow, a tremble and a pulsing red ring on the ground. Telegraphs shorten slightly after wave 8.
- **Boss "combo stage".** The Colossus has heavy poise. Breaking it opens a long stagger window: it can be launched and juggled, and poise only refills when the window ends. Phase 2 (62% HP) adds telegraphed meteor strikes and summoned grunts. Phase 3 (30% HP) speeds up its windups and adds more meteors.
- **Waves.** Waves 1–10 are hand-authored to introduce each enemy type. Later waves are generated from a growing budget, with enemy HP scaling +6% per wave after wave 10. Arenas rotate every 3 waves: dojo, rooftop, neon and volcano.
- **Super Meter costs.** The meter maxes at 100, and each finisher costs 50, so two finishers can be banked.
- **Upgrade picker.** The between-wave flow is: wave clear → partial heal → upgrade pick (the game waits for your choice) → 3-second breather → next wave.

## Presentation

- **Menus.** They are DOM overlays, which are crisper and more accessible than canvas widgets, especially sliders on mobile. The title stickman, HUD, pad and all gameplay visuals are canvas.
- **Upgrade icons.** They are emoji text glyphs, not image assets.
- **Portrait mode.** It crops the 1280×720 logical view to a 760-unit-wide band so fighters stay readable, and keeps the pad at 42% or more of the screen height. In left-handed mode the landscape pad shifts to the left side of the screen. The pause button stays top-right, because the HP bar owns the top-left corner.
- **Music.** It is a procedural 124 BPM groove, and an arpeggio layer intensifies with style rank.

## Deliberately skipped

- **Best-combo replay** (a stretch goal). The sim is deterministic: fixed step, seeded RNG, and no render-dependent logic. But snapshotting 10 seconds of full sim state, and building a replay viewer on top of it, was a poor trade against polish time. Adding it later would mean recording `SwipeEvent`s with frame numbers plus the RNG seed at wave start, then re-simulating.

## Revision pass 1: smoothness, full-width pad, drag-to-move

### Animation
- **Pose blending.** Pose blending is a crossfade layer followed by a critically damped spring per channel, rather than an n-way weighted blend of live clips. The outgoing pose is the snapshot of where the limbs actually were, and it keeps its (clamped, decaying) momentum while its weight fades out. This blends from wherever the limbs are, gives inertia, and is cheap. The details and before/after numbers are in SMOOTHNESS.md.
- **Joint-angle paths.** The brief asks for the shortest arc. Applied literally, the shortest arc made arms flip over the back of the head when the short way was only slightly shorter, which the pop detector flagged. Limbs therefore take the direct path between authored angles, and switch to the shortest arc only when the direct path is more than 1.2 rad longer (a real wraparound). Body spin is never wrapped, because it carries authored flips such as the Jumpshot finisher; it is unwound only on clip changes, at both interpolation endpoints.
- **Turning.** Turning is a 2D "rotation through the camera plane": facing eases from +1 to −1 over 4–5 frames, and the side spread of the shoulders, hips and stance collapses and re-opens. For a stickman seen from the side, this is the projection of a real yaw turn. It is not a scale flip, because the IK knee direction and the shoulder/hip counter-rotation follow it.
- **Pop detector exemptions.** The detector exempts strike contact (the last 2 wind-up frames through 3 frames after contact) and the first 5 ticks of a hit reaction, as intentional snaps. A punch landing and a body reacting to a hit are supposed to be sudden. Every other transition, including cancels, must stay under 0.5 rad per tick.
- **Dash speed.** Dash average speed went from 2,700 to 2,400 units/s, with an ease-out-quad velocity curve. The peak tick is about 80 units instead of about 120, so it still reads as a fast lunge but never as a teleport.

### Pad
- **Default band.** The pad is the full-width bottom 50% of the screen, adjustable from 35% to 60% in Settings. It draws no panel, only a faint gradient and a hairline at its top edge, plus a one-time label (`DRAG = MOVE · FLICK = ATTACK · TAP = DODGE`) that fades after about 7 seconds of a player's first run.
- **Landscape world.** The ground line moved up to logical y = 410, so fighters stand above the pad's top edge on 16:9 screens, and the floor shows through the transparent pad.
- **Portrait world.** The world is cropped to a 640-unit-wide band that runs down behind the pad, so the arena fills the screen instead of leaving a black gap.
- **Safe areas.** Insets are read with an `env(safe-area-inset-*)` probe element. The pad stays clear of the home bar and side notches. The pause button stays top-right in the upper half, outside the touch area.
- **Left-handed mode.** A full-width pad is ambidextrous by nature, so left-handed mode now only mirrors the pad's label to the left side. The pause button stays top-right because the HP bar owns the top-left corner.

### Drag-to-move
- **Floating stick.** The stick anchors where the touch starts, with a 10 px dead zone and full speed at 90 px. Past the radius, the anchor follows the finger, so reversing direction responds immediately.
- **Flick versus drag.** Over the last 75 ms of samples, a stroke that is faster than 1,000 px/s *and* longer than 40 px is an attack. Anything else is movement. While the finger is moving faster than 800 px/s, the stick output is held, so the first frames of a flick never move the player. After a flick, the stick re-anchors on the finger and movement is suppressed for 4 frames.
- **Re-arming.** Re-arming is measured by path speed (finger speed along its path), not net displacement. Net displacement collapses at the turn of a zig-zag, which made each reversal fire twice. A 60 ms minimum before re-arming means one flick can never produce two attacks.
- **No depth band.** Movement is horizontal only. The arena is a side-on 2D plane with a single ground line: every hitbox, bounce, shockwave and shadow assumes it, and a depth axis would have made launches and spikes ambiguous. Vertical finger motion never moves the player, and a slow vertical drag never attacks; only a fast vertical flick does.
- **Facing.** The player faces their movement direction (beat-'em-up convention). Attack magnetism still turns them toward the target, with an eased turn.
- **Keyboard remap.** Movement went to A/D and ←/→, and attacks to I/J/K/L, so the two never share a key.
- **Test-harness note.** Playwright spaces synthetic mouse moves about 16 ms apart, so automated flicks use strokes of 140 px or more to exceed 1,000 px/s. Real finger flicks are usually 1,000–3,000 px/s.

## Revision pass 2: pose-to-pose animation

- **Replaced, not tweaked.** The spring/crossfade animator was removed. Animations are now authored key poses with per-key easing, evaluated exactly. The only blends are 1–4 frame snap-out crossfades on interruption (a cancel, a hit or a state change), which start from the current pose. This is the core change; the diagnosis is in ANIMATION_DIAGNOSIS.md.
- **Reused pose channels.** The pose format reuses the existing rig channels, plus a new `stretch` channel for authored squash and stretch. Every channel is editable in the lab. Grounded keys plant the feet with IK, and air keys use FK legs. The striking limb is IK-reached onto the target's near surface around contact, after the authored pose.
- **Staggered timing as per-group time leads.** Hips lead by 1 frame, torso and upper arms by 0.5, and the head trails by 1. The striking forearm or leg is never offset, so contact stays exactly on the authored frame. Leads of 2 frames made explosive moves such as the launcher stand up before the punch, so I reduced them.
- **Gameplay timing.** Frame data stays the source of truth. A player attack's contact key is authored on the move's startup frame, and the animation length equals startup + active + recovery. When a magnetism dash stretches the startup, the authored dash pose plays first and the anticipation starts straight out of it. Enemy anticipation is time-stretched over the attack's windup, so every telegraph is one large, readable wind-up pose. Hit-stop freezes the fighter, which holds the contact pose. Every key is mapped this way, so no move's frame data prevented good animation.
- **One gameplay-data change: magnetism stand-off.** I raised `reach` (where the auto-dash stops, not the hitbox) by 10–14 units on 19 moves. The new long-limbed rig made the two bodies overlap at the old spacing, which hid the contact pose. Hitboxes, damage and frame data are unchanged, and every move's hitbox still reaches well past the new stand-off (checked per move).
- **One color, no outlines.** Fighters are drawn in one color with uniform round-cap lines and no outlines, as the brief asks. Front and rear limbs are therefore indistinguishable, so moves that differ only by which arm punches would look identical. Every move is authored with a distinct silhouette instead: jab1 is a mid straight, jab2 a low body shot, the cross an overhand, the hook a bent-arm riser, and the launcher a vertical line.
- **Kept details.** Enemies keep a small eye dot so their facing reads, and the player keeps the headband. The red telegraph glow stays as a gameplay-readability exception to the single color.
- **Smears.** A smear is the area the limb sweeps, sampled with FK between the pose two ticks ago and now, in body-local space so dashes don't stretch it. It is drawn only on the frame before a smear key and on the key frame itself.
- **Impact frames.** Every hit gets radial speed lines. Heavy hits, launchers, spikes and finishers also get a 2-frame inverted-color flash, which is disabled when Reduce flashes is on.
- **Shorter juice.** The hit spark, ring and victim flash were shortened, because they covered the contact pose. The pose freezing with sound and lines now carries the impact.
- **Facing.** The eased facing turn from revision 1 stays at 4 frames (3 when attacking). Without it, every magnetism dash would start with a full-body mirror pop.
- **Backgrounds.** Parallax layers draw at 50% opacity and ambient particles are dimmer, for a calmer, higher-contrast backdrop. Fighters get a faint ground reflection.
- **Footsteps.** Run and land keys carry sfx flags, which play soft footstep and landing sounds for the player only.

## Revision pass 3: Rhythm Mode

**The brief arrived truncated.** It ends mid-sentence at "The sim and rendering consume the beat clock by…", so the milestone list it refers to never arrived. I followed everything up to that point and set this milestone order, verifying each one in the running game and re-running the Classic fingerprint after each:
1. The mode flag, the AudioContext beat clock, the lookahead conductor and the built-in sectioned songs.
2. Input judging, rewards, the beat HUD and latency calibration.
3. Snapping player attacks onto the grid.
4. Enemies attacking on the beat, and on-beat parry.
5. Musical juice: tuned hits, notes on the grid, the groove pulse, sections driving intensity, beat-locked idles.
6. Song import and Listen mode on the new clock.
7. Docs, regressions and publishing.

**Git: `pre-rhythm` and `rhythm-attempt-1`.** The repo already held a first rhythm attempt (commit c159ba5), which edited core systems directly. That is the attempt that "went badly". Tagging the current state as `pre-rhythm` would have pointed the tag at a rhythm build. So `pre-rhythm` marks c147f01, the last game with no rhythm code, and `rhythm-attempt-1` marks c159ba5. The working tree was then restored to `pre-rhythm`, and Rhythm Mode was rebuilt on top as an additive layer. The two pieces of the first attempt that had been tested well, song beat detection (`analyze.ts`) and the mic tracker (`live.ts`), were moved into `src/rhythm/` unchanged, apart from adding per-beat loudness. Note: the remote git proxy rejects tag pushes, so the tags exist in the local repo. Their commits are on the pushed branch.

**Isolation.** Rhythm logic lives in `src/rhythm/`, tunables in `data/rhythm.ts` and `data/songs.ts`. The simulation sees only the `RhythmSim` interface through `world.rhythm`, which is `null` in Classic, and every call site is `if (w.rhythm)`. Core files changed only where a hook has to sit:
- one guarded call each in `player.ts`, `combat.ts` and `enemyAI.ts`;
- a `snapBase` field on Fighter (0 in Classic) that the poser uses to stretch the anticipation;
- a `locked` flag on TimeControl;
- a `pitchFn` slot on FxDirector;
- a pose-beat setter in the poser;
- keyboard events now stamped with their keydown time (the sim never reads `ev.time`);
- the title toggle and settings rows.

**Proof that Classic is unchanged.** `t_classic_fp` drives 3,600 sim frames in `?manual` mode with a scripted input sequence and hashes player, enemy and score state every frame. The golden hash was recorded on the restored `pre-rhythm` source before any rhythm code existed. After every milestone it reported IDENTICAL. The classic play, parry, waves (0 pops) and tutorial tests pass too.

**The beat clock is the AudioContext.**
- Song time is `ctx time − songStart`. A tempo map of constant-tempo segments converts song time to beats and back. That gives tempo changes and time-signature changes for free, and the same structure holds a detected beat list (one segment per beat) or a live grid.
- Gameplay uses *heard* time: the context time the listener hears now. That is `ctx.currentTime` minus output latency, measured through `getOutputTimestamp()`, so visuals, judging and enemy strikes line up with the ears, not with the scheduler. Pointer timestamps are mapped onto that same heard timeline, and the calibration offset is subtracted.
- Each fixed sim step receives the perf time it advances to (from the main loop's accumulator), which maps to its heard time. No rhythm decision uses the frame count or `performance.now()` as a clock.

**Scheduler.** This is the classic two-clocks pattern: `setInterval(25 ms)` schedules every 16th-note step whose time falls within 120 ms of `currentTime`. Measured: every scheduled note's start sits exactly on the grid (0.0000 ms error). The tempo map is built lazily a few seconds ahead, section by section, and loops back to `loopFrom` forever.

**Snapping attacks.**
- When a move starts, its natural contact time is `now + effStartup` frames. It snaps to the nearest 16th-note grid point by compressing the startup (to no less than 60%) or delaying it (by no more than 135 ms; slower tempos fall back to 32nds).
- The magnetism dash and any air hangs are re-timed proportionally, and every startup tick re-derives the contact frame from the clock.
- The authored anticipation is played stretched or compressed over the snapped startup, so a delayed strike reads as a deliberate wind-up "waiting for the beat", not a stall.
- Measured: first contact lands within one sim frame (≤ 8.3 ms) of the grid on all three songs. Startup changes range from −4 to +7 frames, with most within ±3.
- Multi-hit moves keep their authored hit spacing after the first contact. Snapping each sub-hit would distort moves like the flurry.

**Judging is separate from snapping.** The swipe's own timing against the nearest beat decides the grade, as the brief says. Snapping just makes every hit musical. Off-beat 8ths count as GOOD (±60 ms) so fast juggles keep the streak. **MISS has no penalty**: same damage as Classic, just no bonus. The only thing it costs is the streak. This keeps the game fun without rhythm experience while on-beat play clearly pays more (up to ×1.6 damage plus bonus score up to ×3).

**Enemies on the beat.**
- An attack-ready enemy squares up and waits for the next beat, at most 40 frames. Its wind-up is a whole number of beats (1–3, nearest the authored length), so the strike lands on a beat.
- If it started mid-beat after a long wait, the wind-up is pushed to at least 75% of that many beats so it stays readable.
- The remaining wind-up is re-derived from the clock each tick, so hit-stop can't push the strike off the beat.
- Pips above the enemy count the beats down, with a red pip for "strikes on the next beat", and a soft tick sounds on each heard beat.
- Measured: strikes land within 7.6 ms of the beat, and scripted on-beat taps parried 3 out of 3, each earning ON-BEAT PARRY.

**Sections drive the fight.** Intensity per section adds an attack token (from about 0.6 intensity up, so builds and drops get +1), scales cooldowns from ×1.35 (calm) to ×0.75 (drop), adds synth layers, and scales the groove pulse. Builds roll the snare into a crash, and drops land with a camera shake and a magenta flash. For imported and heard music, loudness bands (smoothed per-beat RMS, normalized between percentiles, with hysteresis) stand in as CALM, GROOVE and PEAK sections.

**Hits are notes.**
- Hit pitch walks the song's scale over the current bar's chord, one octave of range, so a long combo plays a phrase in key.
- Each targeted strike also gets a short chord-tone pluck scheduled on the audio clock at its exact grid time, ahead of time, which beats the output latency. If the move is interrupted before contact the pluck is cancelled.
- The impact sound itself plays when the sim lands the hit, so it reaches the ear one output latency late (about 35 ms measured). That is inherent unless visuals are delayed too, so the pre-scheduled pluck carries the "on the grid" feel.
- The pluck is disabled for imported and heard music, because their key is unknown and plucks could clash.

**Slow-motion is locked off in Rhythm Mode**, because it would desync the sim from the music. Hit-stop is per-fighter and short, so it stays. Finishers keep their camera focus and impact frames. Slow-mo returns at game over.

**Calibration uses the real pad** with its own metronome conductor, so calibrating from the pause menu doesn't disturb the paused run's song. It takes the median of 12 inputs after a 4-click count-in, ignoring anything more than 250 ms off. In tests, a simulated player 40 ms late measured +40 ms, and their inputs then judged PERFECT.

**Tutorial stays Classic.** It teaches the moves without a beat. After it, Rhythm Mode shows the song picker.

**What I'd do next.** Beat-snap the sub-hits of multi-hit moves to 16ths where it doesn't distort them. Add a "practice" song with a slower 90 BPM and wider windows. Add downbeat detection for imported songs, whose bar accents currently count from the first detected beat.
