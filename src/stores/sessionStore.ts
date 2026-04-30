import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WorkoutSession,
  SessionExercise,
  SetLog,
  WorkoutDay,
  Exercise,
  SessionStatus,
  SkipReason,
} from '../types';
import { generateId } from '../utils/idGen';
import { sessionTotalVolume } from '../utils/volume';

const SESSION_KEY = '@se7en_active_session';
const HISTORY_KEY = '@se7en_session_history';

interface SessionStore {
  activeSession: WorkoutSession | null;
  sessions: WorkoutSession[];
  loaded: boolean;
  sessionTimer: number; // elapsed seconds
  timerInterval: ReturnType<typeof setInterval> | null;

  load: () => Promise<void>;
  startSession: (planId: string, day: WorkoutDay) => void;
  completeSet: (exerciseId: string, setId: string, data: Partial<SetLog>) => void;
  addSetNote: (exerciseId: string, setId: string, note: string) => void;
  finishSession: (sessionNote?: string) => Promise<WorkoutSession>;
  skipDay: (planId: string, dayPosition: number, dayLabel: string, reason?: SkipReason) => Promise<WorkoutSession>;
  acknowledgeRestDay: (planId: string, dayPosition: number, dayLabel: string) => Promise<void>;
  getSessionsForExercise: (exerciseName: string) => WorkoutSession[];
  getLastSession: (dayPosition: number) => WorkoutSession | undefined;
  startTimer: () => void;
  stopTimer: () => void;
  clearActiveSession: () => void;
}

function buildSessionExercises(day: WorkoutDay): SessionExercise[] {
  return day.exercises
    .sort((a, b) => a.order - b.order)
    .map((ex) => ({
      id: generateId(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      order: ex.order,
      setType: ex.setType,
      weightUnit: ex.weightUnit,
      barType: ex.barType,
      barWeight: ex.barWeight,
      isCompleted: false,
      sets: Array.from({ length: ex.targetSets }, (_, i) => {
        const perSet = ex.perSetTargets?.find((p) => p.setNumber === i + 1);
        return {
          id: generateId(),
          setNumber: i + 1,
          targetReps: perSet?.targetReps ?? ex.targetRepsMin ?? null,
          targetWeight: perSet?.targetWeight ?? ex.targetWeight ?? null,
          actualReps: 0,
          actualRepsToFailure: ex.toFailure ? 0 : null,
          actualWeight: ex.targetWeight ?? null,
          platesUsed: [],
          notes: '',
          isCompleted: false,
          completedAt: null,
        } as SetLog;
      }),
    }));
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null,
  sessions: [],
  loaded: false,
  sessionTimer: 0,
  timerInterval: null,

  load: async () => {
    try {
      const [rawSession, rawHistory] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);
      const activeSession = rawSession ? (JSON.parse(rawSession) as WorkoutSession) : null;
      const sessions = rawHistory ? (JSON.parse(rawHistory) as WorkoutSession[]) : [];
      set({ activeSession, sessions, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  startSession: (planId, day) => {
    const exercises = buildSessionExercises(day);
    const session: WorkoutSession = {
      id: generateId(),
      planId,
      dayPosition: day.dayPosition,
      dayLabel: day.label,
      status: 'partial',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      duration: 0,
      skipReason: null,
      sessionNote: null,
      totalVolume: 0,
      prsBreached: [],
      exercises,
    };
    set({ activeSession: session });
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    get().startTimer();
  },

  completeSet: (exerciseId, setId, data) => {
    set((s) => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const sets = ex.sets.map((st) =>
          st.id === setId
            ? { ...st, ...data, isCompleted: true, completedAt: new Date().toISOString() }
            : st,
        );
        const isCompleted = sets.every((st) => st.isCompleted);
        return { ...ex, sets, isCompleted };
      });
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return { activeSession: updated };
    });
  },

  addSetNote: (exerciseId, setId, note) => {
    set((s) => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map((st) => (st.id === setId ? { ...st, notes: note } : st)) }
          : ex,
      );
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return { activeSession: updated };
    });
  },

  finishSession: async (sessionNote) => {
    get().stopTimer();
    const session = get().activeSession!;
    const elapsed = get().sessionTimer;
    const totalVolume = sessionTotalVolume(session.exercises);
    const finished: WorkoutSession = {
      ...session,
      status: 'completed',
      finishedAt: new Date().toISOString(),
      duration: Math.round(elapsed / 60),
      sessionNote: sessionNote ?? null,
      totalVolume,
    };
    const sessions = [...get().sessions, finished];
    set({ activeSession: null, sessions, sessionTimer: 0 });
    await Promise.all([
      AsyncStorage.removeItem(SESSION_KEY),
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions)),
    ]);
    return finished;
  },

  skipDay: async (planId, dayPosition, dayLabel, reason) => {
    const session: WorkoutSession = {
      id: generateId(),
      planId,
      dayPosition,
      dayLabel,
      status: 'missed',
      startedAt: null,
      finishedAt: new Date().toISOString(),
      duration: 0,
      skipReason: reason ?? null,
      sessionNote: null,
      totalVolume: 0,
      prsBreached: [],
      exercises: [],
    };
    const sessions = [...get().sessions, session];
    set({ sessions });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    return session;
  },

  acknowledgeRestDay: async (planId, dayPosition, dayLabel) => {
    // Just record that a rest day was acknowledged (optional)
  },

  getSessionsForExercise: (exerciseName) => {
    return get().sessions.filter((s) =>
      s.exercises.some((e) => e.exerciseName === exerciseName),
    );
  },

  getLastSession: (dayPosition) => {
    const matching = get().sessions
      .filter((s) => s.dayPosition === dayPosition && s.status === 'completed')
      .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());
    return matching[0];
  },

  startTimer: () => {
    const interval = setInterval(() => {
      set((s) => ({ sessionTimer: s.sessionTimer + 1 }));
    }, 1000);
    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const interval = get().timerInterval;
    if (interval) clearInterval(interval);
    set({ timerInterval: null });
  },

  clearActiveSession: () => {
    get().stopTimer();
    set({ activeSession: null, sessionTimer: 0 });
    AsyncStorage.removeItem(SESSION_KEY);
  },
}));
