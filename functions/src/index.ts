/**
 * se7en Cloud Functions — server-side proxy for secrets that must never
 * ship inside the client app: the Groq API key, the HuggingFace inference
 * token, and the Neon Postgres connection string (unscoped read/write/delete
 * on note_embeddings).
 *
 * All functions are Firebase Callable Functions (onCall), which verify the
 * caller's Firebase Auth ID token automatically and hand us `request.auth`.
 * We additionally guard every function with an explicit unauthenticated
 * check, and always derive `userId` from `request.auth.uid` — never from
 * client-supplied input — so one user can never read, write, or delete
 * another user's rows.
 *
 * Secrets are Firebase Functions v2 secret params (Google Secret Manager),
 * set with `firebase functions:secrets:set NAME`. See functions/README.md.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as functionsV1 from 'firebase-functions/v1';

import { callGroq, GroqMessage } from './groq';
import { generateEmbedding, buildEmbedText } from './embedding';
import { getSql } from './neon';
import { NoteEmbeddingRecord, RpeTrend } from './types';

initializeApp();

// ─── Region ─────────────────────────────────────────────────────────────────
// Firestore lives in asia-northeast1 (see firebase.json), which does add
// cross-region latency/egress since these functions run in us-central1.
// NOT switched to asia-northeast1: the client's getFunctions(app) call in
// src/config/firebase.ts doesn't pass a region, so it targets us-central1
// by default. Cloud Functions v2 treats a region change as delete-and-
// recreate, so redeploying here with a new region would 404 every callable
// for every live client until a coordinated client update shipped and was
// picked up. Revisit only alongside that client change.

const REGION = 'us-central1';

// ─── Secrets ────────────────────────────────────────────────────────────────

const GROQ_API_KEY        = defineSecret('GROQ_API_KEY');
const HUGGINGFACE_API_KEY = defineSecret('HUGGINGFACE_API_KEY');
const NEON_DATABASE_URL   = defineSecret('NEON_DATABASE_URL');

// ─── Auth guard ───────────────────────────────────────────────────────────
// enforceAppCheck is deliberately left false: the client has no App Check
// provider wired up yet (Play Integrity on Android, App Attest/DeviceCheck
// on iOS), which requires enrolling the app in Play Console / App Store
// Connect first. Turning this on before that lands rejects every real call.
// Flip to true once client-side App Check is provisioned and verified.
// Until then, requireAuth() below plus per-uid rate limiting and
// maxInstances are the abuse guards.

function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to call this function.');
  }
  return request.auth.uid;
}

// ─── Per-uid rate limiting ────────────────────────────────────────────────
// Simple abuse-prevention guard (not a billing system) for the two functions
// that call paid external APIs (Groq, HuggingFace). Tracks a counter per
// `{uid}_{action}_{hourBucket}` in Firestore, incremented atomically inside
// a transaction so concurrent calls can't race past the cap.

const RATE_LIMIT_PER_HOUR = 60;

async function checkRateLimit(uid: string, action: string): Promise<void> {
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const ref = getFirestore().collection('_rateLimits').doc(`${uid}_${action}_${hourBucket}`);

  await getFirestore().runTransaction(async (tx) => {
    const snap  = await tx.get(ref);
    const count = (snap.data()?.count as number | undefined) ?? 0;

    if (count >= RATE_LIMIT_PER_HOUR) {
      throw new HttpsError(
        'resource-exhausted',
        'Rate limit exceeded. Please try again later.',
      );
    }

    tx.set(
      ref,
      { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

// ─── groqChat ─────────────────────────────────────────────────────────────
// Replaces callGroq() in src/services/coachService.ts.

interface GroqChatRequest {
  messages:   GroqMessage[];
  maxTokens?: number;
}

export const groqChat = onCall(
  {
    secrets:         [GROQ_API_KEY],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest<Partial<GroqChatRequest>>) => {
    const userId = requireAuth(request);
    await checkRateLimit(userId, 'groqChat');

    const { messages, maxTokens } = request.data ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'messages must be a non-empty array.');
    }
    for (const m of messages) {
      if (
        !m ||
        typeof m.content !== 'string' ||
        !['system', 'user', 'assistant'].includes(m.role)
      ) {
        throw new HttpsError('invalid-argument', 'Each message needs a valid role and string content.');
      }
    }
    if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens <= 0)) {
      throw new HttpsError('invalid-argument', 'maxTokens must be a positive number.');
    }

    const text = await callGroq(GROQ_API_KEY.value(), messages, maxTokens ?? 300);
    return { text };
  },
);

// ─── storeNoteEmbedding ───────────────────────────────────────────────────
// Replaces storeNoteEmbedding() in src/services/embeddingService.ts.

interface StoreNoteEmbeddingRequest {
  sessionId:    string;
  exerciseId:   string;
  exerciseName: string;
  muscleTags?:  string[];
  rpe:          number;
  note:         string;
  workoutDate?: string | null;
}

export const storeNoteEmbedding = onCall(
  {
    secrets:         [HUGGINGFACE_API_KEY, NEON_DATABASE_URL],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest<Partial<StoreNoteEmbeddingRequest>>) => {
    const userId = requireAuth(request);
    await checkRateLimit(userId, 'storeNoteEmbedding');
    const data = request.data ?? {};

    if (typeof data.sessionId !== 'string' || !data.sessionId) {
      throw new HttpsError('invalid-argument', 'sessionId is required.');
    }
    if (typeof data.exerciseId !== 'string' || !data.exerciseId) {
      throw new HttpsError('invalid-argument', 'exerciseId is required.');
    }
    if (typeof data.exerciseName !== 'string' || !data.exerciseName) {
      throw new HttpsError('invalid-argument', 'exerciseName is required.');
    }
    if (typeof data.rpe !== 'number' || Number.isNaN(data.rpe)) {
      throw new HttpsError('invalid-argument', 'rpe must be a number.');
    }
    if (typeof data.note !== 'string') {
      throw new HttpsError('invalid-argument', 'note must be a string.');
    }
    if (
      data.muscleTags !== undefined &&
      (!Array.isArray(data.muscleTags) || !data.muscleTags.every((t) => typeof t === 'string'))
    ) {
      throw new HttpsError('invalid-argument', 'muscleTags must be an array of strings.');
    }
    if (
      data.workoutDate !== undefined &&
      data.workoutDate !== null &&
      (typeof data.workoutDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.workoutDate))
    ) {
      throw new HttpsError('invalid-argument', 'workoutDate must be a YYYY-MM-DD string.');
    }

    const muscleGroup = data.muscleTags?.slice(0, 3).join(', ') ?? null;
    const embedText    = buildEmbedText({
      exerciseName: data.exerciseName,
      muscleGroup,
      rpe:  data.rpe,
      note: data.note,
    });

    // isQuery=false — documents embed without the BGE prefix
    const embedding     = await generateEmbedding(HUGGINGFACE_API_KEY.value(), embedText, false);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const sql = getSql(NEON_DATABASE_URL.value());
    await sql`
      INSERT INTO note_embeddings
        (user_id, session_id, exercise_id, exercise_name,
         muscle_group, rpe, note_text, embedding, workout_date)
      VALUES
        (${userId}, ${data.sessionId}, ${data.exerciseId},
         ${data.exerciseName}, ${muscleGroup}, ${data.rpe},
         ${data.note}, ${vectorLiteral}::vector, ${data.workoutDate ?? null})
      ON CONFLICT (session_id, exercise_id) DO UPDATE SET
        rpe          = EXCLUDED.rpe,
        note_text    = EXCLUDED.note_text,
        embedding    = EXCLUDED.embedding,
        muscle_group = EXCLUDED.muscle_group
      WHERE note_embeddings.user_id = EXCLUDED.user_id
    `;
    // The WHERE clause above is a hardening beyond the original client code:
    // (session_id, exercise_id) is the conflict target but is not scoped by
    // user_id, so without this guard a caller who guessed another user's
    // session_id/exercise_id could overwrite that user's note on conflict.
    // With the guard, a cross-user conflict simply updates zero rows.

    return { success: true };
  },
);

// ─── searchRelevantNotes ──────────────────────────────────────────────────
// Replaces searchRelevantNotes() in src/services/embeddingService.ts.

interface SearchRelevantNotesRequest {
  queryText: string;
  topK?:     number;
}

export const searchRelevantNotes = onCall(
  {
    secrets:         [HUGGINGFACE_API_KEY, NEON_DATABASE_URL],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest<Partial<SearchRelevantNotesRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (typeof data.queryText !== 'string' || !data.queryText.trim()) {
      throw new HttpsError('invalid-argument', 'queryText is required.');
    }
    if (data.topK !== undefined && !(Number.isFinite(data.topK) && data.topK > 0)) {
      throw new HttpsError('invalid-argument', 'topK must be a positive number.');
    }
    const topK = Math.min(data.topK ?? 5, 20);

    // isQuery=true — search queries use the BGE asymmetric prefix
    const embedding     = await generateEmbedding(HUGGINGFACE_API_KEY.value(), data.queryText, true);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const sql  = getSql(NEON_DATABASE_URL.value());
    const rows = await sql`
      SELECT
        id, user_id, session_id, exercise_id, exercise_name,
        muscle_group, rpe, note_text, workout_date,
        to_char(created_at, 'YYYY-MM-DD') AS created_at,
        1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM  note_embeddings
      WHERE user_id = ${userId}
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;

    return { notes: rows as unknown as NoteEmbeddingRecord[] };
  },
);

// ─── getRecentNotes ───────────────────────────────────────────────────────
// Replaces getRecentNotes() in src/services/embeddingService.ts.

interface GetRecentNotesRequest {
  limit?: number;
}

export const getRecentNotes = onCall(
  {
    secrets:         [NEON_DATABASE_URL],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest<Partial<GetRecentNotesRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (data.limit !== undefined && !(Number.isFinite(data.limit) && data.limit > 0)) {
      throw new HttpsError('invalid-argument', 'limit must be a positive number.');
    }
    const limit = Math.min(data.limit ?? 20, 100);

    const sql  = getSql(NEON_DATABASE_URL.value());
    const rows = await sql`
      SELECT
        id, user_id, session_id, exercise_id, exercise_name,
        muscle_group, rpe, note_text, workout_date,
        to_char(created_at, 'YYYY-MM-DD') AS created_at
      FROM  note_embeddings
      WHERE user_id = ${userId}
      ORDER BY workout_date DESC NULLS LAST, created_at DESC
      LIMIT ${limit}
    `;

    return { notes: rows as unknown as NoteEmbeddingRecord[] };
  },
);

// ─── getRpeTrends ─────────────────────────────────────────────────────────
// Replaces getRpeTrends() in src/services/embeddingService.ts.

interface GetRpeTrendsRequest {
  days?: number;
}

export const getRpeTrends = onCall(
  {
    secrets:         [NEON_DATABASE_URL],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest<Partial<GetRpeTrendsRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (data.days !== undefined && !(Number.isFinite(data.days) && data.days > 0)) {
      throw new HttpsError('invalid-argument', 'days must be a positive number.');
    }
    const days = Math.min(data.days ?? 28, 365);

    const sql  = getSql(NEON_DATABASE_URL.value());
    const rows = await sql`
      SELECT
        exercise_name,
        muscle_group,
        ROUND(AVG(rpe)::numeric, 1)              AS avg_rpe,
        COUNT(*)::integer                         AS session_count,
        to_char(MAX(workout_date), 'YYYY-MM-DD') AS last_date
      FROM  note_embeddings
      WHERE user_id     = ${userId}
        AND rpe         IS NOT NULL
        AND workout_date >= CURRENT_DATE - ${days}::integer
      GROUP BY exercise_name, muscle_group
      ORDER BY avg_rpe DESC
    `;

    return { trends: rows as unknown as RpeTrend[] };
  },
);

// ─── shared deletion helpers ──────────────────────────────────────────────
// Reused by both the user-facing deleteUserEmbeddings callable and the
// account-deletion trigger below, so both paths purge data identically.

async function deleteEmbeddingsForUser(databaseUrl: string, userId: string): Promise<void> {
  const sql = getSql(databaseUrl);
  await sql`DELETE FROM note_embeddings WHERE user_id = ${userId}`;
}

async function deleteFirestoreUserData(userId: string): Promise<void> {
  const db = getFirestore();
  await db.recursiveDelete(db.collection('users').doc(userId));
}

// ─── deleteUserEmbeddings ─────────────────────────────────────────────────
// Replaces deleteUserEmbeddings() in src/services/embeddingService.ts.
// Takes no params — always deletes the caller's own rows, derived from the
// verified auth token. Also wired into account deletion via the
// `purgeUserDataOnDelete` Auth trigger below.

export const deleteUserEmbeddings = onCall(
  {
    secrets:         [NEON_DATABASE_URL],
    region:          REGION,
    maxInstances:    10,
    enforceAppCheck: false,
  },
  async (request: CallableRequest) => {
    const userId = requireAuth(request);
    await deleteEmbeddingsForUser(NEON_DATABASE_URL.value(), userId);
    return { success: true };
  },
);

// ─── purgeUserDataOnDelete ────────────────────────────────────────────────
// Fires when a Firebase Auth user is deleted (e.g. account deletion from the
// client) and purges everything tied to that uid: the Neon embedding rows
// and the Firestore users/{uid} document tree (settings, plans, sessions,
// activeSession, prs — see src/services/firestoreService.ts).
//
// This is a v1 trigger (functions.auth.user().onDelete) because Functions
// v2 only exposes *blocking* identity triggers (beforeUserCreated,
// beforeUserSignedIn, ...) — there is no v2 equivalent of a non-blocking
// "user was deleted" event as of firebase-functions@6.

export const purgeUserDataOnDelete = functionsV1
  .region(REGION)
  .runWith({ secrets: [NEON_DATABASE_URL] })
  .auth.user()
  .onDelete(async (user) => {
    const userId = user.uid;
    try {
      await Promise.all([
        deleteEmbeddingsForUser(NEON_DATABASE_URL.value(), userId),
        deleteFirestoreUserData(userId),
      ]);
    } catch (err) {
      console.error(`purgeUserDataOnDelete failed for uid=${userId}:`, err);
      throw err;
    }
  });
