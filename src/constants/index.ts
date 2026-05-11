// ─── Se7en · Apple-style Design System ───────────────────────
// Accent: iOS System Blue · Background: near-black with subtle cool tint

export const GRAD = {
  // Primary CTA — iOS blue, short two-stop gradient (not a rainbow)
  accent:      ['#0A84FF', '#409CFF'] as const,
  // Soft fill for backgrounds / subtle highlights
  accentSoft:  ['rgba(10,132,255,0.16)', 'rgba(64,156,255,0.08)'] as const,
  // Danger
  danger:      ['#FF453A', '#FF3B30'] as const,
  // Warning
  warn:        ['#FFD60A', '#FF9F0A'] as const,
  // App background — near-black with barely-perceptible cool-blue depth
  bg:          ['#08090F', '#070A13', '#060B15', '#070A13'] as const,
  bgLocations: [0, 0.30, 0.65, 1] as const,
  bgStart:     { x: 0.3, y: 0 } as const,
  bgEnd:       { x: 0.7, y: 1 } as const,
  // Progress bars / rings — stays in the blue family
  progress:    ['#0A84FF', '#409CFF'] as const,
};

export const COLORS = {
  // ── Backgrounds ───────────────────────────────────────────
  background:           '#000000',       // true black (OLED)
  surface:              '#1C1C1E',       // iOS secondary background (dark)
  surfaceElevated:      '#2C2C2E',       // iOS tertiary background (dark)
  border:               '#38383A',       // iOS separator (dark)
  borderFaint:          '#2C2C2E',

  // ── Text — tuned for #020617 dark background ─────────────
  text:                 '#FFFFFF',
  textSecondary:        '#DADADF',       // bright secondary — readable on very dark bg
  textMuted:            '#AEAEB2',       // iOS secondary label — visible at small sizes
  textLabel:            '#8E8E93',       // iOS tertiary label — captions/version text

  // ── Accent — iOS System Blue (dark mode) ──────────────────
  accent:               '#0A84FF',
  accentHigh:           '#409CFF',       // lighter blue for gradient end
  accentDim:            '#0A3F7A',       // dark blue tint for backgrounds

  // ── Semantic ──────────────────────────────────────────────
  danger:               '#FF453A',       // iOS Red (dark)
  dangerDim:            '#3A0F0D',
  warning:              '#FFD60A',       // iOS Yellow (dark)
  warningDim:           '#3A2E00',
  rest:                 '#64D2FF',       // iOS Cyan (dark) — rest timer

  // ── Gradient aliases ──────────────────────────────────────
  gradientStart:        '#0A84FF',
  gradientEnd:          '#409CFF',

  // ── Misc ──────────────────────────────────────────────────
  white:                '#FFFFFF',
  black:                '#000000',

  // ── Glass surfaces — tuned for #020617 dark background ───
  glass06:              'rgba(255,255,255,0.09)',
  glass09:              'rgba(255,255,255,0.13)',
  glassBorder:          'rgba(255,255,255,0.18)',
  glassBorderHi:        'rgba(255,255,255,0.28)',
  // Subtle blue glow (replaces purple glow)
  accentGlow:           'rgba(10,132,255,0.30)',

  // ── Light theme (unchanged structurally) ──────────────────
  lightBackground:      '#F2F2F7',       // iOS system background
  lightSurface:         '#FFFFFF',
  lightSurfaceElevated: '#F2F2F7',
  lightBorder:          '#C6C6C8',
  lightText:            '#000000',
  lightTextSecondary:   '#6D6D72',
  lightTextMuted:       '#AEAEB2',
};

export const BAR_WEIGHTS: Record<string, number> = {
  barbell:  20,
  ezbar:    10,
  smith:    15,
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
export const MUSCLE_TAG_COLOR: Record<string, string> = {
  // General
  'Chest':       '#FF6B6B',
  'Back':        '#4ECDC4',
  'Shoulders':   '#FFD93D',
  'Biceps':      '#6BCB77',
  'Triceps':     '#409CFF',
  'Forearms':    '#C084FC',
  'Core':        '#FF9F43',
  'Quads':       '#48CAE4',
  'Hamstrings':  '#2EC4B6',
  'Glutes':      '#F472B6',
  'Calves':      '#94A3B8',
  'Cardio':      '#FB7185',
  'Full Body':   '#A78BFA',
  // Chest specifics (red family)
  'Upper Chest': '#FF8E8E',
  'Mid Chest':   '#FF5C5C',
  'Lower Chest': '#E03C3C',
  'Inner Chest': '#FFB3B3',
  // Back specifics (teal family)
  'Lats':        '#4ECDC4',
  'Upper Back':  '#38BDB5',
  'Lower Back':  '#26A69A',
  'Rhomboids':   '#6DDDD6',
  // Shoulder specifics (yellow family)
  'Front Delt':  '#FFB347',
  'Side Delt':   '#FFD93D',
  'Rear Delt':   '#FFA000',
  // Arm specifics
  'Long Head':   '#9B72F5',
  'Short Head':  '#6BCB77',
  'Lateral Head':'#409CFF',
  'Medial Head': '#1E88E5',
  'Brachialis':  '#7CB9A8',
  // Core specifics (orange family)
  'Abs':         '#FF9F43',
  'Obliques':    '#FF7043',
  'Hip Flexors': '#FFCC02',
};

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
export const MAX_BACKUPS              = 7;
