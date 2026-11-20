import { audio } from '../core/audio';
import { settings } from '../core/settings';
import { SONGS, type SongDef } from '../data/songs';
import { GRADE_COLOR } from '../data/rhythm';

export interface PickStatus { set(text: string, err?: boolean): void; progress(f: number): void; busy(b: boolean): void }
export interface CalibView {
  onRetry: () => void;
  beat(i: number): void;
  value(ms: number, n: number, need: number): void;
  done(ms: number, onSave: (ms: number) => void): void;
  reset(): void;
}

/** Rhythm Mode's own DOM overlays (song picker, calibration). Uses the shared menu CSS. */
export class RhythmUI {
  private root = document.getElementById('ui')!;
  private layers = new Map<string, HTMLElement>();

  private layer(id: string, cls: string): HTMLElement {
    this.close(id);
    const el = document.createElement('div');
    el.className = cls;
    el.dataset.id = 'rhythm-' + id;
    this.root.appendChild(el);
    this.layers.set(id, el);
    return el;
  }
  close(id: string): void { const el = this.layers.get(id); if (el) { el.remove(); this.layers.delete(id); } }
  closeAll(): void { for (const id of [...this.layers.keys()]) this.close(id); }
  isOpen(id: string): boolean { return this.layers.has(id); }

  private btn(parent: HTMLElement, label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('click'); onClick(); });
    parent.appendChild(b);
    return b;
  }

  // ------------------------------------------------------------ song picker
  showPicker(o: {
    current: string;
    onSong: (s: SongDef) => void;
    onFile: ((f: File, st: PickStatus) => void) | null;
    onMic: ((st: PickStatus) => void) | null;
    onCalibrate: () => void;
    onBack: (() => void) | null;
  }): void {
    const el = this.layer('picker', 'layer dim');
    const p = document.createElement('div');
    p.className = 'panel music-panel';
    p.innerHTML = '<h2>PICK A SONG</h2><div class="hint" style="margin-top:-6px">Swipe whenever you like — every attack snaps onto the beat. Swipe <b>on</b> the beat for bigger hits and a streak.</div>';
    const sec = (t: string) => { const d = document.createElement('div'); d.className = 'sec'; d.textContent = t; p.appendChild(d); };
    const tile = (parent: HTMLElement, key: string, icon: string, name: string, desc: string, onClick: () => void, wide = false) => {
      const b = document.createElement('button');
      b.className = 'mtile' + (key === o.current ? ' sel' : '') + (wide ? ' wide' : '');
      b.dataset.key = key;
      b.innerHTML = `<span class="ic">${icon}</span><div class="nm">${name}</div><div class="ds">${desc}</div>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('click'); onClick(); });
      parent.appendChild(b);
    };
    sec('BUILT-IN SONGS');
    const g1 = document.createElement('div'); g1.className = 'music-grid'; p.appendChild(g1);
    const icons: Record<string, string> = { dojo: '🥁', neon: '⚡', volcano: '🌋' };
    for (const s of SONGS) tile(g1, 'song:' + s.id, icons[s.style] ?? '♪', s.name, s.desc, () => o.onSong(s));
    const status = document.createElement('div'); status.className = 'mstatus';
    const barO = document.createElement('div'); barO.className = 'mbar'; barO.style.display = 'none';
    const barI = document.createElement('i'); barO.appendChild(barI);
    const st: PickStatus = {
      set: (text, err = false) => { status.textContent = text; status.className = 'mstatus' + (err ? ' err' : ''); },
      progress: (f) => { barO.style.display = f >= 0 && f < 1 ? '' : 'none'; barI.style.width = Math.round(f * 100) + '%'; },
      busy: (b) => { for (const x of p.querySelectorAll('button')) (x as HTMLButtonElement).disabled = b; },
    };
    if (o.onFile || o.onMic) {
      sec('YOUR MUSIC');
      const g2 = document.createElement('div'); g2.className = 'music-grid'; p.appendChild(g2);
      if (o.onFile) {
        const onFile = o.onFile;
        const file = document.createElement('input');
        file.type = 'file'; file.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus'; file.style.display = 'none'; file.id = 'rhythm-file';
        file.addEventListener('change', () => { const f = file.files?.[0]; if (f) onFile(f, st); file.value = ''; });
        p.appendChild(file);
        tile(g2, 'file', '🎵', 'YOUR SONG', 'An MP3 / M4A / WAV from your device. Tempo and beats are detected in the browser.', () => file.click());
      }
      if (o.onMic) { const onMic = o.onMic; tile(g2, 'mic', '🎤', 'LISTEN MODE', 'Play music from any app out loud; the game hears it and locks onto the beat. Experimental.', () => onMic(st)); }
      p.appendChild(status); p.appendChild(barO);
    }
    const foot = document.createElement('div');
    foot.style.marginTop = '12px';
    const off = document.createElement('span');
    off.style.fontWeight = '800'; off.style.opacity = '0.75'; off.style.marginRight = '6px';
    off.textContent = `Latency offset ${settings.rhythmOffset >= 0 ? '+' : ''}${Math.round(settings.rhythmOffset)} ms`;
    foot.appendChild(off);
    this.btn(foot, 'CALIBRATE', o.onCalibrate, 'btn small');
    if (o.onBack) this.btn(foot, 'BACK', o.onBack, 'btn small');
    p.appendChild(foot);
    if (o.onFile || o.onMic) {
      const note = document.createElement('div');
      note.className = 'hint';
      note.textContent = "Streaming apps don't share their audio with other apps, so a song must be a file on your device — or use Listen mode.";
      p.appendChild(note);
    }
    el.appendChild(p);
  }

  // ------------------------------------------------------------ calibration
  /** Instructions at the top; the pad stays live so calibration uses the real flick path. */
  showCalibration(onCancel: () => void): CalibView {
    const el = this.layer('calib', 'layer passthrough');
    el.style.pointerEvents = 'none';
    const box = document.createElement('div');
    box.className = 'panel calib-top';
    box.style.pointerEvents = 'auto';
    box.innerHTML = `<h2 style="margin-bottom:6px">LATENCY CALIBRATION</h2>
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
        msg.textContent = n >= need ? 'done' : `${n} / ${need} hits${n > 0 ? ' · keep going' : ''}`;
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
}
