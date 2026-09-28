import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { COLORS, SPACING, FONTS } from '../../constants';
import { themed } from '../../theme/runtime';

interface Props { title: string; actionLabel?: string; onAction?: () => void; }

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={s.row}>
      <Text style={s.title} accessibilityRole="header">{title}</Text>
      {actionLabel ? (
        <AnimatedPressable
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.action}>{actionLabel}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { fontSize: 12, fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0 },
  action:{ fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.accent },
}));