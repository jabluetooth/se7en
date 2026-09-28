import type { Exercise } from '../types';

// Small formatting helpers used across screens (Progress, Home, PostWorkout).
// Consolidated here so a tweak (precision, separators, locale) lands everywhere
// at once instead of being copy-pasted into each screen.

/**
 * Format a numeric volume figure with a `k` shorthand once it crosses 1 000.
 * 999 → "999", 1 234 → "1.2k", 12 345 → "12.3k"
 */
export function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * Short, locale-aware month/day label — e.g. "Mar 12".
 */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "4 sets × 8–10 · 60 kg", "3 sets to failure", "3 sets × 12". */
export function planLabel(ex: Exercise): string {
  const sets = `${ex.targetSets} set${ex.targetSets === 1 ? '' : 's'}`;
  const reps = ex.toFailure
    ? ' to failure'
    : ex.targetRepsMax && ex.targetRepsMax !== ex.targetRepsMin
      ? ` × ${ex.targetRepsMin}–${ex.targetRepsMax}`
      : ex.targetRepsMin ? ` × ${ex.targetRepsMin}` : '';
  const weight = ex.targetWeight && ex.targetWeight > 0 && ex.weightUnit !== 'bodyweight'
    ? ` · ${ex.targetWeight} ${ex.weightUnit}`
    : '';
  return sets + reps + weight;
}
