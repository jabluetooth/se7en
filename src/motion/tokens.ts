// ─── Se7en · Motion tokens (Reanimated 4) ─────────────────────────────────
// The one place the app's "feel" is defined. Every animation should pick a
// preset from here rather than inventing its own numbers, so the whole app
// moves like one product.
//
//   SPRING.press   — the squish when a finger lands on something tappable
//   SPRING.snappy  — UI that should settle fast (toggles, pills, press release)
//   SPRING.gentle  — larger surfaces arriving (sheets, cards, toasts, lists)
//   SPRING.bouncy  — celebratory moments only (PR badge, set complete tick)
//
// Damping ratio ζ = damping / (2·√(stiffness·mass)). press, snappy and gentle
// sit at ζ ≈ 1 (critically damped): they settle as fast as possible without
// overshooting, so nothing wobbles. Only `bouncy` is underdamped (ζ ≈ 0.7),
// giving one small overshoot, and it is reserved for celebrations.
//
// Every config carries `reduceMotion: ReduceMotion.System`, so when the OS
// "Reduce Motion" setting is on Reanimated jumps straight to the end state.
//
// The legacy `constants/motion.ts` (for React Native's built-in Animated) stays
// until the screens still using it are migrated.
import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

const system = ReduceMotion.System;

export const SPRING = {
  press:  { damping: 35, stiffness: 500, mass: 0.6, reduceMotion: system }, // ζ ≈ 1.0
  snappy: { damping: 32, stiffness: 320, mass: 0.8, reduceMotion: system }, // ζ ≈ 1.0
  gentle: { damping: 27, stiffness: 180, mass: 1,   reduceMotion: system }, // ζ ≈ 1.0
  bouncy: { damping: 19, stiffness: 240, mass: 0.8, reduceMotion: system }, // ζ ≈ 0.7
} as const satisfies Record<string, WithSpringConfig>;

export const TIMING = {
  quick:    { duration: 140, easing: Easing.out(Easing.quad),        reduceMotion: system },
  standard: { duration: 260, easing: Easing.out(Easing.cubic),       reduceMotion: system },
  emphasis: { duration: 420, easing: Easing.bezier(0.2, 0.9, 0.1, 1), reduceMotion: system },
  // Linear for things that must track real time exactly (rest-timer ring).
  linear:   { duration: 1000, easing: Easing.linear,                 reduceMotion: system },
} as const satisfies Record<string, WithTimingConfig>;

/** Per-item delay for staggered list entrances; capped by callers. */
export const STAGGER_MS = 45;
export const MAX_STAGGER_ITEMS = 8;

/** How far pressable things shrink under a finger. */
export const PRESS_SCALE = {
  subtle: 0.98,  // large cards and rows
  normal: 0.96,  // buttons
  strong: 0.9,   // small icon buttons and chips
} as const;
