/**
 * Format a Date as YYYY-MM-DD using LOCAL calendar fields.
 *
 * Never use `date.toISOString().slice(0,10)` for this — toISOString() emits
 * the UTC date, which is one day earlier than local midnight in UTC+ zones
 * (e.g. Philippines UTC+8, where local midnight = UTC previous day 16:00).
 */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Today's 1-based slot index in the active plan cycle.
 * Pass `cycleLen` (activePlan.days.length) so non-7-day plans work correctly.
 */
export function computeDayPosition(
  cycleStartDate: string | null,
  fallback = 1,
  cycleLen = 7,
): number {
  if (!cycleStartDate) return fallback;
  const start = new Date(cycleStartDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return 1;
  return (diff % cycleLen) + 1;
}

/**
 * 1-based slot index for any arbitrary calendar date.
 * Returns null if the date is before the cycle started or no cycle is set.
 */
export function dayPositionForDate(
  cycleStartDate: string | null,
  date: Date,
  cycleLen = 7,
): number | null {
  if (!cycleStartDate) return null;
  const start = new Date(cycleStartDate + 'T00:00:00');
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return (diff % cycleLen) + 1;
}

/** Shift a YYYY-MM-DD string by ±N calendar days. */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

/** Format YYYY-MM-DD as e.g. "Mon, May 12" */
export function formatCycleDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
