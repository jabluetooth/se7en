# Se7en

A gym workout tracker built around a **rotating 7-day cycle** — not tied to Mon–Sun, just Day 1–7 looping indefinitely. Tracks weight, sets, reps, plate combinations, and per-set notes, with full offline support and Firebase sync.

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

Most gym apps assume a calendar week (Push/Pull/Legs on Mon/Wed/Fri) and break the moment your schedule shifts — travel, illness, or a missed Tuesday cascades into a week of "rest days" that aren't really rest days. Se7en treats the cycle as a **rotating queue** instead of a calendar grid: Day 1–7 advances when you complete (or explicitly skip) a workout, independent of which weekday it falls on. The plate calculator, PR detection, and post-workout analytics were built around the mental model I actually use when training, rather than retrofitting the model to whatever a calendar widget can render.

---

## Engineering Highlights

- **State architecture** — Zustand stores split by domain (`settingsStore`, `planStore`, `sessionStore`, `prStore`) with AsyncStorage persistence and opportunistic Firebase sync. No prop-drilling, no context spaghetti.
- **Crash-safe session logging** — in-progress workouts persist to local storage after every completed set; relaunch restores the exact state, including timer position.
- **Offline-first sync** — all writes go to AsyncStorage immediately; Firebase reconciliation happens in the background with conflict resolution favoring the local copy.
- **Plate calculator** — greedy algorithm finds the closest achievable weight given a configurable plate inventory (kg / lb / fractional). Handles bar weights, manual overrides, and warns when the target weight is unreachable.
- **Date-resilient history** — the last-14-days completion bar reads from session *dates*, not slot positions, so reordering days doesn't retroactively un-complete past workouts.
- **Liquid-glass UI** — custom `GlassView` layers `expo-blur` (`systemUltraThinMaterialDark`) + a specular sheen gradient + 1px edge highlights to approximate Apple's liquid-glass material within React Native's constraints.

---

## Features

### Cycle & Plans
- 7-day rotating cycle, drag-to-reorder days
- Rest day support with auto-completion
- Multiple plans with isolated history
- JSON import with field-level validation

### Workout Logging
- 7 set types: Standard · Rep Range · To Failure · Superset · Drop Set · Pyramid · Progressive
- Per-exercise config: bar type, weight unit (kg / lb / plates / bodyweight), target reps/weight
- Set-by-set actual reps, weight, and free-text notes
- Live session timer with hour-format rollover past 60 min

### Plate Calculator
- Visual plate diagram (`[20][15] | BAR | [15][20]`)
- Greedy closest-achievable algorithm with configurable inventory
- Manual override after auto-calc; warns on unreachable targets

### Progress & Analytics
- Weight / Volume / Reps charts per exercise (2-week + all-time toggle)
- All-time personal records, date-window independent
- Set-note timeline per exercise, chronological
- Missed workout log with skip reasons
- Automatic PR detection at session end

### Post-Workout
- Three-page swipe summary: **Summary** (volume hero, highest-volume + heaviest-weight callouts) · **Exercises** (per-set breakdown) · **Next Up** (next day preview + notes carried over)
- Export the summary page as PNG to the camera roll
- Custom background image support

### Data & Backup
- Full offline operation; Firebase Firestore sync on reconnect
- Auto-backup daily / weekly to Firebase Storage (last 7 retained)
- Export as JSON or CSV; import JSON with validation preview

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo ~54 · React Native 0.81 |
| Language | TypeScript |
| State | Zustand |
| Local storage | AsyncStorage |
| Cloud | Firebase (Firestore + Storage) |
| Charts | react-native-svg |
| Glass / blur | expo-blur · expo-linear-gradient |
| Navigation | Custom rounded floating dock |
| Date utils | date-fns |

---

## Project Structure

```
src/
├── types/            TypeScript interfaces (Plans, Sessions, Sets, PRs, Settings)
├── constants/        Colors, spacing, bar weights, default plates
├── config/           Firebase initialization
├── stores/           Zustand stores (settings · plan · session · pr · auth)
├── utils/            Plate calc · volume formulas · PR detection · import validator · cycle math
├── hooks/            useTheme
├── navigation/       AppNavigator with FloatingDock
├── components/
│   ├── FloatingDock/      Rounded glass tab bar
│   ├── ExerciseCard/      Expandable card with set rows
│   ├── SetLogger/         Per-set input (reps · weight · notes)
│   ├── common/            Button · Card · Badge · Modal · GlassView · StatCard
│   └── ui/                AppBackground (radial-glow)
└── screens/
    ├── Onboarding/        First-launch setup
    ├── Auth/              Sign in / sign up
    ├── Home/              Today widget + cycle orbit + contribution heatmap
    ├── Cycle/             7-day overview, drag-to-reorder, plan editor
    ├── ActiveSession/     Live workout with progress card
    ├── RestTimer/         Between-set countdown
    ├── PostWorkout/       3-page swipe summary
    ├── Progress/          Charts, PRs, notes timeline
    ├── ExerciseBuilder/   Custom exercise creation
    └── Settings/          Plans, plates, theme, backup, import/export
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

The app runs fully offline without Firebase. To enable cloud backup, copy `.env.example` to `.env.local` and fill in your Firebase project credentials:

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

- AI suggestions — auto-populate logs based on prior patterns
- Voice-to-text set logging (hands-free between sets)
- Rest timer with audio cues
- Performance predictions and weight / rep suggestions
- Muscle-map visualization
- Apple Watch / WearOS integration
- Community plan templates

---

## License

Personal portfolio project — not monetized.
