# Se7en — Gym Workout Tracker App
## Product Requirements Document (PRD)

**Version:** 2.0  
**Last Updated:** April 2026  
**Status:** In Review

---

## Table of Contents

1. Product Overview
2. Core Features
3. User Flows
4. Data Structure
5. Navigation & UI Architecture
6. Screen Specifications
7. Key Feature Details
8. Non-Functional Requirements
9. MVP vs Future Enhancements
10. Success Metrics
11. Timeline & Milestones
12. Assumptions & Constraints
13. Out of Scope (MVP)
14. Key Decisions Log

---

## 1. Product Overview

**Product Name:** Se7en  
**Version:** 1.0 MVP  
**Target Users:** Single user (personal use)  
**Platforms:** iOS & Android  
**Cost:** Completely free (no monetization)

### Vision
Se7en is a personal gym companion app built around a rotating 7-day workout cycle. It tracks performance metrics including weight, sets, reps, plate combinations, and set-by-set notes — giving the user full visibility into progress and clear guidance on what to improve next session.

### Core Philosophy
- Day-based cycle, not calendar-based (Day 1–7 rotates regardless of actual date)
- Flexible enough to support any split (PPL, Arnold, Upper/Lower, etc.)
- Data is always retained — history is never lost unless explicitly deleted by the user
- Manual entry first; AI/Bot assistance planned for Phase 2

---

## 2. Core Features

### 2.1 Workout Plan Management
- **Create Rotating 7-Day Cycle:** Assign exercises to Day 1 through Day 7 — not tied to Mon–Sun calendar
- **Rest Day Support:** Mark any day as a Rest Day; rest days show a recovery screen instead of exercises
- **Split Flexibility:** Supports any split (PPL, Arnold, Upper/Lower, Bro Split, Full Body, Custom) by freely assigning exercises to any day
- **Import Exercises:** Import full workout plans or exercise lists from JSON
- **Add Exercises Manually:** Add custom exercises to any day
- **Reorder Exercises:** Drag to reorder exercises within a day (explicit `order` field)
- **Edit Workout Plan:** Modify exercises, sets, reps, set types, and target weights
- **Delete Exercises:** Remove exercises from specific days
- **Multiple Plans:** Save multiple workout plans; switch between them while retaining all historical data
- **Active Plan:** Only one plan is active at a time; switching plans does not delete history

### 2.2 Exercise Tracking & Logging

#### Set Types (user selects per exercise)
- **Standard:** Fixed target reps, single weight (e.g., 4×8 @ 100kg)
- **Rep Range:** Min/max rep targets, single weight (e.g., 4×8–12 @ 100kg)
- **To Failure:** No fixed rep target; user logs actual reps achieved at failure
- **Superset:** Two or more exercises grouped, performed back-to-back
- **Drop Set:** Same exercise with decreasing weight per drop, each drop logged separately
- **Pyramid:** Each set has its own individual target weight and/or rep count
- **Progressive:** Each set has explicitly different increasing targets

#### Per-Exercise Configuration
- Exercise name
- Target sets (total count)
- Set type (from list above)
- Target reps or rep range (or "TO FAILURE")
- For Pyramid / Progressive / Drop sets: individual per-set target weight and reps
- Target weight (in chosen unit)
- Weight unit per exercise: `kg` | `lb` | `plates` | `bodyweight`
- Bar type per exercise: Barbell (20kg) | EZ Bar (10kg) | Smith Machine (~15kg) | Dumbbell (no bar) | Custom | None
- Exercise notes (general plan-level notes for this exercise)
- Exercise order (controls display sequence on day view)

#### Logging a Set
- Actual reps performed (single number — what the user actually did)
- Actual weight used
- Plates used (auto-calculated by plate calculator, manually adjustable)
- Notes per set (free text — e.g., "Felt strong", "Form broke on rep 9", "Increase weight next session")
- Mark set as complete

#### Weight System
- Global weight unit preference (kg / lb / plates)
- Per-exercise weight unit override at any time
- `bodyweight`: no weight entry needed, reps and notes only
- Custom plate definitions: user adds/removes available plate sizes
- Bar weight defined per exercise via bar type selection

