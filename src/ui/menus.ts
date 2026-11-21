import { settings, saveSettings } from '../core/settings';
import { audio } from '../core/audio';
import { WEAPONS, availableWeapons, type WeaponDef, type WeaponId } from '../data/weapons';
import { MOVES } from '../data/moves';
import { MovePreview } from './preview';
import { anyUnlocked, isUnlocked, enterCode } from './cheats';
import { STYLE } from '../data/tuning';

/** DOM overlays for menus (title, pause, settings, loadout, results, banners). */
export class Menus {
  private root: HTMLElement;
  private layers = new Map<string, HTMLElement>();
  pauseBtn: HTMLButtonElement;
  /** Cheat: in-game nuke button (only shown with Settings -> Cheats -> Nuke on). */
  nukeBtn: HTMLButtonElement;
  onPause: () => void = () => {};
  onNuke: () => void = () => {};

  constructor() {
    this.root = document.getElementById('ui')!;
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'icon-btn';
    this.pauseBtn.textContent = 'II';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.style.display = 'none';
    this.pauseBtn.addEventListener('click', () => { audio.ui('click'); this.onPause(); });
    this.root.appendChild(this.pauseBtn);
    this.nukeBtn = document.createElement('button');
    this.nukeBtn.className = 'icon-btn nuke-btn';
    this.nukeBtn.textContent = '☢';
    this.nukeBtn.title = 'Nuke (N)';
    this.nukeBtn.setAttribute('aria-label', 'Nuke');
    this.nukeBtn.style.display = 'none';
    this.nukeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onNuke(); });
    this.root.appendChild(this.nukeBtn);
    this.placePause();
    window.addEventListener('resize', () => this.placePause());
  }

  /** Show/hide the in-play buttons (pause, and the nuke when its cheat is on). */
  setPlayButtons(on: boolean): void {
    this.pauseBtn.style.display = on ? '' : 'none';
    this.nukeBtn.style.display = on && settings.cheatNuke ? '' : 'none';
  }

  placePause(): void {
    const st = this.pauseBtn.style;
    // Always top-right: the HP bar owns the top-left corner in both handedness modes.
    st.right = 'max(10px, env(safe-area-inset-right))';
    st.left = '';
  }

  private layer(id: string, cls = 'layer'): HTMLElement {
    this.close(id);
    if (cls.includes('dim')) audio.paper('rustle');
    const el = document.createElement('div');
    el.className = cls;
    el.dataset.id = id;
    this.root.appendChild(el);
    this.layers.set(id, el);
    return el;
  }
  close(id: string): void {
    const el = this.layers.get(id);
    if (el) { el.remove(); this.layers.delete(id); }
  }
  isOpen(id: string): boolean { return this.layers.has(id); }

  private btn(parent: HTMLElement, label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('click'); onClick(); });
    parent.appendChild(b);
    return b;
  }

  // ---------------- Title ----------------
  showTitle(high: number, onSettings: () => void, mode: { rhythm: boolean; onToggle: (rhythm: boolean) => void } | null = null, loadout: { name: string; open: () => void } | null = null): void {
    const el = this.layer('title', 'layer passthrough');
    el.style.justifyContent = 'flex-start';
    el.style.paddingTop = '7vh';
    // Hand-lettered logo + a doodled stick figure doing a jumpshot flip.
    el.innerHTML = `<h1 class="title-logo">JUMPSHOT</h1><div class="subtitle">swipe · launch · juggle · spike</div>
      <svg class="title-doodle" viewBox="0 0 120 80" aria-hidden="true"><circle cx="70" cy="20" r="7"/><path d="M66 26 L52 46 M60 36 L44 30 M60 36 L74 44 M52 46 L36 58 M52 46 L62 64 M80 12 Q96 18 98 34 M98 34 L93 29 M98 34 L101 28 M20 70 L100 70"/></svg>`;
    // Easter egg: tap the logo 5 times for a cheat-code box (touch devices; keyboards can just type).
    const logo = el.querySelector('.title-logo') as HTMLElement | null;
    if (logo) {
      let taps = 0, last = 0;
      logo.style.pointerEvents = 'auto';
      logo.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = performance.now();
        taps = now - last < 600 ? taps + 1 : 1; last = now;
        if (taps >= 5) { taps = 0; this.codePrompt(); }
      });
    }
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    el.appendChild(spacer);
    const pr = document.createElement('div');
    pr.className = 'prompt';
    pr.textContent = 'TAP OR FLICK THE LOWER HALF TO START';
    pr.style.marginBottom = '2vh';
    el.appendChild(pr);
    const row = document.createElement('div');
    row.style.position = 'absolute'; row.style.top = '12px'; row.style.left = '12px';
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '10px';
    this.btn(row, '⚙ SETTINGS', onSettings, 'btn small');
    // TODO(ui-pass): loadout entry point.
    if (loadout) this.btn(row, `⚔ WEAPON: ${loadout.name}`, loadout.open, 'btn small');
    if (mode) {
      // Rhythm / Classic switch.
      const tg = document.createElement('div');
      tg.className = 'mode-toggle';
      tg.setAttribute('role', 'group');
      tg.setAttribute('aria-label', 'Game mode');
      const mk = (label: string, rhythm: boolean) => {
        const b = document.createElement('button');
        b.innerHTML = label.replace(' MODE', '<span class="mt-full"> MODE</span>');
        b.id = rhythm ? 'mode-rhythm' : 'mode-classic';
        b.className = mode.rhythm === rhythm ? 'on' : '';
        b.setAttribute('aria-pressed', String(mode.rhythm === rhythm));
        b.addEventListener('click', (e) => {
          e.stopPropagation(); audio.unlock(); audio.ui('click');
          mode.rhythm = rhythm;
          for (const x of tg.querySelectorAll('button')) { const on = x === b; x.className = on ? 'on' : ''; x.setAttribute('aria-pressed', String(on)); }
          mode.onToggle(rhythm);
        });
        tg.appendChild(b);
      };
      mk('Rhythm MODE', true);
      mk('Classic MODE', false);
      // Under the logo (not in the corner row, where it overlapped the logo on phones).
      tg.classList.add('title-modes');
      const doodle = el.querySelector('.title-doodle');
      el.insertBefore(tg, doodle ? doodle.nextSibling : null);
    }
    if (high > 0) {
      const hs = document.createElement('div');
      hs.style.fontWeight = '900'; hs.style.fontStyle = 'italic'; hs.style.opacity = '0.8';
      hs.textContent = `BEST ${high.toLocaleString()}`;
      row.appendChild(hs);
    }
    el.appendChild(row);
    // keep the prompt above the pad
    const padTop = (window as unknown as { __padTop?: number }).__padTop;
    if (padTop) { pr.style.position = 'absolute'; pr.style.top = (padTop + 18) + 'px'; pr.style.marginBottom = '0'; }
  }

  // ---------------- Pause ----------------
  showPause(onResume: () => void, onSettings: () => void, onRestart: () => void, onQuit: () => void): void {
    const el = this.layer('pause', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>PAUSED</h2>';
    this.btn(p, 'RESUME', onResume, 'btn primary');
    p.appendChild(document.createElement('br'));
    this.btn(p, 'SETTINGS', onSettings);
    p.appendChild(document.createElement('br'));
    this.btn(p, 'RESTART RUN', onRestart);
    p.appendChild(document.createElement('br'));
    this.btn(p, 'QUIT TO TITLE', onQuit);
    const h = document.createElement('div');
    h.className = 'hint';
    h.innerHTML = 'Lower half of the screen: drag slowly = move · flick = attack in that direction · long fast flick = HEAVY<br>Flick ↑ = JUMPSHOT launcher · flick ↓ in air = SPIKE · tap = dodge / parry<br>Keyboard: A/D or ←/→ move · I/J/K/L attack (+Shift heavy) · Space = tap · ` = debug';
    p.appendChild(h);
    el.appendChild(p);
  }

  // ---------------- Settings ----------------
  showSettings(onClose: () => void, onTutorial: (() => void) | null, onCalibrate: (() => void) | null = null): void {
    const el = this.layer('settings', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>SETTINGS</h2>';
    const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'shake' | 'hitstop' | 'sensitivity' | 'padRegion', min: number, max: number, step: number, after?: () => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `${label}: ${Math.round(settings[key] * 100)}%`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(settings[key]);
      inp.id = 'set-' + key;
      inp.addEventListener('input', () => { settings[key] = parseFloat(inp.value); span.textContent = fmt(); audio.applyVolume(); saveSettings(); after?.(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    const check = (label: string, key: 'leftHanded' | 'debug' | 'reduceFlashes' | 'rhythmMode' | 'beatHud' | 'boil' | 'highContrast' | 'cheatGod' | 'cheatRayGun' | 'cheatNuke', after?: () => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      span.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = settings[key];
      inp.addEventListener('change', () => { settings[key] = inp.checked; saveSettings(); after?.(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    };
    // ---- Look & animation (revision pass 5) ----
    const select = (label: string, id: string, opts: [string, string][], get: () => string, set: (v: string) => void) => {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span'); span.textContent = label;
      const sel = document.createElement('select'); sel.id = id;
      sel.style.cssText = 'font:inherit;font-weight:800;background:#141a30;color:#fff;border:1px solid rgba(160,220,255,.4);border-radius:8px;padding:4px 6px';
      for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
      sel.value = get();
      sel.addEventListener('change', () => { set(sel.value); saveSettings(); window.dispatchEvent(new Event('jumpshot-look')); });
      row.appendChild(span); row.appendChild(sel);
      p.appendChild(row);
    };
    select('Animation style', 'set-animStyle', [['drawn', 'Hand-Drawn (stepped)'], ['smooth', 'Smooth (interpolated)']], () => settings.animStyle, (v) => { settings.animStyle = v as 'drawn' | 'smooth'; });
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Hand-Drawn step rate: ${settings.stepRate} fps`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '8'; inp.max = '20'; inp.step = '1'; inp.value = String(settings.stepRate); inp.id = 'set-stepRate';
      inp.addEventListener('input', () => { settings.stepRate = parseInt(inp.value, 10); span.textContent = fmt(); saveSettings(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    select('Fists animation (Hand-Drawn)', 'set-fistAnims', [['v2', 'Reference v2 (new)'], ['legacy', 'Legacy']], () => settings.fistAnims, (v) => { settings.fistAnims = v as 'v2' | 'legacy'; });
    select('Attack smoothness (Hand-Drawn)', 'set-attackSmooth', [['low', 'Low (key drawings only)'], ['normal', 'Normal (+1 in-between)'], ['high', 'High (+2, strikes on ones)']], () => settings.attackSmooth, (v) => { settings.attackSmooth = v as 'low' | 'normal' | 'high'; });
    select('Paper page', 'set-page', [['auto', 'Auto (changes with waves)'], ['blank', 'Blank Page'], ['lined', 'Lined Notebook'], ['graph', 'Graph Paper'], ['sketch', 'Sketchbook'], ['kraft', 'Kraft Paper']], () => settings.page, (v) => { settings.page = v as typeof settings.page; });
    select('Look', 'set-look', [['pixel', 'Pixel (ink page, 1-bit)'], ['crisp', 'Crisp (ink page, full res)'], ['smooth', 'Smooth (previous neon look)']], () => settings.look, (v) => { settings.look = v as 'pixel' | 'crisp' | 'smooth'; });
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Pixel Look resolution: ${Math.round(settings.pixelRes * 100)}%`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '0.3'; inp.max = '0.55'; inp.step = '0.025'; inp.value = String(settings.pixelRes); inp.id = 'set-pixelRes';
      inp.addEventListener('input', () => { settings.pixelRes = parseFloat(inp.value); span.textContent = fmt(); saveSettings(); window.dispatchEvent(new Event('jumpshot-look')); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    slider('Master volume', 'masterVolume', 0, 1, 0.05);
    slider('Music volume', 'musicVolume', 0, 1, 0.05);
    select('Tap / Space', 'set-tapAction', [['jump', 'Jump (double-tap or Shift+Space / F = dodge & parry)'], ['dodge', 'Dodge & parry (original)']], () => settings.tapAction, (v) => { settings.tapAction = v as 'jump' | 'dodge'; });
    select('Sound effects', 'set-sfxStyle', [['recorded', 'Recorded (Freesound, CC0)'], ['synth', 'Synthesized (original)']], () => settings.sfxStyle, (v) => { settings.sfxStyle = v as 'recorded' | 'synth'; });
    slider('Screen shake', 'shake', 0, 1.5, 0.05);
    slider('Hit-stop strength', 'hitstop', 0, 1.5, 0.05);
    slider('Flick sensitivity', 'sensitivity', 0.5, 1.6, 0.05);
    slider('Touch area (screen height)', 'padRegion', 0.35, 0.6, 0.01, () => window.dispatchEvent(new Event('resize')));
    check('Left-handed pad', 'leftHanded', () => { window.dispatchEvent(new Event('resize')); this.placePause(); });
    check('Reduce flashes', 'reduceFlashes');
    check('Line boil (doodles re-drawn ~7 fps)', 'boil');
    check('High contrast (plain page, bolder lines)', 'highContrast', () => window.dispatchEvent(new Event('jumpshot-look')));
    // Easter-egg cheats: this section only appears once a code has unlocked something.
    if (anyUnlocked()) {
      const cheats = document.createElement('div');
      cheats.className = 'sec';
      cheats.textContent = 'CHEATS (runs with cheats don\'t count for high scores)';
      p.appendChild(cheats);
      if (isUnlocked('cheatGod')) check('Never die', 'cheatGod');
      if (isUnlocked('cheatRayGun')) check('Ray gun in the loadout', 'cheatRayGun');
      if (isUnlocked('cheatNuke')) check('Nuke button in play (also the N key)', 'cheatNuke');
    }
    check('Rhythm Mode (off = Classic; applies to the next run)', 'rhythmMode', () => window.dispatchEvent(new Event('jumpshot-mode')));
    check('Beat-track HUD (Rhythm Mode)', 'beatHud');
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Rhythm latency offset: ${settings.rhythmOffset >= 0 ? '+' : ''}${Math.round(settings.rhythmOffset)} ms`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '-250'; inp.max = '250'; inp.step = '5'; inp.value = String(settings.rhythmOffset); inp.id = 'set-rhythmOffset';
      inp.addEventListener('input', () => { settings.rhythmOffset = parseFloat(inp.value); span.textContent = fmt(); saveSettings(); window.dispatchEvent(new Event('jumpshot-mode')); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    if (onCalibrate) this.btn(p, 'CALIBRATE RHYTHM LATENCY', () => { this.close('settings'); onCalibrate(); });
    check('Show debug overlay', 'debug', () => window.dispatchEvent(new Event('jumpshot-debug')));
    if (onTutorial) this.btn(p, 'REPLAY TUTORIAL', () => { this.close('settings'); onTutorial(); });
    const foot = document.createElement('div');
    foot.className = 'sticky-foot';
    this.btn(foot, 'DONE', () => { this.close('settings'); onClose(); }, 'btn primary');
    p.appendChild(foot);
    el.appendChild(p);
  }

  // ---------------- Weapons (revision pass 7) ----------------
  // TODO(ui-pass): the loadout screen, swap strip and weapon tooltip reuse the existing panel/card/button
  // components with a plain functional layout; restyle them in the UI pass.

  /** Pre-run loadout: pick one of the weapons (preview loops its moves on a dummy, plus its swipe cheat-sheet). */
  showLoadout(current: WeaponId, onPick: (id: WeaponId) => void, onClose: () => void): void {
    const el = this.layer('loadout', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel loadout';
    p.innerHTML = '<h2>LOADOUT</h2>';
    const cv = document.createElement('canvas');
    cv.className = 'lo-preview';
    const cap = document.createElement('div');
    cap.className = 'subtitle lo-cap';
    const preview = new MovePreview(cv, (l) => { cap.textContent = l; });
    p.appendChild(cv); p.appendChild(cap);
    const cards = document.createElement('div');
    cards.className = 'cards lo-cards';
    const sheet = document.createElement('div');
    sheet.className = 'lo-sheet';
    let sel = current;
    const pick = (id: WeaponId) => {
      sel = id;
      for (const c of cards.querySelectorAll<HTMLElement>('.card')) c.classList.toggle('sel', c.dataset.id === id);
      preview.setWeapon(WEAPONS[id]);
      sheet.innerHTML = cheatSheet(WEAPONS[id]);
      onPick(id);
    };
    availableWeapons().forEach((id, i) => {
      const w = WEAPONS[id];
      const c = document.createElement('button');
      c.className = 'card';
      c.dataset.id = id;
      const ic = document.createElement('canvas');
      ic.width = 64; ic.height = 64; ic.className = 'lo-icon';
      w.icon(ic.getContext('2d')!, 32, 32, 56, '#1b1a17');
      c.appendChild(ic);
      const t = document.createElement('div');
      t.innerHTML = `<div class="nm">${i + 1}. ${w.name}</div><div class="ds">${w.desc}</div>`;
      c.appendChild(t);
      c.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('select'); pick(id); });
      cards.appendChild(c);
    });
    p.appendChild(cards);
    p.appendChild(sheet);
    const foot = document.createElement('div');
    foot.className = 'sticky-foot';
    this.btn(foot, 'DONE', () => { preview.stop(); this.close('loadout'); onClose(); }, 'btn primary');
    p.appendChild(foot);
    el.appendChild(p);
    pick(sel);
    preview.start();
  }

  /** Keyboard: number keys pick a weapon in the open loadout; Enter/Escape closes it. Returns true if handled. */
  loadoutKey(code: string): boolean {
    const el = this.layers.get('loadout');
    if (!el) return false;
    const n = code.startsWith('Digit') ? parseInt(code.slice(5), 10) : NaN;
    if (n >= 1 && n <= availableWeapons().length) { (el.querySelectorAll<HTMLButtonElement>('.card')[n - 1])?.click(); return true; }
    if (code === 'Enter' || code === 'Escape') { el.querySelector<HTMLButtonElement>('.sticky-foot .btn')?.click(); return true; }
    return false;
  }

  /** Between waves: a small non-blocking strip of weapon icons; tap (or press 1-5) to swap instantly. */
  showSwap(current: WeaponId, onSwap: (id: WeaponId) => void): void {
    const el = this.layer('swap', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const bar = document.createElement('div');
    bar.className = 'swap-bar';
    const lab = document.createElement('span');
    lab.className = 'swap-label';
    lab.textContent = 'Swap weapon';
    bar.appendChild(lab);
    availableWeapons().forEach((id, i) => {
      const w = WEAPONS[id];
      const b = document.createElement('button');
      b.className = 'btn small swap-btn' + (id === current ? ' sel' : '');
      b.title = `${i + 1}: ${w.name}`;
      b.dataset.id = id;
      const ic = document.createElement('canvas');
      ic.width = 40; ic.height = 40;
      w.icon(ic.getContext('2d')!, 20, 20, 34, '#1b1a17');
      b.appendChild(ic);
      const k = document.createElement('small');
      k.textContent = String(i + 1);
      b.appendChild(k);
      b.addEventListener('click', (e) => {
        e.stopPropagation(); audio.unlock();
        for (const x of bar.querySelectorAll('.swap-btn')) x.classList.toggle('sel', x === b);
        onSwap(id);
      });
      bar.appendChild(b);
    });
    el.appendChild(bar);
  }

  /** Keyboard swap during the breather. */
  swapKey(code: string): boolean {
    const el = this.layers.get('swap');
    if (!el) return false;
    const n = code.startsWith('Digit') ? parseInt(code.slice(5), 10) : NaN;
    if (n >= 1 && n <= availableWeapons().length) { el.querySelectorAll<HTMLButtonElement>('.swap-btn')[n - 1]?.click(); return true; }
    return false;
  }

  /** First-time tooltip for a weapon: its directional moves, non-blocking. */
  weaponTip(w: WeaponDef, ms: number): void {
    const el = this.layer('wtip', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'tut wtip';
    t.innerHTML = `${w.name}<small>${w.tips.join('<br>')}</small>`;
    el.appendChild(t);
    window.setTimeout(() => { if (this.layers.get('wtip') === el) this.close('wtip'); }, ms);
  }

  /** Secret code box (from 5 taps on the title logo). TODO(ui-pass) */
  codePrompt(): void {
    const el = this.layer('code', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>?</h2>';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.autocomplete = 'off'; inp.className = 'code-input';
    inp.setAttribute('aria-label', 'Code');
    p.appendChild(inp);
    const msg = document.createElement('div');
    msg.className = 'subtitle';
    p.appendChild(msg);
    const submit = () => { const r = enterCode(inp.value); msg.textContent = r ?? 'nothing happens…'; inp.value = ''; if (r) this.banner('🔓 ' + r, 'cheat', 1400); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); if (e.key === 'Escape') this.close('code'); });
    const row = document.createElement('div');
    this.btn(row, 'OK', submit, 'btn primary');
    this.btn(row, 'CLOSE', () => this.close('code'));
    p.appendChild(row);
    el.appendChild(p);
    setTimeout(() => inp.focus(), 50);
  }

  // ---------------- Results ----------------
  showResults(r: {
    score: number; high: number; newHigh: boolean; wave: number; bestHits: number; bestDamage: number; bestRank: number;
    kos: number; parries: number; finishers: number; maxRank: number;
    /** Rhythm Mode only. */
    rhythm?: { label: string; counts: number[]; bestStreak: number; accuracy: number } | null;
  }, onRetry: () => void, onTitle: () => void): void {
    const el = this.layer('results', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel report';
    p.innerHTML = `<div class="stamp">${STYLE.ranks[r.maxRank]}<small>STYLE</small></div><h2>Report card</h2>
      <div class="big">${r.score.toLocaleString()}</div>
      <div class="subtitle" style="margin-bottom:8px">${r.newHigh ? '★ NEW HIGH SCORE ★' : 'BEST ' + r.high.toLocaleString()}</div>
      <div class="stats">
        <span>Wave reached</span><span class="v">${r.wave}</span>
        <span>Best combo</span><span class="v"><span class="hl">${r.bestHits} hits · ${r.bestDamage} dmg · ${STYLE.ranks[r.bestRank]}</span></span>
        <span>Highest style rank</span><span class="v">${STYLE.ranks[r.maxRank]}</span>
        <span>K.O.s</span><span class="v">${r.kos}</span>
        <span>Perfect parries</span><span class="v">${r.parries}</span>
        <span>Finishers</span><span class="v">${r.finishers}</span>
      </div>`;
    if (r.rhythm) {
      const c = r.rhythm.counts;
      const d = document.createElement('div');
      d.className = 'stats';
      d.style.marginTop = '8px';
      d.innerHTML = `<span>Song</span><span class="v">${r.rhythm.label}</span>
        <span>Beat accuracy</span><span class="v">${Math.round(r.rhythm.accuracy * 100)}%</span>
        <span>Best streak</span><span class="v">${r.rhythm.bestStreak}</span>
        <span>Judgements</span><span class="v">${c[3]} perfect · ${c[2]} great · ${c[1]} good · ${c[0]} miss</span>`;
      p.appendChild(d);
    }
    this.btn(p, 'FIGHT AGAIN', onRetry, 'btn primary');
    this.btn(p, 'TITLE', onTitle);
    el.appendChild(p);
  }

  // ---------------- Banners & tutorial text ----------------
  banner(text: string, sub: string, ms: number): void {
    const el = this.layer('banner', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.appendChild(b);
    window.setTimeout(() => { if (this.layers.get('banner') === el) this.close('banner'); }, ms);
  }

  tutorialText(text: string, sub: string, topPx: number, onSkip: (() => void) | null): void {
    const el = this.layer('tutorial', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'tut';
    t.style.top = topPx + 'px';
    t.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.appendChild(t);
    if (onSkip) {
      const b = this.btn(el, 'SKIP TUTORIAL ›', onSkip, 'btn small');
      b.style.position = 'absolute';
      b.style.top = '62px';
      b.style.right = '10px';
      b.style.pointerEvents = 'auto';
    }
  }

  closeAll(): void { for (const id of [...this.layers.keys()]) this.close(id); }
}

/** Swipe cheat-sheet for a weapon: direction -> light / heavy move names (ground, then air). */
function cheatSheet(w: WeaponDef): string {
  const nm = (id: string) => MOVES[id]?.name ?? id;
  const rows: [string, keyof WeaponDef['ground']][] = [['→ ←', 'side'], ['↗ ↖', 'upDiag'], ['↑', 'up'], ['↘ ↙', 'downDiag'], ['↓', 'down']];
  const tr = (set: WeaponDef['ground']) => rows.map(([d, k]) => `<tr><td>${d}</td><td>${nm(set[k].light)}</td><td>${nm(set[k].heavy)}</td></tr>`).join('');
  return `<table><tr><th>swipe</th><th>light</th><th>heavy (long fast swipe / Shift)</th></tr>${tr(w.ground)}<tr><th colspan="3">in the air</th></tr>${tr(w.air)}<tr><td>tap</td><td colspan="2">${w.dodge.rope ? 'hook-zip dodge' : 'dodge'} / parry</td></tr></table>`;
}
