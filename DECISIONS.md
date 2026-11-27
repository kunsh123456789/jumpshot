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

## Twelve more weapons

Chain Whip, Giant Hammer, Twin Daggers, Boomerang Shield, Ink Brush, Yo-Yo, Bubble Gun, Rocket Gloves, Ice Spear, Paper Plane Swarm, Lightning Fist and Scythe (17 weapons in the loadout, plus the cheat Ray Gun).

**Shared mechanics, not one-offs.** Each weapon is still a data file. The new behaviors are a few more generic `MoveDef` hooks resolved by `sim/weaponExtra.ts`: player projectiles (`shoot`, with homing, gravity, pierce and a from-the-sky variant), erupting ground spikes (`spikes`), statuses (`status`: bleed, freeze/shatter, bubble/pop, snare), chain lightning (`chain`), blink-behind dashes (`behind`, reusing the shield cross-up logic), and throws that ricochet (`toss.bounce`) or skim the floor (`toss.floor`). Beams got styles (whip, lightning, ice, ink) and dodges got `blink` (teleport) and `parry` (a stationary block). Everything still hits through `playerHit`, so combos, juggles, style, super, Rhythm snapping and bowling apply unchanged; Fists is untouched (fingerprint identical).

**Drawings from templates.** With ~120 new moves, the drawings come from shared pose templates (jab, slash, overhead, uppercut, sweep, spin, throw, aimed shot, slam and air versions) patched per move, so all weapons share one pose language and every contact drawing still lands on the hit frame. This is less individual than the hand-authored Fists v2 / Staff drawings; the weapons that deserve bespoke drawings next are the Scythe, Hammer and Daggers.

**Bosses resist control.** Freeze, bubble and snare don't lock down bosses (a freeze chips a quarter of a boss's poise instead), so boss fights can't be trivialized.

**Balance.** A 6-wave bot run per weapon: every one clears with no near-deaths; the Whip, Brush and Bubble Gun were ~50% slower to clear and got damage buffs. Daggers and Lightning Fist score highest (bleed ticks and chain arcs both feed the combo). 60 fps with 13-16 enemies and swarms of projectiles.

## Mobile pass

**Scrolling.** Menus couldn't scroll on phones because one document-wide `touchmove` handler cancelled every swipe (to stop page bounce / pinch zoom during play). It now lets a swipe through when the finger is on something that can actually scroll (settings, loadout, pause); everything else is still blocked. Panels use `overscroll-behavior: contain` so a scroll never drags the page. The loadout on short or narrow screens drops its inner scroll box (no box-in-a-box) and shrinks the preview.

**Mobile performance setting.** Profiling a 15-enemy fight on an emulated phone (915x412, DPR 2.6, CPU x4) showed ~27% of the time in `getImageData`: the Pixel Look snaps every pixel to the palette, which reads the layer back from the GPU each frame (a sync that phones are especially slow at). The setting:
- renders the low-res layer on a normal GPU canvas and skips the palette snap (edges keep a little anti-aliasing; the look is otherwise the same);
- renders the main canvas at 1x density instead of up to 2x;
- skips the floor reflections (each fighter drawn twice) and merges the paper's two layers into one blit (the margin doodles stop bouncing to the beat);
- drops the menu backdrop blur and looping CSS animations.
It never touches the simulation (Classic fingerprint identical). It defaults on for touch devices (`pointer: coarse`) until the player chooses; render time went from ~21 ms to ~9-12 ms per frame in the emulated test (20 -> 45-50 fps).

## Revision pass 8: animation coverage and the Special system

**What the brief assumed vs. what existed.** The brief names a "TimeDirector", a "Jackpot Core", a "Frenzy bubble" and five weapons. The game has no TimeDirector: slow-motion is `core/time.ts` (TimeControl) driven by the FX director, and in Rhythm Mode it is locked off so the sim stays on the beat clock. There is no Jackpot Core: the orb pickups that drop from KOs are the "jackpot" charge source. There is no Frenzy: the Special's freeze bubble is new. There are 17 weapons (plus the cheat Ray Gun), not 5. The five named weapons get fully scripted finishers and Specials. The other twelve use the closest of those five families (`data/cines.ts` `WEAPON_FAMILY`), each with its own Special name and its own held weapon in the hero's hands. Writing ~36 more bespoke cinematics was out of proportion for this pass.

**Jump gesture.** A jump is a *slow* upward drag past `PAD.jumpDragPx` from the finger's lowest point, mostly vertical and below 85% of the flick speed. Flick detection runs first on every sample, and a flick re-bases the jump reference for 180 ms, so a fast flick up is always the launcher and never also a jump. Height grows while the finger keeps dragging up; the boost is applied as if the jump had left the floor at the charged speed, so it never over-extends. The pass 7 tap-jump stays (tap = full jump; Settings can still switch tap back to dodge), since players already use it. The 3-frame jump squat exists for the anticipation drawings; air jumps skip it.

**Grip layer, not 17 copies.** Body drawings are authored once; each weapon overrides only the arm channels per locomotion state, blended in the animator before the crossfade. The held object is already solved from the hand joints (a pole through both hands, single-hand objects along the forearm), so "hands stay on the weapon" holds by construction, with no separate IK solve.

**Cinematics are sim scripts.** Finishers and Specials run in a deterministic per-sim-frame script player (`sim/cine.ts`). Their hits go through the combo, so style, score and rank apply; they ignore combo damage scaling so a long combo can't scale a Special into nothing. Rhythm Mode never desyncs: no cinematic changes the sim rate (slow-mo cues are ignored while TimeControl is locked), the trace lasts a whole number of beats, and QTE prompts are due on beats. A test measured 0.0 ms audio-versus-wall drift and the sim in lock-step during a Special.

**Special input runs in real time with the world frozen.** The sim keeps stepping during the trace and QTE (so the beat clock never stops), but every enemy, projectile, wave and the combo timer are frozen and the hero holds the activation pose inside the bubble. Real-time timers live on the UI side and pause with the game. The sim side has a 900-frame safety timeout that resolves SLOPPY, so nothing can soft-lock. The look is the paper with a dark vignette closing in; ink-on-dark would fight the 1-bit palette.

**KO finisher.** It is triggered at the end of the sim step where the wave's last enemy goes down, not inside the hit, so the move in progress finishes cleanly. Waves wait while a cinematic plays. The nuke cheat skips it.

