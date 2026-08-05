import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsPRs } from '../services/firestoreService';
import { PersonalRecord } from '../types';
import type { Unsubscribe } from 'firebase/firestore';

const CACHE_KEY = '@se7en_prs';

interface PRStore {
  records:  PersonalRecord[];
  loaded:   boolean;
  /** Set when the Firestore leg of load() fails (e.g. offline). Cleared on
   *  the next successful load()/sync. */
  loadError: string | null;
  _unsub:   Unsubscribe | null;

  load:       (uid: string) => Promise<void>;
  startSync:  (uid: string) => void;
  stopSync:   () => void;
  upsertPR:   (pr: PersonalRecord) => Promise<void>;
  getPR:      (exerciseId: string) => PersonalRecord | undefined;
}

async function getUid() {
  return (await import('../config/firebase')).auth.currentUser?.uid ?? null;
}

export const usePRStore = create<PRStore>((set, get) => ({
  records: [], loaded: false, loadError: null, _unsub: null,

  load: async (uid) => {
    set({ loadError: null });

    // Cache first
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) set({ records: JSON.parse(raw) as PersonalRecord[], loaded: true });
    } catch (e) { __DEV__ && console.warn('[se7en/pr]', e); }

    // Firestore authoritative — an empty response means "empty", not "keep
    // local cache". This matches startSync()'s listener, which is the true
    // source of truth for real-time state; treating an empty server read
    // differently between load() and the listener risks resurrecting
    // deleted data or wiping it depending on race timing.
    try {
      const remote = await fsPRs.getAll(uid);
      set({ records: remote, loaded: true, loadError: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    } catch (e) {
      __DEV__ && console.warn('[se7en/pr]', e);
      set({ loadError: e instanceof Error ? e.message : 'Could not sync your personal records.' });
    }

    set({ loaded: true });
  },

  startSync: (uid) => {
    get()._unsub?.();
    const unsub = fsPRs.listen(uid, async records => {
      set({ records, loadError: null });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(records));
    });
    set({ _unsub: unsub });
  },

  stopSync: () => {
    get()._unsub?.();
    set({ records: [], loaded: false, loadError: null, _unsub: null });
    AsyncStorage.removeItem(CACHE_KEY);
  },

  upsertPR: async (pr) => {
    const existing = get().records;
    const idx = existing.findIndex(r => r.exerciseId === pr.exerciseId);
    const records = idx >= 0
      ? existing.map((r, i) => (i === idx ? pr : r))
      : [...existing, pr];
    set({ records });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(records));
    const uid = await getUid();
    if (uid) fsPRs.set(uid, pr).catch(e => __DEV__ && console.warn('[se7en/pr]', e));
  },

  getPR: (exerciseId) => get().records.find(r => r.exerciseId === exerciseId),
}));
