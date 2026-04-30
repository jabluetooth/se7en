import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WorkoutPlan,
  WorkoutDay,
  Exercise,
  ImportPlan,
  WeightUnit,
  BarType,
  SetType,
} from '../types';
import { generateId } from '../utils/idGen';
import { BAR_WEIGHTS } from '../constants';
import { PLAN_TEMPLATES } from '../data/planTemplates';
import { findExercise } from '../data/exercises';

const STORAGE_KEY = '@se7en_plans';

interface PlanStore {
  plans: WorkoutPlan[];
  activePlan: WorkoutPlan | null;
  loaded: boolean;
  load: () => Promise<void>;
  persist: () => Promise<void>;
  createPlan: (name: string, splitType: string) => WorkoutPlan;
  createPlanFromTemplate: (templateId: string, name?: string) => WorkoutPlan;
  importPlan: (importData: ImportPlan) => WorkoutPlan;
  updatePlan: (planId: string, partial: Partial<WorkoutPlan>) => void;
  deletePlan: (planId: string) => void;
  setActivePlan: (planId: string) => void;
  addExercise: (planId: string, dayId: string, exercise: Omit<Exercise, 'id' | 'createdAt'>) => void;
  updateExercise: (planId: string, dayId: string, exerciseId: string, partial: Partial<Exercise>) => void;
  deleteExercise: (planId: string, dayId: string, exerciseId: string) => void;
  reorderExercises: (planId: string, dayId: string, orderedIds: string[]) => void;
  updateDay: (planId: string, dayId: string, partial: Partial<WorkoutDay>) => void;
}

