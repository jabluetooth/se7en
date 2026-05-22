/**
 * Embedding pipeline for Se7en AI coach.
 *
 * Flow:
 *   1. User logs RPE + note after an exercise
 *   2. storeNoteEmbedding() enriches the text, calls HuggingFace, writes to Neon
 *   3. At query time, searchRelevantNotes() embeds the query and does cosine
 *      similarity search against the user's stored notes (RAG retrieval step)
 *
 * Both HuggingFace and Neon calls are fire-and-forget from the session store —
 * failures are logged in DEV but never surface to the user.
 *
 * Embedding model: BAAI/bge-small-en-v1.5 (384-dim, free on HF Inference API)
 * This is an asymmetric retrieval model:
 *   - Documents (notes stored)  → embed the enriched text as-is
 *   - Queries (search at runtime) → prepend the BGE query prefix for better recall
 */

import { neon, neonConfig } from '@neondatabase/serverless';

// React Native compatibility: tell @neondatabase/serverless to use the global
// WebSocket (built into React Native) instead of the Node.js `ws` package,
// and the global fetch instead of any Node.js HTTP module.
// Must be set before any neon() client is created.
neonConfig.webSocketConstructor = WebSocket;
neonConfig.fetchFunction        = fetch;

// ─── Constants ────────────────────────────────────────────────────────────────

const HF_MODEL    = 'BAAI/bge-small-en-v1.5';
const HF_ENDPOINT = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

// BGE asymmetric retrieval prefix — only applied to search queries, not stored notes
const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

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
  userId:        string;
  sessionId:     string;
  exerciseId:    string;
  exerciseName:  string;
  muscleTags?:   string[];
  rpe:           number;
  note:          string;
  workoutDate?:  string | null; // YYYY-MM-DD
}

// ─── Lazy SQL client ──────────────────────────────────────────────────────────

let _sql: ReturnType<typeof neon> | null = null;

function getSql(): ReturnType<typeof neon> {
  if (!_sql) {
    const url = process.env.EXPO_PUBLIC_NEON_DATABASE_URL;
    if (!url) throw new Error('EXPO_PUBLIC_NEON_DATABASE_URL is not configured');
    _sql = neon(url);
  }
  return _sql;
}

// ─── Environment guard ────────────────────────────────────────────────────────
// Silently skips when the pipeline env vars aren't configured yet.

export function isEmbeddingConfigured(): boolean {
  return !!(
    process.env.EXPO_PUBLIC_NEON_DATABASE_URL &&
    process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY
  );
}

// ─── HuggingFace Inference API — BAAI/bge-small-en-v1.5 ──────────────────────
// Free tier; cold-start can take ~20s on the first call after inactivity.
// isQuery=true prepends the BGE prefix for asymmetric retrieval.

async function generateEmbedding(text: string, isQuery = false): Promise<number[]> {
  const apiKey = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_HUGGINGFACE_API_KEY is not configured');

  const input = isQuery ? BGE_QUERY_PREFIX + text : text;

  const res = await fetch(HF_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: input }),
  });

  // HuggingFace returns 503 while the model loads — surface a clear message
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    const eta  = (body as any).estimated_time;
    throw new Error(
      `HuggingFace model is loading${eta ? ` (~${Math.ceil(eta)}s)` : ''}. Retry shortly.`,
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HuggingFace API ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Feature-extraction pipeline returns [[...384 floats...]] for a single input.
  // Some models return a flat array — handle both shapes.
  return Array.isArray(data[0]) ? (data[0] as number[]) : (data as number[]);
}

// ─── Enriched text builder ────────────────────────────────────────────────────
// Packs exercise metadata alongside the user's note so the embedding captures
// context beyond just the raw text (e.g. "felt good" is more meaningful when
// we know the exercise and effort level).

