import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

interface Props {
  data:   number[];
  color:  string;
  width:  number;
  height: number;
}

// Tiny inline trend line — shown next to each exercise's name on the Progress
// screen. Renders a single-pixel dot when there's only one data point.
export function Sparkline({ data, color, width, height }: Props) {
  if (data.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color + '88' }} />
      </View>
    );
  }
  const max   = Math.max(...data);
  const min   = Math.min(...data);
  const range = max - min || 1;
  const pts   = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 6) - 3,
  }));
  const last  = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        stroke={color} strokeWidth={1.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}
