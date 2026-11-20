# JUMPSHOT

A 2D stickman combo-fighting game for the browser. You **flick on the bottom half of the screen**, and the fighter dashes onto a target and strikes on its own. Launch enemies skyward with the **Jumpshot** uppercut, leap after them, juggle them in the air, then spike them into the floor.

You can position yourself by dragging slowly in the bottom half of the screen. Everything is procedural: a skeletal stickman rig with keyframed poses and 2-bone IK, canvas effects, and WebAudio-synthesized sound and music. The game uses no image or audio files.

**It's also a rhythm game.** Fight to a built-in track, to your own song (the game detects its tempo and beats), or to music playing from any app on a speaker (Listen mode, via the microphone). Swipes that land on the beat hit harder and build an on-beat streak, and enemies strike on the beat. See [Music and rhythm](#music-and-rhythm).

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
- `?music=classic|dojo|neon|volcano` picks the music and skips the picker (used by the tests).
- `?manual` drives the loop from `window.__advance(ms)`, for deterministic refresh-rate tests.

## Music and rhythm

After the title screen (or the tutorial) you choose what the fight syncs to. You can change it any time from the pause menu (**♪ MUSIC**).

| Choice | What it does |
|---|---|
| **Dojo Pulse / Neon Rush / Volcano Breaker** | Built-in synthesized tracks at 100, 124 and 148 BPM. The game is the band, so sync is exact |
| **Your song** | Pick an MP3, M4A, WAV, OGG or FLAC from your device. It is decoded and analyzed in the browser (about 1–3 s for a 4-minute song), then plays on a loop, synced |
| **Listen mode** (experimental) | Play music from *any* app (Spotify, Apple Music, YouTube…) out loud. The game listens through the microphone and locks onto the beat in about 5–8 s. The beat track says LISTENING… until it locks |
| **Classic** | The original game: background music, no beat judging, slow-motion on |

**Why not pick a song straight from Spotify or Apple Music?** Those apps don't let other apps or websites read their audio. It's DRM-protected, and Spotify's track-analysis API is closed to new apps. A song has to be a file on your device, or you play it out loud and use Listen mode.

**Rules in rhythm mode**
- Every flick and tap is judged against the nearest beat. **PERFECT** is within ±50 ms, **GREAT** within ±85 ms, **GOOD** within ±115 ms, or on the half-beat (8th note) within ±55 ms. Anything else is **OFF**.
- The move started by that input deals ×1.45, ×1.2, ×1.0 or ×0.7 damage for PERFECT, GREAT, GOOD or OFF. On-beat hits also give bonus style and super meter.
- Every non-OFF input extends your **ON BEAT streak**, and an OFF breaks it. At 8, 16 and 32 the streak multiplies score by ×1.25, ×1.5 and ×2, and style gain by up to ×1.5.
- Enemy attacks are timed so the strike lands on a beat. A tap on the beat parries it, and an on-beat parry (GREAT or better) earns an extra bonus.
- Slow-motion is turned off so the fight never drifts from the music. Hit-stop still happens.
- The beat track under the score shows beats sliding into the ring as you hear them, and the last few timing errors as ticks (early ← | → late). Idle fighters bob on the beat.

**Timing calibration.** Every device adds some delay: Bluetooth headphones, touch screens. Open **Settings → Calibrate timing** (or **Calibrate** on the music screen). Flick, tap or press Space on 12 metronome clicks. The game measures your average offset and applies it to judging. You can also nudge the offset by hand in Settings.

**How beat detection works.** For songs: an STFT spectral-flux onset envelope feeds an autocorrelation tempo estimate (with a prior around 120 BPM). A dynamic-programming beat tracker then picks the beat positions. If they fit a straight line, they're snapped to a perfect grid. Tempos outside 72–168 BPM are folded by half or double. Listen mode runs the same idea live on the last 8 s of microphone audio, four times a second, with a phase-locked loop smoothing the beat grid. Details are in DECISIONS.md.

## Animation Lab

Open the lab with **`#lab`** at the end of the URL, or press **F2** in game. In the lab you can:

- Pick any animation and play, loop or scrub it. **Space** plays and pauses; **← / →** step one frame.
- Set the playback speed from 0.1× to 2×.
- Turn on onion skin. Every key pose is ghosted: earlier keys in blue, later keys in orange, the contact key in red.
- Turn on limb arcs, which plot the hand and foot paths over the whole animation.
- Turn on hold-on-contact, which freezes for the move's hit-stop.
- Turn on **vs dummy**, which plays a reacting enemy at the gameplay stand-off distance so you can check contact timing.

Click a key marker on the timeline to edit that key. Every joint has a slider, and each key has an easing selector. Edits apply live. **Export** copies the animation to the clipboard and logs it to the console, in the exact format of `src/data/anims/*.ts`, ready to paste back in.

All animation data lives in `src/data/anims/`. See ANIMATION_DIAGNOSIS.md for why the animation system was rebuilt pose-to-pose, and `reference/README.md` for how to drop in reference GIF frames.

## Project layout

```
src/
  main.ts          bootstrap + fixed 60 Hz timestep loop with interpolated rendering
  game.ts          game state machine (title, tutorial, waves, upgrades, game over), camera framing
  core/            math, seeded RNG, object pools, event bus, camera, slow-mo, audio synth, layout, settings, keyboard
  sim/rhythm.ts    on-beat streak, grades and the beat oracle the enemy AI times strikes with
  sim/             fighter entity, player controller (buffer/targeting/magnetism/cancels), combat resolver,
                   enemy physics + bowling, token AI, combo/style/super tracker, waves, projectiles/hazards/pickups
  data/            tuning.ts, moves.ts, enemies.ts, waves.ts, upgrades.ts, rhythm.ts: every tunable lives here
  data/anims/      authored key-pose animations (locomotion, player ground/air, reactions, enemies)
  render/          rig (FK + 2-bone IK, per-kind proportions), animPlayer (key evaluation, easing, staggered leads),
                   animator (pose-to-pose playback, interruption crossfades, smears), poser (gameplay -> animation time),
                   stickman renderer, particles/afterimages/floating text, backgrounds, HUD, FX director
  music/           built-in beat-gridded tracks, offline beat detection (analyze.ts), live mic beat tracking (live.ts),
                   MusicManager: clock mapping, beat queries and judging (music.ts)
  ui/              pad (drag-to-move + flick recognizer + trail), menus (DOM, incl. music picker + calibration), tutorial,
                   debug overlay, pop detector, Animation Lab
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
