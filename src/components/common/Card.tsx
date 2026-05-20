import React from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
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

// Card is now a thin delegate — the liquid-glass recipe (sheen, edge highlights,
// systemUltraThinMaterialDark blur) lives in GlassView so every glass surface in
// the app benefits, not just cards.
export function Card({ children, style, elevated, glow, radius = 20, padding = SPACING.md }: Props) {
  return (
    <GlassView
      opacity={elevated ? 'high' : 'mid'}
      radius={radius}
      glow={glow}
      style={StyleSheet.flatten([{ padding }, style]) as ViewStyle}
    >
      {children}
    </GlassView>
  );
}
