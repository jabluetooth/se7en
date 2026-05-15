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
