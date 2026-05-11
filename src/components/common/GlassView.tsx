import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface Props {
  children?:    React.ReactNode;
  style?:       any;
  opacity?:     'low' | 'mid' | 'high';
  radius?:      number;
  borderColor?: string;
  glow?:        boolean;
}

export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  const blurIntensity = opacity === 'high' ? 68 : opacity === 'mid' ? 52 : 36;

  // Match reference: oklch(100% 0 0 / 0.06) for low, up to 0.09 for high
  const tintAlpha = opacity === 'high' ? 0.09 : opacity === 'mid' ? 0.06 : 0.04;

  // Match reference border: oklch(100% 0 0 / 0.10)
  const bc = borderColor ?? 'rgba(255,255,255,0.10)';

  const glowShadow = glow
    ? Platform.select({
        ios: {
          shadowColor:   '#0A84FF',
          shadowOpacity: 0.35,
          shadowRadius:  18,
          shadowOffset:  { width: 0, height: 4 },
        },
        android: {},
      })
    : {};

  const outerStyle: any[] = [
    ss.outer,
    {
      borderRadius: radius,
      borderColor:  bc,
      ...glowShadow,
    },
    ...(Array.isArray(style) ? style : [style]),
  ];

  if (Platform.OS === 'ios') {
    return (
      <View style={outerStyle}>
        <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
        {/* Base tint — matches reference 0.06 white */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${tintAlpha})` }]} />
        {/* Inset top specular — matches reference inset 0 1px 0 rgba(255,255,255,0.14) */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
        {children}
      </View>
    );
  }

  return (
    <View style={[outerStyle, { backgroundColor: 'rgba(20,20,28,0.85)' }]}>
      {children}
    </View>
  );
}

const ss = StyleSheet.create({
  outer: {
    borderWidth:  1,
    overflow:     'hidden',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius:  12,
      },
      android: { elevation: 6 },
    }),
  },
});
