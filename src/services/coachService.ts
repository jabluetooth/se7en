/**
 * AI Coach — Phase 3 core service.
 *
 * Two entry points:
 *   askCoach(uid, query)        — user asks a direct question (chat)
 *   askCoachProactive(uid)      — homescreen widget; generates an unprompted insight
 *
 * Token budget per call (~750 tokens total, well inside Groq free tier):
 *   System prompt    ~150 tokens
 *   Structured ctx   ~300 tokens  ← Firestore/Zustand aggregates
 *   RAG notes        ~250 tokens  ← top-5 relevant notes from Neon
 *   User query        ~50 tokens
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { functions } from '../config/firebase';
import { useSessionStore }  from '../stores/sessionStore';
import { usePlanStore }     from '../stores/planStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getRpeTrends, searchRelevantNotes, getRecentNotes } from './embeddingService';
import { computeDayPosition } from '../utils/cycleUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY      = '@se7en_coach_cache';
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroqMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface CoachResponse {
  text:      string;
  cached:    boolean;
  error?:    string;
}

interface CachedCoachMessage {
  text:        string;
  generatedAt: string; // ISO
}

// ─── Fallback messages — shown when Groq is unavailable ──────────────────────

const FALLBACKS = [
  "Keep showing up — consistency is the only thing that compounds.",
  "Rest is part of the program, not a break from it.",
  "Your last session is already done. Focus on the next one.",
  "Progress isn't always visible in the mirror. Trust the log.",
  "One tough workout done is worth ten planned workouts skipped.",
];

function randomFallback(): string {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCached(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { text, generatedAt } = JSON.parse(raw) as CachedCoachMessage;
    const age = Date.now() - new Date(generatedAt).getTime();
    return age < CACHE_TTL_MS ? text : null;
  } catch {
    return null;
  }
}

async function setCache(text: string): Promise<void> {
  try {
    const payload: CachedCoachMessage = { text, generatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* non-critical */ }
}

export async function clearCoachCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a personal fitness coach inside Se7en, a workout tracking app.
You have real access to the user's workout history, RPE logs, training notes, and muscle group patterns.

