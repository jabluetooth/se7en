// ─── Se7en · Obsidian + Ember Design System ──────────────
// Accent: Amber-Orange · Background: warm near-black obsidian

export const GRAD = {
  accent:      ['#FF8C00', '#FFA940'] as const,
  accentSoft:  ['rgba(255,140,0,0.16)', 'rgba(255,169,64,0.08)'] as const,
  danger:      ['#FF453A', '#FF3B30'] as const,
  warn:        ['#FFD60A', '#FF9F0A'] as const,
  // Background — near-black with warm obsidian undertone
  bg:          ['#0C0A08', '#0F0C09', '#0D0B08', '#0F0C09'] as const,
  bgLocations: [0, 0.30, 0.65, 1] as const,
  bgStart:     { x: 0.3, y: 0 } as const,
  bgEnd:       { x: 0.7, y: 1 } as const,
  progress:    ['#FF8C00', '#FFA940'] as const,
};

export const COLORS = {
  // ── Backgrounds ───────────────────────────────────────────
  background:           '#0C0A08',
  surface:              '#1A1510',
  surfaceElevated:      '#221C15',
  border:               '#3A3028',
  borderFaint:          '#2A2218',

  // ── Text — warm off-white family ─────────────────────────
  text:                 '#FFF8F0',
  textSecondary:        '#E8DDD0',
  textMuted:            '#B8A898',
  textLabel:            '#8A7A6A',

  // ── Accent — Ember (amber-orange) ─────────────────────────
  accent:               '#FF8C00',
  accentHigh:           '#FFA940',
  accentDim:            '#3D1A00',

  // ── Semantic ──────────────────────────────────────────────
  danger:               '#FF453A',
  dangerDim:            '#3A0F0D',
  warning:              '#FFD60A',
  warningDim:           '#3A2E00',
  rest:                 '#64D2FF',

  // ── Gradient aliases ──────────────────────────────────────
  gradientStart:        '#FF8C00',
  gradientEnd:          '#FFA940',

  // ── Misc ──────────────────────────────────────────────────
  white:                '#FFF8F0',
  black:                '#0C0A08',

  // ── Glass surfaces — warm-tinted white on obsidian ────────
  glass06:              'rgba(255,240,220,0.08)',
  glass09:              'rgba(255,240,220,0.12)',
  glassBorder:          'rgba(255,240,220,0.16)',
  glassBorderHi:        'rgba(255,240,220,0.26)',
  accentGlow:           'rgba(255,140,0,0.28)',

  // ── Light theme (unchanged) ───────────────────────────────
  lightBackground:      '#F2F2F7',
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
  'Triceps':     '#60A5FA',  // sky blue — distinct from amber accent
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
  'Lateral Head':'#60A5FA',  // sky blue
  'Medial Head': '#3B82F6',  // standard blue
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
export const MAX_BACKUPS             = 7;
