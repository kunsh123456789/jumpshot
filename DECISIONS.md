# Design decisions

These are the judgment calls made where the brief was silent or where two requirements pulled against each other. Game feel won every tie.

## Input and the draw pad

- **Heavy detection without waiting.** The brief asks for both "commit as soon as the stroke passes the minimum distance" and "a long, fast stroke is HEAVY". Those conflict, so every swipe commits immediately as a **light** move. If the same stroke keeps going straight and fast past the heavy length within `PAD.heavyPromoteFrames`, the pad emits a `promote` event. The in-flight move is then swapped for its heavy variant before its strike frame: elapsed frames are kept, the anticipation stretches, and the pose does not pop. If the light attack has already struck, the promotion is ignored, so one stroke never produces two attacks.
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
- **Bounces per combo.** Ground and wall bounces are counted per combo, not per enemy.
- **KO bodies.** KO'd bodies keep flying and bowl into other enemies. That collision counts toward the combo, which makes crowd hits satisfying.
- **Dropped combos.** A combo dropped by taking damage still shows its summary, labelled COMBO BROKEN, but earns no style bonus.

## Enemies and structure

- **Tokens.** The attack-token count grows from 1 to 3 over the waves. Bosses don't use tokens.
- **Telegraphs.** Every windup has a red glow, a tremble and a pulsing red ring on the ground. Telegraphs shorten slightly after wave 8.
- **Boss "combo stage".** The Colossus has heavy poise. Breaking it opens a long stagger window: it can be launched and juggled, and poise only refills when the window ends. Phase 2 (62% HP) adds telegraphed meteor strikes and summoned grunts. Phase 3 (30% HP) speeds up its windups and adds more meteors.
- **Waves.** Waves 1–10 are hand-authored to introduce each enemy type. Later waves are generated from a growing budget, with enemy HP scaling +6% per wave after wave 10. Arenas rotate every 3 waves: dojo, rooftop, neon and volcano.
- **Super Meter costs.** The meter maxes at 100, and each finisher costs 50, so two finishers can be banked.
- **Between waves.** Wave clear → partial heal → a 3-second breather → next wave (revision pass 7 removed the old blocking pick; see below).

## Presentation

- **Menus.** They are DOM overlays, which are crisper and more accessible than canvas widgets, especially sliders on mobile. The title stickman, HUD, pad and all gameplay visuals are canvas.
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

## Revision pass 5: match the reference animation style

**Source material.** `reference/` held only a README: no GIF, no `sheet0-3.png`. I used the five contact sheets that came with the brief (frames 25–99 and 360–466), saved into `reference/`. Frames 0–24 were never seen, so for those I worked from the brief's description. REFERENCE_NOTES.md maps every technique to its frames and its implementation.

**Missing systems.** The brief mentions a TimeDirector, the Jackpot Core and a weapon system. None exists in this codebase; the passes that would have added them never happened here. Slow-mo is the existing TimeControl: it slows the sim, so drawing holds stretch naturally, and Rhythm Mode still locks it off. The dropped-weapon prop and per-drawing held weapons are skipped, as the brief allows. The only thin-line prop is the Shield enemy's outline shield.

**Two styles, one data path.** Animation Style is a setting.
- **Hand-Drawn** (default): stepped drawings.
- **Smooth**: the previous interpolated system, unchanged, with its own original key data.

The registry swaps between the two sets, so Smooth keeps the poses it was tuned with.

**How stepping works.**
- `evalAnimStepped` holds each key as a drawing: no easing, no staggered leads, no crossfades.
- A display latch per animator decides when the screen shows a new drawing. The drawn root position is latched with it, so dashes and jumps jump across the screen like the reference.
- The sim (hitboxes, physics, frame data, input buffer) still runs at 60 Hz. The Classic fingerprint test with the previous camera is identical in Hand-Drawn mode, so the animator change touches no gameplay.

**When a drawing changes.**
- **Step ticks** govern loops (idle, run, tumble) and root travel. The Step Rate slider controls them.
- **Sacred events** always latch on their exact tick: an animation starting, the contact drawing, and any authored drawing change in a one-shot (attacks, reactions).

