// ─── Se7en · Theme preference ─────────────────────────────────────────────────
// A per-device Dark/Light choice. It is read from AsyncStorage before the first
// render (App.tsx waits on hydrateTheme) so the app never flashes the wrong
// theme, and App keys its tree by `theme` so a switch remounts every screen.
import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './runtime';
import type { ThemeName } from './palettes';

const KEY = '@se7en_theme';

interface ThemeStore {
  theme:    ThemeName;
  setTheme: (t: ThemeName) => void;
}

function applyEverywhere(t: ThemeName) {
  applyTheme(t);
  // Native pieces (keyboard, date pickers, system alerts) follow this too.
  try { Appearance.setColorScheme?.(t); } catch {}
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark',
  setTheme: (t) => {
    if (t === get().theme) return;
    applyEverywhere(t);
    set({ theme: t });
    AsyncStorage.setItem(KEY, t).catch(() => {});
  },
}));

/** Load the saved choice (defaults to dark) and apply it. Never throws. */
export async function hydrateTheme(): Promise<void> {
  let t: ThemeName = 'dark';
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') t = saved;
  } catch {}
  applyEverywhere(t);
  useThemeStore.setState({ theme: t });
}
