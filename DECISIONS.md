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

## Revision pass 3: sync to music (rhythm mode)

**Music apps can't be the source.** The request was "sync to music you choose from a music app". Spotify, Apple Music and YouTube Music don't expose their audio to other apps or web pages (DRM), and Spotify closed its audio-analysis API to new apps in 2024. So I offer the three sources that can actually work: built-in tracks (exact sync), the player's own audio file (detected beats), and Listen mode, which hears any app through the microphone. Listen mode is the only route for streaming apps, and it's labelled experimental because room acoustics and phone mics vary.

**One clock: performance.now().** Pointer events are stamped in that clock, so every beat is converted into it. AudioContext time maps to perf time via `getOutputTimestamp()`, which includes output latency (Bluetooth headphones can add 150+ ms), falling back to `baseLatency + outputLatency`. The mapping is smoothed with a slow EMA and snaps if it jumps more than 30 ms. Judging is then just `input.time − offset − nearestBeat`.

**Judge the input, not the hit.** A flick is judged when the pad recognizes it, not when the fist lands. Moves have 4–20 frames of startup plus a magnetism dash, so judging the hit would make rhythm depend on distance to the target. Judging the input makes "swipe on the beat" literal. The grade rides on the `SwipeEvent` into the sim and on to the move it starts.

**Half-beats count as GOOD.** Juggles need inputs faster than one per beat (124 BPM = 29 frames per beat). An 8th-note input within ±55 ms of the half-beat counts as GOOD, so fast strings keep the streak alive but only quarter-note hits earn PERFECT. Random mashing still lands OFF about 30% of the time, which breaks the streak quickly, so timing matters.

**Rewards are multiplicative but bounded.** On-beat damage tops out at ×1.45 and score at ×2 (streak 32+). OFF still deals 70%, so a player who ignores the beat isn't locked out, just weaker. Classic mode exists for anyone who wants the original game.

**Enemies strike on the beat.** When an enemy starts its wind-up, the AI finds the first beat at least 75% of the authored wind-up away and stretches the wind-up to land the first active frame on it. The remaining wind-up is recomputed from the clock every tick, so hit-stop freezes don't drift it off the beat. Measured: strikes land within 0–8 ms of the beat. Wind-ups that would need more than 40 extra frames (very slow songs) stay unsynced instead of feeling sluggish. The telegraph animation already stretches over the wind-up, so it reads correctly. A tap on the beat now parries naturally, which ties the defense into the rhythm.

**Slow-mo is off in rhythm mode.** Slow-motion slows the sim, but the music keeps playing, so every finisher would desync the fight. Hit-stop is per-fighter and short, so it stays. Finishers keep the camera focus and impact frames. Slow-mo returns for the game-over moment.

**Sim time per step.** The main loop now hands each fixed step the perf-time it advances to (`now − remaining accumulator`), so wind-up timing and the idle bob are sub-frame accurate even when the browser runs several steps in one frame.

**Song analysis: DP tracker, then snap to a grid when it fits.** The onset envelope comes from log-magnitude spectral flux at 11.6 ms hops. Tempo comes from a prior-weighted autocorrelation, then an Ellis/librosa-style dynamic-programming beat tracker. Most pop and electronic music is quantized, so a robust line fit (drop outliers > 35 ms, refit, need 90% inliers and RMS < 15 ms) replaces the DP beats with a perfect grid. That removes ±1-hop jitter and single-beat slips (one synthetic 100 BPM test had a DP slip of half a beat; the robust fit fixed it). Songs that drift (live drummers) keep the DP beats. Synthetic tests at 64, 92 (12 ms human jitter), 100, 128 and 174 BPM all land with mean error under 1 ms after a measured +8 ms alignment constant. 174 BPM folds to 87, and 64 doubles to 128.

**Fold the tempo into 72–168 BPM.** Above about 170 BPM a PERFECT window covers a third of the beat and fighting becomes mashing. Below about 70, inputs feel too sparse. Halving keeps the stronger of the two beat parities, and doubling inserts midpoints.

**Listen mode is tracking, not detection.** Every animation frame a spectral-flux sample is stamped with `now − analyser half-window − input latency` (from `track.getSettings().latency`, else 30 ms). Four times a second the last 8 s are binned to 100 Hz, and an autocorrelation gives the tempo. A recency-weighted comb filter at 2 ms resolution gives the phase. A PLL smooths both (tempo gain 0.15, phase gain 0.35). One subtle bug: when the kick and snare are equally strong (or the tempo was folded), the comb flips between two equally valid beat parities, and the PLL averaged them to a phase a third of a beat off. The fix detects the strong half-period alternative and follows whichever candidate is nearest the prediction. Unit tests now hold phase within 11 ms at 92–174 BPM, and the fake-mic browser test locks to a 128 BPM song at 128.3 BPM in about 6 s. Echo cancellation, noise suppression and auto-gain are disabled, because they treat music as noise.

**Built-in tracks put a transient on every quarter note.** Kick or snare always lands on the beat, so the beat is audible even before the beat track is learned. Each track keeps its intensity layers (hats, arps, leads come in as the style rank rises). The original 124 BPM loop became Neon Rush.

**Calibration uses the real input path.** The overlay leaves the pad live, so you calibrate with the same flicks (and the same recognition delay) you fight with, not with a separate button. It takes the median of 12 inputs after a 4-click count-in and ignores anything more than 250 ms off. In tests, a simulated player 40 ms late measured +40 ms, and the judged grades after saving were PERFECT.

**Pause keeps the grid.** Built-in tracks resume at the next bar boundary on a re-anchored grid. Songs restart from the paused position with a new anchor. A test pausing mid-run and then hitting on-beat inputs scored 6/6 PERFECT.

**Visual sync.** The beat track slides markers into a ring that pulses on the beat. Bar downbeats are taller, and half-beat dots show the GOOD 8th-note window. Timing ticks show early/late at a glance, which helps self-calibration. The pad's top edge glows on each beat. Idle loops are phase-locked so both bobs of the two-bob idle land on beats, for the player and every enemy type. Pop detector: 0 pops over a full rhythm-mode bot run.

**Things I chose not to do.** Downbeat detection for songs: the bar accent counts from the first detected beat, which can be off by 1–3 beats in a song, and it's cosmetic only. Saving loaded songs between sessions: re-picking the file is simple and avoids storing user audio. Rhythm judging in the tutorial: it teaches the moves first, and the music screen follows it.