function buildEmbedText(params: {
  exerciseName: string;
  muscleGroup:  string | null;
  rpe:          number;
  note:         string;
}): string {
  return [
    `Exercise: ${params.exerciseName}`,
    params.muscleGroup ? `Muscles: ${params.muscleGroup}` : null,
    params.rpe > 0     ? `RPE: ${params.rpe}/10`          : null,
    `Note: ${params.note}`,
  ].filter(Boolean).join(' | ');
}

// ─── Store a note embedding ───────────────────────────────────────────────────
// Upserts on (session_id, exercise_id) so edits replace the previous embedding.

export async function storeNoteEmbedding(params: StoreNoteParams): Promise<void> {
  if (!params.note.trim()) return;
  if (!isEmbeddingConfigured()) {
    __DEV__ && console.warn('[se7en/embed] Skipped — env vars not configured');
    return;
  }

  const sql         = getSql();
  const muscleGroup = params.muscleTags?.slice(0, 3).join(', ') ?? null;
  const embedText   = buildEmbedText({
    exerciseName: params.exerciseName,
    muscleGroup,
    rpe:  params.rpe,
    note: params.note,
  });

  // isQuery=false — documents embed without the BGE prefix
  const embedding     = await generateEmbedding(embedText, false);
  const vectorLiteral = `[${embedding.join(',')}]`;

  await sql`
    INSERT INTO note_embeddings
      (user_id, session_id, exercise_id, exercise_name,
       muscle_group, rpe, note_text, embedding, workout_date)
    VALUES
      (${params.userId}, ${params.sessionId}, ${params.exerciseId},
       ${params.exerciseName}, ${muscleGroup}, ${params.rpe},
       ${params.note}, ${vectorLiteral}::vector, ${params.workoutDate ?? null})
    ON CONFLICT (session_id, exercise_id) DO UPDATE SET
      rpe          = EXCLUDED.rpe,
      note_text    = EXCLUDED.note_text,
      embedding    = EXCLUDED.embedding,
      muscle_group = EXCLUDED.muscle_group
  `;
}

// ─── RAG search ───────────────────────────────────────────────────────────────
// Embeds the query with the BGE prefix, then retrieves the top-K most
// semantically similar notes using cosine distance on the HNSW index.

export async function searchRelevantNotes(
  userId:    string,
  queryText: string,
  topK = 5,
): Promise<NoteEmbeddingRecord[]> {
  if (!isEmbeddingConfigured()) return [];

  const sql           = getSql();
  // isQuery=true — search queries use the BGE asymmetric prefix
  const embedding     = await generateEmbedding(queryText, true);
  const vectorLiteral = `[${embedding.join(',')}]`;

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

  return rows as NoteEmbeddingRecord[];
}

// ─── Recent notes (no query) ──────────────────────────────────────────────────
// Used when building the proactive coach context snapshot —
// pull the N most recent notes without any vector search.

export async function getRecentNotes(
  userId: string,
  limit  = 20,
): Promise<NoteEmbeddingRecord[]> {
  if (!isEmbeddingConfigured()) return [];

  const sql  = getSql();
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

  return rows as NoteEmbeddingRecord[];
}

// ─── RPE trend per exercise ───────────────────────────────────────────────────
// Aggregated view for the structured context block sent to the AI coach.

export interface RpeTrend {
  exercise_name: string;
  muscle_group:  string | null;
  avg_rpe:       number;
  session_count: number;
  last_date:     string | null;
}

export async function getRpeTrends(
  userId: string,
  days   = 28,
): Promise<RpeTrend[]> {
  if (!isEmbeddingConfigured()) return [];

  const sql  = getSql();
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

  return rows as RpeTrend[];
}

// ─── Account cleanup ──────────────────────────────────────────────────────────

export async function deleteUserEmbeddings(userId: string): Promise<void> {
  if (!isEmbeddingConfigured()) return;
  const sql = getSql();
  await sql`DELETE FROM note_embeddings WHERE user_id = ${userId}`;
}
