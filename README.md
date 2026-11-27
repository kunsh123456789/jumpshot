# JUMPSHOT

A 2D stickman combo-fighting game for the browser. You **flick on the bottom half of the screen**, and the fighter dashes onto a target and strikes on its own. Launch enemies skyward with the **Jumpshot** uppercut, leap after them, juggle them in the air, then spike them into the floor.

You can position yourself by dragging slowly in the bottom half of the screen. Everything is procedural: a skeletal stickman rig with keyframed poses and 2-bone IK, canvas effects, and WebAudio-synthesized sound and music. The game uses no image or audio files.

There are two modes, switched on the title screen or in Settings:
- **Rhythm Mode** (default): the music is the clock. You swipe whenever you like, and every attack **snaps onto the beat grid**, so each hit is part of the song. Swiping *on* the beat makes hits land harder and builds a streak. Enemies attack on the beat too. See [Rhythm Mode](#rhythm-mode).
- **Classic Mode**: the original game, unchanged.

## Your hero (Home)
The **Home** screen lets you dress the hero. These cosmetics show in the Pixel look:
- **Body:** Male or Female.
- **Neck and back:** red scarf, ninja scarf, cape, tattered cape, notebook-page cape, ribbon, backpack, line-art wings.
- **Hands:** tape wraps, mitts, fingerless gloves, spiked gauntlets, glow band, brass knuckles, flaming fists.
- **Feet:** sneakers, boots, bandaged feet, rocket shoes, flip-flops.
- **Belts and badges:** champion belt, sheriff star, and a Rank pin showing your best style rank.
- **Weapon skins:**
  - Fists: boxing gloves, oven mitts, lobster claws, foam hands.
  - Staff: bamboo, bone, candy cane, glow staff, paintbrush, broom.
  - Laser: toy ray gun, banana, hand cannon, scribble blue, red or green.
  - Hook: pirate hook, chain, fishing rod, rope and anchor.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. The dev server also listens on your LAN IP, so you can open it on a phone on the same network.

## Build for static hosting

```bash
npm run build
```

This type-checks the code and writes a static site to `dist/`. Asset paths are relative, so you can serve `dist/` from any folder or static host. To preview the build locally:

```bash
npm run preview
```

## How to play

The **bottom half of the screen** is the touch area. It is transparent, so you can see the fight through it. Touches that start in the top half only work menus and buttons. One touch does everything, so you don't need to lift your finger:

| Gesture (in the bottom half) | Action |
|---|---|
| **Drag slowly** left/right | **Move.** It works like a floating stick: the further your finger is from where you touched down, the faster you run |
| **Flick** in a direction | **Attack** that way. Keep dragging after a flick to keep running |
| **Long, fast flick** | The **heavy** version of the attack |
| **Fast zig-zag** | Each sharp turn fires the next attack |
| **Slow drag up** | **Jump.** Keep dragging up for a higher jump; steer by dragging sideways in the air. A *fast* flick up is still the launcher attack |
| **Tap** | Also a **jump** (tap again in the air for a second jump; air attacks work straight away) |
| **Hold still** (~0.35 s) | **SPECIAL** when the Special Bar is READY |
| **Double-tap** | Dodge. Dodge just before a red-flashing attack lands for a **PERFECT PARRY** (Settings → Tap / Space can switch tap back to dodge) |

These are the **Fists** moves (the default weapon). Other weapons replace the moveset: see **Weapons** below.

| Flick | On the ground | In the air |
|---|---|---|
| **→ / ←** | Jab, jab, cross string. Heavy: **Spinning Backfist** | Air-kick chain. Heavy: **Air Cannon** |
| **↗ / ↖** | Rising hook. Heavy: **Flying Knee** | Sky slash |
| **↑** | **JUMPSHOT launcher**: the enemy flies up and you leap after it | Rising strike |
| **↘ / ↙** | Leg sweep. Heavy: **Slide Kick** (both break shields) | Spike |
| **↓** | Quake Stomp | **SPIKE** |

- Your attacks dash you onto the nearest enemy in the flick's direction, so positioning matters: walk into a group, keep away from a Brute, chase a Thrower, or line enemies up to bowl them into each other.
- When you flick during an attack, the attack is buffered and fires as soon as the current one can be cancelled.
- **Finishers** (per weapon, with slow-mo, camera push-ins and inverted impact frames):
  - **Air Finisher**: after 5+ hits in an air juggle, flick ↓ in the air (once per air combo). Fists: the **JUMPSHOT FINISHER** meteor axe kick.
  - **Last-Hit Finisher**: when the last enemy of a wave goes down, a short K.O. cinematic plays (any input skips it). Bosses get a longer multi-stage version.
- **Special Bar** (under the HP bar): fills from hits (more for long combos, air hits and multi-hits), on-beat Perfects in Rhythm Mode, perfect parries, orbs, KOs, and a little from taking damage. When it reads **READY**, **hold still on the pad** (or press **X**): the world freezes and a picker shows every weapon's Special. **Tap the one you want**, even one you don't have equipped (or ←/→ + Enter, or d-pad + A on a gamepad). After 4 seconds your equipped weapon's Special is used. Then **drag its one path** in a single stroke (the Hook's path connects dots over the real enemies; the Throw ends with a flick that aims the hurl). How well you trace sets the result: SLOPPY, CLEAN or PERFECT. Even a bad trace still lands a weaker Special. Settings has **Special assist** (wider path, longer timer).
- The style rank (D → SSS) multiplies your score. An elite arrives every 5th wave and a boss every 10th.
- **Between waves** there is a 3-second breather: the arena is clear, you heal 35%, the floor cracks reset and the next wave's title comes up. It continues on its own (in Rhythm Mode the next wave starts on a bar line). A small **Swap weapon** strip is available during the breather.
- **📱 Mobile performance** (top of Settings, on by default on phones and tablets) cuts lag in big fights: it renders at 1x pixel density, skips the Pixel Look's per-frame palette snap (a GPU read-back that phones are slow at), the floor reflections and the menu blur. Gameplay is identical. With it, a 15-enemy fight on an emulated phone at 4x CPU throttle went from ~20 fps to ~45-50 fps.
- Menus (Settings, Loadout, Pause) scroll with a finger swipe; on short or narrow screens the loadout becomes a single scrolling page with a smaller preview.
- **Settings** include volume, screen shake, hit-stop strength, **Flick sensitivity**, the **Touch area** height (35–60% of the screen), left-handed mode, reduced flashes and the debug overlay.

