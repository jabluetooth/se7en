/**
 * HuggingFace embedding call + enriched-text builder — ported from
 * src/services/embeddingService.ts (generateEmbedding / buildEmbedText).
 * Same model, endpoint, and BGE asymmetric-retrieval query prefix; only the
 * API key source changed (secret param instead of client env var).
 */

import { HttpsError } from 'firebase-functions/v2/https';

const HF_MODEL    = 'BAAI/bge-small-en-v1.5';
const HF_ENDPOINT = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;

// BGE asymmetric retrieval prefix — only applied to search queries, not stored notes
const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

// isQuery=true prepends the BGE prefix for asymmetric retrieval.
export async function generateEmbedding(
  apiKey:  string,
  text:    string,
  isQuery = false,
): Promise<number[]> {
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
    const body = await res.json().catch(() => ({}) as any);
    const eta  = (body as any).estimated_time;
    throw new HttpsError(
      'unavailable',
      `HuggingFace model is loading${eta ? ` (~${Math.ceil(eta)}s)` : ''}. Retry shortly.`,
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new HttpsError('internal', `HuggingFace API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as unknown[] | number[][];

  // Feature-extraction pipeline returns [[...384 floats...]] for a single input.
  // Some models return a flat array — handle both shapes.
  return Array.isArray(data[0]) ? (data[0] as number[]) : (data as number[]);
}

// Packs exercise metadata alongside the user's note so the embedding captures
// context beyond just the raw text (e.g. "felt good" is more meaningful when
// we know the exercise and effort level).
export function buildEmbedText(params: {
  exerciseName: string;
  muscleGroup:  string | null;
  rpe:          number;
  note:         string;
}): string {
  return [
    `Exercise: ${params.exerciseName}`,
    params.muscleGroup ? `Muscles: ${params.muscleGroup}` : null,
    params.rpe > 0     ? `RPE: ${params.rpe}/10`          : null,
    params.note.trim() ? `Note: ${params.note}` : null,
  ].filter(Boolean).join(' | ');
}
