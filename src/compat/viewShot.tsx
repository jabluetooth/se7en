/**
 * viewShot.tsx — safe wrapper around react-native-view-shot.
 *
 * react-native-view-shot needs its RNViewShot native module. Since v5 the
 * library looks that module up with TurboModuleRegistry.getEnforcing() the
 * moment it is imported, which throws when the module is missing — so a
 * plain top-level import would crash the whole app on load in any runtime
 * without it. This wrapper therefore:
 *   - loads the library lazily, inside a try, only if the module exists;
 *   - falls back to a plain View so <ViewShot> still renders;
 *   - makes captureRef() throw a recognisable sentinel so callers can show
 *     a friendly message instead of crashing.
 *
 * Where the module is present this is a transparent pass-through.
 */
import React, { forwardRef } from 'react';
import { NativeModules, TurboModuleRegistry, View } from 'react-native';
import type { CaptureOptions, ViewShotProperties, ViewShotRef } from 'react-native-view-shot';

export type { ViewShotRef };

type ViewShotLib = typeof import('react-native-view-shot');

function hasNativeModule(): boolean {
  try {
    return !!(TurboModuleRegistry.get('RNViewShot') ?? NativeModules.RNViewShot);
  } catch {
    return false;
  }
}

function loadLib(): ViewShotLib | null {
  if (!hasNativeModule()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-view-shot') as ViewShotLib;
  } catch {
    return null;
  }
}

const lib = loadLib();

/** True when the native capture module is available. */
export const isViewShotAvailable: boolean = lib !== null;

const FallbackViewShot = forwardRef<ViewShotRef, ViewShotProperties>(function FallbackViewShot(
  { children, style },
  ref,
) {
  return (
    <View ref={ref as React.Ref<View>} style={style} collapsable={false}>
      {children}
    </View>
  );
});

/** Re-exported so callers can use a single import path. */
export const ViewShot = lib?.default ?? FallbackViewShot;

/**
 * Captures a component ref as a PNG data URI or temp file path.
 * Throws `EXPO_GO_NO_CAPTURE` when the native module is absent so the
 * caller can show a user-friendly message.
 */
export async function captureRef(
  ref: Parameters<ViewShotLib['captureRef']>[0],
  options?: CaptureOptions,
): Promise<string> {
  if (!lib) throw new Error('EXPO_GO_NO_CAPTURE');
  return lib.captureRef(ref, options);
}
