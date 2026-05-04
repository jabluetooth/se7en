import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRAD, COLORS, BORDER_RADIUS, SPACING } from '../../constants';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent_ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', loading, disabled, style, icon, fullWidth }: Props) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 48;
  const fz = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const px = size === 'sm' ? 14 : size === 'lg' ? 28 : 22;
  const r  = size === 'sm' ? BORDER_RADIUS.md : size === 'lg' ? BORDER_RADIUS.xl : BORDER_RADIUS.lg;

  const inner = (
    <View style={[styles.inner, { height: h, paddingHorizontal: px, borderRadius: r, gap: 8 }]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#000' : COLORS.accent} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { fontSize: fz, color: variant === 'primary' || variant === 'danger' ? 'oklch(8% 0.04 265)' : variant === 'secondary' ? COLORS.text : variant === 'accent_ghost' ? COLORS.accent : COLORS.textSecondary }]}>{label}</Text>
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}
        style={[{ borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 }, fullWidth && { width: '100%' }, style]}>
        <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: r }}>
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}
        style={[{ borderRadius: r, overflow: 'hidden', opacity: disabled ? 0.4 : 1 }, fullWidth && { width: '100%' }, style]}>
        <LinearGradient colors={GRAD.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: r }}>
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const bg = variant === 'secondary' ? COLORS.glass06 : variant === 'accent_ghost' ? 'rgba(123,94,250,0.10)' : 'transparent';
  const bc = variant === 'secondary' ? COLORS.glassBorder : variant === 'accent_ghost' ? 'rgba(123,94,250,0.30)' : 'rgba(255,255,255,0.15)';

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}
      style={[{ borderRadius: r, backgroundColor: bg, borderWidth: 1, borderColor: bc, opacity: disabled ? 0.4 : 1 }, fullWidth && { width: '100%' }, style]}>
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', letterSpacing: -0.2 },
});