### 2.3 Plate Calculator
- Supports kg, lb, and plates-only exercises
- Bar type selection determines bar weight subtracted before plate calculation
- Calculates closest achievable plate combination to target weight
- Prefers fewest plates (uses larger plates first — greedy algorithm)
- Shows warning if exact weight is not achievable with available plates
- Visual plate diagram: `[20] [15] [5] | BAR | [5] [15] [20]`
- Manual plate override: user toggles individual plates even after auto-calculation
- `plates` and `bodyweight` types: calculator is hidden; volume adapted accordingly

### 2.4 Progress Tracking
- **Cycle-Based:** Tracks by Day position (Day 1–7) not by calendar date
- **Missed Day Logging:** Skipped days marked "Missed" with timestamp and optional skip reason
- **No Retroactive Logging:** Missed days are not backfilled — logged as skipped
- **Completion Status:** Each exercise and each set has its own completion flag
- **Analytics Window:** Default view shows last 2 weeks; all-time toggle available; all data stored forever
- **Volume Calculation — adapts per set type:**
  - Standard / Rep Range: `actualReps × actualWeight`
  - To Failure: `actualRepsToFailure × actualWeight`
  - Superset / Drop / Pyramid / Progressive: sum of each component's `reps × weight`
  - Plates Only / Bodyweight: reps only (weight treated as 1 unit)
- **Performance Metrics per Exercise:**
  - Weight progression (last 2 weeks)
  - Rep improvements (last 2 weeks)
  - Total volume trends (last 2 weeks)
  - All-time Personal Record — not filtered by 2-week window

### 2.5 Post-Workout Summary Screen
Displayed automatically after the user finishes a session. Three sections:

**Today:**
- Total exercises completed vs planned
- Total sets completed
- Total volume lifted (adapted per weight type)
- Session duration
- PRs broken (highlighted with badge)

**Progress:**
- Per-exercise: weight today vs last session (with delta)
- Rep improvements vs last session
- Today's set notes reviewed per exercise

**Next Workout:**
- Next day in cycle (label + exercises + targets)
- Improvement reminders pulled from today's set notes (e.g., "📝 You noted: Increase Bench Press weight next session")
- Rest day notice if next day is a rest day

### 2.6 Analytics & Visualization
- **Weight Progression Chart:** Line chart per exercise (2-week default; all-time toggle)
- **Volume Tracker:** Total volume per exercise (2-week default; all-time toggle)
- **Rep Performance Chart:** Rep improvements over time
- **Cycle Overview:** Visual of Day 1–7 with completion/missed status per cycle iteration
- **Personal Records:** All-time bests per exercise (weight, reps, volume) — never filtered by date
- **Set Notes Timeline:** Chronological all-time log of set notes per exercise
- **Missed Workout Log:** History of all missed days with dates and skip reasons

### 2.7 Data Management
- **Auto-Backup:** Daily backup to Firebase Storage; retains last 7 backups (oldest purged on 8th)
- **Manual Export:** JSON or CSV (both formats supported)
- **Manual Import:** JSON with validation and field-level error reporting
- **Restore:** Select any of last 7 auto-backups or a manually exported file
- **Data Retention:** Historical data NEVER deleted automatically — only if user explicitly confirms deletion
- **Plan Switching:** All history from all plans retained at all times

### 2.8 Future: AI/Bot Integration (Phase 2)
- **Automated Log Population:** Bot fills logs based on past patterns
- **Smart Analytics:** AI-generated performance summaries and insights
- **Next Session Suggestions:** Bot recommends weight/rep targets
- **Voice Logging:** Hands-free set logging via voice-to-text
- **Workout Optimization:** AI suggests plan adjustments based on trends

---

## 3. User Flows

### 3.1 First-Time Setup
1. App opens → dark theme loads by default
2. Onboarding: choose **Import from JSON** or **Start Fresh**
3. Name the plan + choose split type label (PPL / Arnold / U/L / Custom — label only, no structural enforcement)
4. Configure weight system: global unit (kg / lb / plates) + plate preset (Metric / Imperial / Custom)
5. For each of 7 days: mark as Rest Day OR add exercises with full configuration
6. Drag to reorder exercises within each day
7. Confirm → land on Home (Day 1)

