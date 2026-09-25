import { SessionExercise, SetLog, WeightUnit } from '../types';

function setVolume(set: SetLog, weightUnit: WeightUnit): number {
  if (weightUnit === 'bodyweight' || weightUnit === 'plates') {
    return set.actualReps;
  }
  const weight = set.actualWeight ?? 1;
  const reps = set.actualRepsToFailure ?? set.actualReps;
  return reps * weight;
}

export function exerciseVolume(exercise: SessionExercise): number {
  return exercise.sets
    .filter((s) => s.isCompleted)
    .reduce((sum, s) => sum + setVolume(s, exercise.weightUnit), 0);
}

export function sessionTotalVolume(exercises: SessionExercise[]): number {
  return exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
}

const KG_PER_LB = 0.45359237;

/**
 * Weight moved (weight × reps) across completed sets, in one unit.
 *
 * Unlike `sessionTotalVolume` — which adds each exercise in its own unit, and
 * counts bodyweight/plate exercises as plain reps — this converts kg and lb
 * into `unit` and leaves reps-only exercises out, so the total can be labelled
 * honestly as "kg" or "lb".
 */
export function sessionLoad(exercises: SessionExercise[], unit: 'kg' | 'lb'): number {
  let total = 0;
  for (const ex of exercises) {
    if (ex.weightUnit !== 'kg' && ex.weightUnit !== 'lb') continue;
    const factor = ex.weightUnit === unit ? 1 : ex.weightUnit === 'kg' ? 1 / KG_PER_LB : KG_PER_LB;
    for (const set of ex.sets) {
      if (!set.isCompleted || set.actualWeight == null) continue;
      const reps = set.actualRepsToFailure ?? set.actualReps;
      total += reps * set.actualWeight * factor;
    }
  }
  return total;
}
