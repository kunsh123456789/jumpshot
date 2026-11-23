// Shared, REAL game information for every UI option mockup (nothing invented).
// Values are a mid-run snapshot: wave 6, Fists, a 22-hit combo at S rank, the Special READY.
window.GAME = {
  hp: 92, maxHp: 100, combo: 22, dmgScale: 41, rank: 'S', ranks: ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'], rankFill: 0.62,
  score: 48210, wave: 6, best: 184250, bestWave: 12, kos: 37,
  weapon: 'Fists', heatWeapon: 'Laser Blast', heat: 0.64,
  special: { state: 'ready', charge: 1 },
  groove: 0.72, rhythmJudge: 'PERFECT', beatsAhead: [0.18, 0.43, 0.68, 0.93], song: 'Neon Nights',
  damage: [{ v: 12, x: 0.43, y: 0.47 }, { v: 8, x: 0.38, y: 0.41 }, { v: 24, crit: true, x: 0.46, y: 0.36 }],
  trace: { name: 'MEGA JUMPSHOT', progress: 0.58, fuse: 0.55, keys: '→ ↑ → ↓' },
  qte: { glyph: '↑', index: 2, count: 4, ring: 0.45, last: 'PERFECT' },
  tiers: ['SLOPPY', 'CLEAN', 'PERFECT'],
  weapons: [{"id": "fists", "name": "Fists", "desc": "Balanced and fast: strings, a launcher, air kicks and spikes.", "moves": {"side": ["Jab", "Spinning Backfist"], "up": ["Jumpshot", "Jumpshot+"], "down": ["Quake Stomp", "Earthbreaker"], "upDiag": ["Rising Hook", "Flying Knee"], "downDiag": ["Leg Sweep", "Slide Kick"]}}, {"id": "hook", "name": "Grappling Hook", "desc": "Mobility and control: yank enemies in, zip to them, swing around them.", "moves": {"side": ["Yank", "Zip Kick"], "up": ["Air Hook", "Air Hook+"], "down": ["Slam Yank", "Crater Yank"], "upDiag": ["Swing", "Pendulum"], "downDiag": ["Swing", "Pendulum"]}}, {"id": "throw", "name": "Throw", "desc": "Grab gloves: grab anyone and throw them where you swipe. Bowl them into the crowd.", "moves": {"side": ["Quick Toss", "Overhead Heave"], "up": ["Toss Up", "Long Arm"], "down": ["Pile-Driver", "Meteor Driver"], "upDiag": ["Bowling Lob", "Bowling Lob+"], "downDiag": ["Bowling Throw", "Strike!"]}}, {"id": "staff", "name": "Staff", "desc": "Reach and crowd control: wide sweeps, a pole-vault launcher, a dart-blocking spin, a boomerang throw.", "moves": {"side": ["Twirl", "Spinning Sweep"], "up": ["Pole Vault", "Pole Vault+"], "down": ["Plant Slam", "Earth Splitter"], "upDiag": ["Helicopter", "Staff Boomerang"], "downDiag": ["Helicopter", "Helicopter+"]}}, {"id": "laser", "name": "Laser Blast", "desc": "Safe ranged damage: aimed bolts, a charged piercing beam. Watch the heat.", "moves": {"side": ["Bolt", "Charged Beam"], "up": ["Sky Blast", "Sky Barrage"], "down": ["Ground Blast", "Nova"], "upDiag": ["Rising Bolt", "Rising Beam"], "downDiag": ["Leg Shot", "Floor Raker"]}}, {"id": "whip", "name": "Chain Whip", "desc": "Long-reach lashes through the whole line; \u2191 wraps and hoists them up.", "moves": {"side": ["Lash", "Crack"], "up": ["Wrap & Hoist", "Wrap & Hoist+"], "down": ["Snap", "Snap"], "upDiag": ["Whirl", "Whirl"], "downDiag": ["Ankle Lash", "Floor Crack"]}}, {"id": "hammer", "name": "Giant Hammer", "desc": "Slow, huge hits that crack armor; \u2191 heavy ground-pound launches everyone nearby.", "moves": {"side": ["Hammer Swing", "Home Run Smash"], "up": ["Skyward Swing", "Ground Pound"], "down": ["Quake", "Ground Pound"], "upDiag": ["Hammer Spin", "Hammer Spin"], "downDiag": ["Ankle Breaker", "Ankle Breaker"]}}, {"id": "daggers", "name": "Twin Daggers", "desc": "The fastest weapon: bleeding cuts, blink-slashes behind them, a teleport dodge.", "moves": {"side": ["Cut", "Blink Slash"], "up": ["Rising Fangs", "Rising Fangs"], "down": ["Blade Storm", "Blade Storm"], "upDiag": ["Knife Fan", "Knife Fan"], "downDiag": ["Hamstring", "Blink Slash"]}}, {"id": "shield", "name": "Boomerang Shield", "desc": "Defense: tap blocks with a long parry window; throw it to ricochet between enemies.", "moves": {"side": ["Shield Bash", "Ricochet"], "up": ["Shield Lift", "Shield Lift"], "down": ["Shield Slam", "Shield Slam"], "upDiag": ["High Ricochet", "Ricochet"], "downDiag": ["Shield Surf", "Shield Surf"]}}, {"id": "brush", "name": "Ink Brush", "desc": "Magic: ink blobs, a painted line of spikes, an ink geyser, a snaring circle.", "moves": {"side": ["Ink Flick", "Spike Line"], "up": ["Ink Geyser", "Geyser Field"], "down": ["Ink Splat", "Ink Circle"], "upDiag": ["Splash", "Splash"], "downDiag": ["Brush Stroke", "Ink Circle"]}}, {"id": "yoyo", "name": "Yo-Yo", "desc": "It always comes back: throws, walk-the-dog, around-the-world, the sleeper juggle.", "moves": {"side": ["Throw Down", "Walk the Dog"], "up": ["Sleeper", "Sleeper"], "down": ["Gravity Pull", "Gravity Pull"], "upDiag": ["Around the World", "Around the World"], "downDiag": ["Creeper", "Walk the Dog"]}}, {"id": "bubble", "name": "Bubble Gun", "desc": "Silly: bubbles float enemies up helpless; pop them for bonus damage or bowl them.", "moves": {"side": ["Bubble", "Bubble Burst"], "up": ["Bubble Lift", "Bubble Lift"], "down": ["Swat", "Pop Party"], "upDiag": ["Bubble Arc", "Bubble Burst"], "downDiag": ["Bubble Roll", "Pop Party"]}}, {"id": "rocket", "name": "Rocket Gloves", "desc": "Fists you can fire: rocket jabs, a barrage, and an uppercut that carries you up.", "moves": {"side": ["Rocket Jab", "Rocket Barrage"], "up": ["Rocket Uppercut", "Rocket Uppercut+"], "down": ["Rocket Slam", "Rocket Slam"], "upDiag": ["Sky Rocket", "Sky Rocket"], "downDiag": ["Jet Dash", "Jet Dash"]}}, {"id": "ice", "name": "Ice Spear", "desc": "Freeze, then shatter: frozen enemies take big damage from the next hit.", "moves": {"side": ["Frost Jab", "Ice Lance"], "up": ["Ice Pillar", "Ice Pillar"], "down": ["Downstab", "Frost Field"], "upDiag": ["Shard Fan", "Ice Lance"], "downDiag": ["Glacier Sweep", "Frost Field"]}}, {"id": "planes", "name": "Paper Plane Swarm", "desc": "Homing paper planes, a whole flock, a dive-bomb from above. Weak up close.", "moves": {"side": ["Paper Plane", "Flock"], "up": ["Updraft", "Updraft"], "down": ["Paper Cut", "Dive Bomb"], "upDiag": ["Loop-the-Loop", "Flock"], "downDiag": ["Floor Skimmer", "Dive Bomb"]}}, {"id": "thunder", "name": "Lightning Fist", "desc": "Every punch chains lightning to nearby enemies; the slam calls down bolts.", "moves": {"side": ["Spark Jab", "Thunderbolt"], "up": ["Thunder Uppercut", "Thunder Uppercut"], "down": ["Shock Stomp", "Storm Call"], "upDiag": ["Static Hook", "Thunderbolt"], "downDiag": ["Ground Current", "Storm Call"]}}, {"id": "scythe", "name": "Scythe", "desc": "Huge crescent reaps, a reaping pull, a spinning scythe throw (the reference polearm).", "moves": {"side": ["Reap", "Death Spiral"], "up": ["Rising Moon", "Rising Moon"], "down": ["Harvest", "Harvest"], "upDiag": ["Scythe Throw", "Scythe Throw"], "downDiag": ["Reaping Pull", "Death Spiral"]}}],
  results: { score: 48210, best: 184250, newBest: false, wave: 6, bestCombo: 48, bestDamage: 412, maxRank: 'S', kos: 37, parries: 4, finishers: 3, specials: 2,
    rhythm: { label: 'GREAT', accuracy: 87, counts: { PERFECT: 112, GREAT: 54, GOOD: 20, MISS: 9 }, bestStreak: 41 } },
  settings: [
    { k: 'Mobile performance', t: 'check', v: true },
    { k: 'Master volume', t: 'range', v: 0.8 },
    { k: 'Music volume', t: 'range', v: 0.45 },
    { k: 'Look', t: 'select', v: 'Pixel (ink page)' },
    { k: 'Tap / Space', t: 'select', v: 'Jump' },
    { k: 'Special assist', t: 'check', v: false },
    { k: 'Skip QTE prompts', t: 'check', v: false },
    { k: 'Screen shake', t: 'range', v: 1.0 },
  ],
};
const q = new URLSearchParams(location.search);
window.SCREEN = q.get('screen') || 'gameplay';
window.DEVICE = q.get('device') || 'desktop';
window.DEV = { desktop: { w: 1280, h: 720 }, phone: { w: 844, h: 390 } }[window.DEVICE];
window.bgFor = (s) => '../shots/' + ({ gameplay: 'gameplay', special: 'special', trace: 'special', qte: 'special', title: 'title', loadout: 'title', pause: 'gameplay', results: 'gameplay', states: 'gameplay' }[s] || 'gameplay') + '-' + window.DEVICE + '.png';

