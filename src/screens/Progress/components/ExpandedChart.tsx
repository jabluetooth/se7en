import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import { COLORS, FONTS } from '../../../constants';
import { WeightUnit } from '../../../types';
import { fmtDate } from '../../../utils/format';
import { ExerciseSessionPoint } from '../../../utils/exerciseHistory';
import { accentA, ink } from '../../../theme/runtime';

interface Props {
  sessions:     ExerciseSessionPoint[];
  isBodyweight: boolean;
  unit:         WeightUnit;
  width:        number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const DRAW_MS = 800;

// Shown when an exercise card is expanded. Plots top-weight (or top-reps for
// bodyweight) over time. Falls back to a single centred label when every
// session has the same value (avoids the "40 / 40 / 40" axis triplicate).
export const ExpandedChart = React.memo(function ExpandedChart({ sessions, isBodyweight, unit, width }: Props) {
  const W = Math.max(width, 240);
  const H = 140;
  const padL = 50, padR = 14, padTop = 18, padBottom = 30;
  const innerW = W - padL - padR;
  const innerH = H - padTop - padBottom;

  const metric = (s: ExerciseSessionPoint) => isBodyweight ? s.topReps : s.topWeight;
  const data = sessions.map(metric);

  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const max    = Math.max(...data);
    const min    = Math.min(...data);
    const isFlat = max === min;
    const range  = isFlat ? 1 : max - min;
    const pts = data.map((v, i) => ({
      x: padL + (i / (data.length - 1)) * innerW,
      // When every session shares the same value, plot the line on the centre
      // line so flat data reads as flat (instead of slammed to the bottom).
      y: isFlat ? padTop + innerH / 2 : padTop + (1 - (v - min) / range) * innerH,
    }));
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return { max, min, isFlat, pts, length: Math.max(length, 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.join(','), innerW, innerH]);
  const lineLength = geo?.length ?? 1;

  // The line traces itself in when the card opens; area and points follow.
  const draw = useSharedValue(0);
  const rest = useSharedValue(0);
  useEffect(() => {
    draw.value = withTiming(1, { duration: DRAW_MS, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
    rest.value = withDelay(DRAW_MS * 0.5, withTiming(1, TIMING.emphasis));
  }, []);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lineLength * (1 - draw.value) }));
  const restProps = useAnimatedProps(() => ({ opacity: rest.value }));

  if (!geo) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, textAlign: 'center' }}>
          Log this exercise once more to see your trend.
        </Text>
      </View>
    );
  }

  const { max, min, isFlat, pts } = geo;
  const mid = (max + min) / 2;

  const linePath = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseY = padTop + innerH;
  const areaPath =
    `${linePath} L${pts[pts.length-1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`;

  const peakIdx = data.reduce((mi, v, i) => (v > data[mi] ? i : mi), 0);
  const peak    = pts[peakIdx];

  // Word-based units (plates) need a space; symbol units (kg, lb) do not.
  const unitSuffix = (unit === 'kg' || unit === 'lb') ? unit : ` ${unit}`;
  const fmtAxis = (n: number) =>
    isBodyweight ? `${Math.round(n)}` : `${Math.round(n)}${unitSuffix}`;

  // Suppress mid label when rounding makes it identical to max or min —
  // common when the range is narrow (e.g. max=8, mid=7.5→8, min=7).
  const midRounded = Math.round(mid);
  const showMid    = midRounded !== Math.round(max) && midRounded !== Math.round(min);

  const firstDate = fmtDate(sessions[0].finishedAt);
  const lastDate  = fmtDate(sessions[sessions.length - 1].finishedAt);

  const chartSummary = `Progress chart from ${firstDate} to ${lastDate}. `
    + `${isBodyweight ? 'Reps' : 'Weight'} ranged from ${fmtAxis(min)} to ${fmtAxis(max)}, `
    + `peak of ${fmtAxis(data[peakIdx])} on ${fmtDate(sessions[peakIdx].finishedAt)}.`;

  return (
    <View style={{ overflow: 'hidden' }} accessible accessibilityLabel={chartSummary} accessibilityRole="image">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Grid lines */}
        <Path d={`M${padL},${padTop} L${W - padR},${padTop}`}
          stroke={ink(0.06)} strokeWidth={1} />
        <Path d={`M${padL},${padTop + innerH / 2} L${W - padR},${padTop + innerH / 2}`}
          stroke={ink(0.06)} strokeWidth={1} strokeDasharray="2,3" />
        <Path d={`M${padL},${baseY} L${W - padR},${baseY}`}
          stroke={ink(0.1)} strokeWidth={1} />

        {/* Y-axis labels — single centred label when flat, otherwise max / mid / min */}
        {isFlat ? (
          <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={10} fontWeight="700"
            fill={COLORS.textMuted} textAnchor="end">
            {fmtAxis(max)}
          </SvgText>
        ) : (
          <>
            <SvgText x={padL - 6} y={padTop + 3} fontSize={10} fontWeight="700"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(max)}
            </SvgText>
            {showMid && (
              <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={10} fontWeight="600"
                fill={COLORS.textMuted} textAnchor="end">
                {fmtAxis(mid)}
              </SvgText>
            )}
            <SvgText x={padL - 6} y={baseY + 3} fontSize={10} fontWeight="600"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(min)}
            </SvgText>
          </>
        )}

        {/* Area fill + line */}
        <AnimatedG opacity={0} animatedProps={restProps}>
          <Path d={areaPath} fill={accentA(0.12)} />
        </AnimatedG>
        <AnimatedPath d={linePath} stroke={COLORS.accent} strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={`${lineLength} ${lineLength}`}
          animatedProps={lineProps} />

        <AnimatedG opacity={0} animatedProps={restProps}>

        {/* Dashed vertical guide to the peak */}
        <Path d={`M${peak.x},${peak.y} L${peak.x},${baseY}`}
          stroke={COLORS.accent} strokeWidth={1} strokeDasharray="2,3" strokeOpacity={0.6} />

        {/* Plain points */}
        {pts.map((p, i) => i !== peakIdx && (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5}
            fill={COLORS.accent} fillOpacity={0.7} />
        ))}

        {/* Peak — emphasised */}
        <Circle cx={peak.x} cy={peak.y} r={8}
          fill="none" stroke={COLORS.accent} strokeOpacity={0.25} strokeWidth={2} />
        <Circle cx={peak.x} cy={peak.y} r={4.5} fill={COLORS.accent} />
        </AnimatedG>

        {/* X-axis: first + last date labels */}
        <SvgText x={padL} y={H - 6} fontSize={10} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="start">
          {firstDate}
        </SvgText>
        <SvgText x={W - padR} y={H - 6} fontSize={10} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="end">
          {lastDate}
        </SvgText>
      </Svg>
    </View>
  );
});
