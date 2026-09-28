import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { COLORS } from '../../../constants';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import type { SetPoint } from '../../../utils/sessionSummary';
import { ink } from '../../../theme/runtime';

export type { SetPoint };

interface Props {
  data:     SetPoint[];
  /** Index of the set to highlight (best by volume), or -1. */
  peakIdx:  number;
  width:    number;
  /** The line draws itself in once this is true. */
  animate?: boolean;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Group wrapper so the best-set marker's three shapes fade together.
const AnimatedG = Animated.createAnimatedComponent(G);

const DRAW_MS = 900;

// Transparent-background line chart of per-set volume, in the order the sets
// were logged. The line traces itself left to right, the area fill fades in
// under it, and the best set is marked last.
export function VolumeLineGraph({ data, peakIdx, width, animate = true }: Props) {
  const W = width;
  const H = 160;
  const padX = 18, padTop = 18, padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const baseY = padTop + innerH;

  const { linePath, areaPath, points, length } = useMemo(() => {
    if (data.length === 0) return { linePath: '', areaPath: '', points: [], length: 0 };
    const maxVol = Math.max(...data.map(d => d.vol), 1);
    const pts = data.map((d, i) => ({
      x: padX + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1)),
      y: padTop + innerH * (1 - d.vol / maxVol),
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { linePath: line, areaPath: area, points: pts, length: Math.max(len, 1) };
  }, [data, innerW, innerH, baseY]);

  // 0 → nothing drawn, 1 → fully drawn.
  const draw = useSharedValue(animate ? 0 : 1);
  const fillIn = useSharedValue(animate ? 0 : 1);
  const peakIn = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    draw.value = withTiming(1, { duration: DRAW_MS, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
    fillIn.value = withDelay(DRAW_MS * 0.4, withTiming(1, TIMING.emphasis));
    peakIn.value = withDelay(DRAW_MS * 0.85, withTiming(1, TIMING.standard));
  }, [animate]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: 0.10 * fillIn.value }));
  const dotProps  = useAnimatedProps(() => ({ fillOpacity: 0.55 * fillIn.value }));
  const peakProps = useAnimatedProps(() => ({ opacity: peakIn.value }));

  if (data.length === 0) return <View style={{ width: W, height: H }} />;

  const peak = points[peakIdx] ?? null;
  const peakSet = data[peakIdx];
  const summary = peakSet
    ? `Volume of each of your ${data.length} sets. Best set: ${peakSet.reps} reps${peakSet.weight > 0 ? ` at ${peakSet.weight} ${peakSet.unit}` : ''} on ${peakSet.exName}.`
    : `Volume of each of your ${data.length} sets.`;

  return (
    <View accessible accessibilityLabel={summary} accessibilityRole="image">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={`M${padX},${baseY} L${W - padX},${baseY}`} stroke={ink(0.1)} strokeWidth={1} />
        <AnimatedPath d={areaPath} fill={COLORS.accent} animatedProps={areaProps} />
        <AnimatedPath
          d={linePath}
          stroke={COLORS.accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={lineProps}
        />
        {points.map((p, i) => i !== peakIdx && (
          <AnimatedCircle key={i} cx={p.x} cy={p.y} r={2.8} fill={COLORS.accent} animatedProps={dotProps} />
        ))}
        {peak && (
          <AnimatedG opacity={0} animatedProps={peakProps}>
            <Path d={`M${peak.x},${peak.y} L${peak.x},${baseY}`} stroke={COLORS.accent} strokeWidth={1} strokeDasharray="2,3" strokeLinecap="round" />
            <Circle cx={peak.x} cy={peak.y} r={9} fill="none" stroke={COLORS.accent} strokeOpacity={0.3} strokeWidth={2} />
            <Circle cx={peak.x} cy={peak.y} r={5} fill={COLORS.accent} />
          </AnimatedG>
        )}
      </Svg>
    </View>
  );
}