### 3.2 Daily Workout Flow
1. Open app → Home shows current Day in cycle + exercise list
2. Tap "Start Workout" → session timer starts
3. For each exercise:
   - View exercise card: set type badge, target reps/weight, plate calculator shortcut
   - Per set: pre-filled target weight → adjust if needed → log actual reps → add notes (optional) → tap "Complete Set"
   - After all sets: exercise marked complete
4. After all exercises: "Finish Workout" button appears
5. Tap "Finish Workout" → Post-Workout Summary appears
6. View Today / Progress / Next tabs → add session note → tap "Done"
7. Data auto-saved and synced; cycle advances to next day

### 3.3 Missed / Skipped Day Flow
1. Home shows current Day as "Not Started"
2. User taps "Skip Today" → modal prompts for optional skip reason (Sick / Travel / Rest / Other)
3. Day logged as "Missed" with timestamp + reason
4. Cycle advances to next day

### 3.4 Cycle Overview Flow
1. Navigate to Cycle tab via floating dock
2. View Day 1–7 as cards with: day number, day label, exercise count or "Rest Day", status badge
3. Status badges: ✅ Completed · ❌ Missed · 💤 Rest · 🔵 Current · ⬜ Upcoming
4. Tap any card → Day Detail View (view-only for past; editable for upcoming days)
5. Top of screen: last 2 weeks completion rate

### 3.5 Analytics Flow
1. Navigate to Progress tab via floating dock
2. Default: summary cards for last 2 weeks (workouts done, volume, days missed, PRs broken)
3. Select exercise from dropdown (search by name)
4. View weight / volume / reps charts → toggle 2-week vs all-time
5. View PR cards (all-time)
6. View set notes timeline for selected exercise
7. View missed workout log

### 3.6 Post-Workout Summary Flow
1. Auto-triggered after "Finish Workout"
2. Three tabs: Today · Progress · Next Workout
3. User can add an overall session note
4. Tap "Done" → returns to Home (now showing next day)

### 3.7 Settings Flow
1. Navigate to Settings tab via floating dock
2. Manage: weight unit, plate system, theme, backup settings, export/import, plan management

### 3.8 Plan Switching Flow
1. Settings → Manage Plans → tap plan → Set as Active
2. Cycle resets to Day 1 of new plan
3. All historical data from previous plan retained
4. Delete plan → confirmation modal warns history can be optionally deleted; default keeps history

---

## 4. Data Structure

### 4.1 Design Principles
- **Template vs Log are strictly separated:** Plans store what you plan to do; sessions store what you actually did
- **Exercise order is explicit:** All exercise lists include an `order` field (no reliance on insertion order)
- **History is immutable:** Logged sessions are never modified retroactively
- **Per-exercise bar type:** No single global bar weight — each exercise has its own bar type and bar weight
- **Actual reps is a single number:** The user did a specific count, not a range
- **Denormalized session data:** Session records copy exercise name, unit, bar type at time of logging so history is independent of plan edits

### 4.2 Firestore Schema

