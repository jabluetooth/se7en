import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../constants';
import { accentA, dangerA, ink, restA, themed } from '../../theme/runtime';

export type BadgeVariant =
  | 'accent' | 'danger' | 'warn' | 'rest'
  | 'neutral' | 'current' | 'completed' | 'missed' | 'upcoming';

interface Props {
  label:    string;
  variant?: BadgeVariant;
  size?:    'xs' | 'sm';
}

// Rebuilt per theme (themed) so the tints follow light/dark.
const V = themed((): Record<BadgeVariant, { bg: string; text: string; border: string }> => ({
  accent:    { bg: accentA(0.15),  text: COLORS.accent,        border: accentA(0.32)  },
  current:   { bg: accentA(0.2),  text: COLORS.accentHigh,    border: accentA(0.42)  },
  completed: { bg: accentA(0.12), text: COLORS.accent,        border: accentA(0.3)   },
  danger:    { bg: dangerA(0.15),   text: COLORS.danger,        border: dangerA(0.32)   },
  missed:    { bg: dangerA(0.15),   text: COLORS.danger,        border: dangerA(0.32)   },
  warn:      { bg: ink(0.06),     text: COLORS.warning,       border: ink(0.12)      },
  rest:      { bg: restA(0.12),   text: COLORS.rest,          border: restA(0.3)     },
  neutral:   { bg: ink(0.07), text: COLORS.textSecondary, border: ink(0.12) },
  upcoming:  { bg: ink(0.05), text: COLORS.textMuted,     border: ink(0.09) },
}));

export function Badge({ label, variant = 'accent', size = 'sm' }: Props) {
  const v  = V[variant];
  const xs = size === 'xs';
  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: v.bg,
        borderColor:     v.border,
        paddingHorizontal: xs ? 7 : 9,
        paddingVertical:   xs ? 2 : 4,
      },
    ]}>
      <Text style={[styles.text, { color: v.text, fontSize: xs ? 10 : 12 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  badge: { borderRadius: 5, borderWidth: 1, alignSelf: 'flex-start' },
  text:  { fontFamily: FONTS.label, letterSpacing: 0 },
}));