Rules:
- Be direct and specific — reference actual exercises, numbers, and patterns from the data provided
- Keep responses concise: under 120 words for unprompted insights, under 250 words for direct questions
- Tone: encouraging but honest, like a knowledgeable training partner — no generic motivational fluff
- Use ⚠️ only for genuine overtraining signals (RPE 9+ repeated on same exercise, or consistent missed workouts)
- If a muscle group is clearly underrepresented in the frequency data, name it and suggest a fix
- Never fabricate data — only reference what is explicitly in the context below
- If data is sparse (new user), give beginner-friendly general guidance and ask what they want to focus on`.trim();

// ─── Structured context builder ───────────────────────────────────────────────
// Pulls live data from Zustand stores + Neon RPE trends.
// Returns a compact plain-text block (~300 tokens).

async function buildStructuredContext(uid: string): Promise<string> {
  const { sessions, activeSession } = useSessionStore.getState();
  const { activePlan } = usePlanStore.getState();
  const { settings }   = useSettingsStore.getState();

  const now        = new Date();
  const cutoff30   = new Date(now.getTime() - 30 * 24 * 60_000 * 60).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  // ── Plan + current day ──────────────────────────────────────────────────────
  const currentDayPos = computeDayPosition(settings.cycleStartDate, settings.currentDayPosition, activePlan?.days.length ?? 7);
  const planLine      = activePlan
    ? `${activePlan.name} · ${activePlan.splitType}`
    : 'No active plan';

  // currentDayPos is 1-based slot index; look up by array position, not content dayPosition
  const todayDay = activePlan?.days[currentDayPos - 1] ?? null;
  let todayLines = '';
  if (todayDay) {
    if (todayDay.isRestDay) {
      todayLines = `Today (Day ${currentDayPos}): Rest day`;
    } else {
      const exList = todayDay.exercises.map(ex => {
        const muscles = ex.muscleTags?.join(', ');
        return `  • ${ex.name}${muscles ? ` [${muscles}]` : ''}`;
      }).join('\n');
      todayLines = `Today (Day ${currentDayPos}): ${todayDay.label}\n${exList}`;
    }
  }

  // Next non-rest day — compare slot offsets, not content dayPosition IDs
  const planLen = activePlan?.days.length ?? 0;
  const nextDay = (planLen > 0 ? activePlan!.days : [])
    .map((d, i) => ({ d, off: ((i - (currentDayPos - 1) + planLen) % planLen) }))
    .filter(({ d, off }) => !d.isRestDay && off > 0)
    .sort((a, b) => a.off - b.off)[0]?.d ?? null;
  const nextLine = nextDay ? `Next session: ${nextDay.label}` : '';

  // ── Active session (in-progress workout) ────────────────────────────────────
  let activeSessionBlock = '';
  if (activeSession) {
    const exLines = activeSession.exercises.map(ex => {
      const done = ex.sets.filter(s => s.isCompleted).length;
      return `  • ${ex.exerciseName}: ${done}/${ex.sets.length} sets${ex.rpe ? ` · RPE ${ex.rpe}` : ''}`;
    }).join('\n');
    activeSessionBlock = `Active session in progress: ${activeSession.dayLabel}\n${exLines}`;
  }

  // ── Session stats — last 30 days ────────────────────────────────────────────
  const recent    = sessions.filter(s => (s.finishedAt ?? '') >= cutoff30);
  const completed = recent.filter(s => s.status === 'completed');
  const missed    = recent.filter(s => s.status === 'missed');
  const total     = completed.length + missed.length;
  const pct       = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // ── Streak ──────────────────────────────────────────────────────────────────
  const dates = [...new Set(
    [...completed]
      .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
      .map(s => s.finishedAt?.slice(0, 10))
      .filter(Boolean) as string[],
  )];
  let streak = 0;
  const todayStr = now.toISOString().slice(0, 10);
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    if (dates[i] === expected || (i === 0 && dates[0] === todayStr)) {
      streak++;
    } else {
      break;
    }
  }

  // ── Muscle group frequency ───────────────────────────────────────────────────
  const muscleCounts: Record<string, number> = {};
  for (const s of completed) {
    for (const ex of s.exercises) {
      for (const tag of ex.muscleTags ?? []) {
        muscleCounts[tag] = (muscleCounts[tag] ?? 0) + 1;
      }
    }
  }
  const muscleFreq = Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `${m} ${c}x`)
    .join(', ');

  // ── Volume trend ─────────────────────────────────────────────────────────────
  const thisVol = sessions
    .filter(s => s.status === 'completed' && (s.finishedAt ?? '') >= monthStart)
    .reduce((a, s) => a + s.totalVolume, 0);
  const prevVol = sessions
    .filter(s => s.status === 'completed' && (s.finishedAt ?? '') >= prevStart && (s.finishedAt ?? '') < monthStart)
    .reduce((a, s) => a + s.totalVolume, 0);
  const volDelta   = prevVol > 0 ? Math.round(((thisVol - prevVol) / prevVol) * 100) : null;
  const volumeLine = `${Math.round(thisVol).toLocaleString()} kg this month${volDelta !== null ? ` (${volDelta >= 0 ? '+' : ''}${volDelta}% vs last)` : ''}`;

  // ── RPE trends from Neon ─────────────────────────────────────────────────────
  let rpeLines = '';
  try {
    const trends = await getRpeTrends(uid, 28);
    if (trends.length > 0) {
      rpeLines = 'RPE trends (28d):\n' + trends.slice(0, 6).map(t => {
        const flag = Number(t.avg_rpe) >= 9 ? ' ⚠️' : Number(t.avg_rpe) >= 8 ? ' (high)' : '';
        return `  ${t.exercise_name}: avg ${t.avg_rpe} · ${t.session_count} sessions${flag}`;
      }).join('\n');
    }
  } catch (e) {
    __DEV__ && console.warn('[se7en/coach] RPE trends:', e);
  }

  // ── Assemble ─────────────────────────────────────────────────────────────────
  return [
    `Plan: ${planLine}`,
    todayLines,
    nextLine,
    activeSessionBlock,
    '',
    `Consistency (30d): ${completed.length} completed · ${missed.length} missed · ${pct}%`,
    streak > 1 ? `Streak: ${streak} consecutive sessions` : '',
    muscleFreq ? `Muscle frequency (30d): ${muscleFreq}` : '',
    `Volume: ${volumeLine}`,
    rpeLines,
  ].filter(Boolean).join('\n').trim();
}

// ─── RAG note context ─────────────────────────────────────────────────────────
// For proactive messages, pull recent notes. For user queries, search by relevance.

async function buildNoteContext(uid: string, query?: string): Promise<string> {
  try {
    const notes = query
      ? await searchRelevantNotes(uid, query, 5)
      : await getRecentNotes(uid, 10);

    if (notes.length === 0) return '';

    const lines = notes.map(n => {
      const meta     = `[${n.workout_date ?? '?'} · ${n.exercise_name}${n.rpe ? ` · RPE ${n.rpe}` : ''}]`;
      const noteText = n.note_text.trim();
      return noteText ? `${meta} ${noteText}` : meta;
    });
    return 'Recent workout notes:\n' + lines.join('\n');
  } catch (e) {
    __DEV__ && console.warn('[se7en/coach] Note context:', e);
    return '';
  }
}

// ─── Groq inference ───────────────────────────────────────────────────────────
// Proxied through the groqChat Cloud Function so the Groq API key never
// ships inside the client bundle — see functions/src/index.ts.

interface GroqChatResponse {
  text: string;
}

const groqChatCallable = httpsCallable<
  { messages: GroqMessage[]; maxTokens: number },
  GroqChatResponse
>(functions, 'groqChat');

async function callGroq(messages: GroqMessage[], maxTokens = 300): Promise<string> {
  let result: HttpsCallableResult<GroqChatResponse>;
  try {
    result = await groqChatCallable({ messages, maxTokens });
  } catch (err: any) {
    // Preserve the isRateLimit error-shape contract the callers below rely on —
    // previously derived from an HTTP 429, now from the callable's error code.
    if (err?.code === 'functions/resource-exhausted') {
      throw Object.assign(new Error('Rate limited'), { isRateLimit: true });
    }
    throw new Error(err?.message ?? 'Groq request failed');
  }

  return result.data.text.trim();
}

// ─── Conversation type ────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'coach';
  text: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Direct user question — no cache, always fresh.
 * Used by the coach chat screen (Phase 5).
 */
export async function askCoach(uid: string, query: string): Promise<CoachResponse> {
  try {
    const [structuredCtx, noteCtx] = await Promise.all([
      buildStructuredContext(uid),
      buildNoteContext(uid, query),
    ]);

    const userBlock = [
      '=== WORKOUT DATA ===',
      structuredCtx,
      noteCtx ? '\n' + noteCtx : '',
      '\n=== USER QUESTION ===',
      query,
    ].filter(Boolean).join('\n');

    const text = await callGroq([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userBlock },
    ], 350);

    return { text, cached: false };
  } catch (err: any) {
    const cached = await getCached();
    if (cached) return { text: cached, cached: true, error: 'rate_limit' };
    return { text: randomFallback(), cached: false, error: err.message };
  }
}

/**
 * Multi-turn conversation — used by the CoachScreen chat UI.
 * Passes the full structured context + the last N exchanges to Groq so
 * each reply is aware of prior turns and current training data.
 * History is trimmed to the last 12 messages (6 exchanges) to stay within
 * the token budget.
 */
export async function continueConversation(
  uid:      string,
  history:  ConversationMessage[],
  newQuery: string,
): Promise<CoachResponse> {
  try {
    const [structuredCtx, noteCtx] = await Promise.all([
      buildStructuredContext(uid),
      buildNoteContext(uid, newQuery),
    ]);

    // Embed context in the system message so it's refreshed on every turn
    const systemWithCtx = [
      SYSTEM_PROMPT,
      '',
      '=== WORKOUT DATA ===',
      structuredCtx,
      noteCtx ? '\n' + noteCtx : '',
    ].filter(Boolean).join('\n');

    // Cap history at the last 12 messages to control token spend
    const trimmed = history.slice(-12);
    const historyMsgs: GroqMessage[] = trimmed.map(m => ({
      role:    m.role === 'coach' ? 'assistant' : 'user',
      content: m.text,
    }));

    const text = await callGroq(
      [
        { role: 'system', content: systemWithCtx },
        ...historyMsgs,
        { role: 'user',   content: newQuery },
      ],
      350,
    );

    return { text, cached: false };
  } catch (err: any) {
    return {
      text:   randomFallback(),
      cached: false,
      error:  (err as any).isRateLimit ? 'rate_limit' : err.message,
    };
  }
}

/**
 * Proactive homescreen widget message — cached for 24 hours.
 * Generates an unprompted insight based on the user's full data snapshot.
 * Pass forceRefresh=true to bypass cache (e.g. after a workout finishes).
 */
export async function askCoachProactive(
  uid: string,
  forceRefresh = false,
): Promise<CoachResponse> {
  // Return cached message if still fresh
  if (!forceRefresh) {
    const cached = await getCached();
    if (cached) return { text: cached, cached: true };
  }

  try {
    const [structuredCtx, noteCtx] = await Promise.all([
      buildStructuredContext(uid),
      buildNoteContext(uid),
    ]);

    const userBlock = [
      '=== WORKOUT DATA ===',
      structuredCtx,
      noteCtx ? '\n' + noteCtx : '',
      '\n=== YOUR TASK ===',
      'Based on this data, give one specific, actionable insight or encouragement for today.' +
      ' Pick the most meaningful pattern you see — imbalance, overtraining risk, good progress, or what to focus on next.' +
      ' Be specific, not generic.',
    ].filter(Boolean).join('\n');

    const text = await callGroq([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userBlock },
    ], 200);

    await setCache(text);
    return { text, cached: false };
  } catch (err: any) {
    const cached = await getCached();
    if (cached) return { text: cached, cached: true, error: 'rate_limit' };
    const fallback = randomFallback();
    return { text: fallback, cached: false, error: err.message };
  }
}
