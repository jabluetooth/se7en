import React, { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PRESS_SCALE, SPRING } from './tokens';

export type HapticKind = 'none' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning';

export function fireHaptic(kind: HapticKind): void {
  const run = (): Promise<void> | undefined => {
    switch (kind) {
      case 'selection': return Haptics.selectionAsync();
      case 'light':     return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':     return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':   return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':   return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      default:          return undefined;
    }
  };
  run()?.catch(() => {});
}

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. Defaults to `normal` (0.96). */
  scale?: keyof typeof PRESS_SCALE | number;
  /** Haptic fired when the press completes. Defaults to none. */
  haptic?: HapticKind;
  /** Also dims while pressed, for surfaces where a scale alone reads too subtle. */
  dimOnPress?: boolean;
}

/**
 * The app's standard tappable surface: Pressable plus a spring "squish" on the
 * UI thread and optional haptic feedback. Replaces TouchableOpacity, whose
 * opacity flash gives no sense of physical press.
 *
 * `style` lands on the Pressable itself, exactly like TouchableOpacity, so
 * layout (flex, width, margins) behaves the same after a swap.
 */
export const AnimatedPressable = forwardRef<View, AnimatedPressableProps>(function AnimatedPressable(
  { style, scale = 'normal', haptic = 'none', dimOnPress = false, disabled, onPress, onPressIn, onPressOut, ...rest },
  ref,
) {
  const pressed = useSharedValue(0);
  const target = typeof scale === 'number' ? scale : PRESS_SCALE[scale];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - target) * pressed.value }],
    opacity: (disabled ? 0.4 : 1) * (dimOnPress ? 1 - 0.15 * pressed.value : 1),
  }));

  return (
    <AnimatedPressableBase
      ref={ref}
      disabled={disabled}
      onPressIn={e => {
        pressed.value = withSpring(1, SPRING.press);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        pressed.value = withSpring(0, SPRING.snappy);
        onPressOut?.(e);
      }}
      onPress={e => {
        if (haptic !== 'none') fireHaptic(haptic);
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
});
