# Why the old animation felt bad

This diagnosis reads the old pipeline in `render/poser.ts`, `render/animator.ts`, `render/rig.ts` and `render/stickman.ts` (revision 1), and the frame strip in `docs/before_jab_strip.png`. That strip shows a jab, a jab and a launcher, one sim frame per cell.

## What the frame strip shows

- **The extreme never happens.** In frames 4–5, the jab arm is about 80% extended and the body is still in the same squat it had at idle. Hit-stop then freezes this half-pose. There is no frame where you could pause and say "that's a punch".
- **Every frame looks like the one before it.** From frame 2 to frame 23 the silhouette barely changes: bent knees, the same lean, arms near the chest. Three different attacks read as the same crouched shape with a slightly different arm.
- **The contact point is hidden.** A large white spark disk sits over the fist for about 8 frames, so the one moment that should read most clearly is covered.
- **The fighters overlap.** The fist goes inside the enemy's body instead of landing on it.
- **Only the launcher reads.** It is the one move with a distinct, tall pose, at frames 30–31.

## Causes in the code

| # | Cause | Effect |
|---|---|---|
| 1 | **Springs on every channel** (rad/s: 95 on strikes, 30 on recovery, 22 on idle), plus a crossfade on every change | Every pose is a target the body chases but never reaches. Strikes arrive late and under-extended, and hit-stop freezes the unfinished pose. This is the "physics puppet" feel: everything lags and settles. |
| 2 | **Continuous blending everywhere**: adaptive crossfades up to 11 frames, outgoing momentum, the head spring, the squash spring | Motion never stops. There are no holds, so there is no contrast between fast and still, and that contrast is what sells a hit. |
| 3 | **One timing template for every move**: anticipation eased toward the wind-up, a 2-frame `outBack` snap, then the same follow, carry-past and recovery fractions | Every attack has the same rhythm, so the moves feel interchangeable. The timing came from frame data fractions, not from authored beats. |
| 4 | **Only three poses per move** (anticipation, strike, follow) with small deltas, authored as offsets on a deep crouch stance | The extremes were close to neutral (a jab leaned 0.34 rad). The body never committed: no fully planted back leg, no rotated shoulder, no long stretched line. |
| 5 | **Every joint arrives on the same frame** | It looks mechanical. Hand animators lead with the hips, then the torso, then the arm, then the hand. |
| 6 | **Rig proportions and style**: short limbs (upper arm 26, forearm 25), a small head (radius 11.5), a 5 px dark outline on every limb, and rear limbs in a darker shade | Thick outlines merge the limbs into a blob at contact. Short limbs make extensions read weakly, and the small head loses orientation in fast motion. |
| 7 | **Procedural locomotion and idle**: sine-wave breathing and a stride generator | The idle looked like noise. The run had no clear contact, passing or flight poses. |
| 8 | **No smears and no impact frame** | Fast frames were drawn as normal crisp limbs with only a thin glow trail, so speed was invisible. Impact relied on the spark alone. |
| 9 | **Generic hit reactions**: two flinch poses chosen by hit count parity, and a spinning tumble | Hits didn't land on the victim. There was no snapped-back head, arched spine or flung arms held for a beat. |

## What replaces it

- **Pose-to-pose playback.** Every animation is a list of authored key poses in `src/data/anims/`. Each key has its own easing curve into it: snap-out, snap-in, ease-in-out, overshoot or hold. Linear interpolation is not allowed. There are no springs. The playback is exactly what was authored.
- **Snap → hold → settle.** Attacks are authored as anticipation → a 1–2 frame snap into an exaggerated contact pose → a hold (hit-stop adds to it) → follow-through → a settle that can be cancelled.
- **Staggered timing.** Hips lead by 2 frames and torso by 1, while the striking limb lands exactly on the contact frame.
- **Smears, impact frames and echoes.** Smears fill the swept area of the fast limb. Impact frames add an inverted flash on heavy hits and speed lines. Whole-body echoes appear on dashes.
- **A new look.** Long lean limbs, a large head, uniform round-cap lines in one color per fighter with no outlines, a ground reflection, and calmer backgrounds.
- **Short interruption fades only.** A 3-frame snap-out crossfade from the current pose, used only when an animation is interrupted.

## Result

- `docs/before_jab_strip.png` and `docs/after_combo_strip.png` capture the same scripted input (jab string → launcher), one sim frame per cell.
- `docs/lab_jab_backfist_launcher.png` is an Animation Lab contact sheet of three core moves, frame by frame.

In the after strip, every attack has a visible coil and a snap into a fully extended contact pose that holds. The overhand cross leaves an arc smear. The launcher crouches low and fires into a single vertical line, with an inverted impact frame on contact.
