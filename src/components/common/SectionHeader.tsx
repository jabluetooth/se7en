import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants';

interface Props { title: string; actionLabel?: string; onAction?: () => void; }

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {actionLabel ? <TouchableOpacity onPress={onAction}><Text style={s.action}>{actionLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.7, textTransform: 'uppercase' },
  action:{ fontSize: 13, fontWeight: '600', color: COLORS.accent },
});