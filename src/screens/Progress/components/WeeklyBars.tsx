import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../../../constants';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import type { WeekBar } from '../../../utils/progressInsights';
import { ink } from '../../../theme/runtime';

interface Props {
  bars:   WeekBar[];
  /** Planned workouts per week, drawn as a dashed reference line. */
  target: number | null;
  width:  number;
}

const H = 132;
const TOP = 20;      // room for value labels
const BOTTOM = 20;   // room for the two date labels

const md = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Workouts per week as plain columns. Past weeks are grey, this week is
 * orange. Counts sit on top of the columns when there's room; the plan's
 * weekly target is one dashed line, labelled at its end. No grid, no axis
 * numbers: the labels are on the data.
 */
export function WeeklyBars({ bars, target, width }: Props) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = 0;
    grow.value = withTiming(1, { duration: 600, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
  }, [bars.map(b => b.count).join(','), bars.length]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  const n = bars.length;
  const max = Math.max(1, target ?? 0, ...bars.map(b => b.count));
  const innerH = H - TOP - BOTTOM;
  const gap = n > 20 ? 2 : n > 8 ? 4 : 10;
  const barW = Math.max(3, (width - gap * (n - 1)) / n);
  const labelEvery = n <= 13;
  const yOf = (v: number) => TOP + innerH * (1 - v / max);
  const baseY = TOP + innerH;
  const total = bars.reduce((a, b) => a + b.count, 0);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${total} workouts over ${n} weeks${target ? `. Plan target ${fmtTarget(target)} a week` : ''}. This week: ${bars[n - 1]?.count ?? 0}.`}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: H, transformOrigin: 'bottom' }, growStyle]}>
        <Svg width={width} height={H}>
          {bars.map((b, i) => {
            const x = i * (barW + gap);
            const h = b.count > 0 ? Math.max(3, baseY - yOf(b.count)) : 0;
            return (
              <Rect key={b.start} x={x} y={baseY - h} width={barW} height={h} rx={Math.min(4, barW / 2)}
                fill={b.current ? COLORS.accent : ink(0.26)} />
            );
          })}
        </Svg>
      </Animated.View>

      <Svg width={width} height={H}>
        <Line x1={0} y1={baseY + 0.5} x2={width} y2={baseY + 0.5} stroke={COLORS.border} strokeWidth={1} />
        {target != null && target > 0 && (
          <>
            <Line x1={0} y1={yOf(target)} x2={width} y2={yOf(target)} stroke={COLORS.textMuted} strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={width} y={yOf(target) - 5} fontSize={11} fontFamily={FONTS.medium} fill={COLORS.textMuted} textAnchor="end">
              Plan {fmtTarget(target)}/wk
            </SvgText>
          </>
        )}
        {bars.map((b, i) => {
          const show = labelEvery ? b.count > 0 : b.current;
          if (!show) return null;
          const x = i * (barW + gap) + barW / 2;
          return (
            <SvgText key={b.start} x={x} y={yOf(b.count) - 5} fontSize={12} fontFamily={FONTS.display}
              fill={b.current ? COLORS.accent : COLORS.textSecondary} textAnchor="middle">
              {b.count}
            </SvgText>
          );
        })}
        {n > 0 && (
          <>
            <SvgText x={0} y={H - 4} fontSize={11} fontFamily={FONTS.medium} fill={COLORS.textMuted} textAnchor="start">
              {md(bars[0].start)}
            </SvgText>
            <SvgText x={width} y={H - 4} fontSize={11} fontFamily={FONTS.medium} fill={COLORS.accent} textAnchor="end">
              This week
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

function fmtTarget(t: number): string {
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}
