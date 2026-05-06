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
  _unsub:     Unsubscribe | null;

  load:       (uid: string) => Promise<void>;
  startSync:  (uid: string) => void;
  stopSync:   () => void;

  /** Internal — write plans array to cache + Firestore */
  _persist:   (plans: WorkoutPlan[], uid?: string | null) => Promise<void>;

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
  plans: [], activePlan: null, loaded: false, _unsub: null,

  _persist: async (plans, uid) => {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(plans));
    const resolvedUid = uid ?? await getUid();
    if (!resolvedUid) return;
    // Sync changed plans to Firestore individually (batch-like)
    plans.forEach(p => fsPlans.set(resolvedUid, p).catch(() => {}));
  },

  load: async (uid) => {
    // Cache first
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as WorkoutPlan[];
        set({ plans: cached, activePlan: cached.find(p => p.isActive) ?? null, loaded: true });
      }
    } catch {}

    // Firestore authoritative
    try {
      const remote = await fsPlans.getAll(uid);
      if (remote.length > 0) {
        set({ plans: remote, activePlan: remote.find(p => p.isActive) ?? null, loaded: true });
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
      }
    } catch {}

    set({ loaded: true });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsPlans.listen(uid, async plans => {
      set({ plans, activePlan: plans.find(p => p.isActive) ?? null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(plans));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get()._unsub?.();
    set({ plans: [], activePlan: null, loaded: false, _unsub: null });
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
    get()._persist(plans);
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
    get()._persist(plans);
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
    get()._persist(plans);
    return plan;
  },

  updatePlan: (planId, partial) => {
    const plans = get().plans.map(p => p.id === planId ? { ...p, ...partial } : p);
    const activePlan = get().activePlan?.id === planId ? { ...get().activePlan!, ...partial } : get().activePlan;
    set({ plans, activePlan });
    get()._persist(plans);
  },

  deletePlan: (planId) => {
    const plans = get().plans.filter(p => p.id !== planId);
    set({ plans, activePlan: get().activePlan?.id === planId ? null : get().activePlan });
    get()._persist(plans);
    getUid().then(uid => { if (uid) fsPlans.delete(uid, planId).catch(() => {}); });
  },

  setActivePlan: (planId) => {
    const plans = get().plans.map(p => ({ ...p, isActive: p.id === planId }));
    set({ plans, activePlan: plans.find(p => p.id === planId) ?? null });
    get()._persist(plans);
  },

  addExercise: (planId, dayId, exercise) => {
    const ex: Exercise = { ...exercise, id: generateId(), createdAt: new Date().toISOString() };
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, exercises: [...d.exercises, ex] }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    get()._persist(plans);
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
    get()._persist(plans);
  },

  deleteExercise: (planId, dayId, exerciseId) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, exercises: d.exercises.filter(e => e.id !== exerciseId) }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    get()._persist(plans);
  },

  reorderExercises: (planId, dayId, orderedIds) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : {
        ...p, days: p.days.map(d => {
          if (d.id !== dayId) return d;
          const reordered = orderedIds.map((id, idx) => ({ ...d.exercises.find(e => e.id === id)!, order: idx + 1 }));
          return { ...d, exercises: reordered };
        }),
      }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    get()._persist(plans);
  },

  updateDay: (planId, dayId, partial) => {
    const plans = get().plans.map(p =>
      p.id !== planId ? p : { ...p, days: p.days.map(d => d.id !== dayId ? d : { ...d, ...partial }) }
    );
    const activePlan = plans.find(p => p.isActive) ?? null;
    set({ plans, activePlan });
    get()._persist(plans);
  },
}));
