import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSessions, fsActiveSession } from '../services/firestoreService';
import { storeNoteEmbedding } from '../services/embeddingService';
import {
  WorkoutSession, SessionExercise, SetLog,
  WorkoutDay, Exercise, SessionStatus, SkipReason,
} from '../types';
import { generateId } from '../utils/idGen';
import { sessionTotalVolume } from '../utils/volume';
import { detectPRs } from '../utils/prDetection';
import type { Unsubscribe } from 'firebase/firestore';
// Lazy imports to avoid circular dependencies — resolved at call time.
const getWidgetService = () => import('../services/widgetService').then(m => m.widgetService);
const getActivePlan    = () => import('./planStore').then(m => m.usePlanStore.getState().activePlan);
const getPRStore       = () => import('./prStore').then(m => m.usePRStore.getState());
const getSettings      = () => import('./settingsStore').then(m => m.useSettingsStore.getState().settings);

const ACTIVE_KEY  = '@se7en_active_session';
const HISTORY_KEY = '@se7en_session_history';

interface SessionStore {
  activeSession: WorkoutSession | null;
  sessions:      WorkoutSession[];
  loaded:        boolean;
  /** Set when the Firestore leg of load() fails (e.g. offline). Cleared on
   *  the next successful load()/sync. */
  loadError:     string | null;
  sessionTimer:  number;
  timerInterval: ReturnType<typeof setInterval> | null;
  _unsub:        Unsubscribe | null;

  load:       (uid: string) => Promise<void>;
  startSync:  (uid: string) => void;
  stopSync:   () => void;

  startSession:           (planId: string, day: WorkoutDay) => void;
  completeSet:            (exerciseId: string, setId: string, data: Partial<SetLog>) => void;
  addSetNote:             (exerciseId: string, setId: string, note: string) => void;
  setExerciseRPE:         (exerciseId: string, rpe: number, note: string) => void;
  finishSession:          (sessionNote?: string) => Promise<WorkoutSession>;
  skipDay:                (planId: string, dayPosition: number, dayLabel: string, reason?: SkipReason) => Promise<WorkoutSession>;
  acknowledgeRestDay:     (planId: string, dayPosition: number, dayLabel: string) => Promise<void>;
  /** Log a day as fully completed at its scheduled calendar date (uses cycleStartDate to derive the date).
   *  Pass slotIndex (0-based position in plan.days) so the calendar date is computed correctly even
   *  after drag-and-drop reordering where day.dayPosition ≠ slot offset. */
  quickCompleteDay:       (planId: string, day: WorkoutDay, cycleStartDate: string | null, slotIndex?: number) => Promise<WorkoutSession>;
  /** Persist a fully-formed past session (completed offline or retroactively entered). */
  logPastSession:         (session: WorkoutSession) => Promise<void>;
  /** Remove sessions matching a predicate from local state and Firestore. */
  deleteSessions:         (predicate: (s: WorkoutSession) => boolean) => Promise<void>;
  /** Wipe all session history locally and from Firestore. */
  clearAllSessions:       () => Promise<void>;
  getSessionsForExercise: (exerciseName: string) => WorkoutSession[];
  getLastSession:         (dayPosition: number) => WorkoutSession | undefined;
  addSet:                 (exerciseId: string) => void;
  removeLastSet:          (exerciseId: string) => void;
  startTimer:             () => void;
  stopTimer:              () => void;
  clearActiveSession:     () => void;
}

