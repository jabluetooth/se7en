/**
 * widgetService.ts
 * Singleton that keeps widget state in sync between the JS layer,
 * AsyncStorage, and the native Se7enWidgets module.
 *
 * Design principles:
 *  - Never throws — every public method is wrapped in try/catch.
 *  - WidgetNative calls are throttled: reloadWidgets() fires at most once every 2 s.
 *  - Works without the native module (Expo Go, simulator without extension).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import WidgetNative from './widgetNative';
import type { WorkoutSession, WorkoutPlan } from '../types';
import { sessionTotalVolume } from '../utils/volume';

// ─── WidgetState ──────────────────────────────────────────────────────────────

export interface WidgetState {
  isActive: boolean;
  // workout context
  planName: string;
  dayLabel: string;
  dayNum: number;
  cycleNum: number;
  // current exercise
  exerciseName: string;
  setNum: number;
  setTotal: number;
  targetWeight: number | null;
  targetRepsLabel: string;   // "8–12" or "8"
  weightUnit: string;
  // session stats
  setsCompleted: number;
  totalSets: number;
  sessionVolume: number;
  elapsedSecs: number;
  // rest timer
  restActive: boolean;
  restRemaining: number;
  restTotal: number;
  restEndEpoch: number;      // wall-clock ms when rest ends (for background accuracy)
  // next workout (idle state)
  nextDayLabel: string;
  nextDayNum: number;
  nextExercises: string[];   // first 3 exercise names
  // coach widget
  coachSummary: string;
  // progress snapshot
  weekVolume: number;
  weekSessions: number;
  streakDays: number;
  updatedAt: number;
}

const STORAGE_KEY = '@se7en_widget_state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultState(): WidgetState {
  return {
    isActive: false,
    planName: '', dayLabel: '', dayNum: 0, cycleNum: 0,
    exerciseName: '', setNum: 0, setTotal: 0,
    targetWeight: null, targetRepsLabel: '', weightUnit: 'kg',
    setsCompleted: 0, totalSets: 0, sessionVolume: 0, elapsedSecs: 0,
    restActive: false, restRemaining: 0, restTotal: 0, restEndEpoch: 0,
    nextDayLabel: '', nextDayNum: 0, nextExercises: [],
    coachSummary: '',
    weekVolume: 0, weekSessions: 0, streakDays: 0,
    updatedAt: 0,
  };
}

/**
 * Build a targetRepsLabel string from min/max rep targets on an exercise.
 */
function repsLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return '';
  if (min == null) return String(max);
  if (max == null || min === max) return String(min);
  return `${min}–${max}`;
}

/**
 * Count total sets across all exercises in a session.
 */
function countTotalSets(session: WorkoutSession): number {
  return session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

/**
 * Count completed sets across all exercises in a session.
 */
function countCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.isCompleted).length,
    0,
  );
}

/**
 * Find the "current" exercise — the first exercise that still has incomplete sets,
 * or fall back to the last exercise.
 */
function findCurrentExercise(session: WorkoutSession) {
  const active = session.exercises.find(ex => !ex.isCompleted && ex.sets.some(s => !s.isCompleted));
  return active ?? session.exercises[session.exercises.length - 1] ?? null;
}

/**
 * Find the current set number within an exercise.
 */
function findCurrentSetNum(exercise: ReturnType<typeof findCurrentExercise>): number {
  if (!exercise) return 1;
  const firstIncomplete = exercise.sets.findIndex(s => !s.isCompleted);
  return firstIncomplete === -1 ? exercise.sets.length : firstIncomplete + 1;
}

// ─── WidgetService singleton ──────────────────────────────────────────────────

class WidgetService {
  private state: WidgetState = defaultState();
  private reloadThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReloadAt = 0;
  private readonly RELOAD_THROTTLE_MS = 2000;

  // ── Core push ──────────────────────────────────────────────

  private async push(partial: Partial<WidgetState>): Promise<void> {
    try {
      this.state = { ...this.state, ...partial, updatedAt: Date.now() };
      const json = JSON.stringify(this.state);

      // Persist locally so data survives a JS restart
      AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});

      // Push to native side
      WidgetNative.setWidgetData(json);

