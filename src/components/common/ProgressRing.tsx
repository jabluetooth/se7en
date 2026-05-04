import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../constants';

interface Props {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ value, max, size = 48, strokeWidth = 4, label }: Props) {
  const r    = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(1, max > 0 ? value / max : 0);
  const off  = circ * (1 - pct);
  const done = pct >= 1;
  const gradId = 'ringGrad';
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1='0%' y1='0%' x2='100%' y2='100%'>
            <Stop offset='0%'   stopColor='#9035F0' />
            <Stop offset='50%'  stopColor='#7B5EFA' />
            <Stop offset='100%' stopColor='#2ECAC4' />
          </LinearGradient>
        </Defs>
        <Circle cx={size/2} cy={size/2} r={r} fill='none' stroke='rgba(255,255,255,0.08)' strokeWidth={strokeWidth} />
        <Circle
          cx={size/2} cy={size/2} r={r}
          fill='none' stroke={'url(#' + gradId + ')'} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={off}
          strokeLinecap='round'
          rotation={-90} origin={size/2 + ',' + size/2}
        />
      </Svg>
      {label !== undefined && (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: done ? COLORS.accent : 'rgba(255,255,255,0.65)', letterSpacing: -0.3 }}>{label}</Text>
          </View>
        </View>
      )}
    </View>
  );
}