import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterRise } from '../../motion/presets';

interface Props {
  /** Position in the list — drives the stagger delay. Capped internally so
   *  long lists don't take seconds to finish entering. */
  index?:    number;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
}

// Soft fade + short rise entrance for list items (Cycle days, Progress
// cards, Coach messages, …). Runs on the UI thread via a Reanimated layout
// animation, once per mount (keyed by the caller's `key`), so reordering an
// already-mounted item does not replay it; only genuinely new items animate.
// Skipped entirely when the OS "Reduce Motion" setting is on.
export function FadeInItem({ index = 0, children, style }: Props) {
  return (
    <Animated.View entering={enterRise(index)} style={style}>
      {children}
    </Animated.View>
  );
}
