import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSettings } from '../services/firestoreService';
import { Settings } from '../types';
import { DEFAULT_METRIC_PLATES } from '../constants';
import { computeDayPosition, shiftDate, localDateStr } from '../utils/cycleUtils';
import type { Unsubscribe } from 'firebase/firestore';
// Lazy import to avoid a circular dependency with planStore.
const getActivePlanLen = () =>
  import('./planStore').then(m => m.usePlanStore.getState().activePlan?.days.length ?? 7);

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
  defaultWeightUnit: 'kg',
  createdAt:       new Date().toISOString(),
  coachNotificationsEnabled: false,
  coachNotificationHour:     8,
  coachNotificationMinute:   0,
};

interface SettingsStore {
  settings:   Settings;
  loaded:     boolean;
  /** Set when the Firestore leg of load() fails (e.g. offline). Cleared on
   *  the next successful load()/sync. */
  loadError:  string | null;
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
  loadError: null,
  _unsub:   null,

  load: async (uid) => {
    set({ loadError: null });

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
        set({ settings: remote, loaded: true, loadError: null });
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
      } else {
        // First time: push defaults to Firestore
        await fsSettings.set(uid, get().settings);
        set({ loadError: null });
      }
    } catch (e) {
      __DEV__ && console.warn('[se7en/settings]', e);
      set({ loadError: e instanceof Error ? e.message : 'Could not sync your settings.' });
    }

    set({ loaded: true });
  },

  save: async (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));

    const uid = (await import('../config/firebase')).auth.currentUser?.uid;
    // Field-level update — only writes the keys that actually changed, so this
    // can't clobber a different field that another device wrote concurrently.
    if (uid) fsSettings.update(uid, partial).catch(e => __DEV__ && console.warn('[se7en/settings]', e));
  },

  setActivePlan: async (planId) => {
    const today = localDateStr(new Date());
    return get().save({ activePlanId: planId, currentDayPosition: 1, cycleStartDate: today });
  },

  startCycle: async (startDate) => {
    const date    = startDate ?? localDateStr(new Date());
    const cycleLen = await getActivePlanLen();
    const dayPos  = computeDayPosition(date, 1, cycleLen);
    return get().save({ cycleStartDate: date, currentDayPosition: dayPos });
  },

  shiftCycle: async (days) => {
    const current  = get().settings.cycleStartDate ?? localDateStr(new Date());
    const shifted  = shiftDate(current, days);
    const cycleLen = await getActivePlanLen();
    const dayPos   = computeDayPosition(shifted, 1, cycleLen);
    return get().save({ cycleStartDate: shifted, currentDayPosition: dayPos });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsSettings.listen(uid, async remote => {
      set({ settings: remote, loadError: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get()._unsub?.();
    set({ settings: defaults, loaded: false, loadError: null, _unsub: null });
    AsyncStorage.removeItem(CACHE_KEY);
  },
}));
