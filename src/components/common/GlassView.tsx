import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: any;
  opacity?: 'low' | 'mid' | 'high';
  radius?: number;
  borderColor?: string;
  glow?: boolean;
}

export function GlassView({ children, style, opacity = 'low', radius = 16, borderColor, glow }: Props) {
  const bg = opacity === 'high' ? 'rgba(255,255,255,0.09)' : opacity === 'mid' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.06)';
  const bc = borderColor ?? (opacity === 'high' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)');
  return (
    <View style={[
      ss.glass,
      {
        backgroundColor: bg,
        borderColor: bc,
        borderRadius: radius,
        ...(glow ? Platform.select({ ios: { shadowColor: 'rgba(123,94,250,0.5)', shadowOpacity: 0.6, shadowRadius: 16 }, android: {} }) : {}),
      },
      ...(Array.isArray(style) ? style : [style]),
    ]}>
      {children}
    </View>
  );
}

const ss = StyleSheet.create({
  glass: {
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
});
