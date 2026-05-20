# Se7en

A gym workout tracker built around a **rotating 7-day cycle** — not tied to Mon–Sun, just Day 1–7 looping indefinitely. Tracks weight, sets, reps, and per-set notes, with offline-first local storage and optional Firebase sync.

Built with Expo · React Native · TypeScript · Zustand · Firebase.

---

## Try It

<a href="https://expo.dev/accounts/bonsky/projects/se7en">
  <img src="docs/qr-expo-go.png" alt="Scan with Expo Go to open Se7en" width="220" align="right" />
</a>

**Open in Expo Go** → [expo.dev/accounts/bonsky/projects/se7en](https://expo.dev/accounts/bonsky/projects/se7en)

Or scan the QR with the **Expo Go** app — free, no App Store install of Se7en required:
- [Expo Go for iOS](https://apps.apple.com/app/expo-go/id982107779)
- [Expo Go for Android](https://play.google.com/store/apps/details?id=host.exp.exponent)

> The project page always serves the **latest** published bundle. To pin a specific snapshot, link to the update directly (e.g. `/updates/<update-id>`).

<br clear="right" />

---

## Screenshots

> _Add screenshots / a short GIF here once captured: Home · Cycle · Active Session · Post-Workout Summary · Progress._

---

## Why I Built This

Most gym apps assume a calendar week (Push/Pull/Legs on Mon/Wed/Fri) and break the moment your schedule shifts — travel, illness, or a missed Tuesday cascades into a week of "rest days" that aren't really rest days. Se7en treats the cycle as a **rotating queue** instead of a calendar grid: Day 1–7 advances when you complete (or explicitly skip) a workout, independent of which weekday it falls on. The cycle math, PR tracking, and post-workout analytics were built around the mental model I actually use when training, rather than retrofitting the model to whatever a calendar widget can render.

---

## Engineering Highlights

- **State architecture** — Zustand stores split by domain (`settingsStore`, `planStore`, `sessionStore`, `prStore`, `authStore`) with AsyncStorage persistence and optional Firebase sync layered on top.
- **Crash-safe session logging** — in-progress workouts are persisted to local storage (and Firestore via `fsActiveSession` when signed in) after every completed set. Relaunching restores the exact state, including timer position.
- **Offline-first** — every write goes to AsyncStorage immediately; the app is fully usable without Firebase. Firebase auth and sync are additive, not required.
- **Date-resilient history** — the last-14-days completion bar reads from session *dates*, not slot positions, so reordering days in the cycle never retroactively un-completes past workouts. ([CycleScreen.tsx](src/screens/Cycle/CycleScreen.tsx))
- **Hand-rolled SVG charts** — sparklines, multi-set volume line graphs, and an expandable per-exercise chart written directly against `react-native-svg`, no chart-library dependency.
- **Shareable summary** — the post-workout summary page captures itself as a PNG via `react-native-view-shot` and saves to the camera roll, with optional user-picked background image.
- **Liquid-glass UI** — custom `GlassView` layers `expo-blur` (`systemUltraThinMaterialDark`) + a specular sheen gradient + 1px edge highlights to approximate Apple's liquid-glass aesthetic within React Native's constraints.

---

## Features

### Cycle & Plans
- 7-day rotating cycle, drag-to-reorder days
- Rest day support with auto-completion (rest days don't require an explicit log to advance)
- Multiple plans with isolated session history
- Inline plan editor (rename, change split type)
- JSON plan import during onboarding, with field-level schema validation

### Workout Logging
- 7 set types: Standard · Rep Range · To Failure · Superset · Drop Set · Pyramid · Progressive
- Per-exercise config: bar type, weight unit (kg / lb / bodyweight), target reps/weight, rest-timer seconds
- Set-by-set actual reps, actual weight, and free-text notes
- Live session timer with hour-format rollover past 60 min (e.g. `1:20hr`)
- Between-set rest-timer screen with carry-over context

### Progress & Analytics
- Per-exercise charts: weight, volume, reps (2-week + all-time toggle)
- Expandable detail chart with peak set highlighting
- All-time personal records, date-window independent
- Set-note timeline per exercise, chronological
- Contribution heatmap (per cycle and per month)
- Missed workout log with skip reasons

### Post-Workout Summary
Three-page horizontal swipe after every session:
- **Summary** — volume hero with line graph + highest-volume and heaviest-weight set callouts
- **Exercises** — per-exercise set-by-set breakdown
- **Next Up** — preview of the next day in the cycle, with notes carried over from today

Capture the Summary page as a PNG to your camera roll, with an optional background image.

### Data
- Local AsyncStorage persistence for all stores (works fully offline)
- Optional Firebase Firestore sync when signed in (settings, plans, sessions, active session, PRs)
- Sign-in / sign-up via Firebase Auth

### Customization
- In-app Exercise Builder for adding custom exercises
- Drag-to-reorder days and exercises
- Muscle-group tagging with color-coded chips

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54 · React Native 0.81 |
| Language | TypeScript |
| State | Zustand |
| Local storage | AsyncStorage |
| Cloud | Firebase (Auth + Firestore) |
| Charts | react-native-svg (custom) |
| Glass / blur | expo-blur · expo-linear-gradient |
| Navigation | Custom rounded floating dock |
| Date utils | date-fns |
| Capture | react-native-view-shot |

---

## Project Structure

```
src/
├── types/            TypeScript interfaces (Plans, Sessions, Sets, PRs, Settings)
├── constants/        Colors, spacing, bar weights, muscle-tag colors
├── config/           Firebase initialization
├── services/         firestoreService (Firestore CRUD per domain)
├── stores/           Zustand stores (settings · plan · session · pr · auth)
├── utils/            Cycle math · volume formulas · PR detection · import validator
├── data/             Built-in exercises, plan templates
├── hooks/            useTheme
├── navigation/       AppNavigator with FloatingDock
├── components/
│   ├── FloatingDock/      Rounded glass tab bar
│   ├── ExerciseCard/      Expandable card with set rows
│   ├── SetLogger/         Per-set input (reps · weight · notes)
│   ├── common/            Button · Card · Badge · Modal · GlassView · StatCard · ProgressRing
│   └── ui/                AppBackground (radial-glow)
└── screens/
    ├── Onboarding/        First-launch setup, JSON plan import
    ├── Auth/              Sign in / sign up
    ├── Home/              Today widget · cycle orbit · contribution heatmap · highlight slideshow
    ├── Cycle/             7-day overview, drag-to-reorder, plan editor, split type picker
    ├── ActiveSession/     Live workout with progress card and rest timer modal
    ├── RestTimer/         Between-set countdown
    ├── PostWorkout/       3-page swipe summary with PNG capture
    ├── Progress/          Per-exercise charts, PRs, notes timeline
    ├── ExerciseBuilder/   Custom exercise creation
    └── Settings/          Plans · units · backup preferences · account · sign out
```

---

## Run Locally

```bash
git clone https://github.com/jabluetooth/se7ven.git
cd se7ven
npm install
npm start
```

Scan the QR code with **Expo Go** (iOS: in-app QR scanner; Android: built-in scanner).

> Phone and computer must be on the same Wi-Fi. If not, run `npx expo start --tunnel`.

### Firebase (optional)

The app runs fully offline without Firebase. To enable cloud sync and accounts, copy `.env.example` to `.env.local` and fill in your Firebase project credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

---

## Roadmap

- **Plate calculator UI** — the greedy algorithm (`utils/plateCalculator.ts`) is implemented; wiring it to a bottom-sheet UI is pending
- **Real auto-backup** — the settings toggle exists; the scheduled Firestore/Storage write needs to be implemented
- **JSON / CSV export** — currently import-only during onboarding
- **AI suggestions** — auto-populate logs based on prior patterns
- **Voice-to-text set logging** (hands-free between sets)
- **Rest-timer audio cues**
- **Apple Watch / WearOS integration**

---

## License

Personal portfolio project — not monetized.