function buildExercises(
  day: WorkoutDay,
  lastWeightFor?: (exerciseId: string, name: string) => Array<number | null>,
): SessionExercise[] {
  return day.exercises.sort((a, b) => a.order - b.order).map(ex => {
    const prevWeights = lastWeightFor?.(ex.id, ex.name) ?? [];
    return {
      id: generateId(), exerciseId: ex.id, exerciseName: ex.name, order: ex.order,
      setType: ex.setType, weightUnit: ex.weightUnit, barType: ex.barType,
      barWeight: ex.barWeight, isCompleted: false,
      muscleTags: ex.muscleTags ?? [],
      sets: Array.from({ length: ex.targetSets }, (_, i) => {
        const per = ex.perSetTargets?.find(p => p.setNumber === i + 1);
        // Per-set: use history weight for this slot; if plan has more sets than last
        // time, copy the last recorded weight rather than dropping to plan default.
        const prevW = prevWeights.length > 0
          ? (prevWeights[i] ?? prevWeights[prevWeights.length - 1] ?? null)
          : null;
        return {
          id: generateId(), setNumber: i + 1,
          targetReps:   per?.targetReps  ?? ex.targetRepsMin ?? null,
          targetWeight: per?.targetWeight ?? ex.targetWeight ?? null,
          actualReps: 0, actualRepsToFailure: ex.toFailure ? 0 : null,
          actualWeight: prevW ?? ex.targetWeight ?? null,
          platesUsed: [], notes: '', isCompleted: false, completedAt: null,
        } as SetLog;
      }),
    };
  });
}

