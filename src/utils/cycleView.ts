import { WorkoutDay, WorkoutPlan, WorkoutSession } from '../types';

export type DayStatus = 'done' | 'rest' | 'missed' | 'upcoming';

export interface CycleSlot {
  /** 1-based position in the plan's visible (possibly reordered) order. */
  slot:    number;
  day:     WorkoutDay;
  /** Calendar date this slot falls on in the current cycle. */
  date:    Date;
  isToday: boolean;
  isPast:  boolean;
  status:  DayStatus;
  /** The completed session for this day in the current cycle, if any. */
  session: WorkoutSession | null;
}

export interface CycleView {
  slots:      CycleSlot[];
  /** Which cycle this is, counting from the anchor date (1-based). */
  cycleNum:   number;
  /** Done workouts plus rest days already behind you, as a share of the cycle. */
  progress:   number;
  doneCount:  number;
  workoutCount: number;
}

/**
 * The current cycle, day by day. "Done" means completed within THIS cycle's
 * dates — a workout finished last cycle doesn't tick this cycle's slot.
 * Sessions match slots by the day's stable dayPosition, so a drag-reorder on
 * the Cycle screen doesn't lose them.
 */
export function buildCycleView(
  plan: WorkoutPlan,
  sessions: WorkoutSession[],
  currentDayPos: number,
  cycleStartDate: string | null,
): CycleView {
  const len = plan.days.length || 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - (currentDayPos - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + len);

  const inCycle = sessions.filter(s => {
    if (s.status !== 'completed' || !s.finishedAt) return false;
    const t = new Date(s.finishedAt);
    return t >= start && t < end;
  });

  const slots: CycleSlot[] = plan.days.map((day, i) => {
    const slot = i + 1;
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const isToday = slot === currentDayPos;
    const isPast = slot < currentDayPos;
    const session = day.isRestDay
      ? null
      : inCycle
          .filter(s => s.dayPosition === day.dayPosition)
          .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0] ?? null;
    const status: DayStatus = day.isRestDay
      ? 'rest'
      : session
      ? 'done'
      : isPast
      ? 'missed'
      : 'upcoming';
    return { slot, day, date, isToday, isPast, status, session };
  });

  const doneCount = slots.filter(s => s.status === 'done').length;
  const restBehind = slots.filter(s => s.status === 'rest' && s.isPast).length;
  const workoutCount = slots.filter(s => !s.day.isRestDay).length;

  let cycleNum = 1;
  if (cycleStartDate) {
    const anchor = new Date(cycleStartDate + 'T00:00:00');
    const diff = Math.floor((today.getTime() - anchor.getTime()) / 86_400_000);
    cycleNum = diff >= 0 ? Math.floor(diff / len) + 1 : 1;
  }

  return {
    slots,
    cycleNum,
    progress: len > 0 ? (doneCount + restBehind) / len : 0,
    doneCount,
    workoutCount,
  };
}

/** "Today", "Tomorrow", "Yesterday", "In 3 days", "2 days ago". */
export function relativeDay(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}
