// ─── Se7en · Theme runtime ────────────────────────────────────────────────
// How light/dark switching works without rewriting every screen:
//
//  • COLORS and GRAD (constants/index.ts) are live objects. applyTheme()
//    copies the chosen palette into them, so any `COLORS.x` read during
//    render gets the current theme.
//  • Module-level styles are wrapped in themed(() => StyleSheet.create(…)).
//    The factory re-runs (once per theme, cached) the first time a style is
//    read after a switch, so it picks up the new COLORS values.
//  • Overlay tints use ink(a) / accentA(a) / restA(a) / dangerA(a) instead
//    of hard-coded rgba() strings, so a "5% white" wash in dark mode becomes
//    a "5% near-black" wash in light mode.
//  • App remounts its tree when the theme changes (keyed by theme name), so
//    every component re-renders and re-reads styles. Stores keep their data.
import { PALETTES, type Palette, type ThemeName } from './palettes';

let current: ThemeName = 'dark';
const listeners = new Set<(t: ThemeName) => void>();

// Filled by constants/index.ts so this module has no import cycle with it.
let liveColors: Record<string, string> | null = null;
let liveGrad: Record<string, unknown> | null = null;

export function registerLiveTokens(colors: Record<string, string>, grad: Record<string, unknown>) {
  liveColors = colors;
  liveGrad = grad;
  syncTokens();
}

function syncTokens() {
  const p = PALETTES[current];
  if (liveColors) Object.assign(liveColors, p);
  if (liveGrad) {
    Object.assign(liveGrad, {
      accent:     [p.accent, p.accent],
      accentSoft: [`rgba(${p.accentRgb},0.14)`, `rgba(${p.accentRgb},0.08)`],
      danger:     [p.danger, p.danger],
      warn:       [p.warning, p.warning],
      bg:         [p.background, p.background, p.background, p.background],
      progress:   [p.accent, p.accent],
    });
  }
}

export function currentTheme(): ThemeName {
  return current;
}

export function palette(): Palette {
  return PALETTES[current];
}

export function applyTheme(t: ThemeName) {
  if (t === current) return;
  current = t;
  syncTokens();
  listeners.forEach(l => l(t));
}

export function onThemeChange(l: (t: ThemeName) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// ─── Tint helpers ─────────────────────────────────────────────────────────────

/** A subtle overlay: white-based on dark, near-black-based on light. */
export const ink     = (a: number) => `rgba(${PALETTES[current].inkRgb},${a})`;
export const accentA = (a: number) => `rgba(${PALETTES[current].accentRgb},${a})`;
export const restA   = (a: number) => `rgba(${PALETTES[current].restRgb},${a})`;
export const dangerA = (a: number) => `rgba(${PALETTES[current].dangerRgb},${a})`;

// ─── Themed styles ────────────────────────────────────────────────────────────

/**
 * Wraps a module-level style factory so it is rebuilt per theme:
 *   const s = themed(() => StyleSheet.create({ card: { backgroundColor: COLORS.surface } }));
 * `s.card` then always returns the style for the current theme.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache: Partial<Record<ThemeName, T>> = {};
  const get = (): T => (cache[current] ??= factory());
  return new Proxy({} as T, {
    get: (_t, key) => (get() as Record<PropertyKey, unknown>)[key],
    has: (_t, key) => key in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    // Always report configurable: the Proxy target is an empty object, and a
    // non-configurable descriptor for a key the target lacks (frozen dev-mode
    // StyleSheet objects) would violate a Proxy invariant and throw.
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Object.getOwnPropertyDescriptor(get(), key);
      return d && { ...d, configurable: true };
    },
  });
}
