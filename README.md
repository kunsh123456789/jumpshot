# JUMPSHOT

A 2D stickman combo-fighting game for the browser. You **flick on the bottom half of the screen**, and the fighter dashes onto a target and strikes on its own. Launch enemies skyward with the **Jumpshot** uppercut, leap after them, juggle them in the air, then spike them into the floor.

You can position yourself by dragging slowly in the bottom half of the screen. Everything is procedural: a skeletal stickman rig with keyframed poses and 2-bone IK, canvas effects, and WebAudio-synthesized sound and music. The game uses no image or audio files.

There are two modes, switched on the title screen or in Settings:
- **Rhythm Mode** (default): the music is the clock. You swipe whenever you like, and every attack **snaps onto the beat grid**, so each hit is part of the song. Swiping *on* the beat makes hits land harder and builds a streak. Enemies attack on the beat too. See [Rhythm Mode](#rhythm-mode).
- **Classic Mode**: the original game, unchanged.

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
| **Tap** | Dodge. Tap just before a red-flashing attack lands for a **PERFECT PARRY** |

| Flick | On the ground | In the air |
|---|---|---|
| **→ / ←** | Jab, jab, cross string. Heavy: **Spinning Backfist** | Air-kick chain. Heavy: **Air Cannon** |
| **↗ / ↖** | Rising hook. Heavy: **Flying Knee** | Sky slash |
| **↑** | **JUMPSHOT launcher**: the enemy flies up and you leap after it | Rising strike |
| **↘ / ↙** | Leg sweep. Heavy: **Slide Kick** (both break shields) | Spike |
| **↓** | Quake Stomp | **SPIKE** |

- Your attacks dash you onto the nearest enemy in the flick's direction, so positioning matters: walk into a group, keep away from a Brute, chase a Thrower, or line enemies up to bowl them into each other.
- When you flick during an attack, the attack is buffered and fires as soon as the current one can be cancelled.
- **Super Meter** finishers each cost half the meter:
  - **JUMPSHOT FINISHER**: after a launcher and 5+ air hits, flick ↓ in the air.
  - **FLURRY**: in a 15+ hit combo, do a long heavy flick in any direction.
- The style rank (D → SSS) multiplies your score and fills the Super Meter. Between waves you pick 1 of 3 upgrades. An elite arrives every 5th wave and a boss every 10th.
- **Settings** include volume, screen shake, hit-stop strength, **Flick sensitivity**, the **Touch area** height (35–60% of the screen), left-handed mode, reduced flashes and the debug overlay.

**Keyboard**

| Key | Action |
|---|---|
| **A / D** or **← / →** | Move (hold) |
| **I / J / K / L** | Attack up / left / down / right. Press two at once for a diagonal, for example I+L = ↗ |
| **Shift** + attack | Heavy |
| **Space** | Tap (dodge/parry) |
| **Esc / P** | Pause |
| **`** | Debug panel: FPS, sim tick rate, interpolation alpha, frame-time graph, pop detector, input state, buffer |
| **[** | 0.1× slow motion (toggle) |
| **]** | Freeze and step one frame per press |
| **\** | Resume normal speed |

**Dev URL flags**
- `?wave=N` starts a run at wave N.
- `?song=dojo|neon|volcano` forces Rhythm Mode with that song (no picker); `?classic` forces Classic Mode.
- Look and animation style come from Settings (stored in `localStorage` as `jumpshot.settings.v1`: `look`, `animStyle`, `stepRate`, `pixelRes`).
- `?manual` drives the loop from `window.__advance(ms)`, for deterministic refresh-rate tests.

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
| Look | **Pixel** (low-res 1-bit ink page, default) / Crisp (the same ink page at full resolution) / Smooth (the previous neon look and follow camera) |
| Pixel Look resolution | 30–55% of the 1280×720 logical view (default 40%) |

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
  game.ts          game state machine (title, tutorial, waves, upgrades, game over), camera framing
  core/            math, seeded RNG, object pools, event bus, camera, slow-mo, audio synth, layout, settings, keyboard
  sim/             fighter entity, player controller (buffer/targeting/magnetism/cancels), combat resolver,
                   enemy physics + bowling, token AI, combo/style/super tracker, waves, projectiles/hazards/pickups
  data/            tuning.ts, moves.ts, enemies.ts, waves.ts, upgrades.ts, rhythm.ts, songs.ts, inkLook.ts: every tunable lives here
  data/anims/      authored key-pose animations (locomotion, player ground/air, reactions, enemies)
  render/          rig (FK + 2-bone IK, per-kind proportions), animPlayer (key evaluation, easing, staggered leads),
                   animator (pose-to-pose playback, interruption crossfades, smears), poser (gameplay -> animation time),
                   stickman renderer, particles/afterimages/floating text, backgrounds, HUD, FX director,
                   drawStyle (Hand-Drawn state), ink (ink page look, palette quantizer, ink figures), inkFx (hatch smears,
                   specks/splatter, floor damage, scribble energy, ink entities)
  rhythm/          Rhythm Mode (isolated): beatClock (tempo map + audio-clock queries), conductor (lookahead scheduler,
                   song/file/mic sources), synth (song patterns), judge, director (rules + sim hooks), hud, ui (picker,
                   calibration), analyze (song beat detection), live (mic beat tracking), simHooks (the sim-facing interface)
  ui/              pad (drag-to-move + flick recognizer + trail), menus (DOM), tutorial, debug overlay, pop detector, Animation Lab
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