```
users/
  {userId}/

    ── settings (document) ──────────────────────────────────────
      weightUnit:           "kg" | "lb" | "plates"
      plateSystem:          "metric" | "imperial" | "custom"
      availablePlates:      number[]     // e.g. [20, 15, 10, 5, 2.5, 1.25]
      theme:                "dark" | "light"
      autoBackup:           boolean
      backupFrequency:      "daily" | "weekly"
      lastBackupDate:       timestamp
      activePlanId:         string       // FK → workoutPlans/{planId}
      currentDayPosition:   number       // 1–7, current position in active cycle
      createdAt:            timestamp

    ── workoutPlans/{planId} (collection) ───────────────────────
      name:          string              // e.g. "Push Pull Legs"
      splitType:     string              // "PPL" | "Arnold" | "UL" | "Custom" etc.
      description:   string
      createdAt:     timestamp
      isActive:      boolean

      ── workoutDays/{dayId} (subcollection) ──────────────────
        dayPosition:   number            // 1–7 (cycle position, NOT Mon-Sun)
        label:         string            // e.g. "Push Day", "Pull Day", "Rest"
        isRestDay:     boolean

        ── exercises/{exerciseId} (subcollection) ─────────────
          name:           string
          order:          number         // explicit display order within the day
          setType:        "standard" | "repRange" | "toFailure" | "superset"
                          | "dropSet" | "pyramid" | "progressive"
          supersetGroup:  string | null  // groups exercises into a superset
          targetSets:     number
          targetRepsMin:  number | null  // null if toFailure
          targetRepsMax:  number | null  // null if not repRange; same as min if standard
          toFailure:      boolean
          targetWeight:   number | null  // null if bodyweight
          weightUnit:     "kg" | "lb" | "plates" | "bodyweight"
          barType:        "barbell" | "ezbar" | "smith" | "dumbbell" | "custom" | "none"
          barWeight:      number         // 20 / 10 / 15 / 0 / custom value / 0
          perSetTargets:  array | null   // pyramid / progressive / dropset only
            [{
              setNumber:    number,
              targetReps:   number,
              targetWeight: number
            }]
          notes:          string         // plan-level exercise notes
          createdAt:      timestamp

    ── workoutSessions/{sessionId} (collection) ─────────────────
      planId:         string             // plan active at time of session
      dayPosition:    number             // 1–7
      dayLabel:       string             // denormalized
      status:         "completed" | "missed" | "partial"
      startedAt:      timestamp | null
      finishedAt:     timestamp | null
      duration:       number             // minutes
      skipReason:     string | null      // "Sick" | "Travel" | "Rest" | "Other" | null
      sessionNote:    string | null      // overall note from summary screen
      totalVolume:    number             // calculated at session end
      prsBreached:    string[]           // list of exercise names where PRs were set

      ── sessionExercises/{sessionExerciseId} (subcollection) ──
        exerciseId:     string           // FK → plan exercise (for linking)
        exerciseName:   string           // denormalized for history independence
        order:          number           // denormalized
        setType:        string           // denormalized
        weightUnit:     string           // denormalized
        barType:        string           // denormalized
        barWeight:      number           // denormalized
        isCompleted:    boolean

        ── sets/{setId} (subcollection) ─────────────────────
          setNumber:            number
          targetReps:           number | null
          targetWeight:         number | null
          actualReps:           number        // single number (what user actually did)
          actualRepsToFailure:  number | null // populated if toFailure: true
          actualWeight:         number | null // null if bodyweight
          platesUsed:           number[]      // e.g. [20, 15, 5] per side
          notes:                string        // per-set improvement notes
          isCompleted:          boolean
          completedAt:          timestamp

    ── personalRecords/{exerciseId} (collection) ─────────────────
      exerciseName:        string         // denormalized
      heaviestWeight:      number
      heaviestWeightDate:  timestamp
      mostReps:            number
      mostRepsDate:        timestamp
      highestVolume:       number         // single-set volume (reps × weight)
      highestVolumeDate:   timestamp
      updatedAt:           timestamp
      // PRs are updated at session end; never filtered by any date window

    ── backups/{backupId} (collection) ──────────────────────────
      createdAt:   timestamp
      type:        "auto" | "manual"
      storageUrl:  string               // Firebase Storage path
      sizeBytes:   number
      // Last 7 auto-backups retained; oldest purged when 8th is created
```

### 4.3 Local Storage (Device — AsyncStorage / MMKV)
Cached locally for offline access:
- `settings` document
- Active plan's full day/exercise template
- Current session in progress (crash recovery — saved after every completed set)
- Last 2 weeks of `workoutSessions` (for fast analytics rendering without Firestore read)
- `personalRecords` collection (all-time, for instant PR display)

Sync strategy: local cache is source of truth during offline; syncs to Firestore on reconnect. In-progress session is highest-priority sync item.

---

## 5. Navigation & UI Architecture

### 5.1 Floating Dock Navigation
Navigation uses a **floating dock** — a pill-shaped floating bar at the bottom of the screen, inspired by the provided reference design. The active tab expands to show its text label alongside the icon; inactive tabs show icon only.

**Dock Tabs:**
| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| 1 | 🏠 | Home | Current day workout |
| 2 | 📅 | Cycle | 7-day cycle overview |
| 3 | 📊 | Progress | Analytics, PRs, notes |
| 4 | ⚙️ | Settings | Config, backup, plans |

