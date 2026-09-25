import React from 'react';
import {
  Text, StyleSheet, ActivityIndicator, ViewStyle, View,
} from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { GRAD, COLORS, BORDER_RADIUS, SPACING, FONTS } from '../../constants';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent_ghost';

interface Props {
  label:      string;
  onPress:    () => void;
  variant?:   ButtonVariant;
  size?:      'sm' | 'md' | 'lg';
  loading?:   boolean;
  disabled?:  boolean;
  style?:     ViewStyle;
  icon?:      React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, style, icon, fullWidth,
}: Props) {
  // 'sm' was 36pt (under the 44pt touch-target guideline) and is not
  // load-bearing anywhere in the app today (no call site relies on that
  // compactness) — raised to 44pt so it's guideline-clean by default.
  const h  = size === 'sm' ? 44 : size === 'lg' ? 56 : 48;
  const fz = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const px = size === 'sm' ? 14 : size === 'lg' ? 28 : 22;
  const r  = size === 'sm' ? BORDER_RADIUS.md : size === 'lg' ? BORDER_RADIUS.xl : BORDER_RADIUS.lg;

  // Text color per variant
  const textColor =
    variant === 'primary'      ? '#FFFFFF' :   // white on iOS blue
    variant === 'danger'       ? '#FFFFFF' :   // white on red
    variant === 'secondary'    ? COLORS.text :
    variant === 'accent_ghost' ? COLORS.accent :
    COLORS.textSecondary;                       // ghost

  const inner = (
    <View style={[styles.inner, { height: h, paddingHorizontal: px, borderRadius: r, gap: 8 }]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : COLORS.accent}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { fontSize: fz, color: textColor }]}>{label}</Text>
        </>
      )}
    </View>
  );

  // Gradient variants
  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        haptic="light"
        disabled={disabled || loading}
        style={[
          { borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 },
          fullWidth && { width: '100%' },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        <LinearGradient
          colors={GRAD.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: r }}
        >
          {inner}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === 'danger') {
    return (
      <AnimatedPressable
        onPress={onPress}
        haptic="light"
        disabled={disabled || loading}
        style={[
          { borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 },
          fullWidth && { width: '100%' },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        <LinearGradient
          colors={GRAD.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: r }}
        >
          {inner}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  // Ghost / secondary / accent_ghost
  const bg = variant === 'secondary'
    ? COLORS.glass06
    : variant === 'accent_ghost'
    ? 'rgba(255,140,0,0.10)'
    : 'transparent';

  const bc = variant === 'secondary'
    ? COLORS.glassBorder
    : variant === 'accent_ghost'
    ? 'rgba(255,140,0,0.28)'
    : 'rgba(255,240,220,0.14)';

  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      disabled={disabled || loading}
      style={[
        { borderRadius: r, backgroundColor: bg, borderWidth: 1, borderColor: bc, opacity: disabled ? 0.4 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {inner}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', fontFamily: FONTS.semibold, letterSpacing: -0.2 },
});
