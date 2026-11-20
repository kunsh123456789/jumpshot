import { settings, saveSettings } from '../core/settings';
import { audio } from '../core/audio';
import type { UpgradeDef } from '../data/upgrades';
import { STYLE } from '../data/tuning';
import { TRACKS, GRADE_COLOR, type TrackDef } from '../data/rhythm';

export interface MusicStatus { set(text: string, err?: boolean): void; progress(f: number): void; busy(b: boolean): void }
export interface CalibView {
  onRetry: () => void;
  beat(i: number): void;
  value(ms: number, n: number, need: number): void;
  done(ms: number, onSave: (ms: number) => void): void;
  reset(): void;
}

/** DOM overlays for menus (title, pause, settings, upgrades, results, banners). */
export class Menus {
  private root: HTMLElement;
  private layers = new Map<string, HTMLElement>();
  pauseBtn: HTMLButtonElement;
  onPause: () => void = () => {};

  constructor() {
    this.root = document.getElementById('ui')!;
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'icon-btn';
    this.pauseBtn.textContent = 'II';
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.pauseBtn.style.display = 'none';
    this.pauseBtn.addEventListener('click', () => { audio.ui('click'); this.onPause(); });
    this.root.appendChild(this.pauseBtn);
    this.placePause();
    window.addEventListener('resize', () => this.placePause());
  }

  placePause(): void {
    const st = this.pauseBtn.style;
    // Always top-right: the HP bar owns the top-left corner in both handedness modes.
    st.right = 'max(10px, env(safe-area-inset-right))';
    st.left = '';
  }

