import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../../../constants';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import type { SetPoint } from '../../../utils/sessionSummary';
import { ink } from '../../../theme/runtime';

export type { SetPoint };

interface Props {
  data:     SetPoint[];
  /** Index of the set to highlight (biggest by volume), or -1. */
  peakIdx:  number;
  width:    number;
  /** Columns rise in once this is true. */
  animate?: boolean;
}

const H = 150;
const LABEL_H = 22;
const GROUP_GAP = 10;
const BAR_GAP = 3;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/**
 * One column per set, in the order you lifted, grouped by exercise with a
 * small gap between exercises. Height is the set's volume (weight × reps).
 * The biggest set is orange and labelled; the rest are grey. There's no
 * connecting line, because sets of different exercises aren't a series.
 */
export function VolumeLineGraph({ data, peakIdx, width, animate = true }: Props) {
  const grow = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) grow.value = withTiming(1, { duration: 650, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
  }, [animate]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  const bars = useMemo(() => {
    if (data.length === 0) return [];
    const groups = data.reduce((n, d, i) => (i > 0 && d.exName !== data[i - 1].exName ? n + 1 : n), 0);
    const maxVol = Math.max(...data.map(d => d.vol), 1);
    const barW = Math.max(3, Math.min(22, (width - groups * GROUP_GAP - (data.length - 1) * BAR_GAP) / data.length));
    const used = data.length * barW + (data.length - 1) * BAR_GAP + groups * GROUP_GAP;
    let x = Math.max(0, (width - used) / 2);
    const innerH = H - LABEL_H;
    return data.map((d, i) => {
      if (i > 0) x += BAR_GAP + (d.exName !== data[i - 1].exName ? GROUP_GAP : 0);
      const h = Math.max(2, (d.vol / maxVol) * innerH);
      const bar = { x, y: H - h, w: barW, h };
      x += barW;
      return bar;
    });
  }, [data, width]);

  if (data.length === 0) return <View style={{ width, height: H }} />;

  const peak = bars[peakIdx];
  const peakSet = data[peakIdx];
  const peakLabel = peakSet ? (peakSet.weight > 0 ? `${fmt(peakSet.weight)}×${peakSet.reps}` : `${peakSet.reps} reps`) : '';
  const labelX = peak ? Math.max(24, Math.min(width - 24, peak.x + peak.w / 2)) : 0;
  const summary = peakSet
    ? `Volume of each of your ${data.length} sets. Biggest set: ${peakSet.reps} reps${peakSet.weight > 0 ? ` at ${peakSet.weight} ${peakSet.unit}` : ''} on ${peakSet.exName}.`
    : `Volume of each of your ${data.length} sets.`;

  return (
    <View accessible accessibilityLabel={summary} accessibilityRole="image">
      <Svg width={width} height={LABEL_H} style={{ position: 'absolute', top: 0, left: 0 }}>
        {peak && (
          <SvgText x={labelX} y={peak.y > LABEL_H + 16 ? LABEL_H - 6 : 14} fontSize={12} fontFamily={FONTS.display}
            fill={COLORS.accent} textAnchor="middle">
            {peakLabel}
          </SvgText>
        )}
      </Svg>
      <Animated.View style={[{ width, height: H, transformOrigin: 'bottom' }, growStyle]}>
        <Svg width={width} height={H}>
          {bars.map((b, i) => (
            <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(3, b.w / 2)}
              fill={i === peakIdx ? COLORS.accent : ink(0.26)} />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={width} height={1}>
        <Path d={`M0,0.5 L${width},0.5`} stroke={COLORS.border} strokeWidth={1} />
      </Svg>
    </View>
  );
}
