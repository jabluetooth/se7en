# AI Personal Coach — Implementation Phases

## Overview

An AI-powered personal coach integrated into Se7en that tracks RPE + workout notes,
analyzes patterns via RAG, and surfaces insights through an animated cartoon avatar
widget on the homescreen.

**Stack:**
- **Storage:** Firestore (structured data) + Neon pgvector (note embeddings)
- **Embeddings:** HuggingFace Inference API — `BAAI/bge-small-en-v1.5` (384-dim, free tier)
- **Inference:** Groq (free tier — Llama 3.3 70B)
- **Animation:** Lottie (cartoon avatar states)

---

## Phase 1 — RPE + Notes Data Layer

**Goal:** Capture RPE and notes per exercise during an active workout session.

### Data Model

Add to each exercise log entry in Firestore:

```
workoutLog/{userId}/sessions/{sessionId}/exercises/{exerciseId}
  ├── rpe: number (1–10)
  └── note: string (optional, free-form)
```

### Tasks
- [ ] Update Firestore schema to include `rpe` and `note` per exercise entry
- [ ] Add RPE input component (1–10 scale slider or tap-to-select dial)
- [ ] Add note text input (short, single-line, expandable)
- [ ] Integrate both inputs into the active workout session screen post-set or post-exercise
- [ ] Store RPE + note on workout save
- [ ] Display logged RPE on completed exercise cards in history

### UX Notes
- RPE input appears after the last set of each exercise
- Note is optional — skip button visible
- Keep input fast: tap a number, type optional note, done

---

## Phase 2 — Embedding Pipeline

**Goal:** Automatically embed workout notes and store vectors in Neon for future RAG queries.

### Neon Schema

```sql
CREATE TABLE note_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  muscle_group TEXT,
  rpe         INTEGER,
  note_text   TEXT NOT NULL,
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON note_embeddings
  USING ivfflat (embedding vector_cosine_ops);
```

### Tasks
- [ ] Set up Neon project and pgvector extension
- [ ] Create `note_embeddings` table with schema above
- [ ] Integrate HuggingFace Inference API (`BAAI/bge-small-en-v1.5`, 384-dim)
- [ ] Write embedding function: `embedNote(note, metadata) → vector`
- [ ] Trigger embed + insert to Neon on workout save (only if note is non-empty)
- [ ] Write RAG query function: `searchRelevantNotes(userId, queryText, topK=5)`

### Token Budget Awareness
- Each note embed call: ~20–50 tokens (near zero cost)
- Each RAG retrieval: returns top 5 notes → ~200–300 tokens of context

---

## Phase 3 — AI Coach Core

**Goal:** Build the inference layer that assembles context and queries Groq.

### Context Assembly Strategy

```
[System Prompt ~300 tokens]
  Coach persona + behavior rules

[Structured Context ~500 tokens]  ← Firestore aggregates
  - Consistency rate (last 30 days)
  - Muscle group frequency breakdown
  - Volume trend (this month vs last)
  - RPE trend per muscle group (last 4 weeks)
  - Current plan + next session

[Relevant Notes ~300 tokens]  ← Neon RAG (top 5)
  - Most relevant RPE + note entries to the query

[User Query ~50 tokens]

Total target: ~1,200–1,500 tokens per query
```

### Tasks
- [ ] Set up Groq SDK (`groq-sdk`)
- [ ] Write `buildStructuredContext(userId)` — queries Firestore aggregates
- [ ] Write `buildCoachPrompt(userId, userQuery)` — assembles full context
- [ ] Write `askCoach(userId, query)` — calls Groq with assembled prompt
- [ ] Add rate limit handler + fallback message on Groq 429
- [ ] Cache last AI response in AsyncStorage (avoid re-querying on re-render)

### Groq Model
Use `llama-3.3-70b-versatile` for quality or `llama-3.1-8b-instant` for speed/token savings.

---

## Phase 4 — Homescreen Coach Widget

**Goal:** Animated cartoon avatar card on the homescreen that proactively surfaces
insights, recommendations, and encouragement.

### Widget Behavior
- Generates a new coach message on: app open (once per day) + post-workout
- Message types cycle based on context:
  - **Progress** — "You're 82% consistent this month, best streak yet!"
  - **Warning** — "Your legs RPE has been 9+ three sessions in a row — consider a deload"
  - **Recommendation** — "You haven't hit shoulders this week, today's a good day"
  - **Cheer** — "You crushed that PR on bench — keep that energy!"
  - **Tip** — "Try dropping RPE to 7 on warm-up sets to save energy for your working sets"

### Avatar Animation States (Lottie)
| State | Trigger |
|---|---|
| `idle` | Default, breathing loop |
| `talking` | While message is being revealed |
| `celebrating` | Progress / PR messages |
| `thinking` | Loading / generating |
| `concerned` | Warning messages |

### Tasks
- [ ] Source or create cartoon coach Lottie animation files (5 states above)
- [ ] Build `CoachWidget` component with Lottie avatar + message card
- [ ] Animate message text reveal (typewriter effect via Reanimated)
- [ ] Wire `askCoach()` with a homescreen-specific prompt (no user query, proactive insight)
- [ ] Cache widget message in AsyncStorage with a `generatedAt` timestamp
- [ ] Invalidate cache post-workout or after 24 hours
- [ ] Add widget to homescreen above or below the contribution heatmap
- [ ] Add subtle tap interaction — tap avatar to regenerate or expand

### Widget Layout Concept
```
┌─────────────────────────────────────┐
│  [Avatar Lottie]  "Your bench RPE   │
│   (animated)       has been         │
│                    climbing. Try    │
│                    backing off 10%  │
│                    this session."   │
│                          [Ask More] │
└─────────────────────────────────────┘
```

---

## Phase 5 — Full Coach Conversation

**Goal:** Let users have a back-and-forth conversation with the coach from the widget.

### Tasks
- [ ] Build `CoachScreen` — full-screen chat UI with avatar at top
- [ ] Maintain conversation history in session state (last 6 messages for context)
- [ ] "Ask More" button on widget navigates to `CoachScreen` with context preloaded
- [ ] Add suggested prompts: "How am I doing?", "What should I focus on?", "Am I overtraining?"
- [ ] Show token/query usage indicator (optional, helps user stay within free tier)

---

## Phase 6 — Polish + Resilience

**Goal:** Make the feature feel production-quality and resilient to free tier limits.

### Tasks
- [ ] Offline fallback — show last cached message if no network
- [ ] Groq rate limit backoff — queue and retry after 60s
- [ ] Empty state — first-time user with no data yet ("Log a few workouts and I'll start learning your patterns")
- [ ] Avatar customization — choose from 2–3 cartoon coach styles
- [ ] Optional push notification — daily coach check-in ("Your coach has a tip for today")
- [ ] Analytics — track which message types users engage with most

---

## Milestone Summary

| Phase | Deliverable | Dependency |
|---|---|---|
| 1 | RPE + Notes logged per exercise | None |
| 2 | Notes embedded and searchable in Neon | Phase 1 |
| 3 | AI coach answers questions with context | Phase 2 |
| 4 | Homescreen avatar widget with proactive insights | Phase 3 |
| 5 | Full coach conversation screen | Phase 4 |
| 6 | Polish, resilience, customization | Phase 5 |
