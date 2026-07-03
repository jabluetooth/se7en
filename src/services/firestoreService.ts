/**
 * Thin typed wrappers around Firestore SDK.
 * All functions take a uid so no store ever builds its own path string.
 *
 * Schema
 *   users/{uid}/settings          → single document
 *   users/{uid}/plans/{planId}    → one doc per plan
 *   users/{uid}/sessions/{id}     → one doc per session
 *   users/{uid}/activeSession     → single document (overwritten while workout is live)
 *   users/{uid}/prs/{exerciseId}  → one doc per exercise PR
 */

import {
  doc, collection,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Timeout guard (15 s) — prevents reads hanging on poor connectivity ────────

const FS_TIMEOUT_MS = 15_000;

function withTimeout<T>(p: Promise<T>, ms = FS_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore request timed out')), ms)
    ),
  ]);
}
import { Settings, WorkoutPlan, WorkoutSession, PersonalRecord } from '../types';

// ─── Listener error logging ───────────────────────────────────────────────────
// onSnapshot silently stops delivering updates on error (permission-denied after
// a rules change, stale-token, or a stream drop) unless an error callback is
// passed — without one the app just shows stale data with no signal why.

function logListenerError(name: string) {
  return (err: unknown) => { __DEV__ && console.warn(`[se7en/firestore] ${name} listener error:`, err); };
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

const userDoc      = (uid: string)                  => doc(db, 'users', uid);
const settingsDoc  = (uid: string)                  => doc(db, 'users', uid, 'settings', 'doc');
const planDoc      = (uid: string, planId: string)  => doc(db, 'users', uid, 'plans', planId);
const plansCol     = (uid: string)                  => collection(db, 'users', uid, 'plans');
const sessionDoc   = (uid: string, id: string)      => doc(db, 'users', uid, 'sessions', id);
const sessionsCol  = (uid: string)                  => collection(db, 'users', uid, 'sessions');
const activeSessDoc= (uid: string)                  => doc(db, 'users', uid, 'activeSession', 'doc');
const prDoc        = (uid: string, exerciseId: string) => doc(db, 'users', uid, 'prs', exerciseId);
const prsCol       = (uid: string)                  => collection(db, 'users', uid, 'prs');

// ─── Settings ─────────────────────────────────────────────────────────────────

export const fsSettings = {
  async get(uid: string): Promise<Settings | null> {
    const snap = await withTimeout(getDoc(settingsDoc(uid)));
    return snap.exists() ? (snap.data() as Settings) : null;
  },

  async set(uid: string, data: Settings): Promise<void> {
    await setDoc(settingsDoc(uid), data);
  },

  /** Field-level write — only touches the given keys, so a concurrent write
   *  to a different field (another device, or an in-flight save racing the
   *  onSnapshot echo) can't silently clobber it with a stale full-document copy. */
  async update(uid: string, partial: Partial<Settings>): Promise<void> {
    await updateDoc(settingsDoc(uid), partial);
  },

  listen(uid: string, cb: (data: Settings) => void): Unsubscribe {
    return onSnapshot(settingsDoc(uid), snap => {
      if (snap.exists()) cb(snap.data() as Settings);
    }, logListenerError('settings'));
  },
};

// ─── Plans ────────────────────────────────────────────────────────────────────

export const fsPlans = {
  async getAll(uid: string): Promise<WorkoutPlan[]> {
    const snap = await withTimeout(getDocs(plansCol(uid)));
    return snap.docs.map(d => d.data() as WorkoutPlan);
  },

  async set(uid: string, plan: WorkoutPlan): Promise<void> {
    await setDoc(planDoc(uid, plan.id), plan);
  },

  async delete(uid: string, planId: string): Promise<void> {
    await deleteDoc(planDoc(uid, planId));
  },

  listen(uid: string, cb: (plans: WorkoutPlan[]) => void): Unsubscribe {
    return onSnapshot(plansCol(uid), snap => {
      cb(snap.docs.map(d => d.data() as WorkoutPlan));
    }, logListenerError('plans'));
  },
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const fsSessions = {
  async getAll(uid: string): Promise<WorkoutSession[]> {
    const snap = await withTimeout(getDocs(sessionsCol(uid)));
    return snap.docs.map(d => d.data() as WorkoutSession);
  },

  async set(uid: string, session: WorkoutSession): Promise<void> {
    await setDoc(sessionDoc(uid, session.id), session);
  },

  async delete(uid: string, sessionId: string): Promise<void> {
    await deleteDoc(sessionDoc(uid, sessionId));
  },

  async deleteAll(uid: string): Promise<void> {
    const snap = await getDocs(sessionsCol(uid));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  },

  listen(uid: string, cb: (sessions: WorkoutSession[]) => void): Unsubscribe {
    return onSnapshot(sessionsCol(uid), snap => {
      cb(snap.docs.map(d => d.data() as WorkoutSession));
    }, logListenerError('sessions'));
  },
};

// ─── Active session ───────────────────────────────────────────────────────────

export const fsActiveSession = {
  async get(uid: string): Promise<WorkoutSession | null> {
    const snap = await withTimeout(getDoc(activeSessDoc(uid)));
    return snap.exists() ? (snap.data() as WorkoutSession) : null;
  },

  async set(uid: string, session: WorkoutSession): Promise<void> {
    await setDoc(activeSessDoc(uid), session);
  },

  async clear(uid: string): Promise<void> {
    await deleteDoc(activeSessDoc(uid));
  },

  listen(uid: string, cb: (session: WorkoutSession | null) => void): Unsubscribe {
    return onSnapshot(activeSessDoc(uid), snap => {
      cb(snap.exists() ? (snap.data() as WorkoutSession) : null);
    }, logListenerError('activeSession'));
  },
};

// ─── Personal records ─────────────────────────────────────────────────────────

export const fsPRs = {
  async getAll(uid: string): Promise<PersonalRecord[]> {
    const snap = await withTimeout(getDocs(prsCol(uid)));
    return snap.docs.map(d => d.data() as PersonalRecord);
  },

  async set(uid: string, pr: PersonalRecord): Promise<void> {
    await setDoc(prDoc(uid, pr.exerciseId), pr);
  },

  listen(uid: string, cb: (prs: PersonalRecord[]) => void): Unsubscribe {
    return onSnapshot(prsCol(uid), snap => {
      cb(snap.docs.map(d => d.data() as PersonalRecord));
    }, logListenerError('prs'));
  },
};
