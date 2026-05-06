import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthStore {
  user:        User | null;
  initialised: boolean;      // onAuthStateChanged has fired at least once
  loading:     boolean;      // sign-in / sign-up in progress
  error:        string | null;

  // Called once from App.tsx — starts the persistent listener
  startListener: (
    onSignIn:  (user: User) => void,
    onSignOut: () => void,
  ) => () => void;

  signIn:         (email: string, password: string)                             => Promise<void>;
  signUp:         (name: string,  email: string,  password: string)             => Promise<void>;
  signOut:        ()                                                             => Promise<void>;
  resetPassword:  (email: string)                                               => Promise<void>;
  clearError:     ()                                                             => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:        null,
  initialised: false,
  loading:     false,
  error:       null,

  startListener: (onSignIn, onSignOut) =>
    onAuthStateChanged(auth, user => {
      set({ user, initialised: true });
      if (user) onSignIn(user);
      else      onSignOut();
    }),

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // user state updated by onAuthStateChanged listener
    } catch (e: any) {
      set({ error: friendlyError(e.code), loading: false });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      set({ user }); // reflect displayName immediately
    } catch (e: any) {
      set({ error: friendlyError(e.code), loading: false });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await fbSignOut(auth);
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      set({ error: friendlyError(e.code), loading: false });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// ─── Human-readable Firebase error messages ───────────────────────────────────

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
