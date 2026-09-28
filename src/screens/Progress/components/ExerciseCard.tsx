import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { AnimatedPressable } from '../../../motion/AnimatedPressable';
import { enterFade, layoutSoft } from '../../../motion/presets';
import { COLORS, FONTS } from '../../../constants';
import { fmtDate } from '../../../utils/format';
import type { ExerciseHistory } from '../../../utils/exerciseHistory';
import type { LiftTrend } from '../../../utils/progressInsights';
import { ExpandedChart } from './ExpandedChart';
import { themed } from '../../../theme/runtime';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const unitSuffix = (u: string) => (u === 'kg' || u === 'lb' ? ` ${u}` : u === 'bodyweight' ? '' : ` ${u}`);

interface Props {
  history:    ExerciseHistory;
  trend:      LiftTrend;
  expanded:   boolean;
  onToggle:   () => void;
  chartWidth: number;
}

const SPARK_W = 64;
const SPARK_H = 24;

/**
 * One lift as one line of data: name and latest top set on the left, a
 * small trend line, and the change over the period on the right. Tap to see
 * the full line and the last few workouts. No chips, badges or boxes: an
 * orange end dot means the latest top set is a new best.
 */
export const ExerciseCard = React.memo(function ExerciseCard({ history, trend, expanded, onToggle, chartWidth }: Props) {
  const { weightUnit, isBodyweight, exerciseName, sessions } = history;
  const latest = sessions[sessions.length - 1];
  const topSet = isBodyweight
    ? `${latest.topReps} reps`
    : `${fmt(latest.topWeight)}${unitSuffix(weightUnit)} × ${latest.topReps}`;
  const change = trend.change;
  const changeTxt = change == null || change === 0
    ? '–'
    : `${change > 0 ? '+' : '−'}${fmt(Math.abs(change))}${isBodyweight ? '' : weightUnit === 'kg' || weightUnit === 'lb' ? '' : ` ${weightUnit}`}`;

  return (
    <Animated.View layout={layoutSoft} style={s.wrap}>
      <AnimatedPressable
        scale="subtle"
        dimOnPress
        onPress={onToggle}
        style={s.row}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${exerciseName}. Latest top set ${topSet}${change != null && change !== 0 ? `, ${change > 0 ? 'up' : 'down'} ${fmt(Math.abs(change))} this period` : ''}${trend.isBest ? ', a new best' : ''}.`}
      >
        <View style={s.left}>
          <Text style={s.name} numberOfLines={1}>{exerciseName}</Text>
          <Text style={s.meta} numberOfLines={1}>{topSet} · {fmtDate(trend.lastAt)}</Text>
        </View>
        <Spark data={trend.series} best={trend.isBest} />
        <Text style={[s.change, change != null && change > 0 && { color: COLORS.success }]}>{changeTxt}</Text>
      </AnimatedPressable>

      {expanded && (
        <Animated.View entering={enterFade} style={s.detail}>
          <ExpandedChart sessions={sessions} isBodyweight={isBodyweight} unit={weightUnit} width={chartWidth} />
          {sessions.slice(-4).reverse().map(p => (
            <View key={p.sessionId} style={s.logRow}>
              <Text style={s.logDate}>{fmtDate(p.finishedAt)}</Text>
              <Text style={s.logVal}>
                {isBodyweight ? `${p.topReps} reps` : `${fmt(p.topWeight)}${unitSuffix(weightUnit)} × ${p.topReps}`}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
});

function Spark({ data, best }: { data: number[]; best: boolean }) {
  if (data.length < 2) return <View style={{ width: SPARK_W }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => ({
    x: 3 + (i / (data.length - 1)) * (SPARK_W - 6),
    y: max === min ? SPARK_H / 2 : 3 + (1 - (v - min) / span) * (SPARK_H - 6),
  }));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const end = pts[pts.length - 1];
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Path d={d} fill="none" stroke={COLORS.textLabel} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={end.x} cy={end.y} r={2.8} fill={best ? COLORS.accent : COLORS.textMuted} />
    </Svg>
  );
}

const s = themed(() => StyleSheet.create({
  wrap:    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  left:    { flex: 1, minWidth: 0, gap: 2 },
  name:    { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  meta:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  change:  { width: 52, textAlign: 'right', fontSize: 15, fontFamily: FONTS.display, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  detail:  { paddingBottom: 14, gap: 2 },
  logRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  logDate: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  logVal:  { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text, fontVariant: ['tabular-nums'] },
}));
