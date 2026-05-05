import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

export type BadgeVariant =
  | 'accent' | 'danger' | 'warn' | 'rest'
  | 'neutral' | 'current' | 'completed' | 'missed' | 'upcoming';

interface Props {
  label:    string;
  variant?: BadgeVariant;
  size?:    'xs' | 'sm';
}

// All variants updated to iOS-blue palette (no purple)
const V: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  accent:    { bg: 'rgba(10,132,255,0.15)',  text: COLORS.accent,        border: 'rgba(10,132,255,0.32)'  },
  current:   { bg: 'rgba(10,132,255,0.20)',  text: COLORS.accentHigh,    border: 'rgba(10,132,255,0.42)'  },
  completed: { bg: 'rgba(10,132,255,0.11)',  text: COLORS.accent,        border: 'rgba(10,132,255,0.24)'  },
  danger:    { bg: 'rgba(255,69,58,0.15)',   text: COLORS.danger,        border: 'rgba(255,69,58,0.32)'   },
  missed:    { bg: 'rgba(255,69,58,0.15)',   text: COLORS.danger,        border: 'rgba(255,69,58,0.32)'   },
  warn:      { bg: 'rgba(255,214,10,0.14)',  text: COLORS.warning,       border: 'rgba(255,214,10,0.30)'  },
  rest:      { bg: 'rgba(100,210,255,0.14)', text: COLORS.rest,          border: 'rgba(100,210,255,0.30)' },
  neutral:   { bg: 'rgba(255,255,255,0.07)', text: COLORS.textSecondary, border: 'rgba(255,255,255,0.12)' },
  upcoming:  { bg: 'rgba(255,255,255,0.05)', text: COLORS.textMuted,     border: 'rgba(255,255,255,0.09)' },
};

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

const styles = StyleSheet.create({
  badge: { borderRadius: 5, borderWidth: 1, alignSelf: 'flex-start' },
  text:  { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
