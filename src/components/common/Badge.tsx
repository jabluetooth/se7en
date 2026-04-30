import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BORDER_RADIUS, SPACING } from '../../constants';

interface Props {
  label: string;
  color?: string;
  textColor?: string;
}

export function Badge({ label, color, textColor }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: color ?? colors.accentDim }]}>
      <Text style={[styles.text, { color: textColor ?? colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
