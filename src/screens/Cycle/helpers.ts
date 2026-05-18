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
  day:            WorkoutDay,
  displayPos:     number,        // 1-indexed slot position in the visible list
  currentPos:     number,
  sessions:       WorkoutSession[],
  cycleStartDate: string | null,
): DayStatus {
  if (dayIsRest(day)) return 'rest';

  // Filter sessions to the CURRENT cycle's date window so:
  //   1. Cycle 1's "Done" badge doesn't bleed into Cycle 2 (visual auto-reset)
  //   2. Past unrecorded days in this cycle can fall through to auto-"missed"
  // Falls back to "use all sessions, don't auto-miss" when no cycleStartDate
  // is set (first-run / migrated users).
  let cycleSessions = sessions;
  let canAutoMiss   = false;

  if (cycleStartDate) {
    const startDate = new Date(cycleStartDate + 'T00:00:00');
    startDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff  = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);

    if (diff >= 0) {
      // Each cycle is 7 days; figure out which cycle window contains today.
      const cyclesPassed = Math.floor(diff / 7);
      const cycleStart = new Date(startDate);
      cycleStart.setDate(cycleStart.getDate() + cyclesPassed * 7);
      const cycleEnd   = new Date(cycleStart);
      cycleEnd.setDate(cycleEnd.getDate() + 7);

      cycleSessions = sessions.filter(s => {
        if (!s.finishedAt) return false;
        const d = new Date(s.finishedAt);
        return d >= cycleStart && d < cycleEnd;
      });
      canAutoMiss = true;
    }
  }

  // Session lookup uses the stable `dayPosition` (the content's identity) so a
  // completed exercise keeps its "Done" badge no matter where it's dragged.
  // Slot-based comparisons (`displayPos`) drive the visual current/past
  // semantics so the Today highlight and the auto-missed status follow the
  // card's *position*, not its content.
  const last = cycleSessions
    .filter(s => s.dayPosition === day.dayPosition && s.finishedAt)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0];
  if (last?.status === 'completed') return 'completed';
  if (last?.status === 'missed')    return 'missed';
  if (displayPos === currentPos)    return 'current';
  if (canAutoMiss && displayPos < currentPos) return 'missed';
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
