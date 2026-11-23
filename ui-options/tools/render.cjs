// Renders every UI option mockup to PNG (file:// pages over the real-game captures).
// usage: node ui-options/tools/render.cjs [option1-arcade,...] [screen,...]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OPTS = (process.argv[2] || 'option1-arcade,option2-manga,option3-minimal,option4-sketchbook').split(',');
const SCREENS = (process.argv[3] || 'gameplay,trace,qte,title,loadout,pause,results,states').split(',');
const DEV = { desktop: [1280, 720], phone: [844, 390] };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const o of OPTS) {
    if (!fs.existsSync(path.join(ROOT, 'mockups', o + '.html'))) continue;
    for (const s of SCREENS) for (const d of s === 'states' ? ['desktop'] : ['desktop', 'phone']) {
      const [w, h] = DEV[d];
      const page = await b.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errs.push(`${o}/${s}/${d}: ${e.message}`));
      await page.goto('file://' + path.join(ROOT, 'mockups', `${o}.html`) + `?screen=${s}&device=${d}`);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(ROOT, 'png', `${o}--${s}--${d}.png`) });
      await page.close();
    }
  }
  await b.close();
  console.log('rendered', errs.length ? errs : 'no errors');
})();
