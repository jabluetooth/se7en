import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BORDER_RADIUS, SPACING } from '../../constants';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style, textStyle }: Props) {
  const { colors } = useTheme();

  const bg = {
    primary: colors.accent,
    secondary: colors.surfaceElevated,
    danger: colors.danger,
    ghost: 'transparent',
  }[variant];

  const fg = {
    primary: '#000',
    secondary: colors.text,
    danger: '#fff',
    ghost: colors.accent,
  }[variant];

  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.label, { color: fg }, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  disabled: { opacity: 0.4 },
});
