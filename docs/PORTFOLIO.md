# Se7en — Gym Cycle Tracker

**Live Demo:** [expo.dev/accounts/bonsky/projects/se7en](https://expo.dev/accounts/bonsky/projects/se7en/updates/fcb9e4f7-fc4c-409a-b82e-a16d70a96f05) — scan the QR code with [Expo Go](https://expo.dev/go) (iOS / Android)

---

## Short Description

Se7en is a personal mobile app I built to solve a real problem with gym tracking apps — most tie workouts to fixed calendar dates, which breaks the moment you miss a day or travel. Se7en uses a **7-day rotating training cycle** that always knows where you are in your split, regardless of gaps. Athletes define their plan once (PPL, Upper/Lower, custom, etc.), log sessions in real time, and see their history visualised on a contribution heatmap — with missed-day indicators, rest-day auto-completion, and a live "next mission" card that always points at the right workout.

---

## Tech Stack

| Layer | Technology | What I used it for |
|---|---|---|
| Framework | React Native · Expo SDK 54 | Cross-platform iOS + Android from a single codebase |
| Language | TypeScript (strict) | End-to-end type safety across stores, screens, and utilities |
| State | Zustand + AsyncStorage | Lightweight global state with offline-first local persistence |
| Backend | Firebase Firestore + Auth | Real-time sync across devices; authoritative source over local cache |
| UI | expo-blur · LinearGradient · react-native-svg | Custom glassmorphism system, animated charts, shareable PNG cards |
| Gestures | react-native-gesture-handler | Swipe-to-action (edit/clear/done) and drag-to-reorder day cards |
| Architecture | Custom hooks · Zustand slices | `useDockClearance`, `usePresetStore`, `useSessionStore` — each screen owns only what it needs |

---

## Key Features

- **7-Day Cycle Engine** — Slot-based scheduling (not date-bound) means drag-reordering workout days never corrupts logged session history.
- **Contribution Heatmap** — Month calendar with per-workout-type colors, volume fill bars, missed-day red outlines, rest-day auto-completion, and a cycle-name banner anchored to the active week.
- **Mission Card** — Dynamically resolves the next non-rest workout; skips today if already completed and advances to the next real training day automatically.
- **Active Session Screen** — Set-by-set logging with a live elapsed timer, automatic PR detection, and per-set notes.
- **Post-Workout Summary** — Shareable PNG card showing volume, heaviest set, and exercise breakdown with full-bleed background on capture.
- **Plan Presets** — Snapshot any configured plan (days + exercises) and restore it in one tap from the split picker — useful for rotating programs.
- **14-Day Completion Bars** — Three visual states: orange (done), stone gray (rest day), red (missed) with today excluded from the missed calculation.
- **Glassmorphism UI** — iOS `systemUltraThinMaterialDark` + specular sheen gradient + 1 px edge highlights; graceful rgba fallback on Android.

---

## Challenges & Learnings

**1. Mutable schedules, immutable history — an architectural constraint**

The central design problem: users can reorder workout days via drag-and-drop at any time, but past session data must never be invalidated by that action. The solution was a strict separation — *slot index* (visual position, answers "what is today's workout?") vs *calendar date* (answers "what did I log on this day?"). Every query that touches history uses date only. This decision propagated through the entire codebase and made the heatmap, mission card, and completion rate all consistent with each other without any reconciliation logic.

**2. Offline-first sync with an authoritative remote**

The app loads cached data from AsyncStorage instantly on launch, then reconciles with Firestore in the background. This two-phase load (cache-first → remote-authoritative) keeps the UI responsive on slow connections while guaranteeing the user always ends up with the correct state. Real-time Firestore listeners then keep plans and sessions in sync across devices for the rest of the session.

**3. Backwards-compatible schema evolution**

`cycleStartDate` didn't exist in early builds — older accounts only had a `currentDayPosition` integer. Rather than a migration, a synthesis fallback was introduced: if the anchor date is null, derive one from today minus the stored position. The tricky part was scoping the fallback so it didn't cause the heatmap to retroactively flag pre-tracking days as missed workouts. This taught me to be deliberate about what "null" means in a schema and to always design new fields with a safe default path.

**4. Approximating native UI depth in React Native**

The target look was Apple's Liquid Glass — a material that refracts content behind it. The CSS primitive (`feDisplacementMap`) doesn't exist in React Native. The approach: stack `expo-blur` (real frosted glass material on iOS), a `LinearGradient` specular sheen layer (transparent → 5% white → transparent), and 1 px top/bottom edge highlights at different opacities. The result reads as depth without any custom native modules, and degrades gracefully to a semi-transparent rgba surface on Android.

**5. State machines over boolean flags**

Early versions tracked workout day status with a cascade of booleans (`isDone`, `isRest`, `isMissed`). As edge cases multiplied (today-pending vs genuinely missed, rest days inside vs outside the active cycle), the logic became fragile. Replacing the flags with an explicit `BarState = 'done' | 'rest' | 'missed' | 'pending'` union type eliminated an entire class of rendering bugs — the compiler now catches unhandled states at build time rather than at runtime on a user's device.
