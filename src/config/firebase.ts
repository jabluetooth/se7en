import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore }                  from 'firebase/firestore';
import { getStorage }                    from 'firebase/storage';
import { initializeAuth, getAuth }       from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// metro.config.js sets resolver.unstable_conditionNames = ['react-native', ...] so Metro
// resolves firebase/auth → @firebase/auth (react-native build) which exports
// getReactNativePersistence and calls registerAuth("ReactNative") at module load.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
};

// try/catch handles `auth/already-initialized` on Expo Fast Refresh
export const auth = (() => {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) as any });
  } catch {
    return getAuth(app);
  }
})();

export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
