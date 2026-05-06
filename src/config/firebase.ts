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

// `getReactNativePersistence` exists in firebase@10 at runtime but is not in the TS
// declaration files for this version — use require() to bypass the type gap.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => any;
};

// Auth with React Native AsyncStorage persistence — sessions survive app restarts
export const auth = getApps().length === 1
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
