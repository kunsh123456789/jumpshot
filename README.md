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

See **SMOOTHNESS.md** for how the animation pipeline works and how to tune its feel.

## Project layout

```
src/
  main.ts          bootstrap + fixed 60 Hz timestep loop with interpolated rendering
  game.ts          game state machine (title, tutorial, waves, upgrades, game over), camera framing
  core/            math, seeded RNG, object pools, event bus, camera, slow-mo, audio synth, layout, settings, keyboard
  sim/             fighter entity, player controller (buffer/targeting/magnetism/cancels), combat resolver,
                   enemy physics + bowling, token AI, combo/style/super tracker, waves, projectiles/hazards/pickups
  data/            tuning.ts, moves.ts, enemies.ts, waves.ts, upgrades.ts: every tunable lives here
  render/          rig (FK + 2-bone IK), animator (blending, spring head, verlet scarf, trails), poser,
                   stickman renderer, particles/afterimages/floating text, backgrounds, HUD, FX director
  ui/              pad (drag-to-move + flick recognizer + trail), menus (DOM), tutorial, debug overlay, pop detector
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
