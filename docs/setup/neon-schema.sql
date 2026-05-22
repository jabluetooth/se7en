-- Se7en · Neon pgvector Schema
-- Run this once against your Neon database to initialise the embedding store.
--
-- Prerequisites:
--   1. Create a Neon project at https://console.neon.tech
--   2. Copy the connection string to EXPO_PUBLIC_NEON_DATABASE_URL in .env.local
--   3. Run this file in the Neon SQL Editor (or via psql)

-- ── 1. Enable pgvector extension ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Note embeddings table ──────────────────────────────────────────────────
-- One row per (session, exercise) pair — upserted whenever the user edits their RPE note.
-- `embedding` stores a 384-dim vector produced by BAAI/bge-small-en-v1.5
-- via the HuggingFace Inference API (free tier).

CREATE TABLE IF NOT EXISTS note_embeddings (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT         NOT NULL,
  session_id    TEXT         NOT NULL,
  exercise_id   TEXT         NOT NULL,
  exercise_name TEXT         NOT NULL,
  muscle_group  TEXT,                        -- comma-separated tags e.g. 'Chest, Triceps'
  rpe           INTEGER      CHECK (rpe BETWEEN 1 AND 10),
  note_text     TEXT         NOT NULL,
  embedding     VECTOR(384),
  workout_date  DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Prevents duplicate rows when a user edits their note
  UNIQUE (session_id, exercise_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- HNSW index for fast approximate nearest-neighbour search.
-- Cosine distance is appropriate for normalised OpenAI embeddings.
CREATE INDEX IF NOT EXISTS note_embeddings_hnsw_idx
  ON note_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- B-tree index on user_id speeds up the WHERE user_id = $1 filter.
CREATE INDEX IF NOT EXISTS note_embeddings_user_idx
  ON note_embeddings (user_id);

-- Composite index useful for history queries (user + date range).
CREATE INDEX IF NOT EXISTS note_embeddings_user_date_idx
  ON note_embeddings (user_id, workout_date DESC);


-- ── 4. Verify ────────────────────────────────────────────────────────────────
-- Run this after setup to confirm everything is in place.
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'note_embeddings';
--
-- SELECT indexname FROM pg_indexes
--   WHERE tablename = 'note_embeddings';
