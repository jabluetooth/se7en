import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants';

// Plain page background in the active theme. It used to paint a warm radial
// "ember" glow behind every screen; the clean look keeps the page flat so the
// content, not the backdrop, carries the colour.
export function AppBackground() {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} pointerEvents="none" />;
}
