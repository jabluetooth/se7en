import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../../../constants';
import { WeightUnit } from '../../../types';
import { fmtDate } from '../../../utils/format';
import { ExerciseSessionPoint } from '../../../utils/exerciseHistory';

interface Props {
  sessions:     ExerciseSessionPoint[];
  isBodyweight: boolean;
  unit:         WeightUnit;
  width:        number;
}

// Shown when an exercise card is expanded. Plots top-weight (or top-reps for
// bodyweight) over time. Falls back to a single centred label when every
// session has the same value (avoids the "40 / 40 / 40" axis triplicate).
export function ExpandedChart({ sessions, isBodyweight, unit, width }: Props) {
  const W = Math.max(width, 240);
  const H = 140;
  const padL = 50, padR = 14, padTop = 18, padBottom = 30;
  const innerW = W - padL - padR;
  const innerH = H - padTop - padBottom;

  const metric = (s: ExerciseSessionPoint) => isBodyweight ? s.topReps : s.topWeight;
  const data = sessions.map(metric);

  if (data.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Need 2+ sessions to chart</Text>
      </View>
    );
  }

  const max    = Math.max(...data);
  const min    = Math.min(...data);
  const isFlat = max === min;
  const range  = isFlat ? 1 : max - min;
  const mid    = (max + min) / 2;

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    // When every session shares the same value, plot the line on the centre
    // line so flat data reads as flat (instead of slammed to the bottom).
    y: isFlat
      ? padTop + innerH / 2
      : padTop + (1 - (v - min) / range) * innerH,
  }));

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

  return (
    <View style={{ overflow: 'hidden' }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Grid lines */}
        <Path d={`M${padL},${padTop} L${W - padR},${padTop}`}
          stroke="rgba(255,240,220,0.06)" strokeWidth={1} />
        <Path d={`M${padL},${padTop + innerH / 2} L${W - padR},${padTop + innerH / 2}`}
          stroke="rgba(255,240,220,0.06)" strokeWidth={1} strokeDasharray="2,3" />
        <Path d={`M${padL},${baseY} L${W - padR},${baseY}`}
          stroke="rgba(255,240,220,0.10)" strokeWidth={1} />

        {/* Y-axis labels — single centred label when flat, otherwise max / mid / min */}
        {isFlat ? (
          <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={9} fontWeight="700"
            fill={COLORS.textMuted} textAnchor="end">
            {fmtAxis(max)}
          </SvgText>
        ) : (
          <>
            <SvgText x={padL - 6} y={padTop + 3} fontSize={9} fontWeight="700"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(max)}
            </SvgText>
            {showMid && (
              <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={9} fontWeight="600"
                fill={COLORS.textMuted} textAnchor="end">
                {fmtAxis(mid)}
              </SvgText>
            )}
            <SvgText x={padL - 6} y={baseY + 3} fontSize={9} fontWeight="600"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(min)}
            </SvgText>
          </>
        )}

        {/* Area fill + line */}
        <Path d={areaPath} fill="rgba(255,140,0,0.12)" />
        <Path d={linePath} stroke={COLORS.accent} strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

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

        {/* X-axis: first + last date labels */}
        <SvgText x={padL} y={H - 6} fontSize={9} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="start">
          {firstDate}
        </SvgText>
        <SvgText x={W - padR} y={H - 6} fontSize={9} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="end">
          {lastDate}
        </SvgText>
      </Svg>
    </View>
  );
}
