import { useSettingsStore } from '../stores/settingsStore';
import { COLORS, GRAD } from '../constants';

export function useTheme() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const dark = theme === 'dark';

  return {
    dark,
    grad: GRAD,
    colors: {
      background:       dark ? COLORS.background       : COLORS.lightBackground,
      surface:          dark ? COLORS.surface          : COLORS.lightSurface,
      surfaceElevated:  dark ? COLORS.surfaceElevated  : COLORS.lightSurfaceElevated,
      border:           dark ? COLORS.border           : COLORS.lightBorder,
      borderFaint:      dark ? COLORS.borderFaint      : COLORS.lightBorder,
      text:             dark ? COLORS.text             : COLORS.lightText,
      textSecondary:    dark ? COLORS.textSecondary    : COLORS.lightTextSecondary,
      textMuted:        dark ? COLORS.textMuted        : COLORS.lightTextMuted,
      accent:           COLORS.accent,
      accentDim:        COLORS.accentDim,
      gradientStart:    COLORS.gradientStart,
      gradientEnd:      COLORS.gradientEnd,
      danger:           COLORS.danger,
      dangerDim:        COLORS.dangerDim,
      warning:          COLORS.warning,
      warningDim:       COLORS.warningDim,
      rest:             COLORS.rest,
      glass06:          dark ? COLORS.glass06          : 'rgba(0,0,0,0.04)',
      glass09:          dark ? COLORS.glass09          : 'rgba(0,0,0,0.06)',
      glassBorder:      dark ? COLORS.glassBorder      : 'rgba(0,0,0,0.10)',
      accentGlow:       COLORS.accentGlow,
    },
  };
}
