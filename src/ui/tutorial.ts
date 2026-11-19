import type { World } from '../sim/world';
import type { DrawPad } from './pad';
import type { Menus } from './menus';
import { layout } from '../core/layout';
import { audio } from '../core/audio';

interface Step { text: string; sub: string; hint: number; label: string; dummyAttacks?: boolean }

const STEPS: Step[] = [
  { text: 'SWIPE RIGHT → TO STRIKE', sub: 'swipe on the pad — your fighter dashes in automatically', hint: 0, label: 'SWIPE →' },
  { text: 'SWIPE UP ↑ — JUMPSHOT!', sub: 'the launcher sends them skyward and you leap after them', hint: 2, label: 'SWIPE ↑' },
  { text: 'SWIPE AGAIN IN THE AIR', sub: 'juggle them: each air hit keeps you both floating (3 air hits)', hint: 0, label: 'SWIPE → → →' },
  { text: 'SWIPE DOWN ↓ TO SPIKE', sub: 'launch, juggle, then spike them into the ground', hint: 6, label: 'SWIPE ↓ (IN THE AIR)' },
  { text: 'TAP JUST BEFORE THE RED FLASH HITS', sub: 'tap = dodge · tap at the last moment = PERFECT PARRY', hint: -2, label: 'TAP', dummyAttacks: true },
  { text: 'SCRIBBLE TO CHAIN A 10-HIT COMBO', sub: 'zig-zag strokes fire attacks without lifting your finger', hint: -1, label: '' },
];

/** First-run interactive tutorial against a training dummy. */
export class Tutorial {
  step = 0;
  active = false;
  private progress = 0;
  private doneTimer = 0;
  private dodges = 0;
  private bound = false;

  constructor(private pad: DrawPad, private menus: Menus, private onFinish: () => void) {}

  start(w: World): void {
    this.active = true;
    this.step = 0;
    this.progress = 0;
    this.doneTimer = 0;
    this.dodges = 0;
    w.spawnDummy(w.player.x + 220);
    this.show(w);
    if (this.bound) return;
    this.bound = true;
    w.events.on('hit', (e) => {
      if (!this.active || this.doneTimer > 0) return;
      const m = e.move;
      switch (this.step) {
        case 0: if (m && (m.family === 'jab' || m.id === 'backfist')) this.advance(); break;
        case 1: if (e.kind === 'launch') this.advance(); break;
        case 2: if (m && m.tags.includes('air') && !m.spike) { if (++this.progress >= 3) this.advance(); } break;
        case 3: if (m && m.spike) this.advance(); break;
      }
    });
    w.events.on('parry', () => { if (this.active && this.step === 4 && this.doneTimer === 0) this.advance(); });
    w.events.on('dodge', () => { if (this.active && this.step === 4) { this.dodges++; if (this.dodges >= 6 && this.doneTimer === 0) this.advance(); } });
  }

  private advance(): void {
    audio.ui('select');
    this.doneTimer = 0.7;
    this.menus.tutorialText('NICE!', '', this.textTop(), () => this.finish());
  }

  private textTop(): number { return layout.portrait ? layout.world.y + layout.world.h * 0.05 : layout.world.y + layout.world.h * 0.16; }

  private show(w: World): void {
    const s = STEPS[this.step];
    this.pad.hint = s.hint;
    this.pad.hintLabel = s.label;
    w.dummyAttacks = !!s.dummyAttacks;
    this.menus.tutorialText(s.text, s.sub, this.textTop(), () => this.finish());
  }

  update(w: World, dt: number): void {
    if (!this.active) return;
    // Keep the dummy alive and near the player.
    for (const e of w.enemies) {
      if (e.kind === 'dummy') { if (e.hp < 1000) e.hp = e.maxHp; }
    }
    if (this.step === 5 && this.doneTimer === 0 && w.combo.hits >= 10) this.advance();
    if (this.doneTimer > 0) {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) {
        this.doneTimer = 0;
        this.step++;
        this.progress = 0;
        if (this.step >= STEPS.length) { this.finish(); return; }
        this.show(w);
      }
    }
  }

  finish(): void {
    if (!this.active) return;
    this.active = false;
    this.pad.hint = -1;
    this.pad.hintLabel = '';
    this.menus.close('tutorial');
    this.onFinish();
  }
}
