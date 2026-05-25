# Se7en — Gym Tracker

A full-featured gym tracking app built with React Native and Expo. Se7en uses a **7-day rotating cycle** model that decouples workouts from calendar dates, so your training program adapts to your life — not the other way around.

---

## Features

### Core Workout Tracking
- **7-Day Cycle Engine** — Training slots rotate independently of calendar dates. Drag-reorder days without breaking history.
- **Active Session** — Real-time set-by-set logging with elapsed timer, automatic PR detection, and per-set notes.
- **RPE Tracking** — Rate of Perceived Exertion (1–10) per exercise, stored and used for AI coach context.
- **Personal Records** — Auto-detects heaviest weight, most reps, and highest volume per exercise.
- **Rest Timer** — Countdown between sets with per-exercise configurable durations.
- **Plan Presets** — Save and restore any configured plan as a named snapshot.
- **Plate Calculator** — Barbell loading math (e.g., "how to load 185 kg").

### Plan Management
- **Exercise Library** — Pre-built exercises with defaults (reps, weight, equipment, bar type).
- **Plan Templates** — PPL, Upper/Lower, and other splits; filter by experience and equipment.
- **Drag-to-Reorder** — Reorder days and exercises within a plan via gesture.
- **Import / Export** — JSON-based plan backup and restore.

### Analytics & Visualization
- **Contribution Heatmap** — Monthly calendar with per-workout-type colors, volume fill, missed-day indicators, and rest-day auto-completion.
- **Progress Charts** — Volume trends, RPE trends per muscle group, sparklines, and expanded exercise charts.
- **14-Day Completion Bars** — Visual workout history with done, rest, missed, and pending states.
- **Highlight Slideshow** — Carousel of notable achievements (PRs, volume records).
- **Mission Card** — Dynamically resolves and surfaces the next non-rest workout.

### Post-Workout Summary
- Volume breakdown, heaviest set, and exercise list after each session.
- **Shareable PNG Card** — Full-bleed workout card exported via `react-native-view-shot`.
- **Next Up** — Proposes the next workout in the cycle.

### AI Coach
Built across six phases (1–3 implemented):

| Phase | Feature |
|---|---|
| 1 | RPE + notes capture per exercise |
| 2 | Note embeddings (HuggingFace BAAI/bge-small-en-v1.5 → Neon pgvector) |
| 3 | Contextual inference (Groq Llama 3.3 70B + structured context + RAG) |
| 4–6 | Widget insights, proactive check-ins, advanced analytics *(in progress)* |

The coach assembles context from consistency scores, RPE trends, muscle group breakdown, volume trends, and the top-5 relevant notes retrieved from the vector store.

### Auth & Settings
- **Firebase Auth** — Email/password signup and login.
- **Onboarding** — Collects goal, experience, equipment, and days/week to recommend templates.
- **Auto-Backup** — Daily or weekly sync to Firestore.
- **Weight Units** — kg / lb toggle.
- **Push Notifications** — Coach check-in reminders and session alerts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 · Expo 54.0.33 |
| Language | TypeScript 5.9.2 (strict) |
| State | Zustand 5.0.3 + AsyncStorage 2.2.0 |
| Auth & Sync | Firebase Firestore + Auth 10.14.1 |
| Vector DB | Neon (PostgreSQL + pgvector) |
| AI Inference | Groq — Llama 3.3 70B |
| Embeddings | HuggingFace — BAAI/bge-small-en-v1.5 (384-dim) |
| Navigation | @react-navigation 7.x (native-stack + bottom-tabs) |
| Animation | react-native-reanimated 4.1.1 · Lottie |
| Gestures | react-native-gesture-handler |
| Charts | Custom SVG components |
| Notifications | expo-notifications |
| Media | expo-image-picker · expo-media-library · react-native-view-shot |
| Date Utilities | date-fns 3.6.0 |

---

## Architecture

### Offline-First State
- **Two-phase load** — AsyncStorage cache for instant UI, then Firestore as the authoritative source in the background.
- **Real-time sync** — Firestore listeners keep plans, sessions, and settings in sync across devices.
- **Schema evolution** — Backwards-compatible field defaults (e.g., `cycleStartDate` derived from position for legacy accounts).

### UI System
- **Glassmorphism** — iOS `systemUltraThinMaterialDark` blur with specular sheen and 1px edge highlights; `rgba` fallback on Android.
- **Dark theme** — Warm obsidian (`#0C0A08`) with amber-orange accent (`#FF8C00`).
- **Floating Dock** — 4-tab navigation overlay (Home, Cycle, Progress, Settings) anchored above content.
- **Safe-area aware** — Dynamic dock clearance and status bar color management.

---

## Project Structure

```
src/
├── components/       # Reusable UI (charts, coach avatar, set logger, common primitives)
├── screens/          # Full-screen views (Home, Cycle, ActiveSession, Progress, Coach, Settings…)
├── stores/           # Zustand stores (auth, plan, session, settings, PRs, presets)
├── services/         # Firestore, AI coach, embeddings, notifications, widgets
├── navigation/       # Root navigator + modal stack
├── hooks/            # Custom hooks (theme, dock clearance…)
├── utils/            # Plate calculator, volume math, PR detection, cycle date math
├── data/             # Plan templates and exercise library
├── types/            # Full TypeScript schema
└── constants/        # Colors, defaults, plate sets
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI (`npm install -g expo`)
- iOS Simulator or Android Emulator (or physical device with Expo Go)

### Installation

```bash
git clone https://github.com/yourusername/se7en.git
cd se7en
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Neon (PostgreSQL + pgvector)
EXPO_PUBLIC_NEON_DATABASE_URL=

# AI
EXPO_PUBLIC_GROQ_API_KEY=
EXPO_PUBLIC_HUGGINGFACE_API_KEY=
```

### Run

```bash
# Start Expo dev server
npm start

# iOS
npm run ios

# Android
npm run android
```

---

## Build & Deploy

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for native builds and OTA updates via `expo-updates`.

```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS (TestFlight)
eas build --platform ios --profile preview

# Build for Android (APK)
eas build --platform android --profile preview

# OTA update
eas update --branch main --message "Fix X"
```

---

## Database Schema (Neon)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE coach_notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON coach_notes USING ivfflat (embedding vector_cosine_ops);
```

See [docs/setup/neon-schema.sql](docs/setup/neon-schema.sql) for the full schema.

---

## Contributing

1. Fork the repo and create a branch from `main`.
2. Make your changes — keep the offline-first contract intact.
3. Run TypeScript (`npx tsc --noEmit`) before opening a PR.
4. Open a pull request with a clear description of what changed and why.

---

## License

MIT