I first had every drawing change wait for the step grid. That fights the brief's "every drawing change lines up with the move's frame data": a 4-tick jab cannot show 2–3 anticipation drawings on a 5-tick grid. So authored holds rule one-shots, and the grid paces everything else.

**Contact on the exact tick.** The poser used the post-increment frame counter, which showed the contact drawing one tick before the hit resolved. In Hand-Drawn mode it now maps the frame just processed. Verified 14/14 and 15/15: the contact drawing latches on the same tick as the hit. An attack's first drawing appears on the tick the attack starts. No input lag is added, because drawings never delay the sim.

**Rhythm Mode.** Steps follow the musical subdivision (2/3/4/6/8 per beat) closest to the step rate, so drawings change on the same grid the strikes are snapped to. Measured after this pass: strikes still land within 8.2 ms of the 16th grid, enemy strikes within 8.2 ms of the beat, and on-beat parries 3/3.

**Re-authoring.**
- **By hand (30 animations, `handDrawn.ts`):** idle crouch, run, run start/stop/turn, the dash and air-dash flat lunges, leap, fall, land, dodge, jab, jab 2, cross, spinning backfist, hook, launcher (light and heavy), the three air kicks, air heavy, spike, light and heavy hurt, launched, tumble, knockdown, lying, get-up. Each attack has 2–3 anticipation drawings into a fully committed contact pose. Lengths and contact frames are identical to the originals (checked 30/30).
- **Automatic pass (the rest):** enemy idles, walks, taunts and every enemy attack; the finishers (jumpshotFinisher, flurry, flurryEnd); knee, sweep, slide, stomp, aslash, arise; hurtBehind, groundBounce, wallSplat, stunned, guardbreak, burst; parry. These get `dramatize()`: the original keys held as drawings, angles pushed 25% further from the base pose, deeper crouches, wider stances, more stretch on contact. **That is not hand re-authoring.** They are the obvious next work, especially the finishers and enemy attacks. Enemy wind-ups were already stretched over the attack's wind-up, so in Hand-Drawn mode the wind-up drawing becomes one big held telegraph pose. That turned out readable even before hand work.

**The scarf** became a stepped 2-segment red headband line that changes only with the drawing (reference frame 46), instead of the verlet ribbon.

**Pixel Look.**
- The world is drawn into a low-res canvas (0.4× the logical view) and every pixel is snapped to the palette through a 4096-entry lookup table. Canvas 2D can't turn anti-aliasing off, so post-quantization is the reliable way to get hard 1-bit edges.
- Plain gray was removed from the palette. Otherwise anti-aliased edges turned the floor line gray. The reflection's gray comes from a reserved key color the pass turns into a checkerboard stipple.
- The result is upscaled with nearest-neighbor. Text, HUD, pad and menus stay on the full-resolution layer.
- **Performance, honestly:** in headless (software-rendered) Chrome the Pixel path costs about 4.4 ms per frame, against about 0.9 ms for Crisp. 1.2 ms of that is the `getImageData` readback; the rest is the quantize loop and low-res drawing. It runs at a steady 60 fps with 16 enemies, but it is *not* cheaper than Crisp, contrary to the brief's expectation. A WebGL palette shader would remove the readback if it becomes a problem on low-end phones.

**Camera.** In the ink looks it's a locked wide shot: zoom 0.82, so figures are about 13–14% of the screen height, with the floor at 79%. It drifts gently only when the player leaves the central half, and punch-ins are scaled to 40%. One side effect: enemy spawns are placed relative to the visible range, and the view is now wider, so enemies spawn in slightly different places than in the Smooth look. The fight rules are unchanged; the fingerprint with the old camera is identical. Smooth look keeps the previous follow camera.

**The floor sits inside the touch pad.** At 79% of the screen height, the fighters stand in the lower part of the screen, which is the transparent pad. That's what the brief asks for and matches the reference. The pad stays transparent, so the fight shows through, but thumbs will cover more of the action than before. Smooth look keeps the old framing for anyone who prefers it.

