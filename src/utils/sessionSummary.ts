import { PRDetail, SetLog, WorkoutSession } from '../types';
import { sessionLoad } from './volume';

const repsOf = (s: SetLog) => (s.actualRepsToFailure && s.actualRepsToFailure > 0 ? s.actualRepsToFailure : s.actualReps);

/** One completed set, in the order it was logged, for the summary chart. */
export interface SetPoint {
  exName: string;
  reps:   number;
  weight: number;
  unit:   string;
  /** weight × reps, or reps for bodyweight sets (so they still plot). */
  vol:    number;
}

export interface SessionSummary {
  /** Weight moved in the user's unit (weighted sets only). */
  load:        number;
  unit:        'kg' | 'lb';
  sets:        number;
  reps:        number;
  minutes:     number;
  points:      SetPoint[];
  /** Index into `points` of the best set by volume, or -1. */
  bestIdx:     number;
  heaviest:    SetPoint | null;
  /** The last time this same plan day was completed, for comparison. */
  previous:    { load: number; finishedAt: string } | null;
  records:     PRDetail[];
  baselines:   PRDetail[];
}

export function summarizeSession(
  session: WorkoutSession,
  history: WorkoutSession[],
  unit: 'kg' | 'lb',
): SessionSummary {
  const points: SetPoint[] = session.exercises.flatMap(ex =>
    ex.sets.filter(s => s.isCompleted).map(s => {
      const reps = repsOf(s);
      const weight = s.actualWeight ?? 0;
      return {
        exName: ex.exerciseName,
        reps,
        weight,
        unit: ex.weightUnit,
        vol: weight > 0 ? reps * weight : reps,
      };
    }),
  );

  const bestIdx = points.reduce((best, p, i) => (best < 0 || p.vol > points[best].vol ? i : best), -1);
  const heaviest = points.reduce<SetPoint | null>((h, p) => (p.weight > (h?.weight ?? 0) ? p : h), null);

  const finishedAt = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now();
  const prev = history
    .filter(s =>
      s.id !== session.id &&
      s.status === 'completed' &&
      s.planId === session.planId &&
      s.dayPosition === session.dayPosition &&
      !!s.finishedAt &&
      new Date(s.finishedAt).getTime() < finishedAt,
    )
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0];

  const details = session.prDetails ?? [];

  return {
    load:     sessionLoad(session.exercises, unit),
    unit,
    sets:     points.length,
    reps:     points.reduce((a, p) => a + p.reps, 0),
    minutes:  session.duration,
    points,
    bestIdx,
    heaviest: heaviest && heaviest.weight > 0 ? heaviest : null,
    previous: prev ? { load: sessionLoad(prev.exercises, unit), finishedAt: prev.finishedAt! } : null,
    records:  details.filter(d => !d.isFirst),
    baselines: details.filter(d => d.isFirst),
  };
}

const METRIC_LABEL: Record<PRDetail['metric'], string> = {
  weight: 'Heaviest lift',
  reps:   'Most reps',
  volume: 'Best set',
};

export function prMetricLabel(d: PRDetail): string {
  return METRIC_LABEL[d.metric];
}

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : (Math.round(n * 10) / 10).toLocaleString());

/** "82.5 kg", "12 reps", "960 kg" — a record value with its unit. */
export function fmtRecord(value: number, unit: string): string {
  return unit === 'reps' ? `${num(value)} reps` : `${num(value)} ${unit}`;
}
