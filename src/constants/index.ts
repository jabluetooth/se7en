export const COLORS = {
  background: '#0d0d0f',
  surface: '#1a1a1f',
  surfaceElevated: '#242429',
  border: '#2a2a32',
  accent: '#39ff8c',       // accent green
  accentDim: '#1a5c3d',
  text: '#f0f0f4',
  textSecondary: '#8a8a9a',
  textMuted: '#4a4a58',
  danger: '#ff4d4d',
  warning: '#ffb84d',
  success: '#39ff8c',
  white: '#ffffff',
  black: '#000000',
  // Light theme overrides applied at runtime
  lightBackground: '#f5f5f7',
  lightSurface: '#ffffff',
  lightSurfaceElevated: '#f0f0f2',
  lightBorder: '#d0d0d8',
  lightText: '#0d0d0f',
  lightTextSecondary: '#5a5a6a',
  lightTextMuted: '#9a9aaa',
};

export const BAR_WEIGHTS: Record<string, number> = {
  barbell: 20,
  ezbar: 10,
  smith: 15,
  dumbbell: 0,
  none: 0,
};

export const DEFAULT_METRIC_PLATES = [20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

export const SET_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  repRange: 'Rep Range',
  toFailure: 'To Failure',
  superset: 'Superset',
  dropSet: 'Drop Set',
  pyramid: 'Pyramid',
  progressive: 'Progressive',
};

export const DAY_STATUS_ICONS = {
  completed: '✅',
  missed: '❌',
  rest: '💤',
  current: '🔵',
  upcoming: '⬜',
};

export const SKIP_REASONS = ['Sick', 'Travel', 'Rest', 'Other'] as const;

export const SPLIT_TYPES = ['PPL', 'Arnold', 'Upper/Lower', 'Bro Split', 'Full Body', 'Custom'];

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const DOCK_HEIGHT = 72;
export const ANALYTICS_DEFAULT_DAYS = 14;
export const MAX_BACKUPS = 7;