**Telegraphs at this size.** A winding-up enemy alternates between red and its own color on every other drawing (red enemies flash black) and gets a small red pixel starburst above its head. In Rhythm Mode the beat-count pips are still there. Hit flash is the reference's hollow figure: white with a black outline. Fades are impossible in 1-bit, so dying and invulnerable figures blink on alternate drawings instead.

**FX.** Everything is pooled and allocation-free per frame.
- Specks, starbursts and splatter in the victim's color.
- Floor marks that persist until the next wave starts.
- Scribble energy: a red fill, looping ink lines and a spiky rim that re-boil every step, then break into fragments.
- Projectiles as tapered flame scribbles.

Particles advance on the drawing step in Hand-Drawn mode, so FX move in the same held rhythm as the figures. The old additive glow particles still run, but are not drawn in the ink looks.

**What still needs work.**
- Hand re-authoring of the dramatized set: finishers, enemy attacks, enemy walk cycles (the dramatized walks are still a bit stiff), and the remaining player moves.
- The radial burst and inverted night frames of the reference's big moments (410–422) only appear as the existing black/white impact invert.
- HUD styling for the white page: the dark HP and super bars read fine, but they were designed for the dark arenas.


## Revision pass 6: smoother attacks + paper-drawn world and UI

**Missing systems, again.** The brief mentions weapons, the TimeDirector, the Jackpot Core, a loadout screen and a laser heat bar. None of these exist in this codebase, so there was nothing to restyle; they were skipped. The UI audit lists them as not applicable.

**Tags.** `pre-paper-theme` (like `pre-rhythm` and the pass 5 tag) exists only locally: the git proxy in this environment refuses tag pushes.

**In-betweens, not interpolation.** Hand-Drawn stays stepped. The smoothness comes from *more drawings* on the attack segments, generated with arc-aware, eased placement, not from tweening every tick. That keeps the held-drawing look while the swing reads as a continuous arc. Contacts still latch on the exact tick at every smoothness level (14/14 measured), and Rhythm strikes still land within ~8 ms of the grid (p95 7.9 ms).

**Default step rate.** Pass 6 raised it to 20. After pass 7 the defaults went back to **12 fps and Low attack smoothness** at the user's request (both still adjustable in Settings). Saves that had silently picked up the old defaults move to the new ones once (`defaultsRev` in the settings).

**Smear chains instead of single smears.** One dense hatch on one drawing read as a flash. A chain (dense on the fastest drawing, then thinning over contact and follow-through) reads as the swing sweeping through and dissipating, which is how the reference does it.

**Flurry rebuilt.** The pass 5 automatic version of the flurry was a blur. It is now hand-authored: two coils, nine alternating punches (3 ticks each) with 3 ghost arms per punch, then a recovery. Its length (34) and contact frame match the original, so gameplay is unchanged.

**Paper behind the Pixel Look.** The paper is pre-rendered at screen resolution (3 boil variants) and drawn first; the low-res Pixel world is transparent and quantized with an alpha threshold, so only the ink lands on top. White in the palette maps to the current page color. That keeps the texture smooth while the fighters stay crisp 1-bit, and costs nothing extra per frame beyond one `drawImage`.

**HUD on canvas, menus in the DOM.** The HUD changes every frame and needs stepped pops and boil, so it is drawn on the canvas with the sketch helpers. Menus stay DOM (accessibility, text input, scrolling) and get their pen borders from an SVG overlay that is generated once per element size, not per frame.

**Readability over decoration.** Doodles stay out of a band around the floor (`cleanAbove`) and sit at 36% opacity. A crowd check with 15 enemies on graph paper (the busiest page) shows the hollow-headed hero, the solid-headed enemies and the red telegraphs clearly. High Contrast removes the doodles entirely. Judgments carry a shape as well as a color.

**Performance.** With 16 enemies at 1280×720 in headless Chrome: Pixel look renders in ~3.6 ms per frame (p95 4.9 ms), Crisp in ~0.8 ms, sim ~0.2 ms. Both hold 60 fps. The paper adds roughly nothing per frame because it is cached; only a resize or a page change re-renders it.

**What still needs work.**
- The paper sounds are synthesized noise bursts; real recorded pencil and paper samples would sell the theme better.
- The page-flip transition is a stepped wipe, not a 3D curl.
- The smear configs are tuned by eye on the most-used attacks; enemy attacks use the defaults.