**Dock Behavior:**
- Floats above content with semi-transparent background + blur
- Active tab: icon + label, highlighted in accent green (matching reference design)
- Inactive tabs: icon only, muted color
- Auto-hides when keyboard is open
- Present on all main screens

### 5.2 Screen Hierarchy

```
App
├── Onboarding (first launch only)
│   ├── Weight System Setup
│   └── Plan Creation / Import
│
└── [Floating Dock]
    ├── Home
    │   ├── Today's Exercise List (ordered)
    │   │   ├── Exercise Card
    │   │   │   └── Set Logger (inline per set)
    │   │   └── Plate Calculator (bottom sheet)
    │   ├── Rest Day Screen
    │   ├── Skip Day Modal
    │   └── Post-Workout Summary (full-screen modal)
    │       ├── Today Tab
    │       ├── Progress Tab
    │       └── Next Workout Tab
    │
    ├── Cycle
    │   ├── 7-Day Cycle Card View
    │   └── Day Detail View (tap any day)
    │
    ├── Progress
    │   ├── Overview Summary Cards
    │   ├── Exercise Selector
    │   ├── Charts (Weight / Volume / Reps)
    │   ├── PR Cards
    │   ├── Set Notes Timeline
    │   └── Missed Workout Log
    │
    └── Settings
        ├── Weight & Plates Config
        ├── Theme Toggle
        ├── Backup & Restore
        ├── Import / Export
        └── Manage Plans
```

---

## 6. Screen Specifications

### 6.1 Home Screen
**Header:** "Day [X] — [Day Label]" · Cycle iteration indicator (e.g., "Cycle 4")  
**Content:**
- Exercise list in explicit order
- Each Exercise Card: name, set type badge, target summary, inline set logger rows, completion progress (e.g., "3/4 sets")
- Plate calculator shortcut on each card (opens bottom sheet)
- Superset exercises visually grouped
- Sticky bottom button: "Start Workout" → "Finish Workout"
- Secondary "Skip Today" button (before workout starts)
- **Rest Day view:** Recovery tips card + next workout preview

**Set Logger (inline):**
- Pre-filled with target weight from plan
- Fields: Weight | Reps | Notes (optional, expandable)
- "Complete Set" → row collapses with check
- Swipe-to-edit on completed rows

### 6.2 Plate Calculator (Bottom Sheet)
- Input: target weight
- Bar type selector (pre-filled from exercise config, changeable)
- Visual plate diagram per side
- Weight breakdown: bar + plates per side = total
- Closest achievable weight + warning if not exact
- Individual plate toggles for manual override
- "Apply" to confirm

### 6.3 Post-Workout Summary Screen (Full-Screen Modal)
**Today Tab:** Duration · Total sets · Total volume · Completion rate · PR badges  
**Progress Tab:** Per-exercise comparison table (Last Weight → Today's Weight → Delta, Last Reps → Today's Reps) · Today's set notes  
**Next Workout Tab:** Next day label + exercise list + targets · Improvement reminders from today's notes · Rest day notice if applicable  
**Footer:** Session note text field + "Done" button

### 6.4 Cycle Screen
- Day 1–7 cards with: day number, label, exercise count / "Rest Day", status badge
- Status badges: ✅ Completed · ❌ Missed · 💤 Rest · 🔵 Current · ⬜ Upcoming
- Top: last 2 weeks completion rate
- Tap card → Day Detail (view-only past; editable upcoming)

### 6.5 Progress Screen
- Summary cards: workouts done, total volume, days missed, PRs broken (last 2 weeks)
- Exercise selector (searchable dropdown)
- Chart section: Weight / Volume / Reps charts (2-week default; all-time toggle)
- PR section: Heaviest Weight · Most Reps · Highest Volume (all-time, always visible)
- Notes timeline: all past set notes for selected exercise, chronological
- Missed log: date + skip reason for each missed day

### 6.6 Settings Screen
- Weight unit selector · Plate manager (add/remove/edit plates)
- Theme toggle
- Backup: toggle, frequency, last backup date, backup history list (last 7)
- Restore: select from backup list
- Export: format selector (JSON / CSV) + share sheet
- Import: file picker + validation preview before confirming
- Manage Plans: list all plans (active badge), switch active, edit, delete (with history confirmation)

