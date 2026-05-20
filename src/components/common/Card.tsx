import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from './GlassView';
import { SPACING } from '../../constants';

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  elevated?: boolean;
  glow?:     boolean;
  radius?:   number;
  padding?:  number;
}

// Card uses the GlassView base + extra layers to approximate the Apple-Tahoe
// "liquid glass" look. Real refraction (feDisplacementMap) is web-only, so on
// RN we fake it with a top-down specular highlight gradient + a 1px bottom edge.
export function Card({ children, style, elevated, glow, radius = 20, padding = SPACING.md }: Props) {
  return (
    <GlassView
      opacity={elevated ? 'high' : 'mid'}
      radius={radius}
      glow={glow}
      style={StyleSheet.flatten([{ overflow: 'hidden' }, style]) as ViewStyle}
    >
      {/* Specular sheen — bright at top, fades to nothing. Mimics light refracting
          through liquid glass without needing an SVG displacement map. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.00)', 'rgba(255,255,255,0.03)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bottom-edge highlight — completes the rounded liquid lens feel */}
      <View pointerEvents="none" style={s.bottomEdge} />
      {/* Padding lives on an inner View so it doesn't clip the absolute sheen layers */}
      <View style={{ padding }}>
        {children}
      </View>
    </GlassView>
  );
}

const s = StyleSheet.create({
  bottomEdge: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
