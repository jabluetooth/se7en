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
  // Apple-style: real blur via UIVisualEffectView on iOS, tinted fallback on Android
  const blurIntensity = opacity === 'high' ? 72 : opacity === 'mid' ? 55 : 38;

  // Very subtle white tint on top of the blur — the frosted glass feel
  const tintAlpha = opacity === 'high' ? 0.10 : opacity === 'mid' ? 0.07 : 0.05;

  const bc = borderColor ?? (
    opacity === 'high' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.13)'
  );

  const glowShadow = glow
    ? Platform.select({
        ios: {
          shadowColor:   '#0A84FF',
          shadowOpacity: 0.40,
          shadowRadius:  16,
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
        {/* Native blur layer */}
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {/* Specular white tint — the frosted sheen */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${tintAlpha})` }]} />
        {children}
      </View>
    );
  }

  // Android: solid semi-transparent dark surface
  return (
    <View
      style={[
        outerStyle,
        { backgroundColor: `rgba(28,28,36,0.82)` },
      ]}
    >
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
        shadowOpacity: 0.35,
        shadowRadius:  14,
      },
      android: { elevation: 6 },
    }),
  },
});
