// ─── Se7en · Palettes ─────────────────────────────────────────────────────
// Clean athletic look: neutral greys, one orange accent, flat surfaces.
// Both palettes share every key, so any screen works in either theme.
//
// `ink` is the colour that subtle overlays are mixed from: white-based tints
// on dark, near-black tints on light (see theme/runtime.ts → ink()).

export type ThemeName = 'dark' | 'light';

export interface Palette {
  background:      string;
  surface:         string;
  surfaceElevated: string;
  border:          string;
  borderFaint:     string;

  text:            string;
  textSecondary:   string;
  textMuted:       string;
  textLabel:       string;

  accent:          string;
  accentHigh:      string;
  accentDim:       string;
  /** Text/icons drawn on a solid accent fill. */
  onAccent:        string;

  danger:          string;
  dangerDim:       string;
  warning:         string;
  warningDim:      string;
  success:         string;
  rest:            string;

  gradientStart:   string;
  gradientEnd:     string;
  white:           string;
  black:           string;

  glass06:         string;
  glass09:         string;
  glassBorder:     string;
  glassBorderHi:   string;
  accentGlow:      string;

  /** RGB triplets used by the tint helpers. */
  inkRgb:          string;
  accentRgb:       string;
  restRgb:         string;
  dangerRgb:       string;
}

export const DARK: Palette = {
  background:      '#0E0F11',
  surface:         '#17191C',
  surfaceElevated: '#1F2226',
  border:          '#2C3035',
  borderFaint:     '#22252A',

  text:            '#F4F5F7',
  textSecondary:   '#C8CBD0',
  textMuted:       '#9297A0',
  textLabel:       '#6F747D',

  accent:          '#FF7A1A',
  accentHigh:      '#FF9A4D',
  accentDim:       '#3A2210',
  onAccent:        '#111214',

  danger:          '#FF453A',
  dangerDim:       '#3A1412',
  warning:         '#FFCC00',
  warningDim:      '#3A3000',
  success:         '#30D158',
  rest:            '#5AC8FA',

  gradientStart:   '#FF7A1A',
  gradientEnd:     '#FF7A1A',
  white:           '#FFFFFF',
  black:           '#0E0F11',

  glass06:         'rgba(255,255,255,0.05)',
  glass09:         'rgba(255,255,255,0.08)',
  glassBorder:     'rgba(255,255,255,0.10)',
  glassBorderHi:   'rgba(255,255,255,0.16)',
  accentGlow:      'rgba(255,122,26,0.25)',

  inkRgb:          '255,255,255',
  accentRgb:       '255,122,26',
  restRgb:         '90,200,250',
  dangerRgb:       '255,69,58',
};

export const LIGHT: Palette = {
  background:      '#F4F5F7',
  surface:         '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border:          '#DFE2E6',
  borderFaint:     '#ECEEF1',

  text:            '#111316',
  textSecondary:   '#3D4148',
  textMuted:       '#666B74',
  textLabel:       '#8A8F98',

  accent:          '#F26B0F',
  accentHigh:      '#FF8A33',
  accentDim:       '#FDE7D6',
  onAccent:        '#111214',

  danger:          '#D92D20',
  dangerDim:       '#FDE3E1',
  warning:         '#B87800',
  warningDim:      '#FFF3CC',
  success:         '#1E9E48',
  rest:            '#0A84C6',

  gradientStart:   '#F26B0F',
  gradientEnd:     '#F26B0F',
  white:           '#FFFFFF',
  black:           '#111316',

  glass06:         'rgba(17,19,22,0.04)',
  glass09:         'rgba(17,19,22,0.06)',
  glassBorder:     'rgba(17,19,22,0.10)',
  glassBorderHi:   'rgba(17,19,22,0.16)',
  accentGlow:      'rgba(242,107,15,0.18)',

  inkRgb:          '17,19,22',
  accentRgb:       '242,107,15',
  restRgb:         '10,132,198',
  dangerRgb:       '217,45,32',
};

export const PALETTES: Record<ThemeName, Palette> = { dark: DARK, light: LIGHT };
