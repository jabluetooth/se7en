/**
 * Embedding pipeline client — Se7en AI coach.
 *
 * Flow:
 *   1. User logs RPE + note after an exercise
 *   2. storeNoteEmbedding() calls the storeNoteEmbedding Cloud Function,
 *      which enriches the text, calls HuggingFace, and writes to Neon
 *   3. At query time, searchRelevantNotes() calls the searchRelevantNotes
 *      Cloud Function to do the RAG retrieval step
 *
 * All HuggingFace and Neon access now happens server-side (see
 * functions/src/index.ts and functions/src/embedding.ts) — this file only
 * calls the corresponding httpsCallable() functions. Both storeNoteEmbedding
 * calls from the session store and the read calls from coachService.ts are
 * fire-and-forget / best-effort: failures are logged in DEV but never
 * surface to the user.
 *
 * Embedding model: BAAI/bge-small-en-v1.5 (384-dim, free on HF Inference API)
 * This is an asymmetric retrieval model:
 *   - Documents (notes stored)  → embed the enriched text as-is
 *   - Queries (search at runtime) → prepend the BGE query prefix for better recall
 * (both handled server-side now — see functions/src/embedding.ts)
 */

import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoteEmbeddingRecord {
  id:            string;
  user_id:       string;
  session_id:    string;
  exercise_id:   string;
  exercise_name: string;
  muscle_group:  string | null;
  rpe:           number | null;
  note_text:     string;
  workout_date:  string | null;
  created_at:    string;
  similarity?:   number; // present only in search results
}

export interface StoreNoteParams {
  userId:        string; // kept for call-site compatibility; not sent to the backend —
                          // the server derives the real userId from the caller's ID token
  sessionId:     string;
  exerciseId:    string;
  exerciseName:  string;
  muscleTags?:   string[];
  rpe:           number;
  note:          string;
  workoutDate?:  string | null; // YYYY-MM-DD
}

export interface RpeTrend {
  exercise_name: string;
  muscle_group:  string | null;
  avg_rpe:       number;
  session_count: number;
  last_date:     string | null;
}

// ─── Environment guard ────────────────────────────────────────────────────────
// Previously checked for client-side env vars; those secrets now live only
// server-side, so the meaningful client-side precondition is "is someone
// signed in" — every callable function requires Firebase Auth anyway.

export function isEmbeddingConfigured(): boolean {
  return !!auth.currentUser;
}

// ─── Callable bindings ─────────────────────────────────────────────────────────

const storeNoteEmbeddingCallable = httpsCallable<
  Omit<StoreNoteParams, 'userId'>,
  { success: boolean }
>(functions, 'storeNoteEmbedding');

const searchRelevantNotesCallable = httpsCallable<
  { queryText: string; topK?: number },
  { notes: NoteEmbeddingRecord[] }
>(functions, 'searchRelevantNotes');

const getRecentNotesCallable = httpsCallable<
  { limit?: number },
  { notes: NoteEmbeddingRecord[] }
>(functions, 'getRecentNotes');

const getRpeTrendsCallable = httpsCallable<
  { days?: number },
  { trends: RpeTrend[] }
>(functions, 'getRpeTrends');

const deleteUserEmbeddingsCallable = httpsCallable<
  Record<string, never>,
  { success: boolean }
>(functions, 'deleteUserEmbeddings');

// ─── Store a note embedding ───────────────────────────────────────────────────

export async function storeNoteEmbedding(params: StoreNoteParams): Promise<void> {
  if (!isEmbeddingConfigured()) {
    __DEV__ && console.warn('[se7en/embed] Skipped — not signed in');
    return;
  }

  const { userId: _userId, ...rest } = params;
  await storeNoteEmbeddingCallable(rest);
}

// ─── RAG search ───────────────────────────────────────────────────────────────

export async function searchRelevantNotes(
  userId:    string,
  queryText: string,
  topK = 5,
): Promise<NoteEmbeddingRecord[]> {
  if (!isEmbeddingConfigured()) return [];

  const result = await searchRelevantNotesCallable({ queryText, topK });
  return result.data.notes;
}

// ─── Recent notes (no query) ──────────────────────────────────────────────────

export async function getRecentNotes(
  userId: string,
  limit  = 20,
): Promise<NoteEmbeddingRecord[]> {
  if (!isEmbeddingConfigured()) return [];

  const result = await getRecentNotesCallable({ limit });
  return result.data.notes;
}

// ─── RPE trend per exercise ───────────────────────────────────────────────────

export async function getRpeTrends(
  userId: string,
  days   = 28,
): Promise<RpeTrend[]> {
  if (!isEmbeddingConfigured()) return [];

  const result = await getRpeTrendsCallable({ days });
  return result.data.trends;
}

// ─── Account cleanup ──────────────────────────────────────────────────────────

export async function deleteUserEmbeddings(userId: string): Promise<void> {
  if (!isEmbeddingConfigured()) return;
  await deleteUserEmbeddingsCallable({});
}
