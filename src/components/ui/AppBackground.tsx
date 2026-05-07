import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

// Adapted from meghtrix/radial-glow-background (emerald-radial-glow-bg)
// Dark #020617 base + centered radial glow (500px radius, 200px from top)
export function AppBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#020617' }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="glow"
            cx={width / 2}
            cy={200}
            rx={500}
            ry={500}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#3e3e3e" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#020617" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#glow)" />
      </Svg>
    </View>
  );
}
