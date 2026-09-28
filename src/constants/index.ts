// ─── Se7en · Design tokens ───────────────────────────────────────────────
// Clean athletic system: neutral greys, one orange accent, flat surfaces,
// Inter throughout. COLORS and GRAD are LIVE: theme/runtime.ts copies the
// active palette (dark or light, see theme/palettes.ts) into them, so read
// them at render time (or inside themed() styles), never cache a value in a
// module-level constant.
import { DARK, type Palette } from '../theme/palettes';
import { registerLiveTokens } from '../theme/runtime';

type Stops = readonly [string, string, ...string[]];

export const GRAD: {
  accent: Stops; accentSoft: Stops; danger: Stops; warn: Stops; bg: Stops; progress: Stops;
  bgLocations: readonly [number, number, ...number[]];
  bgStart: { x: number; y: number };
  bgEnd: { x: number; y: number };
} = {
  accent:      [DARK.accent, DARK.accent],
  accentSoft:  ['rgba(255,122,26,0.14)', 'rgba(255,122,26,0.08)'],
  danger:      [DARK.danger, DARK.danger],
  warn:        [DARK.warning, DARK.warning],
  bg:          [DARK.background, DARK.background, DARK.background, DARK.background],
  bgLocations: [0, 0.30, 0.65, 1],
  bgStart:     { x: 0.3, y: 0 },
  bgEnd:       { x: 0.7, y: 1 },
  progress:    [DARK.accent, DARK.accent],
};

export const COLORS: Palette = { ...DARK };

registerLiveTokens(COLORS as unknown as Record<string, string>, GRAD as unknown as Record<string, unknown>);

export const BAR_WEIGHTS: Record<string, number> = {
  barbell:  20,
  ezbar:    10,
  smith:    15,
  dumbbell: 0,
  none:     0,
};

// Standard bar weights in pounds (a 20 kg Olympic bar is sold as 45 lb).
export const BAR_WEIGHTS_LB: Record<string, number> = {
  barbell:  45,
  ezbar:    25,
  smith:    35,
  dumbbell: 0,
  none:     0,
};

export const DEFAULT_METRIC_PLATES   = [20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

export const SET_TYPE_LABELS: Record<string, string> = {
  standard:    'Standard',
  repRange:    'Rep Range',
  toFailure:   'To Failure',
  superset:    'Superset',
  dropSet:     'Drop Set',
  pyramid:     'Pyramid',
  progressive: 'Progressive',
};

export const SET_TYPE_VARIANTS: Record<string, string> = {
  standard:    'neutral',
  repRange:    'neutral',
  toFailure:   'danger',
  superset:    'rest',
  dropSet:     'warn',
  pyramid:     'warn',
  progressive: 'accent',
};

export const DAY_STATUS_ICONS = {
  completed: '✓',
  missed:    '✗',
  rest:      '·',
  current:   '●',
  upcoming:  '○',
};

// Cycle-day colour map — shared by ContributionHeatmap and HighlightSlideshow
// so the calendar heat-cells and the highlight slideshow ring stay in sync.
// Day positions are 1-indexed (1–7).
// Cycle-day colour, shared by the heatmap and highlight cards. It used to
// be a rainbow (one hue per day); the clean look uses the accent for every
// day, so colour means "trained" rather than "which day". Resolved at read
// time so it follows the active theme.
export const DAY_COLOR: Record<number, string> = new Proxy({} as Record<number, string>, {
  get: () => COLORS.accent,
});

export const SKIP_REASONS = ['Sick', 'Travel', 'Rest', 'Other'] as const;
export const SPLIT_TYPES  = ['PPL', 'Arnold', 'Upper/Lower', 'Bro Split', 'Full Body', 'Custom'];

// ─── Muscle-group tags ────────────────────────────────────────
export const MUSCLE_TAGS = [
  // General groups
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Cardio', 'Full Body',
  // Chest specifics
  'Upper Chest', 'Mid Chest', 'Lower Chest', 'Inner Chest',
  // Back specifics
  'Lats', 'Upper Back', 'Lower Back', 'Rhomboids',
  // Shoulder specifics
  'Front Delt', 'Side Delt', 'Rear Delt',
  // Arm specifics
  'Long Head', 'Short Head', 'Lateral Head', 'Medial Head', 'Brachialis',
  // Core specifics
  'Abs', 'Obliques', 'Hip Flexors',
] as const;

export type MuscleTag = typeof MUSCLE_TAGS[number];

// Foreground color for each tag (badge text + border tint)
// Muscle-tag chip colour. Every tag used to have its own hue, which made
// lists noisy; tags are now quiet neutral chips in the active theme. (A
// 6-digit hex, because callers append a hex alpha like `color + '22'`.)
export const MUSCLE_TAG_COLOR: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: () => COLORS.textMuted,
});

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  xxl:  24,
  full: 999,
};

export const DOCK_HEIGHT              = 72;
export const ANALYTICS_DEFAULT_DAYS  = 14;
export const MAX_BACKUPS             = 7;

// Inter everywhere: one clean UI family. Weight carries the hierarchy
// (700 display and big numbers, 600 headings and labels, 500/400 text).
// The data* aliases are kept so existing call sites read naturally; pair
// them with fontVariant: ['tabular-nums'] so digits don't jiggle.
// Archivo (tight, athletic) for titles and numbers; Inter for everything you read.
export const FONTS = {
  hero:     'Archivo_800ExtraBold',
  display:  'Archivo_700Bold',
  headline: 'Inter_600SemiBold',
  label:    'Inter_600SemiBold',
  semibold: 'Inter_600SemiBold',
  medium:   'Inter_500Medium',
  body:     'Inter_400Regular',
  data:     'Archivo_700Bold',
  dataBold: 'Inter_600SemiBold',
  dataSub:  'Inter_400Regular',
} as const;