      // Throttled reload
      this.scheduleReload();
    } catch {
      // Never throw
    }
  }

  private scheduleReload(): void {
    try {
      const now = Date.now();
      const msSinceLast = now - this.lastReloadAt;

      if (msSinceLast >= this.RELOAD_THROTTLE_MS) {
        // Safe to reload immediately
        this.lastReloadAt = now;
        WidgetNative.reloadWidgets();
        return;
      }

      // Schedule for the remainder of the throttle window
      if (this.reloadThrottleTimer) return; // already pending
      const delay = this.RELOAD_THROTTLE_MS - msSinceLast;
      this.reloadThrottleTimer = setTimeout(() => {
        try {
          this.reloadThrottleTimer = null;
          this.lastReloadAt = Date.now();
          WidgetNative.reloadWidgets();
        } catch { /* noop */ }
      }, delay);
    } catch {
      // Never throw
    }
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Called whenever the active session state changes (start, complete set, etc.).
   * Pass the raw session object, current elapsed timer seconds, and optional plan.
   */
  async updateSession(
    session: WorkoutSession,
    sessionTimer: number,
    plan?: WorkoutPlan | null,
  ): Promise<void> {
    try {
      const currentEx = findCurrentExercise(session);
      const setNum = findCurrentSetNum(currentEx);
      const setTotal = currentEx?.sets.length ?? 0;

      // Derive target reps label from the current set's target
      let targetRepsLabel = '';
      let targetWeight: number | null = null;
      if (currentEx) {
        const currentSet = currentEx.sets[setNum - 1];
        targetWeight = currentSet?.targetWeight ?? null;

        // Try per-set targets first, fall back to exercise-level targets
        if (currentSet?.targetReps != null) {
          targetRepsLabel = String(currentSet.targetReps);
        } else {
          // Look up plan exercise for min/max
          const planDay = plan?.days.find(d => d.dayPosition === session.dayPosition);
          const planEx = planDay?.exercises.find(e => e.id === currentEx.exerciseId);
          if (planEx) {
            targetRepsLabel = repsLabel(planEx.targetRepsMin, planEx.targetRepsMax);
            if (targetWeight == null) targetWeight = planEx.targetWeight;
          }
        }
      }

      const setsCompleted = countCompletedSets(session);
      const totalSets = countTotalSets(session);
      const sessionVolume = sessionTotalVolume(session.exercises);

      await this.push({
        isActive: true,
        planName: plan?.name ?? '',
        dayLabel: session.dayLabel,
        dayNum: session.dayPosition,
        cycleNum: 1, // Cycle tracking requires separate store — default to 1
        exerciseName: currentEx?.exerciseName ?? '',
        setNum,
        setTotal,
        targetWeight,
        targetRepsLabel,
        weightUnit: currentEx?.weightUnit ?? 'kg',
        setsCompleted,
        totalSets,
        sessionVolume: Math.round(sessionVolume),
        elapsedSecs: sessionTimer,
      });
    } catch {
      // Never throw
    }
  }

  /**
   * Called every second from the rest timer to update the countdown.
   */
  async setRestTimer(
    remaining: number,
    total: number,
    exerciseName: string,
  ): Promise<void> {
    try {
      const restEndEpoch = Date.now() + remaining * 1000;
      await this.push({
        restActive: true,
        restRemaining: Math.max(0, remaining),
        restTotal: total,
        restEndEpoch,
        exerciseName,
      });
      // Also update the Live Activity with the latest rest data
      WidgetNative.updateLiveActivity(
        JSON.stringify({
          restActive: true,
          restRemaining: Math.max(0, remaining),
          restTotal: total,
          restEndEpoch,
          exerciseName,
        }),
      );
    } catch {
      // Never throw
    }
  }

  /**
   * Called when the rest timer ends or is dismissed.
   */
  async clearRestTimer(): Promise<void> {
    try {
      await this.push({
        restActive: false,
        restRemaining: 0,
        restTotal: 0,
        restEndEpoch: 0,
      });
      WidgetNative.updateLiveActivity(
        JSON.stringify({ restActive: false, restRemaining: 0 }),
      );
    } catch {
      // Never throw
    }
  }

  /**
   * Called when the session finishes. Transitions widget to idle state.
   */
  async endSession(): Promise<void> {
    try {
      WidgetNative.endLiveActivity();
      await this.push({
        isActive: false,
        restActive: false,
        restRemaining: 0,
        restTotal: 0,
        restEndEpoch: 0,
        exerciseName: '',
        setNum: 0,
        setTotal: 0,
        setsCompleted: 0,
        totalSets: 0,
        sessionVolume: 0,
        elapsedSecs: 0,
      });
    } catch {
      // Never throw
    }
  }

  /**
   * Called from the home screen to update the idle / "next workout" state.
   * Pass the active plan, all sessions, and the cycle start date so we can
   * compute week stats and the next upcoming day.
   */
  async updateIdle(
    activePlan?: WorkoutPlan | null,
    sessions?: WorkoutSession[],
    cycleStartDate?: string | null,
  ): Promise<void> {
    try {
      if (!activePlan) {
        await this.push({ isActive: false, planName: '' });
        return;
      }

      // ── Next workout day ──────────────────────────────────
      // Find the first non-rest day in the plan (simple sequential selection).
      // A more sophisticated implementation would use cycleStartDate + sessions
      // to derive the actual next scheduled day.
      const today = new Date();
      let nextDay = activePlan.days.find(d => !d.isRestDay);
      let nextDayLabel = nextDay?.label ?? '';
      let nextDayNum = nextDay?.dayPosition ?? 0;
      let nextExercises: string[] = [];

      if (cycleStartDate && sessions) {
        // Compute how many days have elapsed since cycle start
        const cycleStart = new Date(cycleStartDate + 'T00:00:00');
        const daysSinceStart = Math.floor(
          (today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
        );
        // Map elapsed days to a day slot (0-indexed within plan.days)
        const totalDays = activePlan.days.length;
        if (totalDays > 0) {
          const slotIndex = daysSinceStart % totalDays;
          // Find next non-rest day at or after slotIndex
          const sortedDays = [...activePlan.days].sort(
            (a, b) => a.dayPosition - b.dayPosition,
          );
          const nextSlot =
            sortedDays.slice(slotIndex).find(d => !d.isRestDay) ??
            sortedDays.find(d => !d.isRestDay);
          if (nextSlot) {
            nextDay = nextSlot;
            nextDayLabel = nextSlot.label;
            nextDayNum = nextSlot.dayPosition;
          }
        }
      }

      if (nextDay) {
        nextExercises = nextDay.exercises
          .sort((a, b) => a.order - b.order)
          .slice(0, 3)
          .map(e => e.name);
      }

      // ── Week stats ────────────────────────────────────────
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentSessions = (sessions ?? []).filter(s => {
        if (s.status !== 'completed' || !s.finishedAt) return false;
        return new Date(s.finishedAt) >= sevenDaysAgo;
      });
      const weekVolume = recentSessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
      const weekSessions = recentSessions.length;

      // ── Streak ────────────────────────────────────────────
      const streakDays = this.computeStreak(sessions ?? []);

      await this.push({
        isActive: false,
        planName: activePlan.name,
        nextDayLabel,
        nextDayNum,
        nextExercises,
        weekVolume: Math.round(weekVolume),
        weekSessions,
        streakDays,
      });
    } catch {
      // Never throw
    }
  }

  /**
   * Called when the AI Coach produces a new summary so the coach widget
   * can display the latest insight.
   */
  async updateCoach(summary: string): Promise<void> {
    try {
      await this.push({ coachSummary: summary });
    } catch {
      // Never throw
    }
  }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Compute the current consecutive-day workout streak from session history.
   */
  private computeStreak(sessions: WorkoutSession[]): number {
    try {
      const completedDates = new Set<string>();
      for (const s of sessions) {
        if (s.status === 'completed' && s.finishedAt) {
          const d = new Date(s.finishedAt);
          completedDates.add(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          );
        }
      }

      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (completedDates.has(key)) {
          streak++;
        } else if (i > 0) {
          // Allow today to be empty (workout not done yet)
          break;
        }
      }
      return streak;
    } catch {
      return 0;
    }
  }

  /**
   * Start an iOS Live Activity when a session begins.
   */
  async startLiveActivity(
    session: WorkoutSession,
    plan?: WorkoutPlan | null,
  ): Promise<void> {
    try {
      const currentEx = findCurrentExercise(session);
      const setNum = findCurrentSetNum(currentEx);
      const planDay = plan?.days.find(d => d.dayPosition === session.dayPosition);
      const planEx = planDay?.exercises.find(e => e.id === currentEx?.exerciseId);

      const activityData = {
        exerciseName: currentEx?.exerciseName ?? '',
        setNum,
        setTotal: currentEx?.sets.length ?? 0,
        targetWeight: currentEx?.sets[setNum - 1]?.targetWeight ?? null,
        targetRepsLabel: planEx
          ? repsLabel(planEx.targetRepsMin, planEx.targetRepsMax)
          : '',
        setsCompleted: countCompletedSets(session),
        totalSets: countTotalSets(session),
        sessionVolume: Math.round(sessionTotalVolume(session.exercises)),
        elapsedSecs: 0,
        restActive: false,
        restRemaining: 0,
        restTotal: 0,
        restEndEpoch: 0,
        dayLabel: session.dayLabel,
        planName: plan?.name ?? '',
      };

      WidgetNative.startLiveActivity(JSON.stringify(activityData));
    } catch {
      // Never throw
    }
  }
}

// Export singleton instance
export const widgetService = new WidgetService();
