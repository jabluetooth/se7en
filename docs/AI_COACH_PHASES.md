# AI Personal Coach — Implementation Phases

## Overview

An AI-powered personal coach integrated into Se7en that tracks RPE + workout notes,
analyzes patterns via RAG, and surfaces insights through a coach widget on the
homescreen and a full chat screen.

**Status: Phases 1–5 are implemented and live.** This document originally read as
an unstarted plan; it's been corrected to reflect reality. Phase 6 (polish/resilience)
is partially done (see below) and the rest is still just a plan.

**Stack:**
- **Storage:** Firestore/Zustand (structured workout data) + Neon pgvector (note embeddings)
- **Embeddings:** HuggingFace Inference API — `BAAI/bge-small-en-v1.5` (384-dim, free tier)
- **Inference:** Groq (free tier — Llama 3.3 70B, via `llama-3.3-70b-versatile`)
- **Client → provider architecture:** the client never talks to Groq, HuggingFace, or
  Neon directly. All three are proxied through Firebase Cloud Functions callables so
  the provider API keys stay server-side. `src/services/coachService.ts` and
  `src/services/embeddingService.ts` call these callables via `httpsCallable()`; the
  callables themselves live in `functions/src/index.ts`. See "Cloud Functions" below
  for the full map.
- **Avatar:** the originally-planned Lottie cartoon avatar was not built — the shipped
  widget and chat screen use a simpler glass/bolt-icon treatment instead (see
  `CoachWidget.tsx` and `CoachScreen.tsx`'s `BoltAvatar`). References to Lottie states
  below are the original plan, not what's live.

### Cloud Functions (proxy layer)

All six live in `functions/src/index.ts`, each requiring Firebase Auth (`requireAuth`)
and deriving `userId` from the verified token rather than trusting client input:

| Callable | What it does |
|---|---|
| `groqChat` | Sends an assembled message list to Groq and returns the completion text. Used by both `askCoach`/`askCoachProactive` and `continueConversation`. |
| `storeNoteEmbedding` | Builds embed text from an exercise note, embeds it via HuggingFace, and upserts it into Neon `note_embeddings` (keyed on `session_id, exercise_id`). |
| `searchRelevantNotes` | Embeds the query text (with the BGE query prefix) and returns the top-K most similar notes for the calling user via pgvector cosine search. |
| `getRecentNotes` | Returns the caller's N most recent notes, no embedding/search involved — used for the proactive widget's context. |
| `getRpeTrends` | Aggregates average RPE per exercise over a trailing window (default 28 days) for the calling user. |
| `deleteUserEmbeddings` | Deletes all `note_embeddings` rows for the calling user — for account-deletion flows. |

---

## Phase 1 — RPE + Notes Data Layer ✅ Implemented

**Goal:** Capture RPE and notes per exercise during an active workout session.

### Data Model

`setExerciseRPE(exerciseId, rpe, note)` in `src/stores/sessionStore.ts` stores RPE
and a free-form note on the exercise entry within the active session, and
fire-and-forget triggers `storeNoteEmbedding` when `rpe > 0`. Persisted shape lives
in the session store rather than the flat Firestore path originally sketched below;
the field names (`rpe`, `exerciseNote`) carry the same intent.

```
workoutLog/{userId}/sessions/{sessionId}/exercises/{exerciseId}
  ├── rpe: number (1–10)
  └── note: string (optional, free-form)
```

### Tasks
- [x] Update schema to include `rpe` and `note` per exercise entry
- [x] Add RPE input, wired to `setExerciseRPE`
- [x] Add note text input
- [x] Integrate both inputs into the active workout session flow
- [x] Store RPE + note on workout save (and fire embedding on non-empty RPE)
- [x] Display logged RPE — surfaced via `getRpeTrends` in the coach context, not as a
      separate history-card feature (that specific UI wasn't built)

### UX Notes
- RPE input appears after the last set of each exercise
- Note is optional — skip button visible
- Keep input fast: tap a number, type optional note, done

---

## Phase 2 — Embedding Pipeline ✅ Implemented

**Goal:** Automatically embed workout notes and store vectors in Neon for future RAG queries.

### Neon Schema

The authoritative schema lives in [`docs/setup/neon-schema.sql`](./setup/neon-schema.sql) —
treat that file as the source of truth, not the snippet that used to live here. Two
corrections versus the original plan below: the embedding column is `VECTOR(384)`
(matching `bge-small-en-v1.5`, not the 1536-dim OpenAI-sized vector originally
sketched), and the index is HNSW, not `ivfflat`. The table also has a
`UNIQUE (session_id, exercise_id)` constraint with an upsert-on-conflict, so editing
a note updates its embedding in place rather than creating a duplicate row.

### Tasks
- [x] Set up Neon project and pgvector extension
- [x] Create `note_embeddings` table (see `docs/setup/neon-schema.sql`)
- [x] Integrate HuggingFace Inference API (`BAAI/bge-small-en-v1.5`, 384-dim) —
      server-side only, via the `storeNoteEmbedding` and `searchRelevantNotes`
      Cloud Functions (not called directly from the client)
- [x] Write embedding function — `generateEmbedding()` in `functions/src/embedding.ts`,
      called from the Cloud Functions above
- [x] Trigger embed + insert to Neon on workout save (only if RPE > 0), via
      `sessionStore.setExerciseRPE()` → `storeNoteEmbedding()`
- [x] Write RAG query function — `searchRelevantNotes(userId, queryText, topK=5)` in
      `src/services/embeddingService.ts`, which calls the `searchRelevantNotes`
      Cloud Function (HuggingFace + Neon access happens inside the function, not
      in this client code)

### Token Budget Awareness
- Each note embed call: ~20–50 tokens (near zero cost)
- Each RAG retrieval: returns top 5 notes → ~200–300 tokens of context

---

## Phase 3 — AI Coach Core ✅ Implemented

**Goal:** Build the inference layer that assembles context and queries Groq.

### Context Assembly Strategy

Actual budget per call is ~750 tokens (tighter than the original ~1,200–1,500 target),
per the header comment in `src/services/coachService.ts`:

```
[System Prompt ~150 tokens]
  Coach persona + behavior rules

[Structured Context ~300 tokens]  ← Zustand/Firestore aggregates + Neon RPE trends
  - Consistency rate (last 30 days) + streak
  - Muscle group frequency breakdown
  - Volume trend (this month vs last)
  - RPE trend per exercise (last 28 days, via getRpeTrends)
  - Current plan + today's/next session

[Relevant Notes ~250 tokens]  ← Neon RAG (top 5 via searchRelevantNotes, or top 10
  recent notes via getRecentNotes for proactive/no-query calls)

[User Query ~50 tokens]
```

### Tasks
- [x] Set up Groq access — no client-side `groq-sdk`; the client calls the `groqChat`
      Cloud Function, which holds the Groq API key server-side (`functions/src/index.ts`)
- [x] Write `buildStructuredContext(uid)` — in `coachService.ts`, pulls from Zustand
      stores (session/plan/settings) plus `getRpeTrends()` from Neon
- [x] Write the full prompt assembly — inlined into `askCoach()`, `askCoachProactive()`,
      and `continueConversation()` rather than a single shared `buildCoachPrompt()` helper
- [x] Write `askCoach(uid, query)` — calls Groq (via the `groqChat` callable) with the
      assembled prompt
- [x] Add rate limit handler + fallback message — `callGroq()` maps the callable's
      `functions/resource-exhausted` error to an `isRateLimit` flag; callers fall back to
      a cached message or a random static fallback line
- [x] Cache last AI response in AsyncStorage — `CACHE_KEY`/`CACHE_TTL_MS` (24h) in
      `coachService.ts`, used by `askCoachProactive()`

### Groq Model
`llama-3.3-70b-versatile`, called server-side from `functions/src/index.ts`.

---

## Phase 4 — Homescreen Coach Widget ✅ Implemented (avatar concept changed)

**Goal:** Card on the homescreen that proactively surfaces insights, recommendations,
and encouragement.

### Widget Behavior
- Generates a message on first mount per session and on explicit refresh; the message
  is one free-form insight from the model, not selected from the fixed
  Progress/Warning/Recommendation/Cheer/Tip categories originally sketched below — the
  system prompt asks Groq to "pick the most meaningful pattern," so category is
  implicit in the model's own reasoning, not an enum in code.
- Gated behind `MIN_SESSIONS_FOR_AI = 3` — under 3 completed sessions, the widget shows
  a "log a few more workouts" empty state instead of calling Groq at all.
- Below is the original message-type framing, kept for flavor/inspiration — not a
  literal code contract:
  - **Progress** — "You're 82% consistent this month, best streak yet!"
  - **Warning** — "Your legs RPE has been 9+ three sessions in a row — consider a deload"
  - **Recommendation** — "You haven't hit shoulders this week, today's a good day"
  - **Cheer** — "You crushed that PR on bench — keep that energy!"
  - **Tip** — "Try dropping RPE to 7 on warm-up sets to save energy for your working sets"

### Avatar — not built as planned
The Lottie cartoon avatar (5 animation states below) was never sourced/built. The
shipped widget (`src/components/CoachWidget/CoachWidget.tsx`) and chat screen
(`src/screens/Coach/CoachScreen.tsx`) instead use a simple glass-circle "bolt" icon
(`BoltAvatar`), with a pulsing opacity animation while loading. Table kept here as a
record of the original intent, in case avatar work is picked up later:

| State | Trigger |
|---|---|
| `idle` | Default, breathing loop |
| `talking` | While message is being revealed |
| `celebrating` | Progress / PR messages |
| `thinking` | Loading / generating |
| `concerned` | Warning messages |

### Tasks
- [ ] Source or create cartoon coach Lottie animation files (5 states above) — **not done**,
      superseded by the bolt-icon treatment
- [x] Build `CoachWidget` component with avatar + message card (bolt icon, not Lottie)
- [x] Animate message text reveal — typewriter effect via `useTypewriter()`
      (plain `Animated`, not Reanimated)
- [x] Wire `askCoachProactive()` with a homescreen-specific prompt (no user query)
- [x] Cache widget message in AsyncStorage with a `generatedAt` timestamp
- [x] Invalidate cache — 24h TTL, plus `force=true` from the widget's Refresh button
      (post-workout auto-invalidation via a session-finish hook was not found in
      `CoachWidget.tsx` — invalidation today is TTL + manual refresh only)
- [x] Add widget to homescreen
- [x] Add tap interaction — Refresh button (force-regenerate) and "Ask Coach →" button
      (opens `CoachScreen` with the current message preloaded), rather than tapping
      the avatar itself
- [x] Rate-limit handling — countdown banner + "Try now" retry, offline state, and a
      first-time/empty state for users under the 3-session threshold (all beyond what
      Phase 4's task list originally called for)

---

## Phase 5 — Full Coach Conversation ✅ Implemented

**Goal:** Let users have a back-and-forth conversation with the coach from the widget.

### Tasks
- [x] Build `CoachScreen` — full-screen chat UI (`src/screens/Coach/CoachScreen.tsx`),
      bolt-icon avatar at top rather than a cartoon one (see Phase 4)
- [x] Maintain conversation history in session state — last 12 messages (6 exchanges),
      not 6 messages, trimmed in `continueConversation()`
- [x] "Ask Coach →" button on the widget navigates to `CoachScreen` with the widget's
      current message preloaded as the first bubble
- [x] Add suggested prompts — six quick-reply chips in `CoachScreen` ("How am I doing
      overall?", "Am I overtraining?", "Which muscles am I neglecting?", "Should I take
      a rest day?", "What should I focus on next week?", "How can I improve my
      consistency?"), shown until the user has sent 2+ messages
- [ ] Token/query usage indicator — **not built** (was marked optional)

---

## Phase 6 — Polish + Resilience (partially implemented)

**Goal:** Make the feature feel production-quality and resilient to free tier limits.

### Tasks
- [x] Offline fallback — `askCoachProactive`/`askCoach` fall back to the AsyncStorage
      cache on error, and `CoachWidget` shows a distinct "No connection" message when
      the error looks network-related
- [x] Groq rate limit backoff — `CoachWidget` shows a live countdown banner and
      auto-retries after `RATE_LIMIT_SECS = 60`; `CoachScreen`'s chat only surfaces a
      rate-limit error banner without an auto-retry countdown (not queued/retried there)
- [x] Empty state — `CoachWidget` shows a "log N more workouts" message below
      `MIN_SESSIONS_FOR_AI = 3` completed sessions; `CoachScreen` shows a distinct
      first-open empty state
- [ ] Avatar customization — **not built**; there's no cartoon avatar to customize
      (see Phase 4's "Avatar — not built as planned")
- [x] Push notification — daily coach check-in implemented in
      `src/services/notificationService.ts`
      (`scheduleDailyCoachReminder()` / `cancelDailyCoachReminder()`), configurable
      from Settings
- [ ] Analytics — **not found**; no per-message-type engagement tracking in the coach
      code

---

## Milestone Summary

| Phase | Deliverable | Dependency | Status |
|---|---|---|---|
| 1 | RPE + Notes logged per exercise | None | Done |
| 2 | Notes embedded and searchable in Neon | Phase 1 | Done |
| 3 | AI coach answers questions with context | Phase 2 | Done |
| 4 | Homescreen widget with proactive insights | Phase 3 | Done (bolt icon, not cartoon avatar) |
| 5 | Full coach conversation screen | Phase 4 | Done |
| 6 | Polish, resilience, customization | Phase 5 | Partial — offline/rate-limit/empty-state/push done; avatar customization and analytics not built |
