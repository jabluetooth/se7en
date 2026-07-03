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
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

import { callGroq, GroqMessage } from './groq';
import { generateEmbedding, buildEmbedText } from './embedding';
import { getSql } from './neon';
import { NoteEmbeddingRecord, RpeTrend } from './types';

initializeApp();

// ─── Secrets ────────────────────────────────────────────────────────────────

const GROQ_API_KEY        = defineSecret('GROQ_API_KEY');
const HUGGINGFACE_API_KEY = defineSecret('HUGGINGFACE_API_KEY');
const NEON_DATABASE_URL   = defineSecret('NEON_DATABASE_URL');

// ─── Auth guard ───────────────────────────────────────────────────────────
// onCall's built-in App Check enforcement is left off (enforceAppCheck: false
// is the default and App Check isn't configured in this project), so this
// manual check is the only thing standing between an anonymous caller and
// these functions.

function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to call this function.');
  }
  return request.auth.uid;
}

// ─── groqChat ─────────────────────────────────────────────────────────────
// Replaces callGroq() in src/services/coachService.ts.

interface GroqChatRequest {
  messages:   GroqMessage[];
  maxTokens?: number;
}

export const groqChat = onCall(
  { secrets: [GROQ_API_KEY] },
  async (request: CallableRequest<Partial<GroqChatRequest>>) => {
    requireAuth(request);

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
  { secrets: [HUGGINGFACE_API_KEY, NEON_DATABASE_URL] },
  async (request: CallableRequest<Partial<StoreNoteEmbeddingRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

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
    if (data.muscleTags !== undefined && !Array.isArray(data.muscleTags)) {
      throw new HttpsError('invalid-argument', 'muscleTags must be an array of strings.');
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
  { secrets: [HUGGINGFACE_API_KEY, NEON_DATABASE_URL] },
  async (request: CallableRequest<Partial<SearchRelevantNotesRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (typeof data.queryText !== 'string' || !data.queryText.trim()) {
      throw new HttpsError('invalid-argument', 'queryText is required.');
    }
    if (data.topK !== undefined && (typeof data.topK !== 'number' || data.topK <= 0)) {
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
  { secrets: [NEON_DATABASE_URL] },
  async (request: CallableRequest<Partial<GetRecentNotesRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (data.limit !== undefined && (typeof data.limit !== 'number' || data.limit <= 0)) {
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
  { secrets: [NEON_DATABASE_URL] },
  async (request: CallableRequest<Partial<GetRpeTrendsRequest>>) => {
    const userId = requireAuth(request);
    const data   = request.data ?? {};

    if (data.days !== undefined && (typeof data.days !== 'number' || data.days <= 0)) {
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

// ─── deleteUserEmbeddings ─────────────────────────────────────────────────
// Replaces deleteUserEmbeddings() in src/services/embeddingService.ts.
// Takes no params — always deletes the caller's own rows, derived from the
// verified auth token. Worth also wiring into an account-deletion flow
// (e.g. an Auth onDelete trigger) — left for the call site owner, per task
// scope.

export const deleteUserEmbeddings = onCall(
  { secrets: [NEON_DATABASE_URL] },
  async (request: CallableRequest) => {
    const userId = requireAuth(request);

    const sql = getSql(NEON_DATABASE_URL.value());
    await sql`DELETE FROM note_embeddings WHERE user_id = ${userId}`;

    return { success: true };
  },
);