**Keyboard**

| Key | Action |
|---|---|
| **A / D** or **← / →** | Move (hold) |
| **I / J / K / L** | Attack up / left / down / right. Press two at once for a diagonal, for example I+L = ↗ |
| **Shift** + attack | Heavy |
| **Space** | Jump (again in the air for a double jump) |
| **Shift+Space** or **F** | Dodge / parry |
| **W / ↑** | Jump (hold for a higher jump) |
| **S / ↓** | Low stance |
| **X / Enter** | Special (when READY). During it: arrows for the path and swipe prompts, Space for taps |
| **1–9, 0 / Q, E** | Pick a weapon (loadout screen), or swap weapons during the between-wave breather |
| **Enter / Esc** | Close the loadout screen |
| **Esc / P** | Pause |
| **`** | Debug panel: FPS, sim tick rate, interpolation alpha, frame-time graph, pop detector, input state, buffer |
| **[** | 0.1× slow motion (toggle) |
| **]** | Freeze and step one frame per press |
| **\** | Resume normal speed |

**Menus (keyboard).** Arrow keys move focus, Enter selects, and Esc goes back or closes. On a slider or select, ←/→ change the value.

**Gamepad** (any standard-mapping controller)

| Button | In play | In menus |
|---|---|---|
| **Left stick / d-pad** | Move | Move focus |
| **X** | Attack toward the stick direction (neutral = forward) | |
| **Y** | Heavy attack toward the stick | |
| **A** | Jump (again in the air for a double jump) | Select |
| **B / LB** | Dodge / parry | Back |
| **RT / RB** | Special (when READY) | |
| **Start** | Pause / resume | |

**Dev URL flags**
- `?wave=N` starts a run at wave N.
- `?weapon=fists|hook|throw|staff|laser` equips that weapon.
- `?song=dojo|neon|volcano` forces Rhythm Mode with that song (no picker); `?classic` forces Classic Mode.
- Look and animation style come from Settings (stored in `localStorage` as `jumpshot.settings.v1`: `look`, `animStyle`, `stepRate`, `pixelRes`).
- `?manual` drives the loop from `window.__advance(ms)`, for deterministic refresh-rate tests.

## UI: Arcade Fighter

The interface is a bold arcade-fighter design: navy plates, a cyan / magenta / gold palette, skewed corner-cut panels, Russo One and Oswald type, one SVG icon set and slam-in motion. It was chosen from four directions mocked up over the running game (`ui-options/index.html`). Before and after screenshots at desktop, phone landscape and phone portrait are in `ui-options/current/` and `ui-options/after/`, and `UI_AUDIT.md` lists each problem and its fix.

**HUD layout.** All of it stays out of the bottom-half touch area and respects phone safe areas.
- **Top left:** HP bar, weapon chip and heat bar.
- **Top centre:** Special Bar (charging → gold READY → active).
- **Top right:** score plate, wave and KO count, pause button.
- **Under HP:** combo count with damage %, the style-rank hex and the AIR FINISHER hint.
- **Bosses:** a boss bar.

**Drawn on the canvas** (they track the world): damage numbers, the Rhythm beat lane and judgments, and the Special picker and trace.

**Menus** (title, loadout, settings, pause, results, song picker, calibration) work with touch, mouse, keyboard and gamepad.

**Home, traits and cosmetics.** The title screen's **HOME** button opens your fighter: the hero alive in a canvas (tap to change pose), your equipped weapon (CHANGE WEAPON opens the loadout and returns here), **two trait slots**, and cosmetics. Everything is saved in your browser; RESET GAME clears it.
- **Traits** are small trade-offs (an upside and a cost), equipped two at a time and applied to every run and the Training Room (not the tutorial). With none equipped the game plays exactly as before.

| Trait | Up | Down |
|---|---|---|
| Iron Skin | +25% max HP | -10% run speed |
| Glass Cannon | +20% damage dealt | +25% damage taken |
| Adrenaline | Special bar fills 40% faster | -10% max HP |
| Lightfoot | +1 air jump, +10% run speed | -10% damage dealt |
| Steady Nerves | Parry window +50% | -10% damage dealt |
| Leech | Heal 5% of damage dealt | -20% max HP |
| Laser Eyes | Hold jump to **fly** (hover and slowly climb on a small tank that refills on landing); eye beams burn the nearest enemy you face | -15% max HP, -10% damage dealt |
| Executioner | +55% damage to enemies under 30% HP | -10% damage to healthy ones |

- **Cosmetics** (Pixel look): headband colour (red, blue, black, none), headgear (cap, top hat, crown, halo, cat ears, goggles) and hands (wraps, mitts).

**Training Room.** HOME → TRAINING ROOM (or the title's TRAINING button). A dojo with one target and no waves or game over: a training **Dummy** and a **Punching Bag** (hangs and swings when hit), drawn in the game's ink style from your sketches, or the stick figure. The bar has TARGET, DUMMY: STILL / ATTACKS (so you can practise dodging and parrying), WEAPON (swap), FILL SPECIAL (Specials can hit the dummy here), RESET and EXIT, with live LAST / COMBO / TOTAL / DPS readouts. Pause → Restart restarts the Training Room.

**Finishers from your sketches.** Hammer: **HAMMER CRUSH**. Ice: **ICE SPEAR**: the last enemy is dazed, you lunge, a spear drives clean through it with an impact-frame flash, then it shatters.

**Roadmap.** The title screen's **ROADMAP** button shows waves 1-40 as four stages of ten, each ending in a boss. Tap (or focus) a wave for its enemies, what is new, the arena and page, the HP and damage scaling, and boss notes; cleared waves are green and your best wave is outlined. It is built from the real wave tables, and the same data is written out in `ROADMAP.md`.

**Reset settings.** Settings → Other → **RESET SETTINGS TO DEFAULT** (tap twice) puts every setting back to its default and keeps your progress, weapon, character and the Rhythm latency offset (that is a measurement of your device).

**Tutorial and Reset.** The title screen has a **TUTORIAL** button (replay the training at any time) and a **RESET GAME** button (both are also under Settings → Other). Reset asks first, then deletes everything the game saved in this browser and restarts it as a first launch: high score, best combo and wave, tutorial progress, unlocked codes, weapon choice and every setting. On short landscape screens the two buttons sit in the top-left corner.

## Weapons

You carry **one weapon** at a time. All 9 are unlocked from the start. Pick one on the **loadout** screen (the WEAPON button on the title screen; keys 1–9 pick them, Q / E or ←/→ step through them). It shows a looping preview of the moves and a swipe cheat-sheet, and remembers your choice. Between waves you can swap instantly from the small strip (tap an icon, press 1–9 / 0, or step with Q / E). The first time you equip a weapon, a tooltip lists its moves. Every weapon works with the pad and the keyboard, combos, juggles, parry/dodge, the Super Meter finishers (JUMPSHOT and FLURRY), the style rank and both game modes.

| Weapon | Strength | → ← | ↑ (starter) | ↗ ↖ / ↘ ↙ | ↓ | Tap |
|---|---|---|---|---|---|---|
| **Fists** | Balanced, fast | Jab string · heavy: spinning backfist | JUMPSHOT launcher | Rising hook / leg sweep | Quake stomp · air: spike | Dodge |
| **Grappling Hook** | Mobility and control | **Yank** the enemy in (+ an automatic punch) · heavy: **Zip** to them with a flying kick | **Air Hook**: launch and zip up after them | **Swing** around the target, kicking everything on the way | **Slam Yank** into the floor (ground bounce, crack) | Hook-zip dodge (longer) |
| **Staff** | Reach and crowd control | 3-hit twirl · heavy: spinning sweep that trips everyone around | **Pole Vault** launcher | **Helicopter** spin (hits all around, deflects darts) · ↗ heavy: **boomerang** throw | Plant slam shockwave | Dodge |
| **Laser Blast** | Safe ranged damage | Bolt · heavy: **charged piercing beam** | **Sky Blast** (heavy: a barrage that keeps them aloft) | Rising bolt / leg shot (trips) | Ground blast · air: **down beam** spike | Dodge |
| **Chain Whip** | Reach, crowds at range | Lash through the whole line · heavy: crack | **Wrap & Hoist** | Whirl overhead / ankle lash (trips) | Snap the floor | Dodge |
| **Giant Hammer** | Armor breaking, huge hits | Swing · heavy: home-run smash | Skyward swing · heavy: **Ground Pound** (launches everyone near) | Hammer spin / ankle breaker | Quake · air: meteor hammer | Dodge |
| **Twin Daggers** | Speed, long combos | 3-cut string (bleeds) · heavy: **Blink Slash** behind them | Rising fangs | Knife fan / hamstring | Blade storm | **Teleport** |
| **Ice Spear** | Freeze, then shatter | Frost jab · heavy: ice lance (hits **freeze**; next hit **shatters**) | **Ice Pillar** | Shard fan / glacier sweep · heavy: frost field | Downstab | Dodge |
| **Scythe** | Crescent reach | Reap string · heavy: **Death Spiral** | Rising moon | **Scythe throw** / **reaping pull** | Harvest · air: guillotine | Dodge |

- **Hook and Laser** are ranged: they don't dash you up close; they fire at the best target in the swipe direction (generous auto-aim).
- **Laser heat:** every shot adds heat, and full heat overheats the blaster for about a second (swipes become a melee bash while it cools). Heat drains fast; in Rhythm Mode a Perfect-timed shot vents heat.
- Each weapon has a slow-motion moment: the hook yank, the charged beam, the staff vault apex.
- The biggest hits get a white-crescent impact frame; Nova and Crater Yank call down lightning; the helicopter spins a whirlwind.

### New movesets (default)

Every weapon has a reworked **signature moveset**. **Settings → Weapons → Movesets** switches between **New** and **Original** at any time; the table above is the Original set. The loadout preview and move list always show the active set.

| Weapon | Signature | New moves | Dodge | Special |
|---|---|---|---|---|
| **Fists** (Brawler) | **Fury**: hits fill it; while it burns, punches hit harder and boom louder | Jab, jab, **Power Cross** (shockwave puff) · heavy **Haymaker** · ↑ heavy **Dragon Uppercut** · air ↓ **Meteor Elbow** | **Slip**: dodge or parry an attack and you counter-punch automatically | MEGA JUMPSHOT |
| **Grappling Hook** (Spider) | **Grapple mobility**: swing from the roof, zip to the walls and stick to them (see below) · **Tether** two enemies: hitting one drags and hurts the other | ↗ ↖ **Web Swing** · ← → with nobody that side **Wall Zip** · ground ↗ heavy **Tether** · ↘ **Trip Line** · air ↓ **Grapple Dive** (lands with a shockwave) | **Zip up** to the roof and hang | WEB TAKEDOWN |
| **Staff** (Spin Master) | **Momentum spin**: keep holding after ↗ and the staff keeps spinning (deflects shots); let go to fling | → heavy (Shift + →) **Pole Vault Kick**: plant the staff, vault off it and drive both feet in · ↑ heavy **Pole Rocket** · ↘ **Low Spin** · ↓ heavy **Pole Kick** · air → **Windmill** · air ↓ **Drill Dive** | **Vault** over the enemy | CYCLONE |
| **Laser** (Gunslinger) | **Range matters**: up close every shot is a **Point-Blank Blast**; overheating vents a knockback steam burst | → close **Point-Blank Blast** · ↗ **Blast Jump** · ↓ close **Muzzle Slam** | **Recoil dash** (shoots behind you) | OVERLOAD BEAM |
| **Whip** (Tamer) | **Sweet-spot crack**: tip hits do double damage | → heavy **Sonic Crack** (stuns the line) · ↗ heavy **Disarm Crack** (cancels telegraphed attacks, swats shots) · ↑ heavy **Lasso Spin** (swing an enemy as a weapon) · ↓ heavy **Tamer's Ring** · air → **Tarzan Swing** · air ↗ heavy **Lash Flurry** · air ↑ heavy **Whip Yank** · air ↘ heavy **Rodeo Slam** (full table: `WHIP_MOVESET.md`) | **Backflip** | **LION TAMER**: figure-8 path; lashes spin everyone, then one crack yanks them into a pile and launches it |
| **Hammer** (Earthshaker) | **Floor shockwaves** on every slam (jump over them!); swings have **super armor** | → heavy **Smash** (a floor shockwave even when it misses) · ↓ **Quake** (waves both ways) · ↓ heavy **Fault Line** (rock spikes + a forward wave) · ↑ heavy Ground Pound + waves · air ↓ Meteor Hammer + huge waves | **Hammer hop** over the enemy | **EARTHSPLITTER**: down-then-V path; leap, slam, the floor splits both ways and slabs launch everyone Last-hit KO finisher: **HAMMER CRUSH** (the last enemy drops, you stand over it with the hammer raised overhead, then slam it down). |
| **Daggers** (Assassin) | **Backstab**: hits from behind (and any move that lands behind) always crit; cuts **bleed** | → heavy **Shadow Dash** (the cuts land after you pass) · ↓ **Smoke Bomb** (vanish, reappear behind them with a Backstab) · ↓ heavy **Vanishing Execute** (always poofs, reappears behind them, detonates every bleed; the air version pops a smoke cloud) | **Smoke teleport** | **BLADE STORM**: star path; time stops, you blink behind each enemy leaving slashes, then every slash lands at once |
| **Ice** (Frost) | **Slippery floor**: ice patches make enemies slide (and **shatter** into each other); you skate faster on ice | ↘ **Ice Slide** (leaves a trail) · ↓ **Frost Floor** · ↓ heavy **Glacier Wall** (blocks and freezes) · air ↓ **Icicle Drop** | **Skate** (long slide that leaves ice) | **DEEP FREEZE**: X path; the screen freezes, enemies become ice statues, one punch shatters them |
| **Scythe** (Reaper) | **Doom**: hits put skull marks on enemies, 3 = **REAPED** · KOs drop **souls** that heal · below 30% HP hits **steal life** | Doom on the reap string, Death Spiral, Reaping Pull and Harvest · ↓ **Grave Rise** (dead hands hold enemies) | **Phase** (turn ghostly, pass through) | **REAPER**: crescent path; the world goes black and white and a giant shadow scythe sweeps through everyone; their souls heal you |

**Grappling hook mobility** (Hook, New moveset). A girder roof runs across the top of the arena, and both walls take the hook.
- **↗ / ↖: Web Swing.** The rope bites the roof ahead and you swing under it.
  - A quick flick swings one arc and lets go at the top with all the speed.
  - **Keep your finger down** (or the attack key held) to keep swinging back and forth.
  - Flick ↗ again mid-swing to **chain** to the next rope.
  - You **kick** every enemy you swing through.
- **On a rope:**
  - tap / jump: **web jump** (always upward);
  - ↑: reel up and hang;
  - ← → with nobody that side: zip to that wall;
  - ↓: **Grapple Dive**;
  - any other attack lets go and strikes;
  - the arrow keys / stick steer the swing.
- **← / → with no enemy on that side: Wall Zip.** You zip to the wall and **stick** to it, slowly sliding down. Swinging hard into a wall also sticks you to it. From the wall:
  - tap, or swipe away: **wall jump**;
  - swipe toward an enemy: **Wall Dive** kick;
  - ↑: climb to the roof;
  - ↓: drop.
- **Air ↑ with nothing overhead:** zip to the roof and hang. **Dodge** does the same, and stays a dodge: you're briefly untouchable.
- Letting go of any rope keeps your momentum (low air drag for a moment) and gives your air jump back.

## Sound

Every sound in the game is a CC0 recording from Freesound (credits in `SOUND_CREDITS.md`, 83 clips, about 345 KB, bundled with the build). That covers hits, effects, UI, voice, and every drum and instrument in the built-in music.

- **Hits:** every punch has a deep boom and a sharp clack. Eleven pre-mixed punches (short, full and heavy) each combine three parts: a boom that swells in right after contact, a Freesound punch body boosted at 210 Hz so it thumps on phone speakers too, and the crack of a movie-style kung-fu punch on top. Heavy hits briefly duck the music. Variants never repeat back-to-back, and the combo nudges the pitch up. The mix lets each punch's first milliseconds through, with a limiter so nothing clips.
- **Big moments:**
  - The laser Special: an anime charge-up, a heavy beam blast, then a deep, wobbling laser hum for as long as the beam fires.
  - KO finishers: a cinematic impact.
  - Spikes and slams: a sub boom.
  - The Special Bar filling: a charge-up sting.
  - Wave start: a boxing bell.
  - Wave clear and game over: jingles.
  - Getting hit: grunts.
  - Rhythm Mode calibration: a recorded metronome.
- **Music:** the songs are still sequenced in code, so they stay locked to the beat clock. Each drum is a sample and each note is a re-pitched sample (bass, pluck, lead, shamisen, glass bell, pad). Combo hits in Rhythm Mode ring a glass-bell note on the beat.
- **Settings → Sounds & music → Synthesized** switches back to the original synthesized set. It also plays for the first moment after launch, until the clips have decoded.

## Bosses

Every 10th wave is a boss, in this order, then around again with more HP:

| Wave | Boss | How it fights |
|---|---|---|
| 10 | **The Colossus** | Hammer slams with shockwaves, sweeps and rushes; meteors and grunt summons from phase 2. **Every meteor is telegraphed**: a red hit zone on the floor (its exact width), a blinking ! sign, dashed lines up the sky, and a bar that fills until it lands. Jump it to dodge. |
| 20 | **Scribbla, the Ink Witch** | Keeps her distance and throws fans of three darts (parry or deflect them); **blinks** to the far side when you get close; ink rain; summons Throwers and Shields |
| 30 | **The Juggernaut** | Armored. Long charges across the arena: dodge one and he **crashes into the wall**, stunned and open for a full combo. Also a stomp with ground shockwaves and a wide swat; summons Brutes |
| 40 | **Shadow, your ink double** | Your size and speed: fast combos and lunges, sometimes **slips** your hits (attack while it's staggered or busy attacking), ink strikes from phase 2 |

All bosses have three phases (faster in phase 3) and a poise-break stagger window.

## Easter eggs

There are secret cheat codes. On a keyboard just type one; on a phone, tap the JUMPSHOT logo on the title screen five times. Codes toggle, and runs with a cheat on never set records. Hints: the overpowered weapon from the dev notes, the thing with a mushroom cloud, and a word for "can't die". The classic ↑↑↓↓←→←→BA works too.

## Look and animation (Hand-Drawn ink page)

The default look follows a hand-drawn stick-fight reference (see REFERENCE_NOTES.md).
- The world is a white page with a thick black floor line at about 79% of the screen height. Every figure and prop has a stippled gray reflection below it.
- The hero has a hollow head and thin black limbs. Enemies have solid heads and chunkier limbs in team colors: Grunt blue, Rusher black, Brute/Elite/Boss red.
- The camera is a locked wide shot that only drifts gently.

Animation is **stepped drawings with holds**, not interpolation.
- Each animation is a list of drawings. Each drawing stays on screen for its hold length, about 10–12 fps.
- The drawn pose *and* the drawn position jump from drawing to drawing, while hitboxes, physics and frame data still run at 60 Hz underneath.
- The drawing that shows a hit appears on the exact tick the hit resolves and holds through hit-stop.
- Fast swings get scribble-hatch smears. Dashes and launches leave 2–3 echo copies.
- Impacts scatter specks and splatter in the victim's color, and crack the floor; the cracks stay until the next wave.
- Finishers, shockwaves and meteors burst into red scribble energy.

**Settings → Look & animation**

| Setting | Options |
|---|---|
| Animation style | **Hand-Drawn** (stepped drawings, default) / Smooth (the previous interpolated pose-to-pose system) |
| Hand-Drawn step rate | 8–20 fps (default 12). It paces looping drawings (idle, run, tumbles) and the stepped root travel. Attack and reaction drawings always change on their authored frames |
| Fists animation | **Reference v2** (deeper crouches, held contact drawings, crescent smears on heavies, lightning/whirlwind/crescent impact FX on the finishers) / Legacy (the pass 5-7 drawings) |
| Attack smoothness | **Low** / Normal / High: how many generated in-between drawings attacks get and how long their smear chains are (Hand-Drawn only; Smooth ignores it) |
| Paper page | **Auto** (changes with waves) or a fixed Blank / Lined / Graph / Sketchbook / Kraft page |
| Line boil | Background doodles re-drawn at ~7 fps, like a hand-drawn cartoon (on by default) |
| High contrast | Plain page, no doodles, bolder HUD lines |
| Look | **Pixel** (low-res 1-bit ink page, default) / Crisp (the same ink page at full resolution) / Smooth (the previous neon look and follow camera) |
| Pixel Look resolution | 30–55% of the 1280×720 logical view (default 40%) |

### Smoother attacks (pass 6)

Attacks stay stepped, but each swing now has proper animation in-betweens:
- Generated in-between drawings follow the limb's arc (not a straight line), cluster near the key poses on the anticipation, accelerate into the strike, and overshoot on the follow-through. The contact drawing still lands on the exact tick the hit resolves.
- Every swing leaves a **smear chain**: the fastest drawing carries the densest hatch, then the contact and follow-through drawings carry thinning trails along the same arc. Fast drawings also get limb-stretch wedges and a thin swoosh line. Spins get spin arcs; dashes get speed bars.
- The Flurry finisher is back: two coils into nine alternating punches with "hundred fists" ghost arms, then the big finishing blow.

### Paper world (pass 6)

- The fight takes place on a sheet of paper: fiber texture, a soft edge vignette and low-contrast pencil doodles that boil at ~7 fps and stay clear of the fight area. Pages rotate every 3 waves (Blank, Lined notebook, Graph paper, Sketchbook); every 10th wave is Kraft paper.
- Wave start flips the page, and game over crumples the page.
- The pass-6 hand-drawn HUD and menus were replaced by the Arcade Fighter UI (see **UI: Arcade Fighter**). Patrick Hand and Permanent Marker are still bundled for the doodles on the paper. Paper sounds (page rustles, page flip, pen scratch, crumple) still play.

In Rhythm Mode, Hand-Drawn steps fall on the musical subdivision nearest the step rate, so drawings change on the grid the hits already land on.

## Rhythm Mode

**The idea.** The song is the clock of the whole fight.
- You can swipe at any time. The game re-times the attack so its contact frame lands on the nearest 16th note.
- Each swipe is also judged against the nearest beat: **PERFECT** (±45 ms), **GREAT** (±90), **GOOD** (±140, or within ±60 of the off-beat 8th), or **MISS**.
- A MISS still attacks normally. It just earns no bonus.
- On-beat attacks deal up to ×1.6 damage and pay style, super meter and bonus score. Your **streak** multiplies the bonus score: ×1.5 at 8, ×2 at 16, ×3 at 32.

**The enemies dance too.** An enemy that is ready to attack squares up and waits for a beat. Its wind-up lasts a whole number of beats, so the strike lands on a beat. Red pips above its head count the beats down, and a soft tick sounds on each one. A tap on the strike's beat parries it, and an on-beat parry earns a bonus.

**The music drives the fight.**
- Each built-in song has sections: intro, verse, build, drop and breakdown, plus a 3/4 bridge in Dojo Pulse and a 140→150 BPM tempo change in Volcano Breaker.
- A section's intensity sets the band's layers, the number of enemies allowed to attack at once, their cooldowns, and the groove pulse.
- The camera breathes on every beat and the drop lands with a shake.
- Hit sounds climb the song's scale over the current chord, so a long combo plays a melody. Each targeted strike also plucks a chord tone, scheduled on the audio clock at the exact grid point it will land on.
- Idle fighters bob on the beat.

**Songs.**

| Pick | What it does |
|---|---|
| Dojo Pulse · Neon Rush · Volcano Breaker | Built-in sectioned songs, 100 / 124 / 140→150 BPM |
| Your song | An MP3, M4A, WAV, OGG or FLAC from your device. The game detects tempo and beats in the browser. The song's loud and quiet parts act as sections (CALM / GROOVE / PEAK) |
| Listen mode (experimental) | Play music from any app out loud. The game hears it through the microphone and locks onto the beat in about 6 s. Judging and enemy sync switch on once it has locked |

Streaming apps (Spotify, Apple Music…) don't share their audio with other apps, so a song has to be a file on your device, or you use Listen mode.

**Latency calibration.** Use Settings → *Calibrate rhythm latency*, or *Calibrate* on the song picker. Flick or tap on 12 metronome clicks, using the real pad. The median offset is saved and subtracted from every input. You can fine-tune it with the slider in Settings.

**Under the hood.**
- All rhythm timing comes from the WebAudio clock. A `BeatClock` built on a tempo map of constant-tempo segments answers beat, subdivision, phase, bar and section queries on the AudioContext timeline.
- A lookahead scheduler (a 25 ms timer, 120 ms horizon) places every note at exact audio times.
- Pointer timestamps are mapped onto the heard timeline with `getOutputTimestamp()`.
- Everything lives in `src/rhythm/`, behind the mode flag. In Classic Mode the simulation's `world.rhythm` hook is `null` and every call site is guarded. A deterministic fingerprint test confirms Classic is unchanged frame for frame.

## Animation Lab

Open the lab with **`#lab`** at the end of the URL, or press **F2** in game. In the lab you can:

- Pick any animation and play, loop or scrub it. **Space** plays and pauses; **← / →** step one frame.
- Set the playback speed from 0.1× to 2×.
- Turn on onion skin. Every key pose is ghosted: earlier keys in blue, later keys in orange, the contact key in red.
- Turn on limb arcs, which plot the hand and foot paths over the whole animation.
- Turn on hold-on-contact, which freezes for the move's hit-stop.
- Turn on **vs dummy**, which plays a reacting enemy at the gameplay stand-off distance so you can check contact timing.

Click a key marker on the timeline to edit that key. Every joint has a slider, and each key has an easing selector. Edits apply live. **Export** copies the animation to the clipboard and logs it to the console, in the exact format of `src/data/anims/*.ts`, ready to paste back in.

All animation data lives in `src/data/anims/`. The Hand-Drawn set is `handDrawn.ts`: drawings with holds, in the `drawn()` format. Animations without a hand-authored version get an automatic "dramatize" pass of their Smooth keys. In Hand-Drawn style the Lab shows each drawing as a block as wide as its hold, lets you edit the hold, and exports in the drawings format. See ANIMATION_DIAGNOSIS.md for why the animation system was rebuilt pose-to-pose, and `reference/README.md` for how to drop in reference GIF frames.

## Project layout

```
src/
  main.ts          bootstrap + fixed 60 Hz timestep loop with interpolated rendering
  game.ts          game state machine (title, loadout, tutorial, waves, between-wave breather, game over), camera framing
  core/            math, seeded RNG, object pools, event bus, camera, slow-mo, audio synth, layout, settings, keyboard
  sim/             fighter entity, player controller (buffer/targeting/magnetism/cancels), combat resolver,
                   enemy physics + bowling, token AI, combo/style/super tracker, waves, projectiles/hazards/pickups
  data/            tuning.ts, moves.ts, enemies.ts, waves.ts, rhythm.ts, songs.ts, inkLook.ts, smears.ts, paper.ts: every tunable lives here
  data/weapons/    one file per weapon (moveset, frame data, drawings, smears, held object, icon), types, shared tuning, enemy reactions
  data/anims/      authored key-pose animations (locomotion, player ground/air, reactions, enemies)
  render/          rig (FK + 2-bone IK, per-kind proportions), animPlayer (key evaluation, easing, staggered leads),
                   animator (pose-to-pose playback, interruption crossfades, smears), poser (gameplay -> animation time),
                   stickman renderer, particles/afterimages/floating text, backgrounds, HUD, FX director,
                   drawStyle (Hand-Drawn state), ink (ink page look, palette quantizer, ink figures), inkFx (hatch smears,
                   specks/splatter, floor damage, scribble energy, ink entities), paper (pages, doodles, transitions),
                   paperHud (pen-drawn HUD), sketch (wobbly pen line/rect/circle/arrow/scribble/hatch helpers)
  rhythm/          Rhythm Mode (isolated): beatClock (tempo map + audio-clock queries), conductor (lookahead scheduler,
                   song/file/mic sources), synth (song patterns), judge, director (rules + sim hooks), hud, ui (picker,
                   calibration), analyze (song beat detection), live (mic beat tracking), simHooks (the sim-facing interface)
  ui/              pad (drag-to-move + flick recognizer + trail), menus (DOM), sketchDom (wobbly SVG borders for DOM UI),
                   tutorial, debug overlay, pop detector, Animation Lab
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
