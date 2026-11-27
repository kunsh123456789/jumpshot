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

## Second upload (after revision pass 7)

New material: `sheet_000-024.png` (the opening frames, not seen before) and `gif2_sheet0-5.png` (frames 0-358 of a second clip, every other frame). The other uploaded files were byte-identical copies of sheets already here and were removed.

| Frames | What it shows | Applied to |
|---|---|---|
| 000-024, gif2 0-30 | A polearm fighter: low wide crouch with the pole diagonal, big **filled crescent smears** traced by the weapon tip, a ground spin with several crescents, an air spin with two crescents in a Z | **Staff:** a weapon-sweep smear (`WeaponDef.sweep` + `weaponCrescent` in `render/inkFx.ts`) fills the area the staff itself swept between drawings with grip-to-tip hatch and a heavy rim, thinning over the smear chain. The spinning sweep and helicopter now rotate the staff with the arms instead of spinning the whole body |
| gif2 36-46 | **Pole vault:** the pole planted upright in the floor, the hero perched at its top, then swinging over with a crescent | **Staff vault:** during the plant and launch drawings the staff is drawn upright from the floor to the hands, the hero is redrawn high on the pole with legs tucked, then kicking over |
| gif2 54-58 | The weapon thrown, spinning away | **Staff boomerang** (↗ heavy): the staff spins out with two trailing crescents and returns |
| gif2 76-82 | Energy beam across the screen as a chain of **cursive loops** with debris flicking off | **Laser:** beams are now a prolate cycloid (loops written along the line, crawling forward per drawing) over a straight core, with debris strokes |
| gif2 94, 104, 288-298, 322, 350 | Inverted impact frames on the biggest hits, a white crescent on black | **White-crescent impact frame** on finishers, weapon slow-mo moments and `fx.crescent` moves |
| gif2 158-170 | Jagged lightning and a hatched whirlwind ball | **Lightning** (Nova, Crater Yank, JUMPSHOT finisher) and a **whirlwind** around the helicopters and the Flurry |
| gif2 200-238 | A stretched arm grabbing and dragging, held upside down, then thrown | **Throw: Long Arm** (↑ heavy): the arm stretches, grabs and drags; Fists v2 jabs get a rubbery reach |
| gif2 262-284 | Close grappling into an over-the-shoulder throw with a smear | **Over-the-shoulder slam** after the Long Arm (released behind the hero) |
| gif2 336-356 | Dizzy stars around a stunned fighter | The stunned stars already exist |
| sheet_000-024 + all | Low crouches, coiled extremes, held contact drawings, crescent smears on limbs | **Fists Reference v2** set (Legacy kept as a setting) |

## Third clip: `reference/gif3_sheet0-4.png` (frames 0-298, every 2nd)

Sent as more reference. What it shows, and what the game takes from it:

| Frames | What happens | Taken into the game |
|---|---|---|
| 0-10 | A row of fighters mid-action, then a hard cut to a dithered "production" card | Hard cuts and dither transitions, no fades |
| 12-30 | Black title card, a planet rising, blue-rimmed stars | Black frames used as punctuation |
| 32-46 | Clouds drawn as single jagged outlines, no fill | Outline-only shapes for big effects |
| 48-50 | Vertical rain streaks | (not used yet) |
| 62 | **Impact frame**: a full black frame with white radial spikes from one point, a white jagged lightning bolt and thin red lines | The Ice Special's shatter impact frame copies this: black screen, white radial wedges and red lines from the shatter point |
| 64-72 | A huge cloud outline, then a dithered checker frame | Dithered stipple as a flash between two drawings |
| 74-76 | An explosion: jagged outline shards flying out, dust settling as dotted stipple | Shattered ice flies out as outline shards |
| 98-106 | A dash leaving a dithered black smear column | (reference for future dash smears) |
| 110-132 | Fighters with red scribble-hatch weapon smears; a sword thrust | Red scribble smears (already in the game) |
| 134-146 | A big **dithered dust cloud** with chunky rocks thrown out of it | Dithered fills on big clouds |
| 160-166 | A crater left in the floor that stays | Persistent floor damage (already in the game) |
| 168-178 | A dither fade to black, then a house with brick hatching, a cloaked fighter | Background hatching density |
| 182-214 | A giant ball, a cape swirl, a fighter thrown through the air, an inverted **beam impact frame** (208) and a long tapered beam (206-214) | Long tapered beams; inverted frames on the big hit |
| 216-238 | The house wall blasted open into a black dithered hole | Black dithered holes for big destruction |
| 242-276 | An indoor stage with stairs, crates and hanging lamps | Stage props drawn as flat outlines with dither shading |
| 278-298 | A **VS screen**: inverted image, a red jagged "VS", red pixel squares in the corners, "5x" text | (reference for a future VS / boss intro card) |


### Clip 3: ideas not yet in the game (report for the player)
These are candidates, not built yet:
- **Impact frames:** a red tear impact frame (268); a beam clash ring and glyph (208–210); a stipple flash (72); a dither-to-black cut (168–170).
- **Movement:** a scanline blur for dashes and blinks (86, 270, 276); a dither pillar (104); a thrown-enemy dithered arc and spike-landing debris (196–202); a KO body slide (98); a blade clash (114–116); a scribble dust ball (120).
- **Weapons:** a cape weapon (186–198); a war fan or parasol (118, 122); a flame blade (124, 132); an earth dust dome with boulders (134–144); a rolling wrecking ball (184); tapered spread beams (206, 214); planted swords and floor X-slashes (154–162).
- **World:** a breakable wall (216–238); an indoor stage with stairs, crates and lamps (242–276); rain and a starfield (28, 48); dust that stays after explosions (74).
- **UI:** a VS boss card (278–298); a dithered title card (10); a camera punch-in (142).
