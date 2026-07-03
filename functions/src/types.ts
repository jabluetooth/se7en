/**
 * Shared row shapes for the `note_embeddings` table in Neon.
 * Mirrors the client-side types that used to live in
 * src/services/embeddingService.ts (kept in sync manually — this is a
 * small, stable schema).
 */

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

export interface RpeTrend {
  exercise_name: string;
  muscle_group:  string | null;
  avg_rpe:       number;
  session_count: number;
  last_date:     string | null;
}
