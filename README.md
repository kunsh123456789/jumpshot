# JUMPSHOT

A 2D stickman combo-fighting game for the browser. You don't steer the fighter: you **swipe on a draw pad** and the fighter dashes, targets and strikes on its own. Launch enemies skyward with the **Jumpshot** uppercut, leap after them, juggle them in the air, then spike them into the floor.

Everything is procedural: a skeletal stickman rig with keyframed poses and 2-bone IK, canvas effects, and WebAudio-synthesized sound and music. The game uses no image or audio files.

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

| Input | Action |
|---|---|
| **Swipe →/←** | Jab, jab, cross string. A long fast swipe does a **Spinning Backfist** (heavy). |
| **Swipe ↗/↖** | Rising hook (pops the enemy up). Heavy: **Flying Knee** that carries you through enemies. |
| **Swipe ↑** | **JUMPSHOT launcher**: the enemy flies up and you leap after it. Heavy: a higher launch. |
| **Swipe ↘/↙** | Leg sweep (trips and knocks down). Heavy: **Slide Kick** through a crowd. Both break shields. |
| **Swipe ↓** | On the ground: Quake Stomp (hits everything around you). In the air: **SPIKE**. |
| **Tap** | Dodge (short invincible dash). Tap just before a red-flashing attack lands for a **PERFECT PARRY**: slow-mo, the enemy is stunned, and your next hit is a crit. Parrying darts reflects them. |
| **In the air** | → air-kick chain · ↗ sky slash · ↑ rising strike · ↓ spike. Swiping toward another airborne enemy air-dashes to it. |

- Swipes register the moment the stroke passes a short distance, so you don't need to lift your finger. When you **zig-zag without lifting**, each sharp turn fires the next attack.
- When you swipe during an attack, the swipe is buffered and fires as soon as the attack can be cancelled.
- **Super Meter** finishers each cost half the meter:
  - **JUMPSHOT FINISHER**: after a launcher and 5+ air hits, swipe ↓ in the air.
  - **FLURRY**: in a 15+ hit combo, do a long heavy swipe in any direction.
- The style rank (D → SSS) rises with long, varied, aerial combos, parries and finishers. It multiplies your score and fills the Super Meter.
- Between waves you pick 1 of 3 upgrades. An elite arrives every 5th wave and a boss every 10th.

**Keyboard (for testing):** WASD or the arrow keys swipe, and you can press two at once for a diagonal. Hold **Shift** for heavy and press **Space** to tap. **Esc/P** pauses. The **`** key toggles the debug overlay, which shows the last swipe direction, length, speed, the input buffer and the move-start latency.

**Dev shortcut:** add `?wave=N` to the URL to start a run at wave N, for example `?wave=10` for the boss.

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
  ui/              draw pad (gesture recognizer + trail), menus (DOM), tutorial, debug overlay
```

See **TUNING.md** for every tunable value and **DECISIONS.md** for the judgment calls.
