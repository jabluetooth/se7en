<div align="center">

# Se7en - Gym Tracker

**A full-featured, AI-powered gym tracking app built with React Native + Expo.**
Track workouts, visualize progress, and get coaching insights - all offline-first with real-time cloud sync.

![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logo=groq&logoColor=white)

<br>

<!-- HERO: replace the "Screens" table below with an actual 4-panel screenshot montage,
     or better, a short screen-recording GIF (10-15s) of one full loop: open the app on
     Home -> start a session and log a set (auto PR detection firing) -> open the AI
     Coach and show a contextual insight. That loop demonstrates the offline-first +
     RAG-coach angle in one clip. Save as docs/demo.gif, add here as: -->
<!-- <p align="center"><img src="docs/demo.gif" alt="Se7en demo" width="800"></p> -->

</div>

---

## Try It Live

> **Scan with your phone to open instantly in Expo Go.**
> *(Download [Expo Go](https://expo.dev/go) on iOS or Android - free, no account needed)*

<div align="center">

<img src="docs/qr-expo-go.png" alt="Scan to try Se7en" width="220"/>

**[Open in Expo Go →](https://expo.dev/accounts/bonsky/projects/se7en/updates/94dc4760-8b33-4a58-8a8a-6942c00bc282)**
*(on desktop? open that link on your phone, or scan the QR above)*

</div>

---

## What It Does

Se7en uses a **7-day rotating cycle** model - workouts rotate by slot, not by calendar date, so your training program adapts to your schedule instead of breaking when life gets in the way.

| Feature | Description |
|---|---|
| **Focus-Mode Workouts** | One exercise per screen, steppers prefilled from your last set, one-tap logging with live PR detection |
| **AI Coach** | Contextual insights powered by Groq LLM + your own session history (RAG) |
| **Progress Analytics** | This month vs last month, biggest gain, workouts per week against your plan, a trend line for every lift |
| **Post-Workout Summary** | Volume-by-exercise and per-set charts, new records, shareable as a PNG with a custom background |
| **Plan Builder** | Drag-to-reorder days and exercises, plan templates (PPL, Upper/Lower, etc.) |
| **Rest Timer** | Built into the workout's bottom panel, per-exercise durations, notification when rest is over |
| **Offline-First** | Instant load from local cache, background sync to Firestore |
| **Light & Dark** | Theme toggle in Settings, applied live across every screen |

---

## Screens

| Today | Workout | Post-Workout | Progress | Coach |
|---|---|---|---|---|
| Today's workout, week strip, cycle stats | One exercise at a time, inline rest timer, effort rating | Volume and per-set charts, records | Month vs last month, weekly consistency, lift trends | Chat grounded in your history |

---

## Tech Highlights

This project was built to demonstrate production-quality React Native architecture - not just a tutorial app.

- **100+ TypeScript types** - full schema coverage, no `any`
- **Custom component library** - flat, theme-aware UI with SVG charts built from scratch (no chart library), directly labelled and data-first
- **Live light/dark theming** - palette swap plus per-theme cached styles, no per-component rewrites
- **State machines over booleans** - `BarState = 'done' | 'rest' | 'missed' | 'pending'` prevents logic bugs
- **Two-phase data load** - AsyncStorage for instant UI, Firestore as authoritative source in background
- **AI Coach with RAG** - HuggingFace embeddings stored in Neon pgvector, retrieved per query, fed to Groq Llama 3.3 70B
- **Reanimated 4 animations** - soft ease-out motion (no springs) that respects Reduce Motion: drawn-in charts, count-ups, drag-sort, swipe actions

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.86 · Expo 57 |
| Language | TypeScript 5.9 (strict) |
| State | Zustand + AsyncStorage (offline-first) |
| Backend | Firebase Firestore + Auth |
| AI | Groq (Llama 3.3 70B) · HuggingFace (embeddings) |
| Vector DB | Neon - PostgreSQL + pgvector |
| Animation | Reanimated 4 · Lottie |
| Gestures | react-native-gesture-handler |
| Build | EAS Build · Expo Updates (OTA) |

---

## Getting Started (Local)

```bash
git clone https://github.com/jabluetooth/se7en.git
cd se7en
npm install
```

Copy `.env.example` to `.env.local` and fill in your Firebase credentials, then:

```bash
npm start        # Expo dev server
npm run ios      # iOS simulator
npm run android  # Android emulator
```

The AI Coach (Groq, HuggingFace, Neon) runs through a Cloud Functions proxy so those credentials never ship inside the app - see [`functions/README.md`](functions/README.md) to configure and deploy it.

---

## About the developer

**Fil Heinz O. Re La Torre** - Automation & AI Solutions Engineer, building integrations and AI-backed workflows that go from idea to production in days.

[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://www.filheinzrelatorre.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://ph.linkedin.com/in/filheinzrelatorre)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jabluetooth)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:filheinz27@gmail.com)

**Other projects:** [Match](https://github.com/jabluetooth/match) · [ZeroPress](https://github.com/jabluetooth/zeropress) · [Mimo](https://github.com/jabluetooth/mimo) · [Insight](https://github.com/jabluetooth/insight) · [see all →](https://github.com/jabluetooth)
