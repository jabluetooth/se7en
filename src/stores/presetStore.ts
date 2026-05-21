import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutPlan, PlanPreset } from '../types';
import { generateId } from '../utils/idGen';

const PRESET_KEY = '@se7en_plan_presets';

interface PresetStore {
  presets: PlanPreset[];
  loaded:  boolean;
  load:          () => Promise<void>;
  savePreset:    (plan: WorkoutPlan) => PlanPreset;
  deletePreset:  (id: string) => void;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  loaded:  false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(PRESET_KEY);
      set({ presets: raw ? (JSON.parse(raw) as PlanPreset[]) : [], loaded: true });
    } catch (e) {
      __DEV__ && console.warn('[se7en/preset]', e);
      set({ loaded: true });
    }
  },

  savePreset: (plan) => {
    const preset: PlanPreset = {
      id:        generateId(),
      name:      plan.name,
      splitType: plan.splitType,
      days:      plan.days,
      savedAt:   new Date().toISOString(),
    };
    const presets = [...get().presets, preset];
    set({ presets });
    AsyncStorage.setItem(PRESET_KEY, JSON.stringify(presets)).catch(
      e => __DEV__ && console.warn('[se7en/preset]', e),
    );
    return preset;
  },

  deletePreset: (id) => {
    const presets = get().presets.filter(p => p.id !== id);
    set({ presets });
    AsyncStorage.setItem(PRESET_KEY, JSON.stringify(presets)).catch(
      e => __DEV__ && console.warn('[se7en/preset]', e),
    );
  },
}));
