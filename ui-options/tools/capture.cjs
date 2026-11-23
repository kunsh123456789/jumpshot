// Captures the REAL game behind the UI mockups: clean backgrounds (no HUD, pad, menus or special overlay)
// and the current UI for the audit, at desktop (1280x720) and phone landscape (844x390).
// usage: (dev server on :5173) node ui-options/tools/capture.cjs
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, '..');
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
const DEVICES = { desktop: { width: 1280, height: 720, mobile: false }, phone: { width: 844, height: 390, mobile: true } };

async function open(b, dev, query, settings = {}) {
  const d = DEVICES[dev];
  const ctx = await b.newContext({ viewport: { width: d.width, height: d.height }, hasTouch: d.mobile, isMobile: d.mobile });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    localStorage.setItem('jumpshot.save.v1', JSON.stringify({ tutorialDone: true, padHintSeen: true, specialHintSeen: true, highScore: 184250, bestWave: 12, weaponTips: ['fists', 'staff', 'laser', 'hook', 'throw'] }));
    localStorage.setItem('jumpshot.settings.v1', JSON.stringify({ rhythmMode: false, ...s }));
  }, settings);
  await page.goto(BASE + query);
  return { ctx, page };
}
const clean = (page) => page.evaluate(() => {
  const g = window.__jumpshot;
  g.hud.visible = false; g.pad.draw = () => {}; g.specialInput.draw = () => {}; g.debug.visible = false;
  document.getElementById('ui').style.visibility = 'hidden';
});
const adv = (page, n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__advance(1000 / 60); }, n);

const META = {};
const meta = async (page, key) => { META[key] = await page.evaluate(() => { const g = window.__jumpshot, w = g.world, si = g.specialInput; const P = (f) => { const [x, y] = si.toScreen(f.x, f.cy); return { x: Math.round(x), y: Math.round(y) }; }; return { hero: { ...P(w.player), head: Math.round(si.toScreen(w.player.x, w.player.y - 130)[1]), feet: Math.round(si.toScreen(w.player.x, w.player.y)[1]) }, enemies: w.enemies.filter((e) => e.alive).map(P) }; }); };
(async () => {
  const b = await chromium.launch();
  for (const dev of Object.keys(DEVICES)) {
    // ---- gameplay: a crowd, a live combo, the Special READY ----
    {
      const { ctx, page } = await open(b, dev, '?manual&classic&wave=6&weapon=fists');
      await page.waitForTimeout(400);
      await adv(page, 200);
      await page.evaluate(() => {
        const g = window.__jumpshot, w = g.world, p = w.player;
        for (let i = 0; i < 6; i++) w.spawnEnemy(['grunt', 'rusher', 'brute', 'kicker', 'shield', 'thrower'][i]);
        w.enemies.forEach((e, i) => { e.x = e.px = p.x + (i % 2 ? 1 : -1) * (110 + i * 55); e.ai.cooldown = 400; });
        w.special.charge = 100; w.special.add(w, 0.01);
      });
      for (let k = 0; k < 26; k++) { await page.evaluate((k) => { const g = window.__jumpshot; g.pad.inject('swipe', [0, 0, 0, 2, 0, 0, 1, 0][k % 8], false); }, k); await adv(page, 9); }
      await adv(page, 2);
      await page.screenshot({ path: `${OUT}/current/gameplay-${dev}.png` });
      await meta(page, `gameplay-${dev}`);
      await clean(page); await adv(page, 1);
      await page.screenshot({ path: `${OUT}/shots/gameplay-${dev}.png` });
      // ---- special: trace phase (world frozen in the bubble) ----
      await page.evaluate(() => { const g = window.__jumpshot; document.getElementById('ui').style.visibility = ''; g.hud.visible = true; delete g.specialInput.draw; g.world.special.charge = 100; g.pad.inject('hold', -1, false); });
      await adv(page, 40);
      await page.evaluate(() => { delete window.__jumpshot.pad.draw; });
      await page.screenshot({ path: `${OUT}/current/special-${dev}.png` });
      await meta(page, `special-${dev}`);
      await clean(page); await adv(page, 1);
      await page.screenshot({ path: `${OUT}/shots/special-${dev}.png` });
      await ctx.close();
    }
    // ---- title (live scene) ----
    {
      const { ctx, page } = await open(b, dev, '');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/current/title-${dev}.png` });
      await page.evaluate(() => window.__jumpshot.openLoadout());
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/current/loadout-${dev}.png` });
      await page.evaluate(() => { for (const l of document.querySelectorAll('#ui .layer')) l.remove(); window.__jumpshot.openSettings(true); });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/current/settings-${dev}.png` });
      await page.evaluate(() => { document.getElementById('ui').style.visibility = 'hidden'; window.__jumpshot.pad.draw = () => {}; window.__jumpshot.pad.demo = false; });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/shots/title-${dev}.png` });
      await meta(page, `title-${dev}`);
      await ctx.close();
    }
    // ---- pause + results over gameplay ----
    {
      const { ctx, page } = await open(b, dev, '?classic&wave=3&weapon=staff');
      await page.waitForTimeout(3500);
      await page.evaluate(() => window.__jumpshot.togglePause());
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/current/pause-${dev}.png` });
      await page.evaluate(() => { const g = window.__jumpshot; g.togglePause(); g.world.player.hp = 1; g.world.combo.bestHits = 48; });
      await page.evaluate(() => { const g = window.__jumpshot; const p = g.world.player; p.hp = 0; p.alive = false; p.setState('ko'); g.world.gameOver = true; });
      await page.waitForTimeout(3200);
      await page.screenshot({ path: `${OUT}/current/results-${dev}.png` });
      await ctx.close();
    }
  }
  require('fs').writeFileSync(`${OUT}/shots/meta.js`, '// Hero / enemy screen positions in each capture (written by tools/capture.cjs).\nwindow.META = ' + JSON.stringify(META) + ';\n');
  await b.close();
  console.log('captured');
})();
