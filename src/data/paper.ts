/** Paper world (revision pass 6): pages, doodles, page details, transitions. */
export type PageId = 'blank' | 'lined' | 'graph' | 'sketch' | 'kraft';

export const PAGES: { id: PageId; name: string }[] = [
  { id: 'blank', name: 'Blank Page' },
  { id: 'lined', name: 'Lined Notebook' },
  { id: 'graph', name: 'Graph Paper' },
  { id: 'sketch', name: 'Sketchbook' },
  { id: 'kraft', name: 'Kraft Paper (boss waves)' },
];
/** Page rotation by wave (boss waves use kraft). */
export const PAGE_ORDER: PageId[] = ['blank', 'lined', 'graph', 'sketch'];

export const PAPER = {
  /** Paper colours. */
  paper: { blank: '#fbf8f0', lined: '#fdfbf3', graph: '#fafbf6', sketch: '#f5eedb', kraft: '#c9a878' } as Record<PageId, string>,
  /** Pencil / pen colours (the UI palette too). */
  ink: '#1b1a17',
  pencil: '#7d7a73',
  blue: '#2f55c8',
  red: '#d42a2a',
  highlighter: '#ffe94d',
  /** Background doodle opacity (they must never fight the fighters) and stroke width (css px). */
  doodleAlpha: 0.36,
  doodleWidth: 1.3,
  /** Fiber texture: strokes per 100x100 css px, grain alpha, edge vignette strength. */
  fibers: 7,
  grain: 0.035,
  vignette: 0.1,
  /** No doodles from this far above the floor to this far below it (fraction of screen height). */
  cleanAbove: 0.3,
  cleanBelow: 1,
  /** Line boil: baked variants and how often a new one is shown. */
  boilVariants: 3,
  boilFps: 7,
  /** Ruled lines / grid spacing (css px). */
  ruleGap: 30,
  gridGap: 24,
  /** Wave transitions (s), stepped at this rate. */
  flipSec: 0.55,
  clearedSec: 0.9,
  crumpleSec: 0.85,
  transitionFps: 12,
} as const;
