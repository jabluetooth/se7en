import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalRecord } from '../types';

const STORAGE_KEY = '@se7en_prs';

interface PRStore {
  records: PersonalRecord[];
  loaded: boolean;
  load: () => Promise<void>;
  upsertPR: (pr: PersonalRecord) => Promise<void>;
  getPR: (exerciseId: string) => PersonalRecord | undefined;
}

export const usePRStore = create<PRStore>((set, get) => ({
  records: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const records = raw ? (JSON.parse(raw) as PersonalRecord[]) : [];
      set({ records, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  upsertPR: async (pr) => {
    const records = get().records;
    const idx = records.findIndex((r) => r.exerciseId === pr.exerciseId);
    const updated = idx >= 0 ? records.map((r, i) => (i === idx ? pr : r)) : [...records, pr];
    set({ records: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  getPR: (exerciseId) => get().records.find((r) => r.exerciseId === exerciseId),
}));
