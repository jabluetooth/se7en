import { PersonalRecord, PRDetail, SetLog, WorkoutSession } from '../types';

interface PRUpdates {
  /** Records to upsert: improved ones, plus a new baseline for first-timers. */
  updatedPRs: PersonalRecord[];
  /** Exercises that genuinely beat a previous record (first-timers excluded). */
  prsBreached: string[];
  /** One entry per improved metric, or one baseline entry per first-timer. */
  details: PRDetail[];
}

// actualRepsToFailure defaults to 0 for to-failure sets until the user edits
// it — nullish coalescing wouldn't fall back for that 0, so use it only when
// it's a genuine positive rep count; otherwise use the plain actualReps.
const repsForSet = (s: SetLog) =>
  s.actualRepsToFailure && s.actualRepsToFailure > 0 ? s.actualRepsToFailure : s.actualReps;

/**
 * Compares a finished session against the stored records.
 *
 * An exercise's first ever session sets a baseline rather than a "PR": with
 * no history, every metric trivially beats zero, which used to flag (and
 * notify) every exercise of a new user's first workout as a record.
 */
export function detectPRs(
  session: WorkoutSession,
  existingPRs: PersonalRecord[],
): PRUpdates {
  const updatedPRs: PersonalRecord[] = [];
  const prsBreached: string[] = [];
  const details: PRDetail[] = [];

  for (const exercise of session.exercises) {
    const completedSets = exercise.sets.filter((s) => s.isCompleted);
    if (completedSets.length === 0) continue;

    const isBodyweight = exercise.weightUnit === 'bodyweight';
    const maxWeight = Math.max(...completedSets.map((s) => s.actualWeight ?? 0));
    const maxReps = Math.max(...completedSets.map(repsForSet));
    // A set with no recorded weight contributes 0 volume rather than reps × 1.
    const maxVolume = Math.max(...completedSets.map((s) => repsForSet(s) * (s.actualWeight ?? 0)));

    const existing = existingPRs.find((pr) => pr.exerciseId === exercise.exerciseId);
    const now = new Date().toISOString();
    const base = {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
    };

    if (!existing) {
      updatedPRs.push({
        ...base,
        heaviestWeight: maxWeight, heaviestWeightDate: now,
        mostReps: maxReps,         mostRepsDate: now,
        highestVolume: maxVolume,  highestVolumeDate: now,
        updatedAt: now,
      });
      details.push(
        !isBodyweight && maxWeight > 0
          ? { ...base, metric: 'weight', unit: exercise.weightUnit, value: maxWeight, previous: 0, isFirst: true }
          : { ...base, metric: 'reps', unit: 'reps', value: maxReps, previous: 0, isFirst: true },
      );
      continue;
    }

    let pr: PersonalRecord = { ...existing };
    const improved: PRDetail[] = [];
    if (!isBodyweight && maxWeight > pr.heaviestWeight) {
      improved.push({ ...base, metric: 'weight', unit: exercise.weightUnit, value: maxWeight, previous: pr.heaviestWeight, isFirst: false });
      pr = { ...pr, heaviestWeight: maxWeight, heaviestWeightDate: now };
    }
    if (maxReps > pr.mostReps) {
      improved.push({ ...base, metric: 'reps', unit: 'reps', value: maxReps, previous: pr.mostReps, isFirst: false });
      pr = { ...pr, mostReps: maxReps, mostRepsDate: now };
    }
    if (!isBodyweight && maxVolume > pr.highestVolume) {
      improved.push({ ...base, metric: 'volume', unit: exercise.weightUnit, value: maxVolume, previous: pr.highestVolume, isFirst: false });
      pr = { ...pr, highestVolume: maxVolume, highestVolumeDate: now };
    }
    if (improved.length > 0) {
      pr.updatedAt = now;
      updatedPRs.push(pr);
      prsBreached.push(exercise.exerciseName);
      details.push(...improved);
    }
  }

  return { updatedPRs, prsBreached, details };
}

/**
 * Lightweight, single-set PR check for real-time celebration UI during an active
 * session (SetLogger) — NOT the authoritative record, which is still only written
 * by detectPRs() at finishSession(). Mirrors detectPRs' per-metric comparison
 * (weight/reps/volume, any one is enough) so the live badge and the session-end
 * record agree. With no existing record the set is a baseline, not a PR.
 */
export function isSetPR(
  actualWeight: number | null,
  actualReps: number,
  actualRepsToFailure: number | null,
  existingPR: PersonalRecord | undefined,
): boolean {
  if (!existingPR) return false;
  const weight = actualWeight ?? 0;
  const reps = actualRepsToFailure && actualRepsToFailure > 0 ? actualRepsToFailure : actualReps;
  const volume = reps * weight;
  return weight > existingPR.heaviestWeight || reps > existingPR.mostReps || volume > existingPR.highestVolume;
}