**Enemy death variants** are chosen per enemy id (`id % 3`), not from the sim RNG, so spawn sequences stay identical.

**Old super finishers removed.** The super meter, its 50-cost Jumpshot Finisher and the Flurry move are gone. The Jumpshot Finisher returns as the Fists Air Finisher cinematic, and the Flurry drawings as the Fists boss KO's opening flurry. Because the finisher rules changed, the Classic fingerprint changed. To isolate the cause, I ran it with the new air finisher, KO finisher and death variants switched off: the only remaining difference came later and matches the removed meter finishers, so the normal moves are unchanged. The golden was then re-recorded and confirmed deterministic.

**Attack audit.** Instead of hand-editing ~150 template moves, `author.ts` `refine()` adds the missing pieces to every template attack: a settle breakdown into the wind-up, a tightened extreme on longer startups, an overshoot follow-through right after contact, a default smear on the striking limb, and generated in-betweens on heavy, launcher and spike moves. Contact frames are unchanged.

**Balance.** The bot played 6 waves with each of the five scripted weapons, firing Specials whenever READY (random-quality results). Every run cleared with no errors and no near-deaths, at 7-13 Specials per 6 waves, roughly 1-2 per wave. Per-hit charge dropped from 0.9 to 0.8 after a first measurement read 0.7-2.7 per wave. Bosses take at most 22% of their HP from one cinematic (×0.6 damage); elites take ×0.75.

## Revision pass 8, Part C: UI directions (Arcade Fighter chosen)

**Mockups over the real game.** `ui-options/tools/capture.cjs` drives the current build with Playwright (manual frame stepping, so the stills are deterministic) and saves clean frames: no HUD, pad, menus or Special overlay. It also saves the current UI for the audit, plus the hero's and enemies' screen positions (`shots/meta.js`) so the diegetic option can place its ring on the hero. Each direction is a self-contained HTML mockup (`ui-options/mockups/optionN-*.html`) laid over those frames. All four share one data file (`mockups/data.js`) holding the same real information, so they compare like for like. `tools/render.cjs` exports every screen at desktop (1280×720) and phone landscape (844×390), and the PNGs are quantized to 256 colors so the gallery stays light (about 6 MB for 60 images).

**The Special shows as two screens** (trace, then QTE), because a single still can't show both phases.

**Fonts are bundled** as woff2 files from the @fontsource packages (all SIL Open Font License) in `ui-options/fonts/`, so the gallery renders offline and the chosen pair can move straight into the game.

**Keeping the pad clear.** Every option keeps the bottom half free of UI. The Arcade option moves its Special Bar from the genre's usual bottom position to the top centre. The Minimal option draws its ring around the hero, which is inside the touch area visually but never takes touches.

**Implementation plan once a direction is chosen.** Menus and screen text go in a DOM/CSS overlay (crisp, accessible, easy to style, keyboard and gamepad focus). In-world pops, damage numbers and the Special trace stay on the canvas. Both read one set of design tokens. The game is not changed until the choice is made.

## Revision pass 8: Arcade Fighter UI (implementation)

**Architecture: DOM for screens, canvas for the world.** Menus, the HUD (HP, Special Bar, combo/rank, score/wave, boss bar, heat, combo card, pop-up banners), the tutorial, banners and results are DOM elements in `#ui`, styled by one stylesheet (`src/ui/style.css`). Anything tied to world positions or drawn in sync with the sim stays on the canvas: damage numbers and world texts (`render/effects.ts`), the Special trace and QTE (`ui/specialInput.ts`), the rhythm beat lane and judgments (`rhythm/hud.ts`) and pad feedback (`ui/pad.ts`). Both sides use the same palette and the same `--u` scale. DOM text is crisp at any DPR, accessible, and gets focus states and CSS animation for free. The canvas parts need per-frame positions that the DOM would only lag behind.

**The HUD is built once and patched.** `ArcadeHud` creates its elements once. Each frame `set(key, value, apply)` writes to the DOM only when a value's string form changes, so a quiet frame touches no DOM. Score counts up toward the real value. The HP lag bar eases down after a hit. `.hud.spmode` hides the combo, combo card and pop-ups during the Special intro and input, so the overlay has the screen to itself, which matters most in portrait.

**Tokens.** All tokens live on `:root`:
- **Colors:** navy #0b1026 (plates), steel, cyan #2ee6ff (info / focus), magenta #ff2e88 (action / Special charge), gold #ffd23f (READY, selection, best), red (danger).
- **Type:** a type scale `--fs-xs … --fs-xxl`.
- **Spacing:** steps `--s1 … --s6`.
- **Shape:** a −14° skew, corner-cut clip paths, glow shadows.
- **Easing:** curves for slam and pop.

