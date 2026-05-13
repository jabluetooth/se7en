import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSessions, fsActiveSession } from '../services/firestoreService';
import {
  WorkoutSession, SessionExercise, SetLog,
  WorkoutDay, Exercise, SessionStatus, SkipReason,
} from '../types';
import { generateId } from '../utils/idGen';
import { sessionTotalVolume } from '../utils/volume';
import type { Unsubscribe } from 'firebase/firestore';

const ACTIVE_KEY  = '@se7en_active_session';
const HISTORY_KEY = '@se7en_session_history';

interface SessionStore {
  activeSession: WorkoutSession | null;
  sessions:      WorkoutSession[];
  loaded:        boolean;
  sessionTimer:  number;
  timerInterval: ReturnType<typeof setInterval> | null;
  _unsub:        Unsubscribe | null;

  load:       (uid: string) => Promise<void>;
  startSync:  (uid: string) => void;
  stopSync:   () => void;

  startSession:           (planId: string, day: WorkoutDay) => void;
  completeSet:            (exerciseId: string, setId: string, data: Partial<SetLog>) => void;
  addSetNote:             (exerciseId: string, setId: string, note: string) => void;
  finishSession:          (sessionNote?: string) => Promise<WorkoutSession>;
  skipDay:                (planId: string, dayPosition: number, dayLabel: string, reason?: SkipReason) => Promise<WorkoutSession>;
  acknowledgeRestDay:     (planId: string, dayPosition: number, dayLabel: string) => Promise<void>;
  /** Log a day as fully completed at its scheduled calendar date (uses cycleStartDate to derive the date). */
  quickCompleteDay:       (planId: string, day: WorkoutDay, cycleStartDate: string | null) => Promise<WorkoutSession>;
  /** Wipe all session history locally and from Firestore. */
  clearAllSessions:       () => Promise<void>;
  getSessionsForExercise: (exerciseName: string) => WorkoutSession[];
  getLastSession:         (dayPosition: number) => WorkoutSession | undefined;
  startTimer:             () => void;
  stopTimer:              () => void;
  clearActiveSession:     () => void;
}

function buildExercises(day: WorkoutDay): SessionExercise[] {
  return day.exercises.sort((a, b) => a.order - b.order).map(ex => ({
    id: generateId(), exerciseId: ex.id, exerciseName: ex.name, order: ex.order,
    setType: ex.setType, weightUnit: ex.weightUnit, barType: ex.barType,
    barWeight: ex.barWeight, isCompleted: false,
    sets: Array.from({ length: ex.targetSets }, (_, i) => {
      const per = ex.perSetTargets?.find(p => p.setNumber === i + 1);
      return {
        id: generateId(), setNumber: i + 1,
        targetReps:   per?.targetReps  ?? ex.targetRepsMin ?? null,
        targetWeight: per?.targetWeight ?? ex.targetWeight ?? null,
        actualReps: 0, actualRepsToFailure: ex.toFailure ? 0 : null,
        actualWeight: ex.targetWeight ?? null,
        platesUsed: [], notes: '', isCompleted: false, completedAt: null,
      } as SetLog;
    }),
  }));
}