## Revision pass 7: no perks, the weapon system

**What already existed.** As in passes 5 and 6, there was no TimeDirector, no Jackpot Core and no weapon code. Everything was built on what exists: slow-mo moments use the existing `TimeControl` (Rhythm Mode still locks it off), and the weapons plug into the existing combat resolver (`playerHit`), cancels, input buffer, combo/style/super, juggle rules and enemy bowling. **Not done: the Jackpot Core Frenzy flavor per weapon**, because there is no Jackpot Core to hook into. Tag `pre-weapons` is local only (the proxy refuses tag pushes).

**Perks removed completely.** The picker, the upgrade data, the `Stats` object and every hook that read it are gone; each stat is its un-upgraded base value. Features that only existed as perks (crits by chance, chain lightning, KO blasts, dodge damage, heals on parry/finisher, the spike shockwave) were deleted with them. The pad's light→heavy "upgrade" event was unrelated but shared the word, so it is now `promote`. With base stats the Classic fingerprint was identical up to the first wave clear, which proves the removal changed nothing during play.

**The breather.** Between waves: 3 s total. The floor cracks reset, 35% HP heals, the WAVE CLEAR banner shows, then the next wave's title for the last 1.2 s. In Rhythm Mode the wave start waits for the next bar line after that. The weapon-swap strip is non-blocking: ignoring it simply continues.

**Rebalance without perks.** The player no longer grows during a run, so the ramp now comes only from the waves: a gentle enemy HP ramp from wave 6 (+3.5%/wave) and damage ramp from wave 2 (+2.5%/wave, capped ×1.6), slightly bigger authored waves 6–9, a softer elite (340 HP) and boss (1000 HP, slower meteors, fewer summons), and a 35% heal between waves. A rule bot played 12 waves with every weapon (fast-forwarded): damage taken climbs smoothly from ~0–10 per wave early to ~50–100 by waves 8–9; the wave 10 boss is the wall (~270–460 damage for the bot, which never dodges meteors or shockwaves); waves 11–12 settle at ~100–160. The first run found the boss far harsher than the rest (470 damage, 6 near-deaths), which led to the boss nerf.

