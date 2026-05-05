import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface Props {
  children?:    React.ReactNode;
  style?:       any;
  opacity?:     'low' | 'mid' | 'high';
  radius?:      number;
  borderColor?: string;
  glow?:        boolean;
}

export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  // iOS-style glass: subtly opaque dark surface with clean white border
  const bg = opacity === 'high'
    ? 'rgba(255,255,255,0.10)'
    : opacity === 'mid'
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.06)';

  const bc = borderColor ?? (
    opacity === 'high' ? 'rgba(255,255,255,0.17)' : 'rgba(255,255,255,0.11)'
  );

  // Glow uses iOS System Blue instead of purple
  const glowStyle = glow
    ? Platform.select({
        ios: {
          shadowColor:   'rgba(10,132,255,0.6)',
          shadowOpacity: 0.55,
          shadowRadius:  18,
          shadowOffset:  { width: 0, height: 4 },
        },
        android: {},
      })
    : {};

  return (
    <View
      style={[
        ss.glass,
        {
          backgroundColor: bg,
          borderColor:     bc,
          borderRadius:    radius,
          ...glowStyle,
        },
        ...(Array.isArray(style) ? style : [style]),
      ]}
    >
      {children}
    </View>
  );
}

const ss = StyleSheet.create({
  glass: {
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor:  '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius:  10,
      },
      android: { elevation: 4 },
    }),
  },
});