  private layer(id: string, cls = 'layer'): HTMLElement {
    this.close(id);
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
  showTitle(high: number, onSettings: () => void): void {
    const el = this.layer('title', 'layer passthrough');
    el.style.justifyContent = 'flex-start';
    el.style.paddingTop = '7vh';
    el.innerHTML = `<h1 class="title-logo">JUMPSHOT</h1><div class="subtitle">SWIPE · LAUNCH · JUGGLE · SPIKE</div>`;
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
  showPause(onResume: () => void, onSettings: () => void, onRestart: () => void, onQuit: () => void, onMusic: (() => void) | null = null, musicLabel = ''): void {
    const el = this.layer('pause', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>PAUSED</h2>';
    this.btn(p, 'RESUME', onResume, 'btn primary');
    p.appendChild(document.createElement('br'));
    if (onMusic) {
      this.btn(p, '♪ MUSIC', onMusic);
      const ml = document.createElement('div');
      ml.className = 'hint'; ml.style.marginTop = '0'; ml.textContent = musicLabel;
      p.appendChild(ml);
    }
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
    const check = (label: string, key: 'leftHanded' | 'debug' | 'reduceFlashes' | 'beatHud', after?: () => void) => {
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
    slider('Master volume', 'masterVolume', 0, 1, 0.05);
    slider('Music volume', 'musicVolume', 0, 1, 0.05);
    slider('Screen shake', 'shake', 0, 1.5, 0.05);
    slider('Hit-stop strength', 'hitstop', 0, 1.5, 0.05);
    slider('Flick sensitivity', 'sensitivity', 0.5, 1.6, 0.05);
    slider('Touch area (screen height)', 'padRegion', 0.35, 0.6, 0.01, () => window.dispatchEvent(new Event('resize')));
    check('Left-handed pad', 'leftHanded', () => { window.dispatchEvent(new Event('resize')); this.placePause(); });
    check('Reduce flashes', 'reduceFlashes');
    check('Beat track HUD (rhythm mode)', 'beatHud');
    {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      const fmt = () => `Rhythm timing offset: ${settings.rhythmOffset >= 0 ? '+' : ''}${Math.round(settings.rhythmOffset)} ms`;
      span.textContent = fmt();
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '-200'; inp.max = '200'; inp.step = '5'; inp.value = String(settings.rhythmOffset); inp.id = 'set-rhythmOffset';
      inp.addEventListener('input', () => { settings.rhythmOffset = parseFloat(inp.value); span.textContent = fmt(); saveSettings(); });
      row.appendChild(span); row.appendChild(inp);
      p.appendChild(row);
    }
    if (onCalibrate) this.btn(p, 'CALIBRATE TIMING', () => { this.close('settings'); onCalibrate(); });
    check('Show debug overlay', 'debug', () => window.dispatchEvent(new Event('jumpshot-debug')));
    if (onTutorial) this.btn(p, 'REPLAY TUTORIAL', () => { this.close('settings'); onTutorial(); });
    this.btn(p, 'DONE', () => { this.close('settings'); onClose(); }, 'btn primary');
    el.appendChild(p);
  }

  // ---------------- Upgrade picker ----------------
  showUpgrades(choices: UpgradeDef[], stacks: Record<string, number>, onPick: (u: UpgradeDef) => void, title: string): void {
    const el = this.layer('upgrades', 'layer dim');
    const h = document.createElement('div');
    h.className = 'big';
    h.textContent = title;
    h.style.marginBottom = '6px';
    el.appendChild(h);
    const sub = document.createElement('div');
    sub.className = 'subtitle';
    sub.textContent = 'CHOOSE AN UPGRADE';
    sub.style.marginBottom = '18px';
    el.appendChild(sub);
    const cards = document.createElement('div');
    cards.className = 'cards';
    choices.forEach((u, i) => {
      const c = document.createElement('button');
      c.className = 'card';
      c.style.animationDelay = `${i * 0.08}s`;
      const st = stacks[u.id] ?? 0;
      c.innerHTML = `<div class="ic">${u.icon}</div><div class="nm">${u.name}${st > 0 ? ` <span style="opacity:.6;font-size:13px">LV${st + 1}</span>` : ''}</div><div class="ds">${u.desc}</div><div class="tg">${u.tag}</div>`;
      let picked = false;
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        if (picked) return;
        picked = true;
        audio.ui('select');
        this.close('upgrades');
        onPick(u);
      });
      cards.appendChild(c);
    });
    el.appendChild(cards);
  }

  // ---------------- Results ----------------
  showResults(r: {
    score: number; high: number; newHigh: boolean; wave: number; bestHits: number; bestDamage: number; bestRank: number;
    kos: number; parries: number; finishers: number; maxRank: number;
    rhythm?: { label: string; counts: number[]; bestStreak: number; accuracy: number } | null;
  }, onRetry: () => void, onTitle: () => void): void {
    const el = this.layer('results', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = `<h2>DEFEATED</h2>
      <div class="big">${r.score.toLocaleString()}</div>
      <div class="subtitle" style="margin-bottom:8px">${r.newHigh ? '★ NEW HIGH SCORE ★' : 'BEST ' + r.high.toLocaleString()}</div>
      <div class="stats">
        <span>Wave reached</span><span class="v">${r.wave}</span>
        <span>Best combo</span><span class="v">${r.bestHits} hits · ${r.bestDamage} dmg · ${STYLE.ranks[r.bestRank]}</span>
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
      d.innerHTML = `<span>Music</span><span class="v">${r.rhythm.label}</span>
        <span>Beat accuracy</span><span class="v">${Math.round(r.rhythm.accuracy * 100)}%</span>
        <span>Best on-beat streak</span><span class="v">${r.rhythm.bestStreak}</span>
        <span>Judgements</span><span class="v"><b style="color:${GRADE_COLOR[3]}">${c[3]}</b> perfect · <b style="color:${GRADE_COLOR[2]}">${c[2]}</b> great · <b style="color:${GRADE_COLOR[1]}">${c[1]}</b> good · <b style="color:${GRADE_COLOR[0]}">${c[0]}</b> off</span>`;
      p.appendChild(d);
    }
    this.btn(p, 'FIGHT AGAIN', onRetry, 'btn primary');
    this.btn(p, 'TITLE', onTitle);
    el.appendChild(p);
  }


  // ---------------- Music select ----------------
  /**
   * Pick what the fight syncs to. `current` is the highlighted choice key
   * ('builtin:<id>', 'file', 'mic', 'classic').
   */
  showMusic(o: {
    current: string;
    songName: string | null;
    offsetMs: number;
    onTrack: (t: TrackDef) => void;
    onFile: (f: File, status: MusicStatus) => void;
    onLastSong: (() => void) | null;
    onMic: (status: MusicStatus) => void;
    onClassic: () => void;
    onCalibrate: () => void;
    onBack: (() => void) | null;
  }): void {
    const el = this.layer('music', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel music-panel';
    p.innerHTML = '<h2>CHOOSE YOUR BEAT</h2><div class="hint" style="margin-top:-6px">Swipe on the beat: on-beat hits hit harder, build an ON-BEAT streak, and enemies strike on the beat.</div>';
    const tile = (parent: HTMLElement, key: string, icon: string, name: string, desc: string, onClick: () => void, wide = false) => {
      const b = document.createElement('button');
      b.className = 'mtile' + (key === o.current ? ' sel' : '') + (wide ? ' wide' : '');
      b.dataset.key = key;
      b.innerHTML = `<span class="ic">${icon}</span><div class="nm">${name}</div><div class="ds">${desc}</div>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('click'); onClick(); });
      parent.appendChild(b);
      return b;
    };
    const sec = (t: string) => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; p.appendChild(d); };
    sec('BUILT-IN TRACKS · PERFECT SYNC');
    const g1 = document.createElement('div'); g1.className = 'music-grid'; p.appendChild(g1);
    for (const t of TRACKS) tile(g1, 'builtin:' + t.id, t.bpm < 110 ? '🥁' : t.bpm < 140 ? '⚡' : '🌋', t.name, t.desc, () => o.onTrack(t));
    sec('YOUR MUSIC');
    const g2 = document.createElement('div'); g2.className = 'music-grid'; p.appendChild(g2);
    const status = document.createElement('div'); status.className = 'mstatus';
    const barO = document.createElement('div'); barO.className = 'mbar'; barO.style.display = 'none';
    const barI = document.createElement('i'); barO.appendChild(barI);
    const st: MusicStatus = {
      set: (text, err = false) => { status.textContent = text; status.className = 'mstatus' + (err ? ' err' : ''); },
      progress: (f) => { barO.style.display = f >= 0 && f < 1 ? '' : 'none'; barI.style.width = Math.round(f * 100) + '%'; },
      busy: (b) => { for (const x of p.querySelectorAll('button')) (x as HTMLButtonElement).disabled = b; },
    };
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus'; file.style.display = 'none'; file.id = 'music-file';
    file.addEventListener('change', () => { const f = file.files?.[0]; if (f) o.onFile(f, st); file.value = ''; });
    p.appendChild(file);
    tile(g2, 'file', '🎵', 'YOUR SONG', 'Pick an MP3 / M4A / WAV from your device. Tempo and beats are detected automatically.', () => file.click());
    if (o.onLastSong && o.songName) tile(g2, 'lastsong', '↻', 'PLAY AGAIN', o.songName, o.onLastSong);
    tile(g2, 'mic', '🎤', 'LISTEN MODE', 'Play music from ANY app (Spotify, YouTube…) out loud — the game listens and locks onto the beat. Experimental.', () => o.onMic(st));
    p.appendChild(status); p.appendChild(barO);
    sec('NO RHYTHM');
    const g3 = document.createElement('div'); g3.className = 'music-grid'; p.appendChild(g3);
    tile(g3, 'classic', '⚔', 'CLASSIC', 'The original game: background music, no beat judging, slow-mo on.', o.onClassic, true);
    const foot = document.createElement('div');
    foot.style.marginTop = '10px';
    const off = document.createElement('span');
    off.style.fontWeight = '800'; off.style.opacity = '0.75'; off.style.marginRight = '6px';
    off.textContent = `Timing offset ${o.offsetMs >= 0 ? '+' : ''}${Math.round(o.offsetMs)} ms`;
    foot.appendChild(off);
    this.btn(foot, 'CALIBRATE', o.onCalibrate, 'btn small');
    if (o.onBack) this.btn(foot, 'BACK', o.onBack, 'btn small');
    p.appendChild(foot);
    const note = document.createElement('div');
    note.className = 'hint';
    note.textContent = "Streaming apps don't let other apps read their audio, so a song has to be a file on your device — or use Listen mode.";
    p.appendChild(note);
    el.appendChild(p);
  }

  // ---------------- Calibration ----------------
  /** Top-of-screen instructions; the pad below stays live so you calibrate with real flicks. */
  showCalibration(onCancel: () => void): CalibView {
    const el = this.layer('calib', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const box = document.createElement('div');
    box.className = 'panel calib-top';
    box.style.pointerEvents = 'auto';
    box.innerHTML = `<h2 style="margin-bottom:6px">TIMING CALIBRATION</h2>
      <div class="hint" style="margin-top:0">Flick or tap the pad (or press Space) exactly on each click.</div>
      <div class="calib-num" id="cal-num">—</div>
      <div id="cal-dots"></div><div class="mstatus" id="cal-msg">listen for the count-in…</div>`;
    const dots = box.querySelector('#cal-dots') as HTMLElement;
    for (let i = 0; i < 4; i++) { const d = document.createElement('span'); d.className = 'beat-dot'; dots.appendChild(d); }
    const row = document.createElement('div');
    const save = this.btn(row, 'SAVE', () => {}, 'btn primary small');
    save.style.display = 'none';
    this.btn(row, 'RETRY', () => view.onRetry(), 'btn small');
    this.btn(row, 'CANCEL', onCancel, 'btn small');
    box.appendChild(row);
    el.appendChild(box);
    const num = box.querySelector('#cal-num') as HTMLElement;
    const msg = box.querySelector('#cal-msg') as HTMLElement;
    const view: CalibView = {
      onRetry: () => {},
      beat: (i) => dots.childNodes.forEach((d, k) => (d as HTMLElement).classList.toggle('on', k === ((i % 4) + 4) % 4)),
      value: (ms, n, need) => {
        num.textContent = isFinite(ms) ? `${ms >= 0 ? '+' : ''}${Math.round(ms)} ms` : '—';
        msg.textContent = n >= need ? 'done — your average timing:' : `${n} / ${need} hits${n > 0 ? ' · keep going' : ''}`;
        num.style.color = isFinite(ms) ? GRADE_COLOR[Math.abs(ms) < 30 ? 3 : Math.abs(ms) < 70 ? 2 : 1] : '';
      },
      done: (ms, onSave) => {
        save.style.display = '';
        save.onclick = (e) => { e.stopPropagation(); audio.ui('select'); onSave(ms); };
        msg.textContent = `Offset ${ms >= 0 ? '+' : ''}${Math.round(ms)} ms — ${ms > 0 ? 'you (or your device) run late' : 'you run early'}. Save it?`;
      },
      reset: () => { save.style.display = 'none'; num.textContent = '—'; msg.textContent = 'listen for the count-in…'; },
    };
    return view;
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
