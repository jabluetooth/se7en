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
