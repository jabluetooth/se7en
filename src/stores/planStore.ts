import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsPlans } from '../services/firestoreService';
import {
  WorkoutPlan, WorkoutDay, Exercise,
  ImportPlan, WeightUnit, BarType, SetType,
} from '../types';
import { generateId } from '../utils/idGen';
import { BAR_WEIGHTS } from '../constants';
import { PLAN_TEMPLATES } from '../data/planTemplates';
import { findExercise } from '../data/exercises';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = '@se7en_plans';

interface PlanStore {
  plans:      WorkoutPlan[];
  activePlan: WorkoutPlan | null;
  loaded:     boolean;
  /** Set when the Firestore leg of load() fails (e.g. offline). Cleared on
   *  the next successful load()/sync. UI may surface this as an inline
   *  banner — data shown may be stale local cache rather than authoritative. */
  loadError:  string | null;
  _unsub:     Unsubscribe | null;

  load:       (uid: string) => Promise<void>;
  startSync:  (uid: string) => void;
  stopSync:   () => void;

  /** Internal — write the full plans array to the local cache, and push only
   *  the plan(s) that actually changed to Firestore (one document write per
   *  changed plan, not every plan). Omit `changed` to update the cache only
   *  (e.g. after a delete, which is already pushed to Firestore separately). */
  _persist:   (plans: WorkoutPlan[], changed?: WorkoutPlan | WorkoutPlan[], uid?: string | null) => Promise<void>;

  createPlan:              (name: string, splitType: string) => WorkoutPlan;
  createPlanFromTemplate:  (templateId: string, name?: string) => WorkoutPlan;
  importPlan:              (data: ImportPlan) => WorkoutPlan;
  updatePlan:              (planId: string, partial: Partial<WorkoutPlan>) => void;
  deletePlan:              (planId: string) => void;
  setActivePlan:           (planId: string) => void;
  addExercise:             (planId: string, dayId: string, exercise: Omit<Exercise, 'id' | 'createdAt'>) => void;
  updateExercise:          (planId: string, dayId: string, exerciseId: string, partial: Partial<Exercise>) => void;
  deleteExercise:          (planId: string, dayId: string, exerciseId: string) => void;
  reorderExercises:        (planId: string, dayId: string, orderedIds: string[]) => void;
  updateDay:               (planId: string, dayId: string, partial: Partial<WorkoutDay>) => void;
}

function emptyDays(): WorkoutDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: generateId(), dayPosition: i + 1,
    label: `Day ${i + 1}`, isRestDay: false, exercises: [],
  }));
}