async function getUid() {
  return (await import('../config/firebase')).auth.currentUser?.uid ?? null;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null, sessions: [], loaded: false,
  sessionTimer: 0, timerInterval: null, _unsub: null,

  load: async (uid) => {
    // Cache first
    try {
      const [rawActive, rawHistory] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);
      const cached   = rawActive  ? JSON.parse(rawActive)  as WorkoutSession : null;
      const history  = rawHistory ? JSON.parse(rawHistory) as WorkoutSession[] : [];
      if (cached) {
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(cached.startedAt!).getTime()) / 1000));
        set({ activeSession: cached, sessions: history, loaded: true, sessionTimer: elapsed });
        get().startTimer();
      } else {
        set({ sessions: history, loaded: true });
      }
    } catch (e) { __DEV__ && console.warn('[se7en/session]', e); }

    // Firestore authoritative
    try {
      const [remoteActive, remoteHistory] = await Promise.all([
        fsActiveSession.get(uid),
        fsSessions.getAll(uid),
      ]);
      if (remoteActive) {
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(remoteActive.startedAt!).getTime()) / 1000));
        set({ activeSession: remoteActive, sessionTimer: elapsed });
        await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(remoteActive));
        if (!get().timerInterval) get().startTimer();
      }
      if (remoteHistory.length > 0) {
        set({ sessions: remoteHistory });
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(remoteHistory));
      }
    } catch (e) { __DEV__ && console.warn('[se7en/session]', e); }

    set({ loaded: true });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsSessions.listen(uid, async sessions => {
      set({ sessions });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get().stopTimer();
    get()._unsub?.();
    set({ activeSession: null, sessions: [], loaded: false, sessionTimer: 0, _unsub: null });
    AsyncStorage.multiRemove([ACTIVE_KEY, HISTORY_KEY]);
  },

  startSession: (planId, day) => {
    const session: WorkoutSession = {
      id: generateId(), planId, dayPosition: day.dayPosition, dayLabel: day.label,
      status: 'partial', startedAt: new Date().toISOString(), finishedAt: null,
      duration: 0, skipReason: null, sessionNote: null, totalVolume: 0,
      prsBreached: [], exercises: buildExercises(day),
    };
    set({ activeSession: session });
    AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    getUid().then(uid => { if (uid) fsActiveSession.set(uid, session).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
    get().startTimer();
  },

  completeSet: (exerciseId, setId, data) => {
    set(s => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const sets = ex.sets.map(st =>
          st.id === setId ? { ...st, ...data, isCompleted: true, completedAt: new Date().toISOString() } : st
        );
        return { ...ex, sets, isCompleted: sets.every(st => st.isCompleted) };
      });
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(updated));
      getUid().then(uid => { if (uid) fsActiveSession.set(uid, updated).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
      return { activeSession: updated };
    });
  },

  addSetNote: (exerciseId, setId, note) => {
    set(s => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map(ex =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, notes: note } : st) }
          : ex
      );
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(updated));
      return { activeSession: updated };
    });
  },

  finishSession: async (sessionNote) => {
    get().stopTimer();
    const session  = get().activeSession!;
    const finished: WorkoutSession = {
      ...session, status: 'completed', finishedAt: new Date().toISOString(),
      duration: Math.round(get().sessionTimer / 60),
      sessionNote: sessionNote ?? null,
      totalVolume: sessionTotalVolume(session.exercises),
    };
    const sessions = [...get().sessions, finished];
    set({ activeSession: null, sessions, sessionTimer: 0 });
    await Promise.all([
      AsyncStorage.removeItem(ACTIVE_KEY),
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions)),
    ]);
    const uid = await getUid();
    if (uid) {
      await Promise.all([
        fsActiveSession.clear(uid).catch(e => __DEV__ && console.warn('[se7en/session]', e)),
        fsSessions.set(uid, finished).catch(e => __DEV__ && console.warn('[se7en/session]', e)),
      ]);
    }
    return finished;
  },

  skipDay: async (planId, dayPosition, dayLabel, reason) => {
    const session: WorkoutSession = {
      id: generateId(), planId, dayPosition, dayLabel, status: 'missed',
      startedAt: null, finishedAt: new Date().toISOString(), duration: 0,
      skipReason: reason ?? null, sessionNote: null, totalVolume: 0,
      prsBreached: [], exercises: [],
    };
    const sessions = [...get().sessions, session];
    set({ sessions });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    const uid = await getUid();
    if (uid) fsSessions.set(uid, session).catch(e => __DEV__ && console.warn('[se7en/session]', e));
    return session;
  },

  acknowledgeRestDay: async () => {},

  quickCompleteDay: async (planId, day, cycleStartDate) => {
    // Derive the calendar date for this day position from the cycle anchor.
    let finishedAt: string;
    if (cycleStartDate) {
      const d = new Date(cycleStartDate + 'T00:00:00');
      d.setDate(d.getDate() + (day.dayPosition - 1));
      d.setHours(18, 0, 0, 0); // log at 6 PM on the scheduled date
      finishedAt = d.toISOString();
    } else {
      finishedAt = new Date().toISOString();
    }

    // Skip if already logged as completed on this calendar date
    const targetDate = finishedAt.slice(0, 10);
    const existing = get().sessions.find(s =>
      s.planId === planId &&
      s.dayPosition === day.dayPosition &&
      s.finishedAt?.slice(0, 10) === targetDate &&
      s.status === 'completed',
    );
    if (existing) return existing;

    const exercises = buildExercises(day).map(ex => ({
      ...ex,
      isCompleted: true,
      sets: ex.sets.map(st => ({
        ...st,
        actualReps:   st.targetReps   ?? 0,
        actualWeight: st.targetWeight ?? null,
        isCompleted:  true,
        completedAt:  finishedAt,
      })),
    }));

    const session: WorkoutSession = {
      id: generateId(), planId,
      dayPosition: day.dayPosition, dayLabel: day.label,
      status: 'completed',
      startedAt: finishedAt, finishedAt,
      duration: 0, skipReason: null, sessionNote: null,
      totalVolume: sessionTotalVolume(exercises),
      prsBreached: [], exercises,
    };

    const sessions = [...get().sessions, session];
    set({ sessions });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    const uid = await getUid();
    if (uid) fsSessions.set(uid, session).catch(e => __DEV__ && console.warn('[se7en/session]', e));
    return session;
  },

  clearAllSessions: async () => {
    get().stopTimer();
    set({ sessions: [], activeSession: null, sessionTimer: 0 });
    await Promise.all([
      AsyncStorage.removeItem(HISTORY_KEY),
      AsyncStorage.removeItem(ACTIVE_KEY),
    ]);
    const uid = await getUid();
    if (uid) {
      try {
        await Promise.all([fsSessions.deleteAll(uid), fsActiveSession.clear(uid)]);
      } catch (e) { __DEV__ && console.warn('[se7en/session] clearAll', e); }
    }
  },

  getSessionsForExercise: (exerciseName) =>
    get().sessions.filter(s => s.exercises.some(e => e.exerciseName === exerciseName)),

  getLastSession: (dayPosition) =>
    get().sessions
      .filter(s => s.dayPosition === dayPosition && s.status === 'completed')
      .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0],

  startTimer: () => {
    if (get().timerInterval) return;
    const interval = setInterval(() => set(s => ({ sessionTimer: s.sessionTimer + 1 })), 1000);
    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const i = get().timerInterval;
    if (i) clearInterval(i);
    set({ timerInterval: null });
  },

  clearActiveSession: () => {
    get().stopTimer();
    set({ activeSession: null, sessionTimer: 0 });
    AsyncStorage.removeItem(ACTIVE_KEY);
    getUid().then(uid => { if (uid) fsActiveSession.clear(uid).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
  },
}));
