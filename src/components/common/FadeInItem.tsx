import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { MAX_STAGGER_ITEMS, SPRING, STAGGER_MS } from '../../motion/tokens';

interface Props {
  /** Position in the list — drives the stagger delay. Capped internally so
   *  long lists don't take seconds to finish entering. */
  index?:    number;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
}

// Fade + rise + slight spring entrance for list items (Cycle days, Progress
// cards, Coach messages, …). Runs on the UI thread via a Reanimated layout
// animation, once per mount (keyed by the caller's `key`), so reordering an
// already-mounted item does not replay it; only genuinely new items animate.
// Skipped entirely when the OS "Reduce Motion" setting is on.
export function FadeInItem({ index = 0, children, style }: Props) {
  const entering = FadeInDown
    .delay(Math.min(index, MAX_STAGGER_ITEMS) * STAGGER_MS)
    .springify()
    .damping(SPRING.gentle.damping)
    .stiffness(SPRING.gentle.stiffness)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })
    .reduceMotion(ReduceMotion.System);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
