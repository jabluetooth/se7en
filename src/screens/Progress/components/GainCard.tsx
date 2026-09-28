import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../../../constants';
import type { Gain } from '../../../utils/progressInsights';
import { themed } from '../../../theme/runtime';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

interface Props {
  gain:  Gain | null;
  width: number;
}

const H = 70;
const PAD_X = 34;
const PAD_Y = 12;

/**
 * The lift that improved most: its name, the gain as one big number, and its
 * top sets as a line labelled only at the start and the end.
 */
export function GainCard({ gain, width }: Props) {
  const geo = useMemo(() => {
    if (!gain || gain.series.length < 2) return null;
    const min = Math.min(...gain.series), max = Math.max(...gain.series);
    const span = max - min || 1;
    const innerW = width - PAD_X * 2;
    const pts = gain.series.map((v, i) => ({
      x: PAD_X + (i / (gain.series.length - 1)) * innerW,
      y: PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2),
    }));
    return { pts, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') };
  }, [gain, width]);

  if (!gain) {
    return <Text style={s.empty}>No new top sets in this period yet.</Text>;
  }

  const first = geo?.pts[0];
  const last = geo?.pts[geo.pts.length - 1];
  return (
    <View
      style={s.wrap}
      accessible
      accessibilityLabel={`${gain.exerciseName}, up ${fmt(gain.to - gain.from)} ${gain.unit}, from ${fmt(gain.from)} to ${fmt(gain.to)}`}
    >
      <View style={s.head}>
        <Text style={s.name} numberOfLines={1}>{gain.exerciseName}</Text>
        <Text style={s.big}>+{fmt(gain.to - gain.from)}<Text style={s.unit}> {gain.unit}</Text></Text>
      </View>
      {geo && first && last && (
        <Svg width={width} height={H}>
          <Path d={geo.d} fill="none" stroke={COLORS.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={first.x} cy={first.y} r={3.5} fill={COLORS.textMuted} />
          <SvgText x={first.x - 8} y={first.y + 4} fontSize={12} fontFamily={FONTS.display} fill={COLORS.textMuted} textAnchor="end">
            {fmt(gain.from)}
          </SvgText>
          <Circle cx={last.x} cy={last.y} r={4.5} fill={COLORS.accent} />
          <SvgText x={last.x + 8} y={last.y + 4} fontSize={13} fontFamily={FONTS.display} fill={COLORS.accent} textAnchor="start">
            {fmt(gain.to)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap:  { gap: 6 },
  head:  { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  name:  { flex: 1, fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  big:   { fontSize: 34, lineHeight: 38, fontFamily: FONTS.hero, color: COLORS.accent, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  unit:  { fontSize: 15, fontFamily: FONTS.display, letterSpacing: 0 },
  empty: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted },
}));
