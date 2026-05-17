import { WorkoutDay, WorkoutSession } from '../../types';
import { BadgeVariant } from '../../components/common/Badge';
import { ExerciseLibraryItem } from '../../types';
import { EXERCISE_LIBRARY } from '../../data/exercises';

// ─── Day-status helpers ──────────────────────────────────────────────────────

export type DayStatus = 'completed' | 'missed' | 'rest' | 'current' | 'upcoming';

export function dayIsRest(day: WorkoutDay): boolean {
  return day.isRestDay === true || day.label?.toLowerCase() === 'rest';
}

export function getStatus(
  day: WorkoutDay,
  currentPos: number,
  sessions: WorkoutSession[],
): DayStatus {
  if (dayIsRest(day)) return 'rest';
  // Check session history first — a completed/missed session takes priority
  // over the "current" indicator so the badge reflects reality.
  const last = sessions
    .filter(s => s.dayPosition === day.dayPosition && s.finishedAt)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0];
  if (last?.status === 'completed') return 'completed';
  if (last?.status === 'missed')    return 'missed';
  if (day.dayPosition === currentPos) return 'current';
  return 'upcoming';
}

export const STATUS_BADGE: Record<DayStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'Done',     variant: 'completed' },
  missed:    { label: 'Missed',   variant: 'missed'    },
  current:   { label: 'Today',    variant: 'current'   },
  upcoming:  { label: 'Upcoming', variant: 'upcoming'  },
  rest:      { label: 'Rest',     variant: 'rest'      },
};

export function topTags(day: WorkoutDay): string[] {
  const counts: Record<string, number> = {};
  day.exercises.forEach(ex =>
    (ex.muscleTags ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }),
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

// ─── Smart exercise recommendations ──────────────────────────────────────────

const KEYWORD_TO_GROUP: Record<string, string[]> = {
  push: ['Chest', 'Shoulders', 'Triceps'],
  pull: ['Back', 'Biceps'],
  leg: ['Legs'], legs: ['Legs'],
  chest: ['Chest'], back: ['Back'],
  shoulder: ['Shoulders'], shoulders: ['Shoulders'],
  arm: ['Biceps', 'Triceps'], arms: ['Biceps', 'Triceps'],
  bicep: ['Biceps'], biceps: ['Biceps'],
  tricep: ['Triceps'], triceps: ['Triceps'],
  core: ['Core'], abs: ['Core'], ab: ['Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Legs'], squat: ['Legs'], deadlift: ['Back', 'Legs'],
  glute: ['Legs'], quad: ['Legs'], hamstring: ['Legs'],
  calf: ['Legs'], calves: ['Legs'],
};

export const LIB_GROUP_TO_TAGS: Record<string, string[]> = {
  Chest: ['Chest'], Back: ['Back'], Shoulders: ['Shoulders'],
  Biceps: ['Biceps'], Triceps: ['Triceps'], Core: ['Core'],
  Legs: ['Quads', 'Hamstrings', 'Glutes'],
};

// Pick up to 4 library exercises that match the day label (e.g. "Push Day"
// → Chest / Shoulders / Triceps) and aren't already on the day.
export function getRecommended(
  dayLabel: string,
  existingNames: Set<string>,
): ExerciseLibraryItem[] {
  const words = dayLabel.toLowerCase().split(/\W+/);
  const groups = new Set<string>();
  words.forEach(w => (KEYWORD_TO_GROUP[w] ?? []).forEach(g => groups.add(g)));

  const pool = groups.size === 0
    ? EXERCISE_LIBRARY
    : EXERCISE_LIBRARY.filter(ex => groups.has(ex.muscleGroup));

  return pool.filter(ex => !existingNames.has(ex.name.toLowerCase())).slice(0, 4);
}
