import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MOTION } from '../../constants/motion';

interface Props {
  /** Position in the list — drives the stagger delay. Capped internally so
   *  long lists don't take seconds to finish entering. */
  index?:    number;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
}

const MAX_STAGGER_INDEX = 8;

// Tasteful fade + rise entrance for list items (Cycle days, Progress cards,
// Coach messages, …) — mounts once per item (keyed by the caller's `key`
// prop) so reordering an already-mounted item does NOT retrigger the
// animation, only genuinely new items entering the list. Honors reduced-motion.
export function FadeInItem({ index = 0, children, style }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity        = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY      = useRef(new Animated.Value(reducedMotion ? 0 : 10)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const delay = Math.min(index, MAX_STAGGER_INDEX) * MOTION.stagger;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: MOTION.standard.duration, delay,
        easing: MOTION.standard.easing, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: MOTION.standard.duration, delay,
        easing: MOTION.standard.easing, useNativeDriver: true,
      }),
    ]).start();
    // Intentionally runs once per mount (+ once more if reduced-motion toggles
    // mid-flight) — not on every `index` change from a reorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
