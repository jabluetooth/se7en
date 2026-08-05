/**
 * Groq chat-completions call — ported from the client's callGroq() in
 * src/services/coachService.ts. Same endpoint, model, and error semantics;
 * only the API key source changed (secret param instead of client env var).
 */

import { HttpsError } from 'firebase-functions/v2/https';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';

export interface GroqMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export async function callGroq(
  apiKey:    string,
  messages:  GroqMessage[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      max_tokens:  maxTokens,
      temperature: 0.75,
    }),
  });

  // Surfaced to the client as HttpsError code 'resource-exhausted' so
  // callers can check `error.code === 'resource-exhausted'` the same way
  // the old client code checked `err.isRateLimit`.
  if (res.status === 429) {
    throw new HttpsError('resource-exhausted', 'Rate limited');
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`Groq API error ${res.status}:`, body);
    throw new HttpsError('internal', 'Coach is temporarily unavailable.');
  }

  const data = (await res.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new HttpsError('internal', 'Groq returned an unexpected response shape.');
  }
  return text.trim();
}