`--u` is set from JS (`applyUiScale`: clamp(min(w/1280, h/720), 0.6, 1.2)), so canvas code can read the same number (`getUiScale()`). Touch targets have pixel minimums on top of `--u`, so a small phone never shrinks a button below 36-42 px. The page shell is always dark (the artifact's tokens are pinned to navy in both color schemes), and the paper world inside the canvas is unchanged.

**Fonts.** Russo One (display, italic via skew) and Oswald 500/700 (body, labels) are bundled from @fontsource (OFL). Patrick Hand and Permanent Marker stay only for the hand-drawn doodles painted on the paper backdrop, which is world art, not UI.

**Icons.** `src/ui/icons.ts` holds single-path inline SVGs drawn on a 24-unit grid with `currentColor`, so icons follow button states. They replace every emoji, which rendered differently per platform.

**Motion.** A short set of named keyframes (slamIn, bannerIn, popIn, comboPop, rankSlam, readyPulse, flame, march) is used everywhere instead of one-off transitions. `prefers-reduced-motion` reduces them to an instant final state, and the in-game Reduce Flashes setting (`body.calm`) plays looping pulses once and holds them. `body.perf` (Mobile performance) drops glows and backdrop blur.

**Keyboard and gamepad navigation (`src/ui/nav.ts`).**
- **Keyboard:** one capture-phase listener works whenever a menu layer is open. Arrows / d-pad move focus spatially (nearest element in that direction), Enter / A activates, Esc / B triggers the layer's `data-back` button, and ←/→ adjust sliders and selects on settings rows. Focus is shown with a `.focus` class, so mouse users never see a stray ring. A soft UI tick plays on each focus move. On the title, Space still starts through the pad as before.
- **Gamepad in play (standard mapping, polled each frame):** the left stick / d-pad moves, X attacks toward the stick direction (Y for heavy), A jumps, B or LB dodges, RT or RB is Special (hold), and Start pauses. Pad inputs go through the same `pad.inject` path as touch, so the sim and its fingerprint do not change.

**What was removed.**
The pass-6 paper HUD (`render/hud.ts`, `render/paperHud.ts`), the sketch-border DOM utility (`ui/sketchDom.ts`), and the paper/neon branches of the pad renderer and world texts.

**The swap strip** sits at 51% of the height, under the WAVE CLEAR banner and its reward line. Earlier positions covered the banner text.

**The single-file artifact** is the Vite build inlined into one HTML file: the CSS (fonts as data URIs) plus the module script. It needs an explicit `<meta charset="utf-8">`, or the arrows and dots in labels turn into mojibake.

## Every sound from Freesound, and hits that land harder

**Scope.** "All sounds" covers every effect, UI sound and voice, and every instrument in the built-in music. The songs are still sequenced in code, not swapped for recorded loops. Rhythm Mode needs every note on the beat clock's grid, and the songs change with section and fight intensity, which fixed loops can't do. Instead, every drum hit and note the sequencer plays is a Freesound sample. Your-own-song import plays your file as before.

**How the clips were chosen.**
- **Search:** the Freesound API, filtered to CC0, sorted by rating and weighted by rating count and downloads.
- **Measurements, since I can't listen:** each candidate was measured for onset delay, length, attack, spectral centroid and low-band share. Snaps should be short and bright, bodies short with strong low-mids, thumps mostly below 200 Hz.
- **Pitched instruments:** picked from samples named by note, then confirmed with a YIN pitch detector. The measured roots are in the code (`ROOT` in `rhythm/synth.ts`).
- **Processing:** trimmed to 2 ms before onset, a −50 dB tail cut, a short fade, peak-normalized to −1 dBFS, mono MP3.

**Hit layering (`audio.hit`).**
1. **Snap:** a short bright crack, a little louder on light hits so jabs stay crisp.
2. **Body:** a boxing-punch body, played lower and longer as hits get heavier. Kicks use a percussive thud instead, and slashes add the staff swish.
3. **Texture:** the previous punch set, quietly.
4. **Thump:** a low thump, from weight 0.45 up.
5. **Heavy (weight ≥ 0.72):** a bat crack, a bone crunch and a 0.3 s 808 sub hit. The music ducks to 40% for about a quarter second.

Variants never repeat twice in a row; repeated identical samples are what make hits sound robotic. The combo still raises the pitch, but at 35% of the synth's climb, because a full climb sounds chipmunky on recordings. Tails are gated (body 0.16–0.28 s, thump 0.22 s, sub 0.3 s), so fast strings stay distinct instead of smearing.

**Mix calibration.** A Playwright bus-level test plays each song and the classic loop with a bot attacking, and taps the music and SFX buses with analysers. Against the previous commit's recorded build, energy-average SFX level is about 3 dB higher (−13.5 vs −16.5 dB), by design so hits land harder. Music is within about 1–2 dB of the old synth band (dojo sits lower, as its synth version did). The trims live in `MIX` at the top of `core/audio.ts`.
- **Music trim:** sampled instruments play through an `inst` trim bus (0.3), because mastered one-shots are much hotter than the oscillators were.
- **Glass-bell combo notes:** these go through the director's per-note gain, so they can still be cancelled when the strike they were scheduled for doesn't happen.

**The synth fallback stays.** It plays until the clips decode (a fraction of a second) and remains a setting (Settings → Sounds & music), so the old sound is one switch away. Audio uses only the FX RNG, so the sim fingerprint is unchanged.

**Clips are decoded from the bundle, not fetched.** The single-file build inlines every clip as a base64 `data:` URL. Loading them with `fetch()` worked locally, but a host whose Content-Security-Policy restricts `connect-src` (as the published artifact page likely does) refuses those fetches. The game then quietly stayed on the synthesized fallback, so the published build played no recordings. `bytesOf()` in `core/audio.ts` now decodes `data:` URLs directly with `atob`. A Playwright check serves the build with `connect-src 'none'` and confirms all 83 clips decode.

## Freeze fix: jumping in the air with no jumps left

**The bug.**
- `jump()` cancelled the current move (`p.move = null`) before checking whether an air jump was left. With none left it returned without changing state.
- The hero was left in `move` with no move. The next tick dereferenced it (`WeaponSim.tick` → `m.grab`) and threw.
- The rAF loop was `frame(); requestAnimationFrame(loop)`, so the exception also stopped the loop. The picture stayed on screen and the game never resumed.
- The trigger is any tap or drag-up jump during an air attack after the double jump is spent. Tap is jump by default, so this was common in real play.

**Fixes.**
- `jump()` returns before touching the move when no air jump is left, so the attack simply continues.
- `updateMove` recovers to idle or fall if it ever sees `move` without a move.
- The loop schedules the next frame before running this one and catches exceptions, logging each distinct one once. A future bug becomes at worst a glitch, never a frozen game.

**Tests.**
- Input fuzz in manual mode (random taps, jumps, swipes and moves, all 18 weapons): the old code crashed with every weapon within 170-1700 frames; the fixed code ran 3000 frames each with none.
- Real-time soak with a watchdog for sim stalls, stuck slow-mo and long frames: 48 runs (every weapon, every Rhythm song, waves 1-30 including bosses), all clean.
- Fingerprint identical.

## Punchier hits: pre-mixed punch tiers

**Why the first recorded set felt weak.** Hits stacked 4-7 separate clips at runtime: a wet slap, a boxing-punch body, a mattress thump, a bat crack, a bone crunch and an 808. Their transients didn't line up, each had a different tail, and random gains on every layer made the result loose and smeary. The bus compressor also had a 2 ms attack, which flattened the first milliseconds that carry the punch.

**Now each hit plays one finished punch.** Eleven punches in three tiers (`hit_l1`-`l4`, `hit_m1`-`m4`, `hit_h1`-`h3`), built offline with a Python + ffmpeg script:
- **Sources:** the core punches are community-proven Freesound punches, including "punch.wav" (about 79k downloads), "Major punch" and "Punch2". They were shortlisted from 280 CC0 candidates by measured attack time, low-mid share, decay and single-hit shape, with slap/splat/wet/bone clips excluded by name.
- **Cut:** each core is cut at its biggest envelope rise, skipping any built-in whoosh.
- **Body:** a deep "Hit 3/4" thud is layered under the core, then EQ'd (low shelf +5 dB at 100 Hz, −5 dB at 420 Hz, +2 dB at 2.5 kHz).
- **Density:** tanh saturation (drive 1.6 light, 1.9 medium, 2.2 heavy) and a hold-then-exponential decay envelope (light 10/40 ms, medium 18/60 ms, heavy 25/95 ms).
- **Transient:** a high-passed snap or crack goes on top afterwards, unsaturated, so the impact spike stands out. Then a limiter.
- **Heavies:** pitched down about 15%, with a short 808 tail at low level. Waveform plots were checked before and after: an early heavy draft was a solid block with a beating ripple, two low layers fighting, so the 808 was cut back and the transient moved on top.

**At runtime.**
- Weight picks the tier: below 0.42 light, below 0.72 medium, otherwise heavy.
- Variants don't repeat back-to-back. Pitch varies ±3%, the combo climb is 20% of the synth's, and kicks play 6% lower.
- Heavies duck the music to 45% for about 0.2 s.
- **Mix:** the glue compressor attack went from 2 ms to 12 ms, ratio from 5 to 4, so the transient passes. A fast limiter (−1.5 dB threshold, 20:1) after the master gain keeps peaks from clipping. SFX energy-average level is now about −13 dB, against −16.5 for the original recorded build and −13.5 for the layered version; music is unchanged.
- The 14 old layer clips were removed.

## Punches v3: boom + clack

**Feedback:** the punches should be boomier and clackier, never light. So "light" now only means shorter; every punch has both parts. Each is built from three separately shaped parts instead of one saturated blend:
- **Boom:** "boom.wav" or an 808 boom. Low-passed at 260 Hz with a 190 Hz bump, so its upper body survives on phones. It swells in over 8 ms after contact, so the clack is heard first, and decays over 120 / 170 / 260 ms.
- **Body:** a proven Freesound punch at its impact, +7 dB at 210 Hz, −5 dB at 480 Hz.
- **Clack:** the "Kung Fu punch" series and "Punch 1" (peridactyloptrix, the classic movie punch crack), high-passed at 1.3 kHz.

**Clack tuning.**
- Clacks are normalized by their first-8 ms energy, not by peak. Otherwise very short clicks like "Quick Clack" (2 ms) vanished; that clip and a twig snap read as ticks, not clacks, and were dropped.
- The mix is padded 5 ms before the limiter. Without that, a clack peaking in its first 0.3 ms was crushed before the limiter's attack.

**Measurements against the previous set:**
- Every band is up about 2 dB on average: sub 40-150 Hz, thump 180-500 Hz, clack 2-8 kHz.
- The clack's share of the first 20 ms rose from 0.07-0.38 to 0.36-0.76.
- Energy-average SFX level in play is about −11.6 dB, against −13.

## Laser Special: the horizontal blast

**Feedback:** the user's reference image shows a horizontal beam from the fist: a fat white core, a thin ragged red flame edge, a rounded start, and the victim smeared into black streaks. Only that beam style was taken from the image; the characters are ours.

**`sp.laser` ("OVERLOAD BEAM", shared by ice, brush, ray gun and thunder under their own names):**
- **Charge:** 40 frames with a growing flame orb at the fist.
- **Fire:** the beam shoots out over 8 frames to past the screen edge in the traced direction.
- **Hold:** the hold lasts as long as the old sweep (longer on PERFECT). Everyone in the beam is held, pushed along it at 1.6 px per frame and hit for 4 every 10 frames, quietly: small sparks, not full ink hit-sparks, because the repeated sparks turned the victims into a black scribble ball.
- **End:** the beam collapses over 12 frames and everyone caught is launched.
- **Damage:** comparable to the old sweep.

**Rendering (`drawBlast` in `cineFx.ts`).**
- **Glow:** a 22% tinted glow lets the white core read on white or cream pages.
- **Flame edge:** a jittered polygon with random flame tongues and a ragged, streaky end, re-seeded every drawing step so it flickers.
- **Core:** the white core is inset to 70%, with an elliptical cap at the fist.
- **Victims:** 5 black ink streaks each, dragged along the beam.
- **Edge color per weapon:** laser red, ice cyan, ray gun green, brush ink black, thunder gold.

**Sound (`audio.laser`).**
- **Charge:** "Anime Charge Sound" (its rising last 1.25 s).
- **Fire:** the first 1.8 s of "heavy beam weapon", plus the impact and an 808.
- **Hold:** two seamless loops: "Laser/Machine humming" played 22% slower for the deep hum, and "laser beam loop" at low level so the beam is audible on phone speakers. A 7 Hz gain wobble adds the "wub", and the music is ducked.
- **Seamless loops:** they are padded circularly, so any loop window of exactly the body length is a seamless rotation, even if the MP3 decoder shifts the audio by up to 100 ms.
- **Stopping:** `laser('end')` fades both loops out, with a timed fade-out as a safety stop.
- **Measured:** the hum's energy peaks at 32-75 Hz and drops to silence after the end cue.

## Specials: one path, and any weapon's Special

**Feedback:** activating a Special should be just one path to drag, and you should be able to choose which weapon's Special to use, even one that isn't equipped.

**Flow now:**
1. **Activate:** long-press or X triggers the freeze bubble and activation pose, as before.
2. **Pick:** a panel of weapon tiles opens, with the equipped weapon highlighted and marked "E". The highlighted Special's name and weapon are shown below the tiles.
3. **Trace:** that Special's one path is shown and dragged in a single stroke.
4. **Cinematic:** the chosen Special's cinematic plays.

**The button prompts (QTE) are gone.**
- The trace score (coverage 0.5, accuracy 0.35, speed 0.15) alone sets SLOPPY / CLEAN / PERFECT, with the same thresholds (0.5 / 0.82).
- A complete, accurate trace is PERFECT; half a path is about CLEAN; no trace is SLOPPY.
- The cinematics' length knob (`qte`, 0-3) is now derived from the trace score.
- The "Skip the QTE prompts" setting and the QTE tunables were removed.

**The picker (`SpecialInput` pick phase, canvas, Arcade style).**
- **Weapons offered:** `availableWeapons()`, the same list as the loadout and swap strip, so the Ray Gun appears only with its cheat.
- **Input:** one tap on a tile picks and goes. Keyboard: arrows move, Enter / Space / X picks. Gamepad: d-pad or stick moves, A picks. It uses the same raw input sinks as the trace, so the whole screen takes input.
- **Auto-pick:** after `SPECIAL.pickSec` (4 s, a gold bar counts down) the highlighted Special is used. Browsing extends the timer to at least 1.5 s, so it never fires mid-choice.
- **Layout:** rows are balanced (17 tiles: 9 + 8 on desktop, 6 + 6 + 5 on phone portrait) and every row is centered. The panel sits below the HUD on phones, with tiles at least 44 px.

**Sim side.**
- The result carries `weapon`. `SpecialSystem.begin` uses it for the family (who gets caught), the script and `specialStart`.
- `CineCtx.weaponId` carries it into the cinematic, for example the laser beam's edge color.
- The equipped weapon doesn't change. The hero keeps holding it through another weapon's cinematic, which reads fine because the Special cinematics are mostly poses and effects.

## Refinement pass

**Audit.** Every screen at desktop, phone landscape and phone portrait, a CPU profile and a stress test (emulated iPhone, 4× CPU throttle, wave 25 with 10 enemies, bot attacking), a `drawImage` call-site timer, and an input-conflict review.

**Fixed.**
- **HUD cost:** about 4-5 ms per frame on a throttled phone, now about 1.
  - Every bar fill (HP, lag, heat, Special segments, boss, rank) scales with `transform: scaleX` instead of changing `width`, so there's no layout per frame.
  - The READY glow pulses opacity on its own layer instead of animating `filter` on an element with a large box-shadow, so there's no repaint per frame. The low-HP blink is an opacity pulse too.
  - HUD element lookups are cached instead of queried every frame, and HUD blocks are CSS-contained.
  - Mobile performance mode stops the decorative loops (flame, marching segments, glow pulse).
  - **Result:** the stress test went from about 35-39 fps to about 43 fps, a measured −8 fps HUD cost down to within noise.
- **Pausing during the Special picker or trace** no longer draws the overlay through the pause menu.
- **Song picker:** the title (logo and buttons) is hidden while the song picker is open, so the logo no longer peeks out above the panel.
- **Gamepad during a Special:** buttons used to also inject attacks or jumps into the frozen game, which could fire after the Special. Gameplay gamepad input is now off while the Special overlay is open.
- **Grade feedback:** the trace's grade plays the success / fail sting (the old prompt sounds), so you hear SLOPPY vs CLEAN / PERFECT.
- Stale comments about the removed QTE were corrected.

**Measured but left alone.** The one heavy `drawImage` is the Pixel Look's single upscale of the low-res world layer, about 1 ms per frame at 1× in a GPU-less headless browser. On real phones that canvas copy runs on the GPU. Desktop holds 60 fps (p99 22 ms) and the JS heap stays flat over a 25 s stress run.

## Weapon roster cut to 9

**At the user's request**, Throw, Shield, Brush, Yo-Yo, Bubble Gun, Paper Planes, Rocket Gloves and Lightning Fist were removed.
- **Removed:** their definition files, loadout order entries, ID type members, grip and victory-pose entries, Special family and name entries, and beam tones.
- **Kept:** the generic engine hooks they used (projectiles, bubble / snare statuses, thrown-object drawing, beam styles), since new movesets can reuse them.
- **Kept, now unused:** the `throw` Special family's cinematics (HAMMER SWING), which remain available for a future weapon.
- **Saved games:** a save with a removed weapon equipped falls back to Fists through `weaponById`.
- **Verified:** every remaining weapon's moves resolve to registered animations.

## Signature movesets and five unique Specials

**Approved list, built as a layer.** Each weapon keeps its original moveset untouched and gains `WeaponDef.v2` (a `WeaponV2`: moveset, dodge, passive, tips, description). `activeDef()` in `data/weapons/index.ts` returns the v2 copy when Settings → Weapons → Movesets is New (the default), so the sim, loadout preview and move list just read the active weapon. Switching the setting re-equips at once. The Classic fingerprint test pins Original and still matches exactly.

**Moves (`data/weapons/movesets2.ts`).** A move is either:
- **a variant:** an existing move copied under a new ID, with its numbers and drawings reused through the new `MoveDef.anim` field, plus an `x2` mechanic or a tweak. `chain()` variants a whole auto-string and relinks `next`.
- **new:** drawn from the shared attack templates.

**Mechanics (`sim/moveset2.ts`, all pooled, deterministic, only active for `x2` moves or a passive).**
- **Hammer:**
  - Floor shockwaves travel both ways at about 1000 u/s and bounce every grounded enemy once; jumping clears them. Landing after Meteor Hammer sends them too.
  - Super armor halves damage and ignores flinch during swings.
- **Ice:** patches on the floor lower enemy friction (0.965 vs 0.82). A body sliding faster than 380 u/s on ice shatters into the next enemy. Walls block one side and freeze whoever's caught as they rise. The hero runs 1.4× faster on ice.
- **Daggers:**
  - The smoke bomb hides the hero (invisible and untouchable) for 22 frames; its `then` reappears behind the target. `then` moves now honour `behind`.
  - Shadow Dash queues its hits 18 frames later.
  - Execute detonates every bleed for 6 damage plus 0.13 per remaining bleed frame.
  - Backstab crits on enemies facing away, and on any move that lands behind.
- **Scythe:**
  - Doom marks: the third reaps 30 frames later for 22.
  - KOs drop souls that fly to the hero and heal 4.
  - Below 30% HP, hits heal 25% of their damage.
  - Grave hands re-pin a held enemy whenever it recovers from a hit.
- **Hook:** Tether ties the two closest enemies for 7 s; a hit on one passes half its damage to the other and drags them together.
- **Whip:** the beam reports where along the lash a hit landed; past 68% of its length is the tip, for double damage and a CRACK. The lasso's caught body orbits the hero and bowls whoever it touches.
- **Staff:** the momentum spin keeps going while an attack input is held (finger on the pad, an attack key, or gamepad X / Y, reported by the game as `World.attackHeld`); releasing after 20 frames flings.
- **Laser:** `closeVariant()` swaps in the point-blank move when the target is within 150 units. Overheating vents a 230-radius shockwave.
- **Fists:**
  - Fury fills 7% per hit and burns for 6 s at ×1.18 damage and ×1.35 knockback, with heavier hit sounds.
  - Slip: an attack evaded during the slip, or parried, marks its attacker, and the controller throws the counter as soon as the hero is free.

**Dodges.** New `DodgeSpec.kind` values: slip, zipUp, vault, recoil, backflip, smoke, skate, phase.

**Unique Specials (`data/cines.ts` SP2).** Whip, Hammer, Daggers, Ice and Scythe now have their own cinematics, names and trace paths. All other weapons keep their family's.
- **Trace paths:** figure-8, down-then-V, star, X (as one stroke), crescent. `specialKind()` picks the script and the path.
- **Targets:** everyone on screen, up to 10.
- **Visuals:** a floor crack with slabs, a freeze haze with ice blocks, a real CSS grayscale filter on the game canvas while the Reaper plays, a crescent scythe drawn as a tapering blade on a handle, and Blade Storm slash marks.
- The Reaper's blade reach was cut from 820 to 430 after screenshots showed it sweeping off-screen.

**Verified.**
- Per-mechanic tests in manual mode cover fury, puff, slip counter, shockwaves on both sides, vanish, backstab reappear, execute, delayed cuts, ice patches, the ice wall, doom 1 → 2 → reap, souls healing, grave hold, point-blank swap, vent, tether, tip crack, and the held spin and fling.
- Input fuzz on all 10 weapons and a 10-weapon soak with Specials both came out clean.
- Each new Special was captured at fixed cinematic frames.
- **Balance is a first pass;** the numbers are in `V2` (`data/weapons/tuning.ts`) and in `movesets2.ts`.

## Grappling hook mobility, and the staff's Pole Vault Kick

**Asked:** "swing along the roof or grapple to a wall like spiderman… highly mobility based". Built into the hook's **New** moveset only (`Passive.grapple`); the Original set is untouched.

**A roof and walls to grab.** The arena had neither, so the hook's New set draws a pencil girder 470 units up (`ROOF_Y`) and the two wall faces. They are light gray so they read as scenery, not a second floor. Nothing else collides with them.

**The swing is a rope, not an animation (`sim/grapple.ts`).**
- The hip is a particle on a rope to the anchor, solved position-based in two substeps:
  1. predict the move;
  2. project onto the rope;
  3. take the velocity from the move;
  4. strip the radial part while the rope is taut.
- Without step 4, reeling in turned straight into an upward fling: the first build slid the hero along the roof.
- The floor shortens the rope (the hero skims it), and the walls stick the hero.
- Release speed is whatever the rope gave, so the momentum is real.

**Hold to keep swinging.**
- A swipe commits mid-drag, so the finger is still down. Keep it there to swing back and forth (up to 4.3 s); lift it to let go at the top of the arc.
- A plain flick auto-releases on the upswing.
- This reuses `World.attackHeld` from the staff spin.

**Inputs are context, not new buttons.**
- ↗ ↖ always swing; ground ↗ heavy stays Tether.
- ← → zip to a wall only when nobody is on that side within 560, so the yank and zip kick still work on enemies.
- Air ↑ zips up only with nothing overhead.
- On a rope or a wall, the directions become rope or wall actions (`PlayerController.grappleInput`).

**New states `swing` and `cling`** own the hero's position; the controller skips its own physics.
- Anything else that takes the hero (a hit, a cinematic) cuts the rope on the next tick.
- Letting go gives the air jump back, plus 48 frames of low air drag (`Fighter.fling`). Without it, the usual 0.96 per-frame drag killed the swing's speed within a second.

**Drawings:** four new loops (`data/anims/grappleSet.ts`). The swing and hang are drawn upright with both arms straight up; the poser turns the whole body about the hip (`spinAdd`) so the arms line up with the rope.

**Attacks while grappling** keep the mobility offensive:
- the body kick (`hk3_kick`): once per enemy per rope, above 430 u/s;
- the Wall Dive (`hk3_wallKick`): the zip kick variant.

**The dodge** (zipUp) now zips to the roof and hangs for 46 frames, keeping the dodge's invulnerability and parry window.

**Staff Pole Vault Kick.** Asked: "shift side attack with the staff … like a pole vault kick".
- Shift + → is the ground side heavy, so the New staff's heavy side is now `st2_vaultKick`: run in, plant the staff, then a two-foot kick at contact.
- The kick: 19 damage, knockdown, a crescent, and a short slow-mo.
- The vault is real: the hero launches up and forward, through `x2.self` with the new `free` flag.
- That launch fires the frame **after** contact. Otherwise the hit's own air-stall and hit-stop ate it, and the first build rose only 9 units.
- The old Spinning Sweep stays in the Original set.

## Reset and Tutorial buttons

**Asked:** "a button to completely reset the game and a button for tutorial".
- **Tutorial** was already in Settings, but only when Settings was opened from the title. It is now a title-screen button too.
- **Reset Game** sits on the title screen and in Settings → Other. It always asks first, with a list of what will be lost, because it can't be undone.
- **What a reset clears:** every `localStorage` key starting with `jumpshot` (`wipeAllAndReload()` in `core/settings.ts`), then the page reloads as a first launch, so the next FIGHT starts the tutorial. Keys belonging to anything else on the same origin are left alone.
- **Layout:** the two buttons sit under the main buttons. On landscape phones (max height 560 px) they collided with the "tap or flick to start" prompt, so there they move to the empty top-left corner, mirroring the BEST plate.

## Hammer, daggers, whip, shield, meteors, roadmap

**Hammer.** The home-run smash (→ heavy) now carries the shockwave itself, so it fires on the contact frame whether or not the swing hits anything (`x2.wave`, forward only). Quake and Fault Line already did.

**Daggers.** ↓ heavy is now **Vanishing Execute**: it poofs, reappears behind the target and then runs Execute (which detonates every bleed).
- Execute could not simply gain `vanish`: a vanish resolves the move at contact and skips its hitbox. So it is a smoke move whose `then` is a `behind` copy of Execute.
- With no enemy on screen it still poofs.
- The air ↓ heavy (Falling Fangs) can't vanish without dropping the dive, so it gets a cosmetic smoke cloud (`x2.poof`). That is the one place "always" is cosmetic.

**Whip.** Four new moves in slots that used to repeat another move (full table in `WHIP_MOVESET.md`):
- **Disarm Crack** (ground ↗ heavy): interrupts telegraphed attacks and swats projectiles.
- **Lash Flurry** (air ↗ heavy): six rapid cracks.
- **Whip Yank** (air ↑ heavy): reels an enemy in.
- **Rodeo Slam** (air ↘ / ↓ heavy): a grab and slam.

Yank and Rodeo reuse the hook's tether moves; Disarm needed a new `x2.disarm`.

**Shield enemies.** HP 95 to 70, and the guard now breaks on any heavy move or on the third blocked hit (`SHIELD`, `Fighter.blocks`). Shields only appear from wave 7, so the Classic fingerprint is expected to stay identical (verified by the fingerprint test).

**Colossus meteors.** The old warning was a small flat ellipse. Now (`render/meteorWarn.ts`, drawn by both the colour and ink pipelines):
- the zone on the floor is the real hit width (`meteorRadius + 20`), a blinking sign marks it, and dashed lines run up the sky;
- a bar fills until impact, and the blink speeds up as it nears;
- it is render-only (no sim RNG), and every boss that calls meteors uses it.

**Roadmap.** Read as an in-game screen, not just a document: title screen button, built from the real tables (`data/roadmap.ts`) so it can't drift, and `ROADMAP.md` is generated from the same function.
- It shows waves 1-40 (one boss cycle) and notes that the cycle then repeats.
- It is not on the pause menu (the title screen is where you plan a run).

## Hammer KO finisher: HAMMER CRUSH (from the player's sketch)

**Sent through the Reference Sketchpad:** a stick fighter standing over a downed enemy with the hammer raised high overhead; note: "add this as one of the finishers for when using the hammer".
- **Moment:** the last enemy of a wave dies, as with every KO finisher, so it plays for the hammer instead of the fists-family roundhouse (`KO_OWN` in `data/cines.ts`).
- **Beats:**
  1. the enemy crumples to the floor;
  2. the hero holds the hammer overhead in slow motion (about 40 frames);
  3. the slam on frame 42 (bigger crack, invert flash, heavy shake and boom);
  4. the enemy is knocked out.
- **Drawings:** two new loops in `data/anims/cineSet.ts` (`cine_hammerUp`, `cine_hammerSlam`).
- **Bosses:** the existing boss wrapper (three hits first) applies, so the Hammer finisher is the closer of those.
- **Other weapons:** not affected. The hammer's air finisher and the Original moveset are unchanged.

## Standing rule: updates target the Pixel look only

**From the user:** "from now on, when I ask for any update, do it only to the Pixel main style, not the neon or the interpolated animation."
- New visuals (cosmetics, sprites, effects, drawings) are built for the Pixel ink look (`DRAW.ink`, Settings → Look → Pixel).
- The neon look (`stickman.ts`, Look: Smooth) and the Smooth / interpolated animation style are left as they were. They keep working, but get no new art and no tuning.
- Shared sim and data changes (traits, moves, UI screens) are look-independent and apply everywhere.
- Hero cosmetics, the Training Room sprites and the Ice Spear finisher art are therefore drawn only by `render/ink.ts` and its helpers; in the neon look the hero and the dummy draw as before.

## Home, traits, cosmetics, Training Room, Ice Spear and Laser Eyes

**Asked:** a Home menu (character, cosmetics, 2 trait slots, equipped weapon), a Training Room with a dummy the user draws, plus the sketches they sent (Dummy, Punching Bag, Ice Spear Finisher, Laser Eyes "can also fly"). All visuals are Pixel look only (see the standing rule above).

**Traits.**
- They bring back stat modifiers (perks were removed for balance in P7-1), so each one is a trade-off with a real cost.
- They combine into one `TraitMods` object (`data/hero.ts`) that is exactly the identity when nothing is equipped; the Classic fingerprint test confirms it. `world.setTraits()` applies it at run start and in training (not the tutorial).
- A test measures every trait's number against a no-trait baseline (max HP, damage out and in, low-HP bonus, Special gain, run speed, parry frames, air jumps, lifesteal).

**Cosmetics.** Colour choices stick to the Pixel look's four ink colours (red, blue, black); everything else is shape-based (headgear and hand gear drawn in `render/heroGear.ts`). The hero body stays black so it never blends into the blue and red enemies.

**Training Room.** A new `'training'` state next to `'tutorial'`: no wave spawns, the hero is healed so it can't die (even with the dummy attacking), Specials may target the dummy (`World.trainingRoom`), and Pause → Restart restarts training. The dummy walks back to its spot after a hit; the bag never moves and only swings (a spring on `Fighter.spriteAng`, render only).

**Targets: references, not pasted images.** The first build pasted the user's Dummy and Bag drawings in as images, but they meant them as references. Both are now redrawn in the game's ink style in `render/targetArt.ts`:
- paper fill and ink outlines at the enemies' line weight, re-jittered each drawing step so they boil like the figures;
- the Dummy keeps the sketch's big round head with X eyes, the stubby-sleeved shirt, one post and a base plate, plus a red bullseye;
- the Bag keeps the sketch's tapered body on a rope, with X eyes near the top and the wraps as red tape.

The PNGs are gone. Hit detection stays on the dummy's rig; the art is visual only.

**Ice Spear finisher** (`ko.ice`): a lunge drawing (`cine_lunge`), the spear as a cine visual drawn by `render/cineFx.ts`, an invert flash as the impact frame, then the existing shatter effect.
- Second pass: the spear didn't look like one. It is now a black ink shaft running through both of the hero's actual hand joints (with grip wraps), with a long blue ice-crystal head (facets and frost chips) that comes out through the enemy, as in the sketch.
- The Ice weapon's own held art is hidden during the lunge, so the hero holds only the spear.

**Laser Eyes** is a trait (`sim/powers.ts`), not a separate system, so it uses the same two slots.
- Hold jump after the apex to hover and climb slowly (150 frames of fuel, refilled by landing).
- While flying, every 10 frames the nearest enemy in front takes a small hit and burns for 200 frames (1 damage per 20 frames, never lethal on its own).
- The cost is -15% max HP and -10% damage.
- Flames, beams and the fuel bar are Pixel look only.

## Reset settings to default

**Asked:** "a quick reset to default settings button in settings".
- A two-tap button in Settings → Other (the first tap arms it, so a stray tap can't wipe your setup).
- It resets `settings` only (`resetSettingsToDefaults()`): saves, high score, hero, weapon and unlocked codes are untouched. Cheat switches go off, and Mobile performance follows the device again.
- The Rhythm latency offset is **kept**: it is a calibration of your device and ear, not a preference, and losing it would mean re-running the calibration.
- After the reset the panel reopens so every control shows its default, and the look, moveset, mode and layout listeners are notified.


## Ice sketches (Glacier Wall, Crystal Rush, Deep Freeze finisher) — Pixel look only
- **Glacier Wall** is redrawn from the sketch in the ink path only: a tall blue-outlined slab with a low step on the caster's side and a slanted top. It blinks out instead of fading. The neon drawing is unchanged.
- **Crystal Rush** (`ic2_rush`) replaces the duplicate Lance in the new Ice moveset's ground ↗ heavy slot. Six crystal spikes zig-zag forward, each taller than the last, with a short freeze.
  - In the Pixel look, every Ice spike move draws blue crystals instead of black triangles. `Spike.i` carries the index that sets the heights.
- **Deep Freeze as a finisher:** when the Ice Special will KO at least one non-boss enemy, it plays the sketch's version (Pixel look only). The check uses the predicted damage after the elite multiplier.
  1. Slow-mo and zoom in.
  2. Ice chunks grow over each body part.
  3. The hero points (`cine_point`, with the spear hidden).
  4. The shatter: a black impact frame with white wedges and red streaks, taken from frame 62 of the reference clip and skipped with Reduce Flashes, then shards fly.
  - The old Deep Freeze still plays otherwise, and always in the neon look. `data/cines.ts` reads `DRAW.ink` for this, as `handDrawn.ts` already does. The Classic fingerprint is unaffected.
- **Fix:** the hero no longer blinks through cinematics in the Pixel look. The cinematic invulnerability was triggering the invulnerability blink.

## Wardrobe: capes, scarves, footwear, badges, weapon skins, Female body (Pixel look only)
- **Where it is drawn:** everything new is drawn only by the Pixel renderer, in `render/heroCos.ts` and `render/weaponSkins.ts`, called from `ink.ts` and gated on `DRAW.ink`. The neon look keeps the old headband, headgear, wraps and mitts.
- **How it moves:** capes, scarves, the ribbon and the ponytail are stateless. They trail opposite the hero's velocity, rise when airborne, and wobble per drawing step, so they boil like the page.
- **Slots added to the Home screen:**
  - Body (Male / Female);
  - Neck & back (8 items);
  - Hands (now 8 items, merging the "general" list: tape wraps, fingerless gloves, brass knuckles, flaming fists, plus spiked gauntlets and the glow band);
  - Feet (5 items);
  - Belts & badges (3 items);
  - a per-weapon skin row each for Fists, Staff, Laser and Hook.
- **"Throw gloves" became Fists skins:** there is no Throw weapon any more, so the boxing gloves, oven mitts, lobster claws and foam hands are skins for the Fists.
- **Female body:**
  - shoulders are pulled in and hips pushed out (a copy of the joints, render-only, so the hitboxes and the sim are unchanged);
  - she has a ponytail.
- **Scribble green:** the 4-colour Pixel page has no green, so "Scribble green" is drawn in the pencil-grey dither.
- **Rank pin:** it shows the best style rank ever reached. A new `save.bestRank` field is updated on `rankUp`.

## Standing rule: preview before building
- The player asked to see options before they are implemented. For each new visual request, first publish a separate options artifact.
  - It shows real renders from a test build (via the game's own renderer).
  - The player picks there, and only the pick gets built into the game.
- The first such page covers the female hero's options:
  - hair: ponytail, long, bob, space buns, pigtails;
  - body: wide hips, same as male, hourglass outline, skirt, red dress.
  - The variant code is kept aside as a patch until the player picks.
- **The player's pick:** the player rejected round 2 (full looks with lashes, blush and bows) as a whole. They picked:
  - **Hair** (a new "Hair (female)" row in Home): ponytail, long wavy (with a small side fringe), or space buns. It only shows on the Female body.
  - **Female body:** the hips build plus the **hourglass outline** around the torso.
  - **A Flower headband option:** a red five-petal flower over the ear instead of the band's tail. It is Pixel look only; the neon look never drew the band.
  - The other options (bob, pigtails, skirts, dress, lashes, blush, bow) were dropped, along with the preview patch.

- **Second batch, approved on its preview page:**
  - two hair styles: messy bun, and long hair with bangs;
  - devil horns (Headgear);
  - devil tail and butterfly wings (Neck & back);
  - leg warmers and knee-high socks (Feet).
  - All are Pixel look only. The horns are drawn by `heroCos.ts` and not by the shared `heroGear.ts`, so the neon look is untouched.

## Character screen (was Home): colours, split slots, pause access, reset
- **Rename:** Home is now **Character**, on the title screen and in its heading. The element ids keep the `home-` prefix so the tests still work.
- **From the pause menu:** the pause menu has a **Character** button. That version shows only cosmetics and skins, because the weapon and traits change between runs. Done returns to the pause menu.
- **Colours per slot:** there are swatches for Hair, Headgear, Neck & back, Hands, Leg-wear, Shoes, Belts & badges, and one Skin colour for all weapon skins. The choices are Default (the item's own colours), Black, Red, Blue and White.
  - The chosen colour replaces the item's main colour (`MAIN_*` tables in `heroCos.ts` and `weaponSkins.ts`).
  - White hair gets an ink outline so it doesn't vanish into the page.
  - The headband keeps its own colour row.
- **Moved and split slots:**
  - The **Flower** moved from Headband to **Headgear**.
  - Feet is split into **Leg-wear** (bandages, warmers, socks) and **Shoes** (sneakers, boots, rocket shoes, flip-flops), so boots can be worn over socks or warmers.
- **Hair** now shows on either body, and has a None option.
- **Migration (save format v3):**
  - a flower headband becomes the flower headgear;
  - the old feet slot goes to Shoes or Leg-wear;
  - male heroes start with no hair, because before v3 hair only showed on the Female body.
- **Pixelated preview:** the Character preview draws into a low-res layer at the game's own pixel density, palette-snaps it, and scales it up with smoothing off, so it matches the game.
- **Reset Character:** a two-tap button resets every cosmetic, colour, skin and both trait slots.
