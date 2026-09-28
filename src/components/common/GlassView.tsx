import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS } from '../../constants';
import { currentTheme } from '../../theme/runtime';

interface Props {
  children?:    React.ReactNode;
  style?:       StyleProp<ViewStyle>;
  /** Kept for compatibility: 'high' reads as a slightly raised surface. */
  opacity?:     'low' | 'mid' | 'high';
  radius?:      number;
  borderColor?: string;
  /** Kept for compatibility: now just a slightly stronger border, no glow. */
  glow?:        boolean;
}

/**
 * The app's card surface. Once a frosted "liquid glass" layer (blur, tint,
 * sheen, rim lights); now a flat card — solid surface, hairline border, soft
 * shadow on dark only — as part of the clean athletic look. The name and
 * props are unchanged so every existing call site keeps working, in either
 * theme.
 */
export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  const dark = currentTheme() === 'dark';
  return (
    <View
      style={[
        s.card,
        {
          borderRadius: radius,
          backgroundColor: opacity === 'high' ? COLORS.surfaceElevated : COLORS.surface,
          borderColor: borderColor ?? (glow ? COLORS.accentGlow : COLORS.border),
        },
        dark ? s.shadowDark : s.shadowLight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  shadowDark: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14 },
    default: { elevation: 2 },
  }) as ViewStyle,
  shadowLight: Platform.select({
    ios:     { shadowColor: '#1B1F24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
    default: { elevation: 1 },
  }) as ViewStyle,
});
