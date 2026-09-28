import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, FONTS } from '../../../constants';
import type { Gain } from '../../../utils/progressInsights';
import { accentA, themed } from '../../../theme/runtime';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

interface Props {
  gain:        Gain | null;
  periodLabel: string;
  width:       number;
}

const H = 64;
const PAD = 5;

/**
 * The headline of Progress: the lift that improved most in the chosen
 * window, as a number and a small chart of its top sets.
 */
export function GainCard({ gain, periodLabel, width }: Props) {
  const chartW = Math.max(120, width - 32);

  const paths = useMemo(() => {
    if (!gain || gain.series.length < 2) return null;
    const min = Math.min(...gain.series);
    const max = Math.max(...gain.series);
    const span = max - min || 1;
    const pts = gain.series.map((v, i) => ({
      x: PAD + (i / (gain.series.length - 1)) * (chartW - PAD * 2),
      y: PAD + (1 - (v - min) / span) * (H - PAD * 2),
    }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
    return { line, area, end: pts[pts.length - 1] };
  }, [gain, chartW]);

  if (!gain) {
    return (
      <View style={s.card}>
        <Text style={s.eyebrow}>Biggest gain · {periodLabel.toLowerCase()}</Text>
        <Text style={s.emptyTitle}>No new top sets yet</Text>
        <Text style={s.sub}>Beat a previous top set on any lift and it shows up here.</Text>
      </View>
    );
  }

  const diff = gain.to - gain.from;
  return (
    <View
      style={s.card}
      accessible
      accessibilityLabel={`Biggest gain: ${gain.exerciseName}, up ${fmt(diff)} ${gain.unit}, from ${fmt(gain.from)} to ${fmt(gain.to)}`}
    >
      <Text style={s.eyebrow} numberOfLines={1}>Biggest gain · {gain.exerciseName}</Text>
      <Text style={s.big}>+{fmt(diff)} <Text style={s.bigUnit}>{gain.unit}</Text></Text>
      <Text style={s.sub}>Top set {fmt(gain.from)} → {fmt(gain.to)} {gain.unit}</Text>
      {paths && (
        <Svg width={chartW} height={H} style={s.chart}>
          <Path d={paths.area} fill={accentA(0.14)} />
          <Path d={paths.line} fill="none" stroke={COLORS.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={paths.end.x} cy={paths.end.y} r={4.5} fill={COLORS.accent} />
        </Svg>
      )}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  card:       {
    padding: 16, borderRadius: 22, gap: 4,
    backgroundColor: COLORS.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: COLORS.border,
  },
  eyebrow:    { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  big:        { fontSize: 48, lineHeight: 52, fontFamily: FONTS.hero, color: COLORS.accent, letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  bigUnit:    { fontSize: 20, fontFamily: FONTS.display, letterSpacing: 0 },
  sub:        { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.display, color: COLORS.text, marginTop: 2 },
  chart:      { marginTop: 12 },
}));
