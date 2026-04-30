import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, WeightUnit, PlateSystem, Theme } from '../types';
import { DEFAULT_METRIC_PLATES, DEFAULT_IMPERIAL_PLATES } from '../constants';

const STORAGE_KEY = '@se7en_settings';

const defaultSettings: Settings = {
  weightUnit: 'kg',
  plateSystem: 'metric',
  availablePlates: DEFAULT_METRIC_PLATES,
  theme: 'dark',
  autoBackup: true,
  backupFrequency: 'daily',
  lastBackupDate: null,
  activePlanId: null,
  currentDayPosition: 1,
  createdAt: new Date().toISOString(),
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (partial: Partial<Settings>) => Promise<void>;
  setActivePlan: (planId: string | null) => Promise<void>;
  advanceDay: () => Promise<void>;
  resetDay: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Settings;
        set({ settings: { ...defaultSettings, ...parsed }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  save: async (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  setActivePlan: async (planId) => {
    await get().save({ activePlanId: planId, currentDayPosition: 1 });
  },

  advanceDay: async () => {
    const current = get().settings.currentDayPosition;
    const next = current >= 7 ? 1 : current + 1;
    await get().save({ currentDayPosition: next });
  },

  resetDay: async () => {
    await get().save({ currentDayPosition: 1 });
  },
}));
