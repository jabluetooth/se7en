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

// Glass recipe ported from web reference:
//   - dock.tsx           → opacity & blurriness (bg-white/10, border-white/20, backdrop-blur-md ≈ 12px)
//   - n8n/match globals  → cool white tint, inset top highlight, soft shadow, navy fallback
export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  // BlurView intensity calibrated so `mid` ≈ Tailwind `backdrop-blur-md` (~12px)
  const blurIntensity = opacity === 'high' ? 70 : opacity === 'mid' ? 50 : 40;

  // Cool white tint: low = subtle card, mid = dock baseline (bg-white/10), high = topbar-dense
  const tintAlpha = opacity === 'high' ? 0.16 : opacity === 'mid' ? 0.10 : 0.06;

  // Cool white border, default = dock baseline (border-white/20 scaled for card use)
  const bc = borderColor ?? (opacity === 'high' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.14)');

  const glowShadow = glow
    ? Platform.select({
        ios: {
          shadowColor:   '#FF8C00',
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
        {/* Cool white tint — bg-white/10 at mid (dock baseline) */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${tintAlpha})` }]} />
        {/* Inset top specular — 1px highlight, ref: inset 0 1px 0 rgba(255,255,255,0.06) */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        {children}
      </View>
    );
  }

  // Android lacks reliable backdrop blur — solid navy approximation from ref @supports fallback
  return (
    <View style={[outerStyle, { backgroundColor: 'rgba(20,22,30,0.85)' }]}>
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
        // Soft layered shadow from match's --shadow-card recipe
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius:  16,
      },
      android: { elevation: 6 },
    }),
  },
});
