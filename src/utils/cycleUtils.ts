/**
 * Derives which plan day (1–7) corresponds to a given calendar date, using
 * the stored cycle start date (the calendar date when Day 1 began).
 *
 * If no cycleStartDate is stored we fall back to the legacy manual position.
 */

/** Today's day position in the 7-day cycle. */
export function computeDayPosition(
  cycleStartDate: string | null,
  fallback = 1,
): number {
  if (!cycleStartDate) return fallback;
  const start = new Date(cycleStartDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return 1;
  return (diff % 7) + 1;
}

/** Day position (1–7) for any arbitrary calendar date. Returns null if
 *  the date is before the cycle started or no cycle is set. */
export function dayPositionForDate(
  cycleStartDate: string | null,
  date: Date,
): number | null {
  if (!cycleStartDate) return null;
  const start = new Date(cycleStartDate + 'T00:00:00');
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return (diff % 7) + 1;
}

/** Shift a YYYY-MM-DD string by ±N calendar days. */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format YYYY-MM-DD as e.g. "Mon, May 12" */
export function formatCycleDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
