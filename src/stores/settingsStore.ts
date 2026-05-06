import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSettings } from '../services/firestoreService';
import { Settings } from '../types';
import { DEFAULT_METRIC_PLATES } from '../constants';
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
  createdAt:       new Date().toISOString(),
};

interface SettingsStore {
  settings:   Settings;
  loaded:     boolean;
  _unsub:     Unsubscribe | null;

  /** Load from cache first, then merge from Firestore */
  load:        (uid: string) => Promise<void>;
  /** Persist to cache + Firestore */
  save:        (partial: Partial<Settings>) => Promise<void>;
  setActivePlan: (planId: string | null) => Promise<void>;
  advanceDay:  () => Promise<void>;
  resetDay:    () => Promise<void>;
  /** Start real-time listener */
  startSync:   (uid: string) => void;
  /** Stop listener and reset state */
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
    } catch {}

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
    } catch {}

    set({ loaded: true });
  },

  save: async (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));

    const uid = (await import('../config/firebase')).auth.currentUser?.uid;
    if (uid) fsSettings.set(uid, updated).catch(() => {});
  },

  setActivePlan: async (planId) => get().save({ activePlanId: planId, currentDayPosition: 1 }),
  advanceDay:    async () => {
    const next = get().settings.currentDayPosition >= 7 ? 1 : get().settings.currentDayPosition + 1;
    return get().save({ currentDayPosition: next });
  },
  resetDay:      async () => get().save({ currentDayPosition: 1 }),

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
