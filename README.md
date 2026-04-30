# Se7en — Gym Workout Tracker

A personal gym companion app built around a **rotating 7-day workout cycle**. Tracks weight, sets, reps, plate combinations, and per-set notes — giving full visibility into progress and clear guidance on what to improve next session.

Built with **Expo + React Native + TypeScript**.

---

## Features

### Core
- **7-Day Rotating Cycle** — not tied to Mon–Sun calendar; Day 1–7 rotates indefinitely
- **Rest Day Support** — mark any day as a rest day with a recovery screen
- **Multiple Plans** — save and switch between plans while retaining all history
- **Import from JSON** — import full workout plans with field-level validation

### Exercise Tracking
- **7 Set Types:** Standard · Rep Range · To Failure · Superset · Drop Set · Pyramid · Progressive
- **Per-exercise config:** bar type, weight unit (kg / lb / plates / bodyweight), target reps/weight
- **Set-by-set logging** with actual reps, actual weight, and free-text notes per set

### Plate Calculator
- Visual plate diagram: `[20][15][5] | BAR | [5][15][20]`
- Greedy algorithm finds closest achievable weight with available plates
- Manual plate toggle overrides after auto-calculation
- Warns when exact target weight isn't achievable

### Progress & Analytics
- **Weight / Volume / Reps charts** per exercise (2-week default · all-time toggle)
- **All-time Personal Records** — never filtered by date window
- **Set notes timeline** — chronological improvement notes per exercise
- **Missed workout log** with skip reasons
- PR detection at session end with post-workout badge

### Post-Workout Summary
Three-tab screen after every session:
- **Today** — duration, sets, volume, PR badges
- **Progress** — weight and reps deltas vs last session
- **Next Workout** — upcoming day preview + improvement reminders from today's notes

### Data & Backup
- Full offline support — logs locally, syncs to Firebase on reconnect
- Crash recovery — in-progress session saved after every completed set
- Auto-backup daily/weekly to Firebase Storage (last 7 retained)
- Export as **JSON** or **CSV**
- Import JSON with validation and error preview

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54 · React Native 0.81 |
| Language | TypeScript |
| State | Zustand |
| Local Storage | AsyncStorage |
| Cloud | Firebase (Firestore + Storage) |
| Charts | react-native-svg |
| Navigation | Custom floating dock (pill bar) |
| Date utils | date-fns |

---

## Project Structure

```
src/
├── types/            TypeScript interfaces (Plans, Sessions, Sets, PRs, Settings)
├── constants/        Colors, spacing, bar weights, default plates
├── config/           Firebase initialization
├── stores/           Zustand stores
│   ├── settingsStore.ts
│   ├── planStore.ts
│   ├── sessionStore.ts
│   └── prStore.ts
├── utils/
│   ├── plateCalculator.ts   Greedy plate calculation algorithm
│   ├── volume.ts            Volume formulas per set type
│   ├── prDetection.ts       PR comparison at session end
│   ├── importValidator.ts   JSON import schema validation
│   └── idGen.ts
├── hooks/
│   └── useTheme.ts          Dark/light theme colors
├── navigation/
│   └── AppNavigator.tsx     Tab-state navigator with FloatingDock
├── components/
│   ├── FloatingDock/        Pill-shaped floating tab bar
│   ├── ExerciseCard/        Expandable exercise card with set rows
│   ├── SetLogger/           Per-set weight/reps/notes input
│   ├── PlateCalculator/     Visual plate diagram bottom sheet
│   └── common/              Button, Card, Badge, Modal
└── screens/
    ├── Onboarding/          First-launch setup (import or start fresh)
    ├── Home/                Current day workout + session timer
    ├── Cycle/               7-day cycle overview with status badges
    ├── Progress/            Analytics, charts, PRs, notes timeline
    ├── PostWorkout/         3-tab summary after finishing a session
    └── Settings/            Plans, plates, theme, backup, export/import
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/jabluetooth/se7ven.git
cd se7ven
npm install
```

### 2. Firebase setup (optional for MVP — app works fully offline)

Copy `.env.example` to `.env.local` and fill in your Firebase project credentials:

```bash
cp .env.example .env.local
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Run

```bash
npm start
```

Scan the QR code with the **Expo Go** app (not your phone's native camera):
- iOS: Open Expo Go → tap "Scan QR code"
- Android: Open Expo Go → tap the QR icon

> Phone and computer must be on the **same WiFi**. If not, run `npm start -- --tunnel`.

---

## Supported Platforms

- iOS
- Android

---

## Roadmap (Phase 2)

- [ ] AI/Bot — automatic log population based on past patterns
- [ ] Voice-to-text set logging (hands-free)
- [ ] Rest timer with audio cues
- [ ] Performance predictions and weight/rep suggestions
- [ ] Muscle group tagging + muscle map visualization
- [ ] Apple Watch / WearOS integration
- [ ] Community workout plan templates

---

## License

Personal use. Not monetized.
