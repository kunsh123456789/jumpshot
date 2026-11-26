# Whip (Tamer): New moveset

The whip is the long-reach, control weapon. Its signature is the **sweet spot**: a lash that connects with the **last third of its length (the tip)** cracks for **double damage**. The new moves below add counters, a barrage, and ways to reel enemies in. (Settings → Weapons → Movesets switches between New and Original; the Original whip is unchanged.)

Directions are the swipe: → forward, ↗ up-forward, ↑ up, ↘ down-forward, ↓ down. "Heavy" is a long fast flick (Shift on a keyboard). "Air" means you are off the ground.

## Ground

| Input | Move | What it does |
|---|---|---|
| → | **Lash string** | Two alternating lashes with reach 340. Tip hits crack for ×2. Repeat the flick to chain. |
| → heavy | **Sonic Crack** | A 460-reach crack that pierces the whole line and **stuns** everything it hits (not bosses). Tip crack ×2. |
| ↗ | **Whirl** | A spinning overhead twirl around you; hits everyone close. |
| ↗ heavy | **Disarm Crack** *(new)* | A long crack that **interrupts every enemy that is winding up or mid-attack** in front of you (they are stunned for about 1.2 s) and **swats enemy projectiles** out of the air. It does this on the contact frame even if the lash itself hits nothing. Bosses can't be interrupted. |
| ↑ | **Wrap & Hoist** | Wraps an enemy and yanks it up into the air for a juggle. |
| ↑ heavy | **Lasso Spin** | Lassos an enemy, then swings it around you as a weapon; it bowls over everyone it touches. |
| ↘ | **Ankle Lash** | A low lash that trips (knockdown). |
| ↘ heavy | **Floor Crack** | A long low crack that breaks guards and knocks down the line. |
| ↓ | **Snap** | A floor snap around you that pops everyone close into the air. |
| ↓ heavy | **Tamer's Ring** | A wide whirling ring around you (three hits, knockdown). |
| Dodge | **Backflip** | Arc away from the nearest threat. |

## Air

| Input | Move | What it does |
|---|---|---|
| air → | **Tarzan Swing** | A swinging kick around the target; light. |
| air → heavy | **Air Lash** | A quick air lash that lifts you a little. |
| air ↗ | **Air Wrap** | Wraps and launches an enemy upward, you rise with it. |
| air ↗ heavy | **Lash Flurry** *(new)* | Hover and fire **six rapid cracks** along the swipe direction (it re-aims at the live target). Each crack is small, but tip hits double: about 24 damage on a juggled enemy. |
| air ↑ | **Air Wrap** | As above. |
| air ↑ heavy | **Whip Yank** *(new)* | Lashes out, **reels the enemy to you**, then punches it (reel-in punch). |
| air ↘ / ↓ | **Down Lash** | A diving lash that spikes enemies into the floor. |
| air ↘ / ↓ heavy | **Rodeo Slam** *(new)* | Wraps an enemy and **slams it into the floor** (ground bounce). |

## Why these four

The old set repeated itself: the up-forward heavy was the same whirl as the light one, and the air up-forward, air up and both air down slots all pointed at one move each. Each new move fills one of those repeated slots with its own job:

- **Disarm Crack** answers enemy attacks (a counter, not just damage).
- **Lash Flurry** rewards tip positioning with many small chances to crack.
- **Whip Yank** pulls enemies out of the air into your range.
- **Rodeo Slam** finishes juggles with a ground bounce.

Numbers are in `src/data/weapons/movesets2.ts`; the disarm mechanic is `Moveset2.disarm` in `src/sim/moveset2.ts`.
