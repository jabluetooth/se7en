import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from 'react-native-svg';
import { WorkoutSession } from '../../types';
import { COLORS, GRAD } from '../../constants';

interface Props {
  currentDay: number; // 1–7
  sessions: WorkoutSession[];
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, R: number, ri: number, a0: number, a1: number) {
  const p1 = polar(cx, cy, R,  a0);
  const p2 = polar(cx, cy, R,  a1);
  const p3 = polar(cx, cy, ri, a1);
  const p4 = polar(cx, cy, ri, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${p1.x},${p1.y} A${R},${R} 0 ${big} 1 ${p2.x},${p2.y}` +
    ` L${p3.x},${p3.y} A${ri},${ri} 0 ${big} 0 ${p4.x},${p4.y} Z`
  );
}

export function CycleOrbitWidget({ currentDay, sessions }: Props) {
  const SZ = 200, cx = 100, cy = 100, R = 88, ri = 68;
  const SEG = 360 / 7;
  const GAP = 3.5;

  const completedTotal = sessions.filter(s => s.status === 'completed').length;
  const cycleNum       = Math.floor(completedTotal / 7) + 1;
  const pct            = Math.round(((currentDay - 1) / 7) * 100);

  return (
    <View style={s.container}>
      <Svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
        <Defs>
          {/* Both gradients share the same two-stop iOS-blue ramp */}
          <SvgGrad id="done" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={GRAD.accent[0]} stopOpacity="1" />
            <Stop offset="100%" stopColor={GRAD.accent[1]} stopOpacity="1" />
          </SvgGrad>
          <SvgGrad id="curr" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={GRAD.accent[0]} stopOpacity="1" />
            <Stop offset="100%" stopColor={GRAD.accent[1]} stopOpacity="0.7" />
          </SvgGrad>
        </Defs>

        {/* Inner dark circle first so arcs sit on top */}
        <Circle cx={cx} cy={cy} r={ri - 1} fill="rgba(8,9,15,0.92)" />

        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const a0  = i * SEG + GAP / 2;
          const a1  = a0 + SEG - GAP;
          const d   = arcPath(cx, cy, R, ri, a0, a1);

          if (day < currentDay) {
            return <Path key={i} d={d} fill="url(#done)" />;
          }
          if (day === currentDay) {
            return <Path key={i} d={d} fill="url(#curr)" />;
          }
          return (
            <Path
              key={i}
              d={d}
              fill="rgba(255,240,220,0.06)"
              stroke="rgba(255,240,220,0.14)"
              strokeWidth={0.6}
            />
          );
        })}
      </Svg>

      <View style={s.overlay} pointerEvents="none">
        <Text style={s.lbl}>CYCLE</Text>
        <Text style={s.num}>{cycleNum}</Text>
        <Text style={s.pct}>{pct}%</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  overlay:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lbl:       { fontSize: 9,  fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 2 },
  num:       { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -2,  lineHeight: 46 },
  pct:       { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
});
