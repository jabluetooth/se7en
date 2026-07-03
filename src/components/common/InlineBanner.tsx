import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../../constants';

interface Props {
  message:   string;
  onRetry?:  () => void;
  /** 'warning' (default) for sync/connectivity issues, 'danger' for hard failures. */
  variant?:  'warning' | 'danger';
}

// Small inline banner for surfacing recoverable data-sync errors in context
// (e.g. "couldn't sync your plans, showing last saved copy") without blocking
// the whole screen — pairs with each store's `loadError` field.
export function InlineBanner({ message, onRetry, variant = 'warning' }: Props) {
  const color = variant === 'danger' ? COLORS.danger : COLORS.warning;

  return (
    <View
      style={[ib.wrap, { borderColor: color + '40', backgroundColor: color + '14' }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Ionicons name="cloud-offline-outline" size={15} color={color} style={{ marginTop: 1 }} />
      <Text style={[ib.text, { color }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[ib.retryBtn, { borderColor: color + '50' }]}
          accessibilityRole="button"
          accessibilityLabel="Retry sync"
        >
          <Text style={[ib.retryTxt, { color }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const ib = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: SPACING.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  text: {
    flex: 1, fontSize: 12, fontFamily: FONTS.semibold, fontWeight: '600', lineHeight: 17,
  },
  retryBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
  },
  retryTxt: {
    fontSize: 11, fontFamily: FONTS.headline, fontWeight: '700',
  },
});