async function getUid() {
  return (await import('../config/firebase')).auth.currentUser?.uid ?? null;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plans: [], activePlan: null, loaded: false, loadError: null, _unsub: null,

  _persist: async (plans, changed, uid) => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(plans));
    if (!changed) return;
    const resolvedUid = uid ?? await getUid();
    if (!resolvedUid) return;
    // Only push the plan(s) that actually changed — a single-plan edit should
    // never rewrite every other plan document (wasted writes, and risks
    // clobbering concurrent edits to those plans from another device).
    const toSync = Array.isArray(changed) ? changed : [changed];
    toSync.forEach(p => fsPlans.set(resolvedUid, p).catch(e => __DEV__ && console.warn('[se7en/plan]', e)));
  },

  load: async (uid) => {
    set({ loadError: null });

    // Backfill isRestDay for plans stored before the field was added
    const normalize = (plans: WorkoutPlan[]): WorkoutPlan[] =>
      plans.map(p => ({
        ...p,
        days: p.days.map(d => ({
          ...d,
          isRestDay: d.isRestDay ?? (d.label?.toLowerCase() === 'rest' && d.exercises.length === 0),
        })),
      }));

    // Cache first
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = normalize(JSON.parse(raw) as WorkoutPlan[]);
        set({ plans: cached, activePlan: cached.find(p => p.isActive) ?? null, loaded: true });
      }
    } catch (e) { __DEV__ && console.warn('[se7en/plan]', e); }

    // Firestore authoritative — an empty response means "empty", not "keep
    // local cache". This matches startSync()'s listener, which is the true
    // source of truth for real-time state; treating an empty server read
    // differently between load() and the listener risks resurrecting
    // deleted data or wiping it depending on race timing.
    try {
      const remote = normalize(await fsPlans.getAll(uid));
      set({ plans: remote, activePlan: remote.find(p => p.isActive) ?? null, loaded: true, loadError: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    } catch (e) {
      __DEV__ && console.warn('[se7en/plan]', e);
      set({ loadError: e instanceof Error ? e.message : 'Could not sync your plans.' });
    }

    set({ loaded: true });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsPlans.listen(uid, async plans => {
      set({ plans, activePlan: plans.find(p => p.isActive) ?? null, loadError: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(plans));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get()._unsub?.();
    set({ plans: [], activePlan: null, loaded: false, loadError: null, _unsub: null });
    AsyncStorage.removeItem(CACHE_KEY);
  },

  // ── CRUD ───────────────────────────────────────────────────────────────────

  createPlan: (name, splitType) => {
    const plan: WorkoutPlan = {
      id: generateId(), name, splitType, description: '',
      createdAt: new Date().toISOString(), isActive: false, days: emptyDays(),
    };
    const plans = [...get().plans, plan];
    set({ plans });
    get()._persist(plans, plan);
    return plan;
  },

  createPlanFromTemplate: (templateId, name) => {
    const template = PLAN_TEMPLATES.find(t => t.id === templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);
    const days: WorkoutDay[] = Array.from({ length: 7 }, (_, i) => {
      const pos = i + 1;
      const td  = template.days.find(d => d.dayPosition === pos);
      if (!td || td.isRestDay) return { id: generateId(), dayPosition: pos, label: td?.label ?? `Day ${pos}`, isRestDay: true, exercises: [] };
      return {
        id: generateId(), dayPosition: pos, label: td.label, isRestDay: false,
        exercises: td.exercises.map((te, idx) => {
          const lib = findExercise(te.exerciseId);
          return {
            id: generateId(), name: lib?.name ?? te.exerciseId, order: idx + 1,
            setType: te.setType, supersetGroup: null, targetSets: te.targetSets,
            targetRepsMin: te.targetRepsMin, targetRepsMax: te.targetRepsMax,
            toFailure: te.toFailure, targetWeight: te.targetWeight,
            weightUnit: te.weightUnit, barType: te.barType,
            barWeight: BAR_WEIGHTS[te.barType] ?? 0,
            perSetTargets: null, notes: te.notes, createdAt: new Date().toISOString(),
          };
        }),
      };
    });
    const plan: WorkoutPlan = {
      id: generateId(), name: name ?? template.name, splitType: template.splitType,
      description: template.description, createdAt: new Date().toISOString(),
      isActive: false, days,
    };
    const plans = [...get().plans, plan];
    set({ plans });
    get()._persist(plans, plan);
    return plan;
  },

  importPlan: (data) => {
    const days: WorkoutDay[] = data.days.map(d => ({
      id: generateId(), dayPosition: d.dayPosition, label: d.label, isRestDay: d.isRestDay,
      exercises: d.exercises.map(e => ({
        id: generateId(), name: e.name, order: e.order, setType: e.setType,
        supersetGroup: null, targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin ?? null, targetRepsMax: e.targetRepsMax ?? null,
        toFailure: e.toFailure, targetWeight: e.targetWeight ?? null,
        weightUnit: e.weightUnit, barType: e.barType, barWeight: BAR_WEIGHTS[e.barType] ?? 0,
        perSetTargets: e.perSetTargets ?? null, notes: e.notes ?? '',
        createdAt: new Date().toISOString(),
      })),
    }));
    // Fill missing positions
    const existing = new Set(days.map(d => d.dayPosition));
    for (let i = 1; i <= 7; i++) {
      if (!existing.has(i)) days.push({ id: generateId(), dayPosition: i, label: `Day ${i}`, isRestDay: false, exercises: [] });
    }
    days.sort((a, b) => a.dayPosition - b.dayPosition);
    const plan: WorkoutPlan = {
      id: generateId(), name: data.planName, splitType: data.splitType ?? 'Custom',
      description: '', createdAt: new Date().toISOString(), isActive: false, days,
    };
    const plans = [...get().plans, plan];
    set({ plans });
    get()._persist(plans, plan);
    return plan;
  },

  updatePlan: (planId, partial) => {
    const plans = get().plans.map(p => p.id === planId ? { ...p, ...partial } : p);
    const activePlan = get().activePlan?.id === planId ? { ...get().activePlan!, ...partial } : get().activePlan;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },

  deletePlan: (planId) => {
    const plans = get().plans.filter(p => p.id !== planId);
    set({ plans, activePlan: get().activePlan?.id === planId ? null : get().activePlan });
    // No `changed` — the deletion itself is pushed to Firestore below;
    // remaining plans didn't change and shouldn't be rewritten.
    get()._persist(plans);
    getUid().then(uid => { if (uid) fsPlans.delete(uid, planId).catch(e => __DEV__ && console.warn('[se7en/plan]', e)); });
  },

  setActivePlan: (planId) => {
    const previousActiveId = get().activePlan?.id;
    const plans = get().plans.map(p => ({ ...p, isActive: p.id === planId }));
    set({ plans, activePlan: plans.find(p => p.id === planId) ?? null });
    // Only the newly-active and previously-active plans actually changed.
    const changed = plans.filter(p => p.id === planId || p.id === previousActiveId);
    get()._persist(plans, changed);
  },

  addExercise: (planId, dayId, exercise) => {
    // Rest days never hold exercises (Cycle screen invariant). The UI already
    // hides the add button when isRestDay is true, but enforce it here too so
    // any other caller (sync, future automation) can't silently break the rule.
    const targetDay = get().plans.find(p => p.id === planId)?.days.find(d => d.id === dayId);
    if (targetDay?.isRestDay) return;

    const ex: Exercise = { ...exercise, id: generateId(), createdAt: new Date().toISOString() };
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, exercises: [...d.exercises, ex] }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },

  updateExercise: (planId, dayId, exerciseId, partial) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : {
        ...p, days: p.days.map(d =>
          d.id !== dayId ? d : { ...d, exercises: d.exercises.map(e => e.id !== exerciseId ? e : { ...e, ...partial }) }
        ),
      }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },

  deleteExercise: (planId, dayId, exerciseId) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, exercises: d.exercises.filter(e => e.id !== exerciseId) }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },

  reorderExercises: (planId, dayId, orderedIds) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : {
        ...p, days: p.days.map(d => {
          if (d.id !== dayId) return d;
          // Filter out ids no longer present in `exercises` first (e.g. a
          // stale drag-and-drop id) — otherwise `find` returns undefined,
          // and spreading it contributes nothing, persisting a malformed
          // exercise object with only `{ order: N }`.
          const reordered = orderedIds
            .map(id => d.exercises.find(e => e.id === id))
            .filter((e): e is Exercise => e !== undefined)
            .map((e, idx) => ({ ...e, order: idx + 1 }));
          return { ...d, exercises: reordered };
        }),
      }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },

  updateDay: (planId, dayId, partial) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, ...partial }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    const changed = plans.find(p => p.id === planId);
    get()._persist(plans, changed);
  },
}));
