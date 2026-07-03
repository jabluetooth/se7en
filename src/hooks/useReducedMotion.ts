import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Tracks the OS-level "Reduce Motion" accessibility setting so continuous /
// decorative animation loops (pulses, typing dots, glow breathing, etc.) can
// skip straight to their resting visual state instead of looping forever.
// One-shot feedback animations (press scale, transitions) are NOT gated by
// this — only indefinite loops that serve no functional purpose for users
// who've asked the OS to minimise motion.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (mounted) setReduced(value); })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      setReduced(value);
    });

    return () => { mounted = false; sub.remove(); };
  }, []);

  return reduced;
}
