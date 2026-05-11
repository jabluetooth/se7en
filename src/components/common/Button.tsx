import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRAD, COLORS, BORDER_RADIUS, SPACING } from '../../constants';

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
  const h  = size === 'sm' ? 36 : size === 'lg' ? 56 : 48;
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
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        style={[
          { borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 },
          fullWidth && { width: '100%' },
          style,
        ]}
      >
        <LinearGradient
          colors={GRAD.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: r }}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        style={[
          { borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 },
          fullWidth && { width: '100%' },
          style,
        ]}
      >
        <LinearGradient
          colors={GRAD.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: r }}
        >
          {inner}
        </LinearGradient>
      </TouchableOpacity>
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
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        { borderRadius: r, backgroundColor: bg, borderWidth: 1, borderColor: bc, opacity: disabled ? 0.4 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', letterSpacing: -0.2 },
});
