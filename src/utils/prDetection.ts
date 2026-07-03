import { PersonalRecord, SessionExercise, WorkoutSession } from '../types';
import { exerciseVolume } from './volume';

interface PRUpdates {
  updatedPRs: PersonalRecord[];
  prsBreached: string[];
}

export function detectPRs(
  session: WorkoutSession,
  existingPRs: PersonalRecord[],
): PRUpdates {
  const updatedPRs: PersonalRecord[] = [];
  const prsBreached: string[] = [];

  for (const exercise of session.exercises) {
    if (!exercise.isCompleted && exercise.sets.every((s) => !s.isCompleted)) continue;

    const completedSets = exercise.sets.filter((s) => s.isCompleted);
    if (completedSets.length === 0) continue;

    const maxWeight = Math.max(...completedSets.map((s) => s.actualWeight ?? 0));
    // actualRepsToFailure defaults to 0 for to-failure sets until the user edits
    // it — nullish coalescing wouldn't fall back for that 0, so use it only when
    // it's a genuine positive rep count; otherwise use the plain actualReps.
    const repsForSet = (s: (typeof completedSets)[number]) =>
      s.actualRepsToFailure && s.actualRepsToFailure > 0 ? s.actualRepsToFailure : s.actualReps;
    const maxReps = Math.max(...completedSets.map(repsForSet));
    const maxVolume = Math.max(
      ...completedSets.map((s) => {
        // Match maxWeight's null handling — a set with no recorded weight
        // contributes 0 volume rather than a spurious reps*1.
        const w = s.actualWeight ?? 0;
        return repsForSet(s) * w;
      }),
    );

    const existing = existingPRs.find((pr) => pr.exerciseId === exercise.exerciseId);
    const now = new Date().toISOString();
    let pr: PersonalRecord = existing
      ? { ...existing }
      : {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          heaviestWeight: 0,
          heaviestWeightDate: now,
          mostReps: 0,
          mostRepsDate: now,
          highestVolume: 0,
          highestVolumeDate: now,
          updatedAt: now,
        };

    let broken = false;
    if (maxWeight > pr.heaviestWeight) {
      pr = { ...pr, heaviestWeight: maxWeight, heaviestWeightDate: now };
      broken = true;
    }
    if (maxReps > pr.mostReps) {
      pr = { ...pr, mostReps: maxReps, mostRepsDate: now };
      broken = true;
    }
    if (maxVolume > pr.highestVolume) {
      pr = { ...pr, highestVolume: maxVolume, highestVolumeDate: now };
      broken = true;
    }
    if (broken) {
      pr.updatedAt = now;
      updatedPRs.push(pr);
      prsBreached.push(exercise.exerciseName);
    }
  }

  return { updatedPRs, prsBreached };
}