---

## 7. Key Feature Details

### 7.1 Day Cycle Logic
- `currentDayPosition` (1–7) stored in `settings`
- Advances automatically after: workout completed · day skipped · rest day acknowledged
- Wraps: Day 7 → Day 1 (infinite rotation)
- No calendar alignment — Day 1 can fall on any day of the week

### 7.2 Set Types — Behavior Reference

| Set Type | Target Definition | Log Fields |
|----------|-------------------|------------|
| Standard | Single rep target + single weight | actualReps + actualWeight |
| Rep Range | Min/max rep target + single weight | actualReps + actualWeight |
| To Failure | No rep target | actualRepsToFailure + actualWeight |
| Superset | Two+ exercises linked, per-exercise sets | Each exercise: actualReps + actualWeight |
| Drop Set | Same exercise, decreasing weight per drop | Each drop: actualReps + actualWeight |
| Pyramid | Per-set individual weight + reps | Each set: actualReps + actualWeight |
| Progressive | Per-set increasing targets | Each set: actualReps + actualWeight |

### 7.3 Plate Calculator Algorithm
```
Input:  targetWeight, barWeight, availablePlates (sorted descending)
Output: platesList[] per side, totalAchieved, warning (boolean)

perSideTarget = (targetWeight - barWeight) / 2
remaining = perSideTarget
platesList = []

for each plate in availablePlates (largest first):
  while remaining >= plate:
    platesList.push(plate)
    remaining -= plate

totalAchieved = barWeight + (sum(platesList) × 2)
warning = (totalAchieved !== targetWeight)
```
- `plates` mode: calculator hidden; user enters plate count directly  
- `bodyweight` mode: calculator hidden entirely

### 7.4 Volume Calculation Reference

| Set Type | Formula |
|----------|---------|
| Standard / Rep Range | actualReps × actualWeight |
| To Failure | actualRepsToFailure × actualWeight |
| Superset | Σ (reps × weight) per component exercise |
| Drop Set | Σ (reps × weight) per drop |
| Pyramid / Progressive | Σ (reps × weight) per set |
| Plates Only | reps only (weight = 1) |
| Bodyweight | reps only (weight = 1) |

Session total = Σ all set volumes across all exercises.

### 7.5 Import — JSON Schema & Validation
**Validation rules:**
- Missing required fields → use defaults where possible; flag as warning
- Invalid types → field-level error shown in preview before import
- Duplicate exercise names in same day → flagged as warning, user confirms
- `toFailure: true` + rep targets present → rep targets ignored with warning

**JSON Schema:**
```json
{
  "planName": "Push Pull Legs",
  "splitType": "PPL",
  "days": [
    {
      "dayPosition": 1,
      "label": "Push Day",
      "isRestDay": false,
      "exercises": [
        {
          "name": "Bench Press",
          "order": 1,
          "setType": "repRange",
          "targetSets": 4,
          "targetRepsMin": 8,
          "targetRepsMax": 12,
          "toFailure": false,
          "targetWeight": 100,
          "weightUnit": "kg",
          "barType": "barbell",
          "barWeight": 20,
          "notes": "Control the eccentric"
        },
        {
          "name": "Leg Press",
          "order": 2,
          "setType": "toFailure",
          "targetSets": 3,
          "targetRepsMin": null,
          "targetRepsMax": null,
          "toFailure": true,
          "targetWeight": 200,
          "weightUnit": "kg",
          "barType": "none",
          "barWeight": 0,
          "notes": "Last set to absolute failure"
        }
      ]
    },
    {
      "dayPosition": 2,
      "label": "Rest Day",
      "isRestDay": true,
      "exercises": []
    }
  ]
}
```

### 7.6 PR Detection (at Session End)
1. For each exercise in completed session: compute max weight used, max reps, max single-set volume
2. Compare against stored `personalRecords/{exerciseId}`
3. If any metric exceeds stored PR → update PR document + add exercise name to session `prsBreached[]`
4. Post-workout summary highlights PRs with badge
5. Progress screen PR cards always reflect latest all-time records

