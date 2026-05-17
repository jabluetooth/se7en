import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../../../constants';

// One data point per completed set — used by the Summary page's hero chart.
export interface SetPoint {
  vol:    number;
  reps:   number;
  weight: number;
  unit:   string;
  exName: string;
}

interface Props {
  data:    SetPoint[];
  peakIdx: number;
  width:   number;
}

// Transparent-background line chart of per-set volume. Peak set highlighted
// with a larger filled dot, a soft outer ring, and a dashed guide to baseline.
export function VolumeLineGraph({ data, peakIdx, width }: Props) {
  const W = width;
  const H = 160;
  const padX = 18, padTop = 18, padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  if (data.length === 0) {
    return <View style={{ width: W, height: H }} />;
  }

  const maxVol = Math.max(...data.map(d => d.vol), 1);
  const points = data.map((d, i) => ({
    x: padX + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1)),
    y: padTop + innerH * (1 - d.vol / maxVol),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const baseY = padTop + innerH;
  const areaPath =
    `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseY} ` +
    `L${points[0].x.toFixed(1)},${baseY} Z`;

  const peak = points[peakIdx];

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Subtle baseline */}
      <Path d={`M${padX},${baseY} L${W - padX},${baseY}`}
        stroke="rgba(255,240,220,0.10)" strokeWidth={1} />

      {/* Area fill — semi-transparent accent */}
      <Path d={areaPath} fill="rgba(255,140,0,0.10)" />

      {/* Line */}
      <Path d={linePath} stroke={COLORS.accent} strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Vertical guide to the peak */}
      <Path d={`M${peak.x},${peak.y} L${peak.x},${baseY}`}
        stroke={COLORS.accent} strokeWidth={1}
        strokeDasharray="2,3" strokeLinecap="round" />

      {/* Plain data points */}
      {points.map((p, i) => i !== peakIdx && (
        <Circle key={i} cx={p.x} cy={p.y} r={2.8}
          fill={COLORS.accent} fillOpacity={0.55} />
      ))}

      {/* Peak point — bigger ring + filled centre */}
      <Circle cx={peak.x} cy={peak.y} r={9}
        fill="none" stroke={COLORS.accent} strokeOpacity={0.30} strokeWidth={2} />
      <Circle cx={peak.x} cy={peak.y} r={5} fill={COLORS.accent} />
    </Svg>
  );
}
