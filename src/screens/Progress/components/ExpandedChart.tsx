import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import { COLORS, FONTS } from '../../../constants';
import { WeightUnit } from '../../../types';
import { fmtDate } from '../../../utils/format';
import { ExerciseSessionPoint } from '../../../utils/exerciseHistory';

interface Props {
  sessions:     ExerciseSessionPoint[];
  isBodyweight: boolean;
  unit:         WeightUnit;
  width:        number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const H = 128;
const PAD_X = 30;     // room for the end labels
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

/**
 * Top set per workout for one lift, as a single line. Only three values are
 * written, directly on the line: where it started, where it is now, and the
 * best if that's somewhere in between. Dates appear once at each end.
 */
export const ExpandedChart = React.memo(function ExpandedChart({ sessions, isBodyweight, unit, width }: Props) {
  const data = sessions.slice(-16).map(s => (isBodyweight ? s.topReps : s.topWeight));
  const pts16 = sessions.slice(-16);
  const W = Math.max(width, 200);

  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const span = max - min || 1;
    const innerW = W - PAD_X * 2, innerH = H - PAD_TOP - PAD_BOTTOM;
    const pts = data.map((v, i) => ({
      x: PAD_X + (i / (data.length - 1)) * innerW,
      y: max === min ? PAD_TOP + innerH / 2 : PAD_TOP + (1 - (v - min) / span) * innerH,
    }));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const peak = data.reduce((mi, v, i) => (v > data[mi] ? i : mi), 0);
    return { pts, len: Math.max(1, len), peak };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.join(','), W]);

  const draw = useSharedValue(0);
  useEffect(() => { draw.value = withTiming(1, { duration: 700, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion }); }, []);
  const lineLen = geo?.len ?? 1;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lineLen * (1 - draw.value) }));

  if (!geo) {
    return (
      <View style={{ height: 64, justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted }}>
          Log this exercise again to see a trend.
        </Text>
      </View>
    );
  }

  const { pts, peak } = geo;
  const last = pts.length - 1;
  const u = isBodyweight ? '' : unit === 'kg' || unit === 'lb' ? '' : ` ${unit}`;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const showPeak = peak !== 0 && peak !== last;
  const summary = `${isBodyweight ? 'Reps' : 'Top set'} from ${fmt(data[0])} on ${fmtDate(pts16[0].finishedAt)} to ${fmt(data[last])} on ${fmtDate(pts16[last].finishedAt)}${showPeak ? `, best ${fmt(data[peak])}` : ''}.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Svg width={W} height={H}>
        <Line x1={PAD_X} y1={H - PAD_BOTTOM + 6} x2={W - PAD_X} y2={H - PAD_BOTTOM + 6} stroke={COLORS.border} strokeWidth={1} />
        <AnimatedPath d={line} stroke={COLORS.text} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={`${lineLen} ${lineLen}`} animatedProps={lineProps} />

        <Circle cx={pts[0].x} cy={pts[0].y} r={3.5} fill={COLORS.textMuted} />
        <SvgText x={pts[0].x - 7} y={pts[0].y + 4} fontSize={12} fontFamily={FONTS.display} fill={COLORS.textMuted} textAnchor="end">
          {fmt(data[0])}{u}
        </SvgText>

        {showPeak && (
          <>
            <Circle cx={pts[peak].x} cy={pts[peak].y} r={3.5} fill={COLORS.text} />
            <SvgText x={pts[peak].x} y={pts[peak].y - 8} fontSize={12} fontFamily={FONTS.display} fill={COLORS.text} textAnchor="middle">
              {fmt(data[peak])}
            </SvgText>
          </>
        )}

        <Circle cx={pts[last].x} cy={pts[last].y} r={4.5} fill={COLORS.accent} />
        <SvgText x={pts[last].x + 7} y={pts[last].y + 4} fontSize={13} fontFamily={FONTS.display} fill={COLORS.accent} textAnchor="start">
          {fmt(data[last])}
        </SvgText>

        <SvgText x={PAD_X} y={H - 3} fontSize={11} fontFamily={FONTS.medium} fill={COLORS.textMuted} textAnchor="start">
          {fmtDate(pts16[0].finishedAt)}
        </SvgText>
        <SvgText x={W - PAD_X} y={H - 3} fontSize={11} fontFamily={FONTS.medium} fill={COLORS.textMuted} textAnchor="end">
          {fmtDate(pts16[last].finishedAt)}
        </SvgText>
      </Svg>
    </View>
  );
});
