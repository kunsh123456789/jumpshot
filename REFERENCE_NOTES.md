# Reference notes (revision pass 5)

**Source material.** The brief points at a GIF and `sheet0.png`–`sheet3.png` (frames 0–99) in `reference/`. Neither was in the repo. I used the five contact sheets that came with the brief instead, now saved as:

| File | Frames |
|---|---|
| `reference/sheet_025-049.png` | 25–49 |
| `reference/sheet_050-074.png` | 50–74 |
| `reference/sheet_075-099.png` | 75–99 |
| `reference/sheet_360-418.png` | 360–418, every 2nd |
| `reference/sheet_420-466.png` | 420–466, every 2nd |

Frames 0–24 (the low crouch at 0, the flat lunge at 6–9, the tumbles at 12–20, the collapse at 21–22) were not in what I received. For those I worked from the brief's descriptions and from how the same ideas reappear later: the flat collapse at 77 and 97–98, the lunges at 47–49 and 82, the tumbles at 91–96.

Measured on the sheets (each cell is 220×160):
- The floor line sits at y ≈ 128/160, about **80 %** down.
- A standing figure is about **22–26 px of 160**, roughly **14–16 %** of the frame height.
- Lines are 1–2 px at sheet scale, about 2–3 px at the original resolution. Every edge is hard.

## Technique by technique

| Technique | Where it shows | How it's implemented |
|---|---|---|
| **Limited drawings, no in-betweens** | Everywhere: poses jump between cells (31→32→33, 41→42→43), even the slow walk (47–49) | A stepped "drawing" playback mode. Each authored key is a drawing that holds until the next. A display latch shows a new drawing or root position only on step ticks (Step Rate, default 12 fps = 5 ticks), except on sacred events (an animation starts, the contact drawing, a hit reaction), which latch on the exact tick. No render interpolation of pose or position in this mode |
| **Root position stepped** | Dashes jump across the floor (82–84, 47–49) | The drawn root x/y is latched on the same cadence. The sim still moves at 60 Hz |
| **Dramatic poses** | Staff plant + vault (25–29), axe overhead (70), sword raised (58–59), flat collapse (77, 97–98), crouch-run (82, 85) | Core animations re-authored as drawings with low crouches, committed extremes, a horizontal lunge, flat knockdowns, big contact deltas |
| **Scribble-hatch smears** | Staff arc (25, 28), sword (57), axe (70–72), the hero's slash (82, 84) | `ink.smear()`: 14–30 short strokes with jittered angle and length filling the crescent between the previous drawing's limb or weapon and the current one. Denser at the leading edge, with a few stray specks. Seeded by animation and drawing index, so every repeat is identical. Shown for the whole hold of the smear drawing (≥ 2 ticks) |
| **Echo copies** | Black enemy dashing (84–86), hero leaping (91–94) | During dashes, air dashes, the launcher follow, knock-backs and rushing enemies: 2–3 full-opacity copies of the current drawing at evenly spaced points between the previous latched root and the current one |
| **Persistent floor damage** | Scratch marks gather along the floor from frame 7 and stay (77–99) | `ink.floorMark()`: seeded scratchy crack and debris marks on and just under the floor line, added on ground impacts, spikes, bounces, KOs and footsteps from heavy moves. Kept until the wave ends |
| **Impact specks / splatter** | Specks after hits (77, 87, 89), speck spray (95–98) | Ink particles: 1–2 px specks, starburst stroke lines, and splatter pixels in the victim's color, flying on simple ballistic paths |
| **Scribble energy** | Red blast 52–54 (looping lines filled with red, breaking into fragments 54–56), red flame shots 63–65, the big scribble ball 424–428 | `ink.scribbleBurst()`: a mass of random looping arcs filled in the move color, breaking into drifting fragment strokes. Used for finishers, enemy projectiles (tapered flame scribbles), shockwaves and meteors |
| **Thin-line props** | Staff, sword, shield, axe (25–35, 57–73), a sword planted in the floor as scenery (73–99) | There is no weapon system in this build, so the planted-weapon prop is skipped. The Shield enemy's shield is redrawn as a thin outline rectangle like 69–71. Held weapons can be drawn per drawing later |
| **White page, thick floor** | All frames | The Blank Page arena: white background, a thick black floor line at 79 % of screen height, a few fixed doodle marks |
| **Dithered reflection** | Gray stippled mirror below the floor, cut off by the frame (all) | Fighters are mirrored below the floor in a reserved "dither key" gray. The pixel post-pass turns that color into a checkerboard stipple, clipped at the bottom of the view |
| **Hard 1-bit pixels** | All frames | The Pixel Look path draws the world to a low-res canvas (0.4× logical by default), quantizes every pixel to the palette (white, black, blue, red, gray-dither) with a 64-entry lookup table, which removes anti-aliasing, then upscales with nearest-neighbor. The HUD, pad and menus stay on the full-resolution layer |
| **Hollow vs solid heads** | Hero: outline circle. Enemies: solid black / blue / red heads with thicker limbs (25–49, 63–66, 84–89) | Hero: white-filled circle with a black outline, thin black limbs, a tiny stepped red headband tail (46). Enemies: solid heads, thicker limbs in team colors: Grunt blue, Rusher black, Brute / Elite / Boss red, others blue or black |
| **Locked wide camera** | The frame never moves (all) | A locked wide shot (figures about 14 % of the screen height), a gentle horizontal drift to keep the action in frame, small brief punch-ins only. No spring follow or auto-zoom |
| **Big moments** | Radial black/white burst (410–422), inverted night frames (410–414), zoom-in frames (368, 394) | The existing impact frame becomes a hard black/white invert on heavy hits and finishers, and finishers get a scribble burst. The radial burst background was used for finishers |
| **Telegraph** | Not in the reference | Kept readable: a winding-up enemy flashes red on alternating drawings, with a small red pixel burst at the head |