async function getUid() {
  return (await import('../config/firebase')).auth.currentUser?.uid ?? null;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null, sessions: [], loaded: false, loadError: null,
  sessionTimer: 0, timerInterval: null, _unsub: null,

  load: async (uid) => {
    set({ loadError: null });

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
      set({ loadError: null });
    } catch (e) {
      __DEV__ && console.warn('[se7en/session]', e);
      set({ loadError: e instanceof Error ? e.message : 'Could not sync your session history.' });
    }

    set({ loaded: true });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsSessions.listen(uid, async sessions => {
      set({ sessions, loadError: null });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get().stopTimer();
    get()._unsub?.();
    set({ activeSession: null, sessions: [], loaded: false, loadError: null, sessionTimer: 0, _unsub: null });
    AsyncStorage.multiRemove([ACTIVE_KEY, HISTORY_KEY]);
  },

  startSession: (planId, day) => {
    const history = get().sessions;

    // Build a per-set weight lookup from the most recent completed session that
    // contains each exercise. Match by exerciseId first (stable across renames),
    // fall back to case-insensitive name match. Weights returned in set-number
    // order so set 1 gets the previous set-1 weight, set 2 gets set-2, etc.
    const lastWeightFor = (exerciseId: string, exerciseName: string): Array<number | null> => {
      const lower = exerciseName.toLowerCase();
      const sorted = [...history]
        .filter(s => s.status === 'completed' && s.finishedAt != null)
        .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());
      for (const s of sorted) {
        const ex = s.exercises.find(
          e => e.exerciseId === exerciseId || e.exerciseName.toLowerCase() === lower,
        );
        if (!ex) continue;
        const weights = [...ex.sets]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map(st => st.actualWeight ?? null);
        // Skip sessions where every set has null weight (e.g. quickComplete without
        // a targetWeight) and keep looking for a session with real recorded weights.
        if (weights.every(w => w === null)) continue;
        return weights;
      }
      return [];
    };

    const session: WorkoutSession = {
      id: generateId(), planId, dayPosition: day.dayPosition, dayLabel: day.label,
      status: 'partial', startedAt: new Date().toISOString(), finishedAt: null,
      duration: 0, skipReason: null, sessionNote: null, totalVolume: 0,
      prsBreached: [], exercises: buildExercises(day, lastWeightFor),
    };
    set({ activeSession: session });
    AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    getUid().then(uid => { if (uid) fsActiveSession.set(uid, session).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
    get().startTimer();
    // Notify widget of new session and start iOS Live Activity
    Promise.all([getWidgetService(), getActivePlan()]).then(([ws, plan]) => {
      ws.updateSession(session, 0, plan);
      ws.startLiveActivity(session, plan);
    }).catch(() => {});
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
      // Notify widget of updated session stats (pass plan for reps/weight labels)
      Promise.all([getWidgetService(), getActivePlan()]).then(([ws, plan]) => {
        ws.updateSession(updated, s.sessionTimer, plan);
      }).catch(() => {});
      return { activeSession: updated };
    });
  },

  addSet: (exerciseId) => {
    set(s => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        const newSet: SetLog = {
          id: generateId(),
          setNumber: ex.sets.length + 1,
          targetReps:   lastSet?.targetReps   ?? null,
          targetWeight: lastSet?.targetWeight ?? null,
          actualReps: 0,
          actualRepsToFailure: ex.setType === 'toFailure' ? 0 : null,
          actualWeight: lastSet?.actualWeight ?? lastSet?.targetWeight ?? null,
          platesUsed: [], notes: '', isCompleted: false, completedAt: null,
        };
        return { ...ex, sets: [...ex.sets, newSet], isCompleted: false };
      });
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(updated));
      getUid().then(uid => { if (uid) fsActiveSession.set(uid, updated).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
      return { activeSession: updated };
    });
  },

  removeLastSet: (exerciseId) => {
    set(s => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        if (ex.sets.length <= 1) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        if (lastSet?.isCompleted) return ex; // never discard logged data
        const sets = ex.sets.slice(0, -1);
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

  setExerciseRPE: (exerciseId, rpe, note) => {
    // 1. Update local state + persist to AsyncStorage + Firestore
    set(s => {
      if (!s.activeSession) return s;
      const exercises = s.activeSession.exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, rpe, exerciseNote: note } : ex
      );
      const updated = { ...s.activeSession, exercises };
      AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(updated));
      getUid().then(uid => { if (uid) fsActiveSession.set(uid, updated).catch(e => __DEV__ && console.warn('[se7en/session]', e)); });
      return { activeSession: updated };
    });

    // 2. Fire-and-forget: embed the note and store it in Neon
    // Only runs when there is a non-trivial note and a valid RPE score.
    if (rpe <= 0) return;

    const session = get().activeSession;
    if (!session) return;
    const exercise = session.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    getUid().then(uid => {
      if (!uid) return;
      storeNoteEmbedding({
        userId:       uid,
        sessionId:    session.id,
        exerciseId:   exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        muscleTags:   exercise.muscleTags,
        rpe,
        note,
        workoutDate:  session.startedAt?.slice(0, 10) ?? null,
      }).catch(e => __DEV__ && console.warn('[se7en/embed]', e));
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
      prsBreached: [],
    };

    // ── PR detection ──────────────────────────────────────────────────────────
    // Detect new personal records synchronously (before persisting) so
    // `finished.prsBreached` is correct in the write below — a fire-and-forget
    // dynamic import here would resolve after the persist and silently lose
    // the PR flags on reload.
    try {
      const prStore = await getPRStore();
      const { updatedPRs, prsBreached } = detectPRs(finished, prStore.records);
      if (prsBreached.length > 0) {
        finished.prsBreached = prsBreached;
        const { notifyNewPR } = await import('../services/notificationService');
        await Promise.all(
          updatedPRs.map(async pr => {
            prStore.upsertPR(pr);
            await notifyNewPR(
              pr.exerciseName,
              pr.heaviestWeight,
              pr.mostReps,
              // Find the exercise in the session to get weightUnit
              finished.exercises.find(e => e.exerciseId === pr.exerciseId)?.weightUnit ?? 'kg',
            );
          }),
        );
      }
    } catch (e) { __DEV__ && console.warn('[se7en/pr]', e); }

    const sessions = [...get().sessions, finished];

    // Persist to local storage and Firestore before clearing activeSession.
    // Clearing it first caused the iOS dismiss+present race: the ActiveSession
    // modal would start its slide-out animation, then the PostWorkout modal
    // tried to present before UIKit finished, dropping the incoming screen.
    // Keeping activeSession non-null here lets ActiveSessionScreen stay rendered
    // during network I/O so there is no blank flash between screens.
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

    // ── Cycle-complete detection ───────────────────────────────────────────────
    Promise.all([getActivePlan(), getSettings()]).then(async ([plan, settings]) => {
      if (!plan || !settings.cycleStartDate) return;
      const cycleStart = new Date(settings.cycleStartDate + 'T00:00:00');
      const cycleEnd   = new Date(cycleStart);
      cycleEnd.setDate(cycleStart.getDate() + plan.days.length);

      const nonRestDays = plan.days.filter(d => !d.isRestDay);
      if (nonRestDays.length === 0) return;

      const cycleSessions = sessions.filter(s =>
        s.status === 'completed' &&
        s.finishedAt != null &&
        new Date(s.finishedAt) >= cycleStart &&
        new Date(s.finishedAt) < cycleEnd,
      );

      const allCovered = nonRestDays.every(day =>
        cycleSessions.some(s => s.dayPosition === day.dayPosition),
      );
      if (!allCovered) return;

      const totalVolume   = cycleSessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
      const totalSessions = cycleSessions.length;

      const { notifyCycleComplete } = await import('../services/notificationService');
      await notifyCycleComplete(totalVolume, totalSessions);
    }).catch(e => __DEV__ && console.warn('[se7en/cycle]', e));

    // Invalidate coach cache so the widget regenerates with fresh post-workout insight
    AsyncStorage.removeItem('@se7en_coach_cache').catch(() => {});
    // Transition widget to idle state
    getWidgetService().then(ws => ws.endSession()).catch(() => {});

    // Update sessions but keep activeSession alive so the Modal content is
    // never empty between the active→summary phase swap.  AppNavigator clears
    // activeSession in a useEffect *after* PostWorkoutSummary has mounted.
    set({ sessions, sessionTimer: 0 });
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

  quickCompleteDay: async (planId, day, cycleStartDate, slotIndex) => {
    // Derive the calendar date from the SLOT INDEX (0-based position in plan.days),
    // not day.dayPosition. After drag-and-drop reordering, dayPosition is a stable
    // content-id; the actual calendar offset from cycleStartDate is the slot index.
    // Fall back to dayPosition - 1 only when slotIndex is not provided (legacy callers).
    const offset = slotIndex !== undefined ? slotIndex : (day.dayPosition - 1);
    let finishedAt: string;
    if (cycleStartDate) {
      const d = new Date(cycleStartDate + 'T00:00:00');
      d.setDate(d.getDate() + offset);
      d.setHours(18, 0, 0, 0); // log at 6 PM on the scheduled date
      finishedAt = d.toISOString();
    } else {
      finishedAt = new Date().toISOString();
    }

    // Skip if already logged as completed on this calendar date.
    // Use local-date comparison so UTC± offsets don't cause UTC-midnight sessions
    // to land on the "wrong" UTC day and slip past deduplication.
    const localDate = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const targetLocalDate = localDate(finishedAt);
    const existing = get().sessions.find(s =>
      s.planId === planId &&
      s.dayPosition === day.dayPosition &&
      s.finishedAt != null &&
      localDate(s.finishedAt) === targetLocalDate &&
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

  logPastSession: async (session) => {
    if (get().sessions.some(s => s.id === session.id)) return;
    const sessions = [...get().sessions, session];
    set({ sessions });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    const uid = await getUid();
    if (uid) fsSessions.set(uid, session).catch(e => __DEV__ && console.warn('[se7en/session]', e));
  },

  deleteSessions: async (predicate) => {
    const toDelete = get().sessions.filter(predicate);
    if (toDelete.length === 0) return;
    const remaining = get().sessions.filter(s => !predicate(s));
    set({ sessions: remaining });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(remaining));
    const uid = await getUid();
    if (uid) {
      await Promise.all(
        toDelete.map(s => fsSessions.delete(uid, s.id).catch(e => __DEV__ && console.warn('[se7en/session]', e))),
      );
    }
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
    const interval = setInterval(() => {
      const active = get().activeSession;
      if (active?.startedAt) {
        set({ sessionTimer: Math.max(0, Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)) });
      } else {
        set(s => ({ sessionTimer: s.sessionTimer + 1 }));
      }
    }, 1000);
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