### 7.7 Auto-Backup Logic
1. Triggered at first app open after midnight (daily) or weekly per setting
2. Full Firestore data serialized → JSON file
3. Uploaded to Firebase Storage: `backups/{userId}/{timestamp}.json`
4. If 7 backups already exist → oldest deleted before new upload
5. Manual exports do not count toward the 7-backup limit
6. Restore: user selects backup → app wipes local data → rehydrates from file → syncs to Firestore

---

## 8. Non-Functional Requirements

| Requirement | Target | Notes |
|------------|--------|-------|
| Performance | <2s initial load | Local cache first; Firestore for sync |
| App Size | <100MB | Lean bundle |
| Offline | Full workout logging works offline | Sync on reconnect |
| Crash Recovery | In-progress session survives crash | Saved locally after every completed set |
| Reliability | 99.9% uptime | Firebase infrastructure |
| Security | Encrypted at rest + in transit | Firebase default encryption |
| Responsiveness | 60fps UI | Avoid heavy JS on main thread |
| Sync Conflict | Local wins for in-progress session | All other data: last-write-wins |

---

## 9. MVP vs Future Enhancements

### Phase 1 — MVP
- ✅ Rotating 7-Day Cycle (not calendar-based)
- ✅ Rest day support per day position
- ✅ All set types: Standard, Rep Range, To Failure, Superset, Drop Set, Pyramid, Progressive
- ✅ Per-exercise bar type and bar weight
- ✅ Customizable weight units (kg / lb / plates / bodyweight) — global + per-exercise
- ✅ Custom plate system
- ✅ Plate calculator (closest-achievable algorithm)
- ✅ Set-by-set logging with per-set notes (single actualReps value)
- ✅ Missed day logging with optional skip reason
- ✅ Post-workout summary (Today / Progress / Next Workout tabs)
- ✅ Improvement reminders on Next Workout tab from today's set notes
- ✅ Analytics: 2-week default + all-time toggle
- ✅ All-time Personal Records (separate from 2-week window)
- ✅ Set notes timeline per exercise
- ✅ Floating dock navigation (4 tabs, accent green active state)
- ✅ Dark theme default + light theme option
- ✅ Auto-backup daily/weekly (last 7 retained)
- ✅ Manual export (JSON + CSV)
- ✅ Import from JSON with validation and error preview
- ✅ Multiple saved plans with full history retention on switch
- ✅ Exercise reordering within a day
- ✅ Crash recovery (session persisted locally per set)

### Phase 2 — Future
- 🔄 AI/Bot for automatic log population and analytics
- 🔄 Voice-to-text logging (hands-free)
- 🔄 Performance predictions and weight/rep suggestions
- 🔄 Rest timer between sets with audio cues
- 🔄 Muscle group tagging + muscle map visualization
- 🔄 Body measurements tracking
- 🔄 Camera integration (gym photo log per session)
- 🔄 Exercise library with tutorial videos
- 🔄 Wearable integration (Apple Watch / WearOS)
- 🔄 Community workout plan import (templates marketplace)

---

## 10. Success Metrics

| Metric | Pass Condition |
|--------|---------------|
| Launch | App opens without crash on iOS and Android |
| Cycle Logic | Day advances correctly after completion, skip, and rest day |
| Set Logging | All 7 set types log correctly and persist to Firestore |
| Plate Calculator | Returns correct closest-achievable combo for all bar types |
| Volume | Correct calculation for all set types (including to-failure and bodyweight) |
| PR Detection | PRs detected and stored correctly at session end |
| Post-Workout Summary | Accurate data across Today / Progress / Next tabs |
| Offline | Full workout logged and saved with zero internet connectivity |
| Crash Recovery | In-progress session restored correctly after force-close |
| Auto-Backup | Backup created on schedule; 7-backup cap enforced |
| Import | Valid JSON imports cleanly; invalid JSON shows field-level errors |
| History Retention | All data retained after plan switch; only deleted on explicit user confirm |
| Navigation | Floating dock renders and navigates correctly on iOS and Android |

---

