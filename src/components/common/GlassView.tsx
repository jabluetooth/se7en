import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  children?:    React.ReactNode;
  style?:       any;
  opacity?:     'low' | 'mid' | 'high';
  radius?:      number;
  borderColor?: string;
  glow?:        boolean;
}

// Liquid-glass approximation for React Native. Real refraction (SVG feDisplacementMap
// from the Apple Tahoe button) is web-only, so we layer:
//   1. BlurView with iOS system material  →  authentic Apple frosted backdrop
//   2. Cool white tint                    →  surface presence (dock.tsx bg-white/10)
//   3. Top→bottom specular sheen          →  fake refraction highlight
//   4. 1px top + 1px bottom edge lines    →  liquid "lens" rim
export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  // BlurView intensity calibrated so `mid` ≈ Tailwind backdrop-blur-md (~12px)
  const blurIntensity = opacity === 'high' ? 70 : opacity === 'mid' ? 50 : 40;
  const tintAlpha     = opacity === 'high' ? 0.16 : opacity === 'mid' ? 0.10 : 0.06;
  const bc            = borderColor ?? (opacity === 'high' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.14)');

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
        {/* iOS system material — actual Apple glass, not a flat dark blur */}
        <BlurView intensity={blurIntensity} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        {/* Cool white tint over the material */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${tintAlpha})` }]} />
        {/* Specular sheen — subtle top highlight that fades quickly. Just enough to
            hint at a liquid-glass lens without dominating the surface. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.00)', 'rgba(255,255,255,0.015)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Top rim — faint specular line */}
        <View pointerEvents="none" style={ss.topEdge} />
        {/* Bottom rim — very soft counter-highlight */}
        <View pointerEvents="none" style={ss.bottomEdge} />
        {children}
      </View>
    );
  }

  // Android lacks reliable backdrop blur — solid navy approximation from the match recipe
  return (
    <View style={[outerStyle, { backgroundColor: 'rgba(20,22,30,0.85)' }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.00)', 'rgba(255,255,255,0.01)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={ss.topEdge} />
      <View pointerEvents="none" style={ss.bottomEdge} />
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
        shadowOffset:  { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius:  20,
      },
      android: { elevation: 6 },
    }),
  },
  topEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bottomEdge: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
