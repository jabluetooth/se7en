import { useSettingsStore } from '../stores/settingsStore';
import { COLORS } from '../constants';

export function useTheme() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const dark = theme === 'dark';

  return {
    dark,
    colors: {
      background: dark ? COLORS.background : COLORS.lightBackground,
      surface: dark ? COLORS.surface : COLORS.lightSurface,
      surfaceElevated: dark ? COLORS.surfaceElevated : COLORS.lightSurfaceElevated,
      border: dark ? COLORS.border : COLORS.lightBorder,
      accent: COLORS.accent,
      accentDim: COLORS.accentDim,
      text: dark ? COLORS.text : COLORS.lightText,
      textSecondary: dark ? COLORS.textSecondary : COLORS.lightTextSecondary,
      textMuted: dark ? COLORS.textMuted : COLORS.lightTextMuted,
      danger: COLORS.danger,
      warning: COLORS.warning,
      success: COLORS.success,
    },
  };
}