## 11. Timeline & Milestones

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Setup & Architecture | Weeks 1–2 | Firebase project, Firestore rules, Expo + React Native setup, floating dock shell |
| Plan Management | Week 3 | Plan CRUD, day/exercise setup, exercise reordering, JSON import with validation |
| Workout Logging | Weeks 4–5 | All set types, plate calculator (all bar types), per-set notes, cycle advance logic, crash recovery |
| Post-Workout & PRs | Week 6 | Summary screen (3 tabs), improvement reminders, PR detection |
| Analytics | Week 7 | Charts (weight/volume/reps), PR cards, notes timeline, missed log, 2-week/all-time toggle |
| Data & Backup | Week 8 | Auto-backup, restore, export (JSON + CSV), offline sync, local cache layer |
| Polish & Testing | Week 9 | Bug fixes, edge cases, device testing (iOS + Android), performance pass |
| Launch | Week 10 | TestFlight (iOS) + Internal Testing Track (Android); App Store submission |

---

## 12. Assumptions & Constraints

### Assumptions
- Single user (no multi-user features needed)
- 7-day cycle is rotating — not aligned to Mon–Sun calendar
- Rest days are defined per plan by the user
- All set types are manually configured per exercise
- Historical data is never auto-deleted under any circumstances
- Dark theme is the default preference
- Weight units and bar type vary per exercise and are user-defined
- Manual logging for Phase 1; AI/Bot for Phase 2
- Auto-backup preferred; manual export as supplementary option

### Constraints
- Firebase free tier: sufficient for single user (50k reads/day, 20k writes/day on Firestore)
- No backend server to manage
- App bundle < 100MB
- Local device storage < 100MB
- Analytics default to 2-week window (older data stored, accessible via all-time toggle)
- Phase 1: manual entry only — no AI, no voice

---

## 13. Out of Scope (MVP)

- ❌ Calendar-based day mapping (Mon–Sun)
- ❌ Social or sharing features
- ❌ Multi-user support
- ❌ Nutrition / macro tracking
- ❌ Gym membership or class booking
- ❌ Wearable / smartwatch integration
- ❌ Embedded video tutorials
- ❌ Monetization of any kind
- ❌ AI/Bot logging (Phase 2)
- ❌ Voice logging (Phase 2)
- ❌ Rest timer with audio cues (Phase 2)
- ❌ Muscle group map visualization (Phase 2)

---

## 14. Key Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Calendar vs cycle? | Rotating Day 1–7 cycle — no calendar alignment |
| 2 | Rest days? | Yes — any day can be marked Rest Day, defined per plan |
| 3 | Weight units? | Customizable: global default + per-exercise override (kg / lb / plates / bodyweight) |
| 4 | Rep tracking? | Min/max range + TO FAILURE option per exercise |
| 5 | Set notes? | Yes — free text per set; used for improvement tracking and Next Workout reminders |
| 6 | Plate calculation? | Closest achievable with warning if exact not possible |
| 7 | Progress window? | 2-week default; all-time toggle; data stored forever |
| 8 | Backup? | Auto-backup daily/weekly; last 7 retained; manual export (JSON + CSV) also available |
| 9 | Theme? | Dark default; light theme toggleable |
| 10 | Logging method? | Manual entry (Phase 1); AI/Bot + voice (Phase 2) |
| 11 | Set types? | All major types: Standard, Rep Range, To Failure, Superset, Drop Set, Pyramid, Progressive |
| 12 | Bar type? | Per-exercise: Barbell / EZ Bar / Smith / Dumbbell / Custom / None |
| 13 | Missed workouts? | Mark as Missed + optional skip reason; no retroactive backfill |
| 14 | Plan switching? | All history always retained; only deleted on explicit user confirmation |
| 15 | Post-workout summary? | Three tabs: Today · Progress vs last session · Next Workout + reminders |
| 16 | Navigation? | Floating dock — 4-tab pill bar; active tab expands with label; accent green highlight |
| 17 | Export format? | Both JSON and CSV |
| 18 | Volume for edge cases? | Adapted formula per set type; plates-only and bodyweight track reps only (weight = 1) |
| 19 | Actual reps field? | Single number (not min/max) — user logs what they actually did |
| 20 | Exercise order? | Explicit `order` field on every exercise — not reliant on Firestore insertion order |

---

**Version:** 2.0  
**Last Updated:** April 2026  
**Status:** In Review — Pending Final Approval
