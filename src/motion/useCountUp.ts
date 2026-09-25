import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { TIMING } from './tokens';

interface Options {
  /** ms; defaults to a calm 700 ms. */
  duration?: number;
  delay?: number;
  /** Start only once this is true (e.g. when a pager page becomes visible). */
  enabled?: boolean;
}

// Ease-out cubic: quick at first, landing softly on the final value.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts a number up from 0 to `target`, for stats that should "arrive"
 * rather than just appear. Driven from JS with requestAnimationFrame: it
 * only runs for well under a second on a handful of numbers, and a Text
 * re-render is simpler and more robust than an animated text input.
 * With Reduce Motion on, it shows the final value immediately.
 */
export function useCountUp(target: number, { duration = 700, delay = 0, enabled = true }: Options = {}): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (reduced || target === 0) {
      setValue(target);
      return;
    }
    // Replaying on every re-render would restart the count; only run once
    // per target (a changed target counts from where it is to the new one).
    const from = started.current ? value : 0;
    started.current = true;
    let frame = 0;
    let startAt: number | null = null;
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        startAt ??= now;
        const t = Math.min(1, (now - startAt) / duration);
        setValue(from + (target - from) * easeOut(t));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, reduced]);

  return value;
}

/** Default stagger between the summary's counters, in ms. */
export const COUNT_STAGGER = Math.round(TIMING.standard.duration / 3);
