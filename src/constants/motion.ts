// ─── Se7en · Shared motion language ───────────────────────────────────────
// A single set of timing/easing constants so every hand-rolled Animated.timing
// call in the app reads from the same "feel" instead of picking ad hoc
// durations per component. Three tiers, matching how the app actually uses
// motion:
//   quick    — immediate press/selection feedback (button opacity, chip taps)
//   standard — sheet/section transitions, list entrances, cross-fades
//   slow     — deliberately slow ambient motion (rest-timer pulse, glow breathe)
// `stagger` is the per-item delay step for list entrance choreography.
import { Easing } from 'react-native';

export const MOTION = {
  quick: {
    duration: 120,
    easing:   Easing.out(Easing.quad),
  },
  standard: {
    duration: 240,
    easing:   Easing.out(Easing.cubic),
  },
  slow: {
    duration: 550,
    easing:   Easing.inOut(Easing.sin),
  },
  // Per-item delay step for staggered list entrances (day cards, exercise
  // cards, chat bubbles). Capped by callers at ~8 items so long lists don't
  // take seconds to finish appearing.
  stagger: 45,
} as const;
