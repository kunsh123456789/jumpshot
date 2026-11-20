# UI audit (revision pass 6)

Screenshots of every screen at three sizes, taken with headless Chromium (`t_audit.cjs` in the session scratchpad):

| Size | Viewport |
|---|---|
| desktop | 1280×720 |
| phoneL | 844×390, touch |
| phoneP | 390×844, touch |

The audit covers title, settings, calibration, song picker, tutorial, a gameplay crowd, the pad mid-swipe, the combo and rank, the between-wave screen (an upgrade picker until pass 7; now the breather with a weapon-swap strip), pause, results and the Rhythm HUD.

- **Before:** `docs/screenshots/before/<size>_<nn>_<screen>.png`
- **After:** `docs/screenshots/after/`

Some screens the brief asks for don't exist in this build: loadout/weapon select, the Jackpot Core, the weapon indicator and the laser heat bar. There is no weapon system, Jackpot Core or TimeDirector in the codebase, so those screens could not be audited or redesigned.

## Before (pass 5 state)

| # | Where | Problem | Severity |
|---|---|---|---|
| 1 | All menus (settings, calibration, song picker, pause, between-wave cards, results, tutorial banner, combo summary) | Dark navy glassy panels and buttons from the old neon theme, pasted on the white ink page. The whole UI clashes with the world | high |
| 2 | Title | Gradient neon "JUMPSHOT" logo with a glow. The yellow "TAP OR FLICK…" prompt on white is nearly invisible | high |
| 3 | Title (phones) | The Rhythm/Classic toggle and Settings button overlap the logo, in both landscape and portrait | high |
| 4 | Calibration from the title | The panel covers the mode toggle row; both sit at the top | medium |
| 5 | Settings (phone landscape) | The panel is taller than the screen; half the rows and the DONE button are clipped (scrollable, but nothing hints at it) | high |
| 6 | HUD: HP / super | Neon green and pink bars with dark tracks, a tiny pink "SUPER READY". Off-style and low contrast on white | medium |
| 7 | HUD: combo + rank | The big combo number overlaps the rank letters at the right edge (e.g. "33" over "SSS"). Rank letters are glowing blue/pink gradients | high |
| 8 | HUD: combo summary box | A dark navy box with tiny text sits over the arena | medium |
| 9 | Hurt vignette | A red radial gradient becomes a pink wash over the whole white page (phone screenshots 06) | high |
| 10 | Pad | Light-blue gradient band and hairline at the pad's top edge. The light-blue glow stick ring and the "DRAG = MOVE · FLICK = ATTACK" label are faint blue on white | medium |
| 11 | Floor in the letterbox | On phone landscape the floor line and paper stop at the world rect, leaving empty side bands | medium |
| 12 | Between-wave cards (removed in pass 7) | Dark cards; "WAVE N CLEARED" in yellow-on-dim | medium |
| 13 | Results / pause | Dark panels; tiny keyboard-hint text in pause on phones | medium |
| 14 | Rhythm HUD | Grey pill track; the BPM / section label is tiny (≈8 px) on phones | low |
| 15 | Damage numbers / floating text | Bold sans with a black outline. Fine, but not hand-lettered | low |
| 16 | Background | A plain white page with a few floor doodles; no paper feel | low |

## After (pass 6)

Screenshots: `docs/screenshots/after/` (same names as before).

| # | Fix |
|---|---|
| 1 | Every menu is a notebook page: ruled paper background, wobbly SVG pen borders drawn twice, hand font. Buttons get a highlighter swipe on hover |
| 2 | Title: hand-lettered marker logo with a red offset, a pen doodle of the hero, the prompt in marker with a highlighter underline |
| 3 | Title on phones: the mode toggle moved below the logo doodle as two drawn checkboxes. Nothing overlaps at any size |
| 4 | Calibration hides the title layer behind it |
| 5 | Settings: DONE sits in a sticky footer so it is always visible; tighter rows on short screens |
| 6 | HP is a heart + pen box with a scribble fill (blue → purple → red), with a hatched lag segment. Super is two hatched pencil boxes with ticks; "SUPER READY!" in red marker |
| 7 | Combo number is measured and placed left of the rank, which sits in a pen circle. No overlap at any combo length |
| 8 | Combo summary is a yellow sticky note |
| 9 | Hurt feedback is red pen hatching at the screen edges, not a pink wash |
| 10 | Pad: a dashed pencil top line with a "swipe here!" label and arrow (two lines on narrow screens), a doodled stick ring, an ink trail |
| 11 | The paper and floor cover the whole screen, including letterbox bands |
| 12 | The between-wave cards were pastel sticky notes with tape (the cards were removed in pass 7); "WAVE N CLEARED" in marker; a red pen circle on hover |
| 13 | Pause is a notebook page. Results is a report card with a rank stamp and a highlighted best combo, two-column on short landscape screens so the buttons stay visible |
| 14 | Rhythm HUD: pencil ticks, pen ring, metronome doodle, marker judgments with shapes; BPM in the hand font at a readable size |
| 15 | Damage numbers are handwritten with a stepped pop |
| 16 | Five paper pages with texture, doodles and line boil; page flip, cleared check and crumple transitions |

Also fixed during the after pass: the scoreboard no longer collides with the HP number on phone portrait, and the "x hits" combo label now reads "hit combo".

Crowd check: 15 enemies on graph paper at desktop and phone portrait. The hero, enemy teams and red attack telegraphs stay readable; damage numbers and BREAK!/BLOCK labels sit above the crowd.
