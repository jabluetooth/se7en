import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { COLORS } from '../../constants';

// Adapted from meghtrix/radial-glow-background (brown variant).
// Warm obsidian base (COLORS.background) + centered ember glow (500px radius,
// 100px from top). The base used to be a cool navy #020617, which clashed
// with the warm palette every other surface in the app is built on.
// CSS equivalent: radial-gradient(circle 500px at 50% 100px, rgba(120,53,15,0.45), transparent)
export function AppBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="glow"
            cx={width / 2}
            cy={100}
            rx={500}
            ry={500}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#78350F" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#78350F" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#glow)" />
      </Svg>
    </View>
  );
}
