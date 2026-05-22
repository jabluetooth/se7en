/**
 * widgetNative.ts
 * Thin wrapper around the Se7enWidgets NativeModule.
 * All methods are no-ops when the native module is unavailable (simulator,
 * Expo Go, Android without the package registered, etc.).
 */

import { NativeModules } from 'react-native';

interface Se7enWidgetsNative {
  setWidgetData(json: string): void;
  reloadWidgets(): void;
  startLiveActivity(json: string): void;
  updateLiveActivity(json: string): void;
  endLiveActivity(): void;
}

const noop = () => {};

function getModule(): Se7enWidgetsNative | null {
  try {
    const mod = NativeModules.Se7enWidgets as Se7enWidgetsNative | undefined;
    return mod ?? null;
  } catch {
    return null;
  }
}

const WidgetNative: Se7enWidgetsNative = {
  setWidgetData(json: string): void {
    try { getModule()?.setWidgetData(json); } catch { noop(); }
  },
  reloadWidgets(): void {
    try { getModule()?.reloadWidgets(); } catch { noop(); }
  },
  startLiveActivity(json: string): void {
    try { getModule()?.startLiveActivity(json); } catch { noop(); }
  },
  updateLiveActivity(json: string): void {
    try { getModule()?.updateLiveActivity(json); } catch { noop(); }
  },
  endLiveActivity(): void {
    try { getModule()?.endLiveActivity(); } catch { noop(); }
  },
};

export default WidgetNative;
