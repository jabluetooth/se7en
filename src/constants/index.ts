// ─── Gradient Palette: Violet → Indigo → Cobalt → Teal ─────────────
// Hex approximations of the OKLCH design tokens

export const GRAD = {
  // Main accent gradient (buttons, active states, progress)
  accent:    ['#9035F0', '#7B5EFA', '#4CAAF0', '#2ECAC4'] as const,
  // Soft version for backgrounds / subtle fills
  accentSoft:['rgba(144,53,240,0.18)', 'rgba(123,94,250,0.14)', 'rgba(76,170,240,0.10)', 'rgba(46,202,196,0.08)'] as const,
  // Danger gradient
  danger:    ['#FF5A5A', '#E83535'] as const,
  // Warning gradient
  warn:      ['#F2C044', '#E8A020'] as const,
  // Full screen background
  bg:        ['#0B0814', '#080B18', '#060C16', '#060E14'] as const,
  bgLocations: [0, 0.35, 0.65, 1] as const,
  bgStart:   { x: 0.2, y: 0 } as const,
  bgEnd:     { x: 0.8, y: 1 } as const,
  // Progress bar / ring
  progress:  ['#8B30EE', '#7B5EFA', '#2ECAC4'] as const,
};

export const COLORS = {
  // Dark theme base
  background:       '#0B0814',
  surface:          '#12121F',
  surfaceElevated:  '#1A1A2E',
  border:           '#252540',
  borderFaint:      '#1A1A30',
  // Text
  text:             '#F2F2F6',
  textSecondary:    '#8888A0',
  textMuted:        '#44445A',
  // Accent — electric indigo (mid-gradient point)
  accent:           '#7B5EFA',
  accentDim:        '#3D2E7D',
  // Semantic
  danger:           '#F05050',
  dangerDim:        '#5A1A1A',
  warning:          '#F2B040',
  warningDim:       '#4A3010',
  rest:             '#5B8EC8',
  // Gradient endpoint aliases
  gradientStart:    '#9035F0',
  gradientEnd:      '#2ECAC4',
  // Misc
  white:            '#ffffff',
  black:            '#000000',
  // Glass surfaces
  glass06:          'rgba(255,255,255,0.06)',
  glass09:          'rgba(255,255,255,0.09)',
  glassBorder:      'rgba(255,255,255,0.12)',
  glassBorderHi:    'rgba(255,255,255,0.18)',
  // Accent glow
  accentGlow:       'rgba(123, 94, 250, 0.45)',
  // Light theme overrides
  lightBackground:  '#F0F0FA',
  lightSurface:     '#FFFFFF',
  lightSurfaceElevated: '#EDEDF5',
  lightBorder:      '#D0D0E0',
  lightText:        '#0D0D1A',
  lightTextSecondary:'#55557A',
  lightTextMuted:   '#9A9AB0',
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
  rest:      '💤',
  current:   '●',
  upcoming:  '○',
};

export const SKIP_REASONS = ['Sick', 'Travel', 'Rest', 'Other'] as const;
export const SPLIT_TYPES  = ['PPL', 'Arnold', 'Upper/Lower', 'Bro Split', 'Full Body', 'Custom'];

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

export const DOCK_HEIGHT         = 72;
export const ANALYTICS_DEFAULT_DAYS = 14;
export const MAX_BACKUPS         = 7;