function buildEmptyDays(): WorkoutDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: generateId(),
    dayPosition: i + 1,
    label: `Day ${i + 1}`,
    isRestDay: false,
    exercises: [],
  }));
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plans: [],
  activePlan: null,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const plans = JSON.parse(raw) as WorkoutPlan[];
        const activePlan = plans.find((p) => p.isActive) ?? null;
        set({ plans, activePlan, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  persist: async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().plans));
  },

  createPlan: (name, splitType) => {
    const plan: WorkoutPlan = {
      id: generateId(),
      name,
      splitType,
      description: '',
      createdAt: new Date().toISOString(),
      isActive: false,
      days: buildEmptyDays(),
    };
    set((s) => ({ plans: [...s.plans, plan] }));
    get().persist();
    return plan;
  },

  createPlanFromTemplate: (templateId, name) => {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    const days: WorkoutDay[] = Array.from({ length: 7 }, (_, i) => {
      const dayPos = i + 1;
      const templateDay = template.days.find((d) => d.dayPosition === dayPos);

      if (!templateDay || templateDay.isRestDay) {
        return {
          id: generateId(),
          dayPosition: dayPos,
          label: templateDay?.label ?? `Day ${dayPos}`,
          isRestDay: true,
          exercises: [],
        };
      }

      const exercises: Exercise[] = templateDay.exercises.map((te, idx) => {
        const libItem = findExercise(te.exerciseId);
        return {
          id: generateId(),
          name: libItem?.name ?? te.exerciseId,
          order: idx + 1,
          setType: te.setType,
          supersetGroup: null,
          targetSets: te.targetSets,
          targetRepsMin: te.targetRepsMin,
          targetRepsMax: te.targetRepsMax,
          toFailure: te.toFailure,
          targetWeight: te.targetWeight,
          weightUnit: te.weightUnit,
          barType: te.barType,
          barWeight: BAR_WEIGHTS[te.barType] ?? 0,
          perSetTargets: null,
          notes: te.notes,
          createdAt: new Date().toISOString(),
        };
      });

      return {
        id: generateId(),
        dayPosition: dayPos,
        label: templateDay.label,
        isRestDay: false,
        exercises,
      };
    });

    const plan: WorkoutPlan = {
      id: generateId(),
      name: name ?? template.name,
      splitType: template.splitType,
      description: template.description,
      createdAt: new Date().toISOString(),
      isActive: false,
      days,
    };
    set((s) => ({ plans: [...s.plans, plan] }));
    get().persist();
    return plan;
  },

  importPlan: (importData) => {
    const days: WorkoutDay[] = importData.days.map((d) => ({
      id: generateId(),
      dayPosition: d.dayPosition,
      label: d.label,
      isRestDay: d.isRestDay,
      exercises: d.exercises.map((e) => ({
        id: generateId(),
        name: e.name,
        order: e.order,
        setType: e.setType,
        supersetGroup: null,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin ?? null,
        targetRepsMax: e.targetRepsMax ?? null,
        toFailure: e.toFailure,
        targetWeight: e.targetWeight ?? null,
        weightUnit: e.weightUnit,
        barType: e.barType,
        barWeight: BAR_WEIGHTS[e.barType] ?? 0,
        perSetTargets: e.perSetTargets ?? null,
        notes: e.notes ?? '',
        createdAt: new Date().toISOString(),
      })),
    }));

    const existingPositions = new Set(days.map((d) => d.dayPosition));
    for (let i = 1; i <= 7; i++) {
      if (!existingPositions.has(i)) {
        days.push({
          id: generateId(),
          dayPosition: i,
          label: `Day ${i}`,
          isRestDay: false,
          exercises: [],
        });
      }
    }
    days.sort((a, b) => a.dayPosition - b.dayPosition);

    const plan: WorkoutPlan = {
      id: generateId(),
      name: importData.planName,
      splitType: importData.splitType ?? 'Custom',
      description: '',
      createdAt: new Date().toISOString(),
      isActive: false,
      days,
    };
    set((s) => ({ plans: [...s.plans, plan] }));
    get().persist();
    return plan;
  },

  updatePlan: (planId, partial) => {
    set((s) => ({
      plans: s.plans.map((p) => (p.id === planId ? { ...p, ...partial } : p)),
      activePlan:
        s.activePlan?.id === planId ? { ...s.activePlan, ...partial } : s.activePlan,
    }));
    get().persist();
  },

  deletePlan: (planId) => {
    set((s) => {
      const plans = s.plans.filter((p) => p.id !== planId);
      return { plans, activePlan: s.activePlan?.id === planId ? null : s.activePlan };
    });
    get().persist();
  },

  setActivePlan: (planId) => {
    set((s) => {
      const plans = s.plans.map((p) => ({ ...p, isActive: p.id === planId }));
      const activePlan = plans.find((p) => p.id === planId) ?? null;
      return { plans, activePlan };
    });
    get().persist();
  },

  addExercise: (planId, dayId, exercise) => {
    const newEx: Exercise = {
      ...exercise,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map((d) =>
                d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d,
              ),
            }
          : p,
      ),
    }));
    const activePlan = get().plans.find((p) => p.id === planId) ?? null;
    set({ activePlan: activePlan?.isActive ? activePlan : get().activePlan });
    get().persist();
  },

  updateExercise: (planId, dayId, exerciseId, partial) => {
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map((d) =>
                d.id === dayId
                  ? {
                      ...d,
                      exercises: d.exercises.map((e) =>
                        e.id === exerciseId ? { ...e, ...partial } : e,
                      ),
                    }
                  : d,
              ),
            }
          : p,
      ),
    }));
    const updated = get().plans.find((p) => p.id === planId) ?? null;
    if (updated?.isActive) set({ activePlan: updated });
    get().persist();
  },

  deleteExercise: (planId, dayId, exerciseId) => {
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map((d) =>
                d.id === dayId
                  ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseId) }
                  : d,
              ),
            }
          : p,
      ),
    }));
    const updated = get().plans.find((p) => p.id === planId) ?? null;
    if (updated?.isActive) set({ activePlan: updated });
    get().persist();
  },

  reorderExercises: (planId, dayId, orderedIds) => {
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              days: p.days.map((d) => {
                if (d.id !== dayId) return d;
                const reordered = orderedIds.map((id, idx) => {
                  const ex = d.exercises.find((e) => e.id === id)!;
                  return { ...ex, order: idx + 1 };
                });
                return { ...d, exercises: reordered };
              }),
            }
          : p,
      ),
    }));
    const updated = get().plans.find((p) => p.id === planId) ?? null;
    if (updated?.isActive) set({ activePlan: updated });
    get().persist();
  },

  updateDay: (planId, dayId, partial) => {
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? { ...p, days: p.days.map((d) => (d.id === dayId ? { ...d, ...partial } : d)) }
          : p,
      ),
    }));
    const updated = get().plans.find((p) => p.id === planId) ?? null;
    if (updated?.isActive) set({ activePlan: updated });
    get().persist();
  },
}));
