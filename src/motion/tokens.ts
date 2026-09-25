// ─── Se7en · Motion tokens (Reanimated 4) ─────────────────────────────────
// The one place the app's "feel" is defined. The brief: motion should be
// felt more than seen. So there are no springs and nothing overshoots —
// every animation is an ease-out curve that decelerates into place, moves a
// short distance, and finishes quickly.
//
//   TIMING.press    — a finger landing on something tappable
//   TIMING.release  — letting go
//   TIMING.standard — most state changes (fades, small moves, rotations)
//   TIMING.emphasis — bigger surfaces arriving (sheets, the rest bar)
//
// Every config carries `reduceMotion: ReduceMotion.System`, so when the OS
// "Reduce Motion" setting is on Reanimated jumps straight to the end state.
// Entering/exiting/layout presets built on these live in ./presets.ts.
//
// The legacy `constants/motion.ts` (for React Native's built-in Animated) stays
// until the screens still using it are migrated.
import { Easing, ReduceMotion, type WithTimingConfig } from 'react-native-reanimated';

const system = ReduceMotion.System;

/** A soft ease-out: fast start, long gentle landing, no overshoot. */
export const EASE_OUT = Easing.bezier(0.22, 0.8, 0.3, 1);

export const TIMING = {
  press:    { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: system },
  release:  { duration: 180, easing: EASE_OUT,                reduceMotion: system },
  quick:    { duration: 160, easing: EASE_OUT,                reduceMotion: system },
  standard: { duration: 260, easing: EASE_OUT,                reduceMotion: system },
  emphasis: { duration: 340, easing: EASE_OUT,                reduceMotion: system },
  // Linear for things that must track real time exactly (rest-timer ring).
  linear:   { duration: 1000, easing: Easing.linear,          reduceMotion: system },
} as const satisfies Record<string, WithTimingConfig>;

/** Per-item delay for staggered list entrances; capped by callers. */
export const STAGGER_MS = 35;
export const MAX_STAGGER_ITEMS = 8;

/** How far entering content drifts into place, in points. */
export const DRIFT = 6;

/** How far pressable things shrink under a finger. Kept barely perceptible. */
export const PRESS_SCALE = {
  subtle: 0.99,  // large cards and rows
  normal: 0.98,  // buttons
  strong: 0.95,  // small icon buttons and chips
} as const;
