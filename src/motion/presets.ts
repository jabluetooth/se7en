// Shared entering / exiting / layout animations, all built on the soft
// ease-out timings in ./tokens.ts. Use these instead of Reanimated's builders
// directly (FadeInDown.springify(), ZoomIn, …) so every screen moves the same
// quiet way: short distances, no springs, no overshoot.
import {
  Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, Keyframe,
  LinearTransition, ReduceMotion, SlideInDown, SlideOutDown,
} from 'react-native-reanimated';
import { DRIFT, EASE_OUT, MAX_STAGGER_ITEMS, STAGGER_MS, TIMING } from './tokens';

const system = ReduceMotion.System;

/** Content arriving in place: fade in while rising a few points. */
export function enterRise(index = 0) {
  return FadeInUp
    .duration(TIMING.standard.duration)
    .easing(EASE_OUT)
    .delay(Math.min(index, MAX_STAGGER_ITEMS) * STAGGER_MS)
    .withInitialValues({ opacity: 0, transform: [{ translateY: DRIFT }] })
    .reduceMotion(system);
}

/** Content arriving from above (toasts): fade in while settling down a few points. */
export const enterFromTop = FadeInDown
  .duration(TIMING.standard.duration)
  .easing(EASE_OUT)
  .withInitialValues({ opacity: 0, transform: [{ translateY: -DRIFT * 2 }] })
  .reduceMotion(system);

export const exitToTop = FadeOutUp.duration(TIMING.quick.duration).reduceMotion(system);

/** Plain fades. */
export const enterFade = FadeIn.duration(TIMING.standard.duration).easing(EASE_OUT).reduceMotion(system);
export const exitFade  = FadeOut.duration(TIMING.quick.duration).reduceMotion(system);

/**
 * A small thing appearing (a checkmark, a badge): fades in while growing
 * from 90% — noticeable enough to register, never a "pop".
 */
export const enterSettle = new Keyframe({
  0:   { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(TIMING.standard.duration).reduceMotion(system);

/**
 * A small floating surface (an info bubble, a popover): fades in while
 * growing from 96% and settling a couple of points into place.
 */
export const enterBubble = new Keyframe({
  0:   { opacity: 0, transform: [{ scale: 0.96 }, { translateY: 3 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(TIMING.quick.duration + 40).reduceMotion(system);

/** Bottom sheets and docked bars sliding in from the bottom edge. */
export const enterSheet = SlideInDown.duration(TIMING.emphasis.duration).easing(EASE_OUT).reduceMotion(system);
export const exitSheet  = SlideOutDown.duration(220).easing(Easing.in(Easing.quad)).reduceMotion(system);

/** Docked bars (the rest timer): a short rise and fade rather than a full slide. */
export const enterDock = FadeInDown
  .duration(TIMING.emphasis.duration)
  .easing(EASE_OUT)
  .withInitialValues({ opacity: 0, transform: [{ translateY: DRIFT * 3 }] })
  .reduceMotion(system);
export const exitDock = FadeOut.duration(TIMING.quick.duration).reduceMotion(system);

/** Siblings shifting when something above them grows, shrinks or leaves. */
export const layoutSoft = LinearTransition.duration(TIMING.standard.duration).easing(EASE_OUT).reduceMotion(system);
