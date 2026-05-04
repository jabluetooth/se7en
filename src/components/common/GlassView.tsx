import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
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
      styles.glass,
      {
        backgroundColor: bg,
        borderColor: bc,
        borderRadius: radius,
        shadowColor: glow ? 'rgba(123,94,250,0.5)' : '#000',
        shadowOpacity: glow ? 0.6 : 0.3,
        shadowRadius: glow ? 16 : 12,
      },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
});
