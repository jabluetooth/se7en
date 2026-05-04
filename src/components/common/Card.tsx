import React from 'react';
import { ViewStyle } from 'react-native';
import { GlassView } from './GlassView';
import { SPACING } from '../../constants';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  glow?: boolean;
  radius?: number;
  padding?: number;
}

export function Card({ children, style, elevated, glow, radius = 16, padding = SPACING.md }: Props) {
  return (
    <GlassView opacity={elevated ? 'mid' : 'low'} radius={radius} glow={glow} style={[{ padding }, style]}>
      {children}
    </GlassView>
  );
}
