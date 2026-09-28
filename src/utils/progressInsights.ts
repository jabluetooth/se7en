import type { PRDetail, WorkoutSession } from '../types';
import { aggregateExercises, type ExerciseHistory } from './exerciseHistory';
import { sessionLoad } from './volume';

export type Period = '4w' | '3m' | 'all';

export const PERIOD_LABEL: Record<Period, string> = { '4w': '4 weeks', '3m': '3 months', all: 'All time' };
const PERIOD_DAYS: Record<Period, number | null> = { '4w': 28, '3m': 91, all: null };

export interface Gain {
  exerciseId:   string;
  exerciseName: string;
  unit:         string;
  from:         number;
  to:           number;
  /** Top-set weights over the window, oldest first, starting at the baseline. */
  series:       number[];
}

export interface PeriodSummary {
  workouts:     number;
  volume:       number;
  records:      number;
  /** Same figures for the equal-length window just before; null for all time. */
  prevWorkouts: number | null;
  prevVolume:   number | null;
  gain:         Gain | null;
  recentPRs:    (PRDetail & { finishedAt: string })[];
}

const DAY = 86_400_000;

/**
 * Everything the top of Progress shows for one time window: totals compared
 * with the window before, the lift that improved most, and the latest records.
 */
export function summarize(sessions: WorkoutSession[], period: Period, unit: 'kg' | 'lb', now = Date.now()): PeriodSummary {
  const done = sessions.filter(s => s.status === 'completed' && s.finishedAt);
  const days = PERIOD_DAYS[period];
  const start = days == null ? -Infinity : now - days * DAY;
  const prevStart = days == null ? -Infinity : now - 2 * days * DAY;
  const at = (s: WorkoutSession) => new Date(s.finishedAt!).getTime();

  const inWin = done.filter(s => at(s) >= start && at(s) <= now);
  const inPrev = days == null ? [] : done.filter(s => at(s) >= prevStart && at(s) < start);

  const vol = (list: WorkoutSession[]) => list.reduce((a, s) => a + sessionLoad(s.exercises, unit), 0);

  const recentPRs = inWin
    .flatMap(s => (s.prDetails ?? []).filter(d => !d.isFirst && d.metric === 'weight').map(d => ({ ...d, finishedAt: s.finishedAt! })))
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());

  return {
    workouts: inWin.length,
    volume: vol(inWin),
    records: inWin.reduce((a, s) => a + (s.prsBreached?.length ?? 0), 0),
    prevWorkouts: days == null ? null : inPrev.length,
    prevVolume: days == null ? null : vol(inPrev),
    gain: biggestGain(done, start, now),
    recentPRs,
  };
}

/**
 * The weighted lift whose best top set in the window beats its baseline by
 * the largest share. The baseline is the last session before the window, or
 * the first one inside it when there is none.
 */
export function biggestGain(sessions: WorkoutSession[], start: number, now: number): Gain | null {
  let best: { gain: Gain; pct: number } | null = null;
  for (const h of aggregateExercises(sessions)) {
    if (h.isBodyweight || h.weightUnit === 'plates') continue;
    const pts = h.sessions.filter(p => p.topWeight > 0);
    const t = (p: typeof pts[number]) => new Date(p.finishedAt).getTime();
    const before = pts.filter(p => t(p) < start);
    const inside = pts.filter(p => t(p) >= start && t(p) <= now);
    const baseline = before[before.length - 1] ?? inside[0];
    const after = before.length ? inside : inside.slice(1);
    if (!baseline || after.length === 0) continue;
    const to = Math.max(...after.map(p => p.topWeight));
    if (to <= baseline.topWeight) continue;
    const pct = (to - baseline.topWeight) / baseline.topWeight;
    if (!best || pct > best.pct) {
      best = {
        pct,
        gain: {
          exerciseId: h.exerciseId,
          exerciseName: h.exerciseName,
          unit: h.weightUnit,
          from: baseline.topWeight,
          to,
          series: [baseline.topWeight, ...after.map(p => p.topWeight)],
        },
      };
    }
  }
  return best?.gain ?? null;
}

// ─── Workouts per week ────────────────────────────────────────────────────────

export interface WeekBar {
  /** Monday 00:00 of the week, local time. */
  start:   number;
  count:   number;
  current: boolean;
}

function mondayOf(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Completed workouts per calendar week (Monday to Sunday) across the window:
 * 4 bars for 4 weeks, 13 for 3 months, and for all time every week since the
 * first workout (at least 4, at most 52).
 */
export function weeklyCounts(sessions: WorkoutSession[], period: Period, now = Date.now()): WeekBar[] {
  const done = sessions.filter(s => s.status === 'completed' && s.finishedAt);
  const thisWeek = mondayOf(now);
  let weeks = period === '4w' ? 4 : period === '3m' ? 13 : 4;
  if (period === 'all' && done.length) {
    const first = mondayOf(Math.min(...done.map(s => new Date(s.finishedAt!).getTime())));
    weeks = Math.min(52, Math.max(4, Math.round((thisWeek.getTime() - first.getTime()) / (7 * DAY)) + 1));
  }
  const counts = new Map<number, number>();
  for (const s of done) {
    const k = mondayOf(new Date(s.finishedAt!).getTime()).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const bars: WeekBar[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    const start = d.getTime();
    bars.push({ start, count: counts.get(start) ?? 0, current: i === 0 });
  }
  return bars;
}

// ─── One lift over the window ─────────────────────────────────────────────────

export interface LiftTrend {
  /** Top-set value per workout in the window (weight, or reps for bodyweight). */
  series:  number[];
  latest:  number;
  /** Latest minus the first workout in the window; null with fewer than two. */
  change:  number | null;
  /** The latest top set is the best ever. */
  isBest:  boolean;
  lastAt:  string;
}

export function liftTrend(h: ExerciseHistory, period: Period, now = Date.now()): LiftTrend | null {
  if (h.sessions.length === 0) return null;
  const metric = (p: ExerciseHistory['sessions'][number]) => (h.isBodyweight ? p.topReps : p.topWeight);
  const days = PERIOD_DAYS[period];
  const start = days == null ? -Infinity : now - days * DAY;
  const inWin = h.sessions.filter(p => new Date(p.finishedAt).getTime() >= start);
  const pts = inWin.length ? inWin : h.sessions.slice(-1);
  const series = pts.slice(-12).map(metric);
  const latest = metric(h.sessions[h.sessions.length - 1]);
  const best = Math.max(...h.sessions.map(metric));
  return {
    series,
    latest,
    change: inWin.length >= 2 ? metric(inWin[inWin.length - 1]) - metric(inWin[0]) : null,
    isBest: h.sessions.length >= 2 && latest >= best && latest > Math.max(...h.sessions.slice(0, -1).map(metric)),
    lastAt: h.sessions[h.sessions.length - 1].finishedAt,
  };
}

/** "+2", "−1", "same"; null when there is nothing to compare with. */
export function deltaLabel(now: number, prev: number | null, percent = false): string | null {
  if (prev == null) return null;
  if (percent) {
    if (prev <= 0) return now > 0 ? 'new' : null;
    const pct = Math.round(((now - prev) / prev) * 100);
    return pct === 0 ? 'same as before' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs before`;
  }
  const d = now - prev;
  return d === 0 ? 'same as before' : `${d > 0 ? '+' : '−'}${Math.abs(d)} vs before`;
}
