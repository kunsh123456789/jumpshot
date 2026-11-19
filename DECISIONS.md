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
