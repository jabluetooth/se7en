import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassView } from './GlassView';
import { COLORS, FONTS } from '../../constants';

interface Props { label: string; value: string; unit?: string; delta?: number; accent?: boolean; style?: object; }

export function StatCard({ label, value, unit, delta, accent, style }: Props) {
  const isPos = delta !== undefined && delta > 0;
  const isNeg = delta !== undefined && delta < 0;
  return (
    <GlassView style={StyleSheet.flatten([{ flex: 1, padding: 14 }, style]) as any} radius={16}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Text style={[s.value, accent ? s.accent : undefined]}>{value}</Text>
        {unit ? <Text style={s.unit}>{unit}</Text> : null}
      </View>
      {delta !== undefined ? <Text style={[s.delta, { color: isPos ? COLORS.accent : isNeg ? COLORS.danger : COLORS.textMuted }]}>{isPos ? '+' : ''}{delta}</Text> : null}
    </GlassView>
  );
}

const s = StyleSheet.create({
  label:  { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0.80, textTransform: 'uppercase', marginBottom: 5 },
  row:    { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value:  { fontSize: 26, fontWeight: '800', fontFamily: FONTS.data, color: '#fff', letterSpacing: -1.04, lineHeight: 30 },
  accent: { color: COLORS.accent },
  unit:   { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary },
  delta:  { fontSize: 12, fontWeight: '700', fontFamily: FONTS.headline, marginTop: 2 },
});
