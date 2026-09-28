import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../../../constants';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import { useCountUp } from '../../../motion/useCountUp';
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
const DRAW_MS = 700;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The lift that improved most: its name, the gain as one big number, and its
 * top sets as a line labelled only at the start and the end. The line draws
 * itself in and the number counts up, both again when the period changes.
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
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { pts, len: Math.max(1, len), d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') };
  }, [gain, width]);

  const diff = gain ? gain.to - gain.from : 0;
  const shownDiff = useCountUp(diff, { duration: DRAW_MS });

  // Replays whenever the line itself changes.
  const draw = useSharedValue(0);
  const ends = useSharedValue(0);
  const lineLen = geo?.len ?? 1;
  useEffect(() => {
    draw.value = 0;
    ends.value = 0;
    draw.value = withTiming(1, { duration: DRAW_MS, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
    ends.value = withDelay(DRAW_MS * 0.6, withTiming(1, TIMING.standard));
  }, [geo?.d]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lineLen * (1 - draw.value) }));
  const endStyle = useAnimatedStyle(() => ({ opacity: ends.value }));

  if (!gain) {
    return <Text style={s.empty}>No new top sets in this period yet.</Text>;
  }

  const first = geo?.pts[0];
  const last = geo?.pts[geo.pts.length - 1];
  return (
    <View
      style={s.wrap}
      accessible
      accessibilityLabel={`${gain.exerciseName}, up ${fmt(diff)} ${gain.unit}, from ${fmt(gain.from)} to ${fmt(gain.to)}`}
    >
      <View style={s.head}>
        <Text style={s.name} numberOfLines={1}>{gain.exerciseName}</Text>
        <Text style={s.big}>+{fmt(Math.round(shownDiff * 10) / 10)}<Text style={s.unit}> {gain.unit}</Text></Text>
      </View>
      {geo && first && last && (
        <View style={{ width, height: H }}>
          <Svg width={width} height={H} style={StyleSheet.absoluteFill}>
            <AnimatedPath
              d={geo.d} fill="none" stroke={COLORS.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={`${lineLen} ${lineLen}`} animatedProps={lineProps}
            />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, endStyle]}>
            <Svg width={width} height={H}>
              <Circle cx={first.x} cy={first.y} r={3.5} fill={COLORS.textMuted} />
              <SvgText x={first.x - 8} y={first.y + 4} fontSize={12} fontFamily={FONTS.display} fill={COLORS.textMuted} textAnchor="end">
                {fmt(gain.from)}
              </SvgText>
              <Circle cx={last.x} cy={last.y} r={4.5} fill={COLORS.accent} />
              <SvgText x={last.x + 8} y={last.y + 4} fontSize={13} fontFamily={FONTS.display} fill={COLORS.accent} textAnchor="start">
                {fmt(gain.to)}
              </SvgText>
            </Svg>
          </Animated.View>
        </View>
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