**Weapon framework.** A weapon is data (`data/weapons/<id>.ts`): moveset by direction class, drawings, smear configs, frame data per move, Rhythm grid per move, a held-object draw routine and an icon. Weapon behavior comes from a small set of generic `MoveDef` hooks (`beam`, `grab`, `tether`, `plant`, `deflect`, `heat`, `aimCone`, `ranged`, `slowmo`, `then`, `grid`), resolved by one `WeaponSim`. **Every hook acts on the move's contact frame**, so the existing Rhythm snapping (which re-times the startup so contact lands on the grid) works for beams firing, grab releases, hook hits and plants with no extra code. Fists moved into the format unchanged; the Classic fingerprint (re-recorded after the rebalance) stays identical with the framework in place.
- **8 directions as 5 classes.** Movesets map direction *classes* (side, up-diagonal, up, down-diagonal, down). Mirrored directions share a move, and the swipe's horizontal sign picks the facing, so all 8 directions are covered without duplicating every move. Aimed moves (beams, throws, hook) still use the exact swipe vector.
- **Air moves.** Each weapon also has an air moveset (air variants share drawings with `base: 'air'`).
- **Finishers are shared.** JUMPSHOT and FLURRY are the same for every weapon (they are body moves and the brief's "Super Meter finishers" exist once). Weapon-specific finishers are a future idea.

**Weapon decisions.**
- **Throw.** A throw is one move: dash → catch at dash end → `hold` frames lifted/wound up → release on the contact frame. If nothing is caught (or the target is a Brute/elite with poise, or the boss outside a stagger), the move strikes instead and still damages poise: stagger, then throw. Thrown bodies keep the existing bowling with a damage multiplier that falls off per collision (×0.75). Re-grabs mid-air work because flying bodies are valid targets and the air moveset is all throws. The bot found a soft-lock: chained whiffed air throws kept the hero hanging off the top of the page. Fixed: a grab that caught nothing no longer hangs or stalls, and the hero is capped at 520 units above the floor.
- **Grappling Hook.** Pull reels the victim in over 14 frames (position-driven, with velocity set so dragging a body through others bowls them), then an automatic reel-in punch. Zip is a long rope-drawn magnetism dash into a flying kick (the existing dash with echoes). The N Air Hook is a ranged launcher with the existing follow leap, so it chains into the air game like the fists launcher. Swing takes over the hero's position along an arc around the anchor (over the top for up-diagonals, a low skim for down-diagonals) and hits everything on the way. The rope is a 10-point verlet rope drawn as stepped chain strokes.
- **Staff.** Plain moves (no hooks besides deflect/plant): long hitboxes, multi-target arcs, AOE sweeps that trip. The vault launcher's slow-mo fires at the apex of the follow leap, not at contact.
- **Laser.** Beams are hitscan lines from the hand, auto-aimed within a per-move cone. Light bolts stop at the first enemy, heavy beams pierce everything on the line. Heat: +12% per bolt, +45% per charged beam, drains at 55%/s; at full heat a 1.1 s overheat swaps every swipe for a melee bash (never fully helpless). Wall reflection is implemented behind `WEAPON_T.beamWallReflect` (off).
- **Rhythm grids.** Light bolts, quick throws and swings snap to 8ths/16ths; heavies, starters and slams snap to the beat. Measured on the Neon Rush song: contacts within ~8 ms of the grid for every weapon (Hook p95 16.6 ms, because its auto-chained punch sometimes can't move far enough to reach a grid point).

**Balance (bot, 12 waves each, deliberately mediocre play).** All five weapons clear 12 waves. Staff was clearly strongest at first (twice the score, 143-hit combos, mostly the helicopter), so the helicopter lost a hit, damage and targets, and twirls hit 2 targets. Hook was weakest, so its damage went up ~15%. Throw is slowest against the boss, because the boss can only be thrown while staggered; that is intended, since its strength is crowds.

**Performance.** With 9–16 enemies plus ropes, beams and thrown bodies, every weapon holds ~60 fps in the Pixel look in headless Chrome (render 4–5.5 ms, sim 0.2 ms). Ropes, beams and hit lists are preallocated; the beam hit buffer is a fixed array.

**UI is functional only.** The loadout screen, swap strip, weapon tooltip and heat bar reuse the existing panel/card/button styles with a plain layout and carry `TODO(ui-pass)` comments.

**Future ideas.** Mid-wave weapon swapping (deliberately not added); weapon-specific Super finishers; a Jackpot Core Frenzy flavor per weapon once a Jackpot Core exists; hand-tuned throw arcs for each enemy weight; a proper Hook vs. boss interaction (pull the hero to the boss instead of the boss to the hero).

## After pass 7: the second reference upload

See `REFERENCE_NOTES.md` ("Second upload"). The biggest change is a **weapon-sweep smear**: a weapon can expose its striking segment, and smeared drawings then fill the area the weapon swept with a hatched crescent (the reference's signature polearm look). Staff spin/helicopter drawings now turn the staff with the arms rather than rotating the whole body, the vault plants the staff upright with the hero on top, and laser beams are written as cursive loops. Not used yet: thrown weapons, lightning/whirlwind FX.

## Reference pass 2, part 2: everything from the second upload

**Fists Reference v2 + Legacy toggle.** Fists gameplay is unchanged (Classic fingerprint identical); only the drawings changed, and the previous drawings are kept as **Legacy** (Settings → Fists animation). v2 is built from the Legacy drawings by one consistent pass (deeper crouches, a coiled extreme before contact, more stretch/lean on contact, the contact drawing held up to 2 ticks longer by borrowing from the next drawing) plus per-move touches (rubbery reach on the jabs and cross, a taller launcher, more spin on the spike and spinning kicks). Contact frames and lengths are untouched: contacts still latch on the exact tick (14/14 at Low and High, both sets). Heavies and kicks get **limb crescents**: the area the forearm/shin swept is filled with grip-to-tip hatch, the same technique as the staff. The finishers get the new FX in v2 only, so Legacy looks exactly as before.

**Not a Fists move: the arm-stretch grab.** Adding a grab to Fists would change how Fists plays, which every brief has asked to keep. The stretched arm went to the **Throw** weapon instead (↑ heavy, replacing the near-duplicate "Sky Toss"; ↑ light is still the launcher starter), and the v2 jabs/cross get the rubbery reach visually.

**Thrown weapon.** The Staff's ↗ heavy (previously the same helicopter as ↘ heavy) is now a boomerang: the staff spins out along the aim with two trailing crescents, returns to the hand, and hits everything once per leg. The hero's hands are empty while it is out; any other move recalls it instantly, so there is no unarmed state to manage.

**Over-the-shoulder throw.** `grab.behind` releases the body behind the hero; the Long Arm drags the enemy in (the hook's pull, drawn as a stretched arm via `ropeStyle: 'arm'`) and auto-chains into the over-the-shoulder slam (spike + shockwave + ground bounce).

**FX.** Lightning (jagged bolts with a branch, from the top of the page to each victim) on the laser Nova, the Crater Yank and the JUMPSHOT finisher (v2). A whirlwind ball (rotating hatched spiral) around the hero during the helicopters and the Flurry (v2). The white-crescent impact frame: drawn in ink on the world layer during the inverted frame, so it reads white on black; triggered by finishers, every weapon slow-mo moment and moves flagged `fx.crescent`. All are presentation-only (`MoveDef.fx`), respect Reduce flashes, and are pooled.

## Sound effects and cheats

**Freesound.** Searching uses the Freesound API with the user's key (injected by the environment's network proxy, never stored in the repo). The files are the HQ MP3 previews, which need no key. Only **CC0** sounds were picked, then trimmed, made mono and loudness-normalized (`ffmpeg loudnorm`, 22 kHz, 48 kbps: 29 files, ~105 KB). They are bundled with the build instead of fetched at runtime, so the game needs no network and the key never ships. The synthesized set stays as the fallback and as a setting. Picked without listening, by rating and duration: some choices (thunder, staff swap) are stand-ins worth replacing by ear.

**Cheats (user request, reversible).** God mode, the Ray Gun weapon and the Nuke are hidden easter eggs: secret codes (`RAYGUN`, `NUKE`, `IMMORTAL`, or the Konami code) typed anywhere, or entered in a box opened by tapping the title logo 5 times. A code toggles its cheat and unlocks its switch in Settings → Cheats, which is hidden until then; locked cheats are always forced off; with them off the game is unchanged (Classic fingerprint identical). They are also isolated in one commit, so `git revert` removes them cleanly. Any cheat marks the run, and cheated runs never save a high score, best combo or best wave.

## More bosses

Bosses are data now: `EnemyDef.boss` (`BossSpec`: intro text, meteor interval, summons, blink, slip chance, drawn prop) instead of `kind === 'boss'` checks, so every boss shares the phase/stagger/boss-bar/drop-in machinery. Three new bosses, each built on one new mechanic: the **Witch** blinks away when you get close and fires dart fans (`projectile.count/spread`); the **Juggernaut**'s charge (`attack.charge`) crashes into the wall and leaves him stunned with poise broken (a deliberate punish window: dodge the big attack, then combo); **Shadow** slips hits (`dodge` chance, never while staggered or mid-attack, never against finishers). They rotate every 10 waves (Colossus, Witch, Juggernaut, Shadow) and HP keeps scaling. New attacks reuse existing drawings (`attack.anim`), and the Juggernaut/Shadow borrow the Brute/Rusher idle and walk.

Balance (rule bot, Fists, deliberately poor at dodging): Colossus ~300-400 damage taken, Witch ~550, Juggernaut ~900 (the bot never dodges the long charges, which is the whole point of that fight), Shadow ~500. Every fight ends with the boss defeated, with no soft-locks.

## Jump

At the user's request, tap and Space now **jump** (one extra jump in the air; air moves are available straight away). Dodge and the perfect parry are kept on a **double-tap** (two taps within 16 frames: the first jumps, the second dodges, which works in the air too), **Shift+Space** or **F**. Settings → Tap / Space restores the original tap = dodge & parry. The Classic fingerprint and the regression tests run with the original setting, so they stay comparable.
