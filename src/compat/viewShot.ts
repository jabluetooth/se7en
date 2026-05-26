/**
 * viewShot.ts — safe wrapper around react-native-view-shot.
 *
 * react-native-view-shot requires the RNViewShot native module.
 * In Expo Go that module is not bundled, so:
 *   - ViewShot renders fine (it is just a View wrapper at the JS level)
 *   - captureRef() throws a recognisable sentinel so callers can show
 *     a helpful "use a dev build" message instead of crashing.
 *
 * In development builds and production this module is fully transparent —
 * it passes through to the real library with zero overhead.
 */

import { NativeModules } from 'react-native';
import ViewShotLib, {
  captureRef as captureRefLib,
  type CaptureOptions,
} from 'react-native-view-shot';

/** True when the native capture module is available (dev build / production). */
export const isViewShotAvailable: boolean = !!NativeModules.RNViewShot;

/** Re-exported so callers can use a single import path. */
export const ViewShot = ViewShotLib;

/**
 * Captures a component ref as a PNG data URI or temp file path.
 * Throws `EXPO_GO_NO_CAPTURE` when the native module is absent so the
 * caller can show a user-friendly message.
 */
export async function captureRef(
  ref: Parameters<typeof captureRefLib>[0],
  options?: CaptureOptions,
): Promise<string> {
  if (!isViewShotAvailable) {
    throw new Error('EXPO_GO_NO_CAPTURE');
  }
  return captureRefLib(ref, options);
}
