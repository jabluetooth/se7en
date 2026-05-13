import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSettings } from '../services/firestoreService';
import { Settings } from '../types';
import { DEFAULT_METRIC_PLATES } from '../constants';
import { computeDayPosition, shiftDate } from '../utils/cycleUtils';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = '@se7en_settings';

const defaults: Settings = {
  availablePlates: DEFAULT_METRIC_PLATES,
  theme:           'dark',
  autoBackup:      true,
  backupFrequency: 'daily',
  lastBackupDate:  null,
  activePlanId:    null,
  currentDayPosition: 1,
  cycleStartDate:  null,
  createdAt:       new Date().toISOString(),
};

interface SettingsStore {
  settings:   Settings;
  loaded:     boolean;
  _unsub:     Unsubscribe | null;

  load:        (uid: string) => Promise<void>;
  save:        (partial: Partial<Settings>) => Promise<void>;
  setActivePlan: (planId: string | null) => Promise<void>;
  /** Anchor the cycle to a calendar date (YYYY-MM-DD). Defaults to today.
   *  Pass a date in the past to say "I started N days ago." */
  startCycle:  (startDate?: string) => Promise<void>;
  /** Shift the cycle start by ±1 day without full reset. */
  shiftCycle:  (days: number) => Promise<void>;
  startSync:   (uid: string) => void;
  stopSync:    () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaults,
  loaded:   false,
  _unsub:   null,

  load: async (uid) => {
    // 1. Cache (instant, works offline)
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        set({ settings: { ...defaults, ...parsed }, loaded: true });
      }
    } catch (e) { __DEV__ && console.warn('[se7en/settings]', e); }

    // 2. Firestore (authoritative, overwrites cache if different)
    try {
      const remote = await fsSettings.get(uid);
      if (remote) {
        set({ settings: remote, loaded: true });
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
      } else {
        // First time: push defaults to Firestore
        await fsSettings.set(uid, get().settings);
      }
    } catch (e) { __DEV__ && console.warn('[se7en/settings]', e); }

    set({ loaded: true });
  },

  save: async (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));

    const uid = (await import('../config/firebase')).auth.currentUser?.uid;
    if (uid) fsSettings.set(uid, updated).catch(e => __DEV__ && console.warn('[se7en/settings]', e));
  },

  setActivePlan: async (planId) => {
    const today = new Date().toISOString().slice(0, 10);
    return get().save({ activePlanId: planId, currentDayPosition: 1, cycleStartDate: today });
  },

  startCycle: async (startDate) => {
    const date   = startDate ?? new Date().toISOString().slice(0, 10);
    const dayPos = computeDayPosition(date);
    return get().save({ cycleStartDate: date, currentDayPosition: dayPos });
  },

  shiftCycle: async (days) => {
    const current = get().settings.cycleStartDate ?? new Date().toISOString().slice(0, 10);
    const shifted = shiftDate(current, days);
    const dayPos  = computeDayPosition(shifted);
    return get().save({ cycleStartDate: shifted, currentDayPosition: dayPos });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsSettings.listen(uid, async remote => {
      set({ settings: remote });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get()._unsub?.();
    set({ settings: defaults, loaded: false, _unsub: null });
    AsyncStorage.removeItem(CACHE_KEY);
  },
}));
