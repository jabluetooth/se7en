import { WorkoutSession, SetLog, WeightUnit } from '../types';

// One entry per session that contained this exercise. Captures the headline
// per-session figures (top weight, top reps, volume, estimated 1RM) so the
// Progress screen can chart / sort without re-walking the raw sets each time.
export interface ExerciseSessionPoint {
  sessionId:  string;
  finishedAt: string;
  topWeight:  number;
  topReps:    number;
  topVolume:  number;
  est1RM:     number;
  sets:       SetLog[];
}

export interface ExerciseHistory {
  exerciseId:   string;
  exerciseName: string;
  weightUnit:   WeightUnit;
  isBodyweight: boolean;
  sessions:     ExerciseSessionPoint[];   // chronological, oldest → newest
}

// Epley 1RM estimate. Returns 0 for non-weighted reps so callers can guard.
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// Walk every completed session → group sets by exerciseId, capture top weight,
// top reps, volume, est1RM for each session occurrence.
export function aggregateExercises(sessions: WorkoutSession[]): ExerciseHistory[] {
  const byId = new Map<string, ExerciseHistory>();

  for (const session of sessions) {
    if (session.status !== 'completed' || !session.finishedAt) continue;
    for (const ex of session.exercises) {
      const completed = ex.sets.filter(s => s.isCompleted);
      if (completed.length === 0) continue;

      const heaviest = completed.reduce<SetLog>(
        (b, s) => ((s.actualWeight ?? 0) > (b.actualWeight ?? 0) ? s : b),
        completed[0],
      );
      const topWeight = heaviest.actualWeight ?? 0;
      const topReps   = heaviest.actualRepsToFailure ?? heaviest.actualReps;

      const isBw      = ex.weightUnit === 'bodyweight';
      const topVolume = completed.reduce(
        (a, s) => a + (s.actualRepsToFailure ?? s.actualReps) * (s.actualWeight ?? (isBw ? 1 : 0)),
        0,
      );
      const est1RM    = (isBw || ex.weightUnit === 'plates') ? 0 : epley1RM(topWeight, topReps);

      const entry = byId.get(ex.exerciseId) ?? {
        exerciseId:   ex.exerciseId,
        exerciseName: ex.exerciseName,
        weightUnit:   ex.weightUnit,
        isBodyweight: isBw,
        sessions:     [],
      };
      entry.sessions.push({
        sessionId:  session.id,
        finishedAt: session.finishedAt,
        topWeight, topReps, topVolume, est1RM,
        sets:       completed,
      });
      byId.set(ex.exerciseId, entry);
    }
  }

  for (const h of byId.values()) {
    h.sessions.sort((a, b) =>
      new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
  }
  return [...byId.values()];
}
