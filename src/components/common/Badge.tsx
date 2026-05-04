import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../../constants';

export type BadgeVariant =
  | 'accent' | 'danger' | 'warn' | 'rest'
  | 'neutral' | 'current' | 'completed' | 'missed' | 'upcoming';

interface Props {
  label: string;
  variant?: BadgeVariant;
  size?: 'xs' | 'sm';
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  accent:    { bg: 'rgba(123,94,250,0.15)',  text: COLORS.accent,         border: 'rgba(123,94,250,0.30)'  },
  danger:    { bg: 'rgba(240,80,80,0.15)',   text: COLORS.danger,         border: 'rgba(240,80,80,0.30)'   },
  warn:      { bg: 'rgba(242,176,64,0.15)',  text: COLORS.warning,        border: 'rgba(242,176,64,0.30)'  },
  rest:      { bg: 'rgba(91,142,200,0.15)',  text: COLORS.rest,           border: 'rgba(91,142,200,0.30)'  },
  neutral:   { bg: 'rgba(255,255,255,0.08)', text: COLORS.textSecondary,  border: 'rgba(255,255,255,0.12)' },
  current:   { bg: 'rgba(123,94,250,0.20)',  text: COLORS.accent,         border: 'rgba(123,94,250,0.40)'  },
  completed: { bg: 'rgba(123,94,250,0.12)',  text: COLORS.accent,         border: 'rgba(123,94,250,0.25)'  },
  missed:    { bg: 'rgba(240,80,80,0.15)',   text: COLORS.danger,         border: 'rgba(240,80,80,0.30)'   },
  upcoming:  { bg: 'rgba(255,255,255,0.06)', text: COLORS.textMuted,      border: 'rgba(255,255,255,0.10)' },
};

export function Badge({ label, variant = 'accent', size = 'sm' }: Props) {
  const v = VARIANT_STYLES[variant];
  const xs = size === 'xs';
  return (
    <View style={[styles.badge, { backgroundColor: v.bg, borderColor: v.border, paddingHorizontal: xs ? 7 : 9, paddingVertical: xs ? 2 : 4 }]}>
      <Text style={[styles.text, { color: v.text, fontSize: xs ? 10 : 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 5, borderWidth: 1, alignSelf: 'flex-start' },
  text:  { fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
