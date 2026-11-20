# JUMPSHOT

A 2D stickman combo-fighting game for the browser. You **flick on the bottom half of the screen**, and the fighter dashes onto a target and strikes on its own. Launch enemies skyward with the **Jumpshot** uppercut, leap after them, juggle them in the air, then spike them into the floor.

You can position yourself by dragging slowly in the bottom half of the screen. Everything is procedural: a skeletal stickman rig with keyframed poses and 2-bone IK, canvas effects, and WebAudio-synthesized sound and music. The game uses no image or audio files.

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
- `?manual` drives the loop from `window.__advance(ms)`, for deterministic refresh-rate tests.

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
  sim/             fighter entity, player controller (buffer/targeting/magnetism/cancels), combat resolver,
                   enemy physics + bowling, token AI, combo/style/super tracker, waves, projectiles/hazards/pickups
  data/            tuning.ts, moves.ts, enemies.ts, waves.ts, upgrades.ts: every tunable lives here
  data/anims/      authored key-pose animations (locomotion, player ground/air, reactions, enemies)
  render/          rig (FK + 2-bone IK, per-kind proportions), animPlayer (key evaluation, easing, staggered leads),
                   animator (pose-to-pose playback, interruption crossfades, smears), poser (gameplay -> animation time),
                   stickman renderer, particles/afterimages/floating text, backgrounds, HUD, FX director
  ui/              pad (drag-to-move + flick recognizer + trail), menus (DOM), tutorial, debug overlay, pop detector, Animation Lab
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