/** Simple 24x24 line icons (each option styles stroke / fill its own way). */
window.ICON = {
  fists: 'M6 10V7a2 2 0 0 1 4 0v3M10 9V6a2 2 0 0 1 4 0v3M14 9V7a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6H10a4 4 0 0 1-4-4v-5a2 2 0 0 1 4 0',
  hook: 'M12 3v10a4 4 0 1 1-4-4M12 3l3 3',
  throw: 'M5 12a7 7 0 1 0 14 0M8 8l4-4 4 4M12 4v9',
  staff: 'M4 20L20 4M7 20l-3-3M20 7l-3-3',
  laser: 'M3 10h11v4H3zM14 11h3M17 9l4 3-4 3M5 14v4',
  whip: 'M4 20c4-4 2-10 8-12s8 2 8 2',
  hammer: 'M10 4h8v6h-8zM14 10v10',
  daggers: 'M6 3l3 9-3 3-3-3zM18 3l3 9-3 3-3-3zM6 15v5M18 15v5',
  shield: 'M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z',
  brush: 'M14 4l6 6-8 8-4-4zM8 14l-4 6 6-4',
  yoyo: 'M12 3v7M12 14a4 4 0 1 0 0 .01',
  bubble: 'M8 14a4 4 0 1 0 0 .01M16 8a3 3 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01',
  rocket: 'M12 3c3 3 4 7 4 11h-8c0-4 1-8 4-11zM9 18l-2 3M15 18l2 3M12 18v3',
  ice: 'M12 2v20M5 6l14 12M19 6L5 18',
  planes: 'M3 12l18-8-6 16-3-7z',
  thunder: 'M13 2L5 14h6l-1 8 8-12h-6z',
  scythe: 'M5 21L16 6M16 6c-3-3-9-3-12 1 4-1 8 0 12 3',
  pause: 'M8 5v14M16 5v14', gear: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z', bolt: 'M13 2L5 14h6l-1 8 8-12h-6z', star: 'M12 3l2.6 5.6 6 .7-4.5 4 1.3 6-5.4-3-5.4 3 1.3-6-4.5-4 6-.7z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
};
window.icon = (id, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24"><path d="${window.ICON[id] || window.ICON.star}"/></svg>`;

/** The Fists trace path (rising line curling into a loop) in the pad area, as an SVG path for a W x H screen. */
window.tracePath = (W, H) => {
  const padY = H * 0.5, bx = W * 0.14, bw = W * 0.72, by = padY + H * 0.06, bh = H * 0.38;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([bx + (0.12 + t * 0.36) * bw, by + bh * (0.95 - t * 0.75)]); }
  const lx = bx + 0.62 * bw, ly = by + bh * 0.36, r = Math.min(bw, bh) * 0.3;
  for (let i = 1; i <= 30; i++) { const a = Math.PI + (i / 30) * Math.PI * 1.75; pts.push([lx + Math.cos(a) * r * 1.1, ly + Math.sin(a) * r]); }
  const [ex, ey] = pts[pts.length - 1];
  for (let i = 1; i <= 8; i++) pts.push([ex + i * 6, ey + i * (by + bh - ey) / 8]);
  return pts;
};
window.pathD = (pts, upto = 1) => { const n = Math.max(2, Math.round(pts.length * upto)); return pts.slice(0, n).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); };
