import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingDock, TabName }    from '../components/FloatingDock/FloatingDock';
import { HomeScreen }               from '../screens/Home/HomeScreen';
import { CycleScreen }              from '../screens/Cycle/CycleScreen';
import { ProgressScreen }           from '../screens/Progress/ProgressScreen';
import { SettingsScreen }           from '../screens/Settings/SettingsScreen';
import { PostWorkoutSummary }       from '../screens/PostWorkout/PostWorkoutSummary';
import { ActiveSessionScreen }      from '../screens/ActiveSession/ActiveSessionScreen';
import { RestTimerScreen }          from '../screens/RestTimer/RestTimerScreen';
import { ExerciseBuilderScreen }    from '../screens/ExerciseBuilder/ExerciseBuilderScreen';
import { CoachScreen }              from '../screens/Coach/CoachScreen';
import { useSessionStore }          from '../stores/sessionStore';
import { usePlanStore }             from '../stores/planStore';
import { useAuthStore }             from '../stores/authStore';
import { WorkoutSession, WorkoutDay } from '../types';

// The floating dock is an overlay — it sits ON TOP of screen content so the
// page background extends edge-to-edge (including behind the dock + home
// indicator). Individual screens that scroll should add a bottom padding of
// roughly DOCK_RESERVE so the user can scroll the last item above the dock.

// A single discriminated union drives the workout modal so ActiveSession and
// PostWorkoutSummary share one <Modal>. This avoids the iOS dismiss→present
// race that caused the post-workout screen to flash and immediately disappear:
// UIKit cannot present a new fullScreen VC while another is still animating out.
type WorkoutModal =
  | { phase: 'hidden' }
  | { phase: 'active' }
  | { phase: 'summary'; session: WorkoutSession };

export function AppNavigator() {
  const [activeTab,       setActiveTab      ] = useState<TabName>('Home');
  const [workoutModal,    setWorkoutModal    ] = useState<WorkoutModal>({ phase: 'hidden' });
  const [showRestTimer,   setShowRestTimer   ] = useState(false);
  const [showBuilder,     setShowBuilder     ] = useState(false);
  const [showCoach,       setShowCoach       ] = useState(false);
  const [coachInitialMsg, setCoachInitialMsg ] = useState<string | undefined>();

  const { activeSession }  = useSessionStore();
  const { activePlan }     = usePlanStore();
  const { signOut, user }  = useAuthStore();

  // Auto-raise the session modal when a session is started (e.g. from HomeScreen).
  // When finishSession() eventually clears activeSession, we are already in the
  // 'summary' phase so the condition below is a no-op — no unintended close.
  useEffect(() => {
    if (activeSession) {
      setWorkoutModal(prev => prev.phase === 'hidden' ? { phase: 'active' } : prev);
    }
  }, [activeSession]);

  // Atomically swap from 'active' → 'summary' inside the same modal.
  // No dismiss+present cycle, so iOS never drops the incoming screen.
  const handleSessionFinish = (session: WorkoutSession) => {
    setWorkoutModal({ phase: 'summary', session });
  };

  const handlePostWorkoutDone = () => {
    setWorkoutModal({ phase: 'hidden' });
    setActiveTab('Home');
  };

  // Called by ActiveSessionScreen when the day is skipped / session cleared.
  const handleSessionCleared = () => {
    setWorkoutModal({ phase: 'hidden' });
  };

  const handleOpenCoach = (initialMessage?: string) => {
    setCoachInitialMsg(initialMessage);
    setShowCoach(true);
  };

  // "Next Up" must mirror the Cycle screen's slot order — NOT dayPosition+1.
  // After a drag-reorder on the Cycle screen, slot N+1 holds whatever workout
  // the user dragged there, which may have any dayPosition. We locate the
  // finished session by its stable dayPosition, then walk forward through the
  // slot array (wrapping at 7) and skip rest days so the user sees the next
  // actual workout — exactly what the Cycle screen shows as "tomorrow".
  const finishedSession = workoutModal.phase === 'summary' ? workoutModal.session : null;
  const nextDay: WorkoutDay | undefined = (() => {
    if (!finishedSession || !activePlan) return undefined;
    const days = activePlan.days;
    const currentSlot = days.findIndex(d => d.dayPosition === finishedSession.dayPosition);
    if (currentSlot === -1) return undefined;
    for (let offset = 1; offset <= days.length; offset++) {
      const candidate = days[(currentSlot + offset) % days.length];
      if (candidate && !candidate.isRestDay) return candidate;
    }
    return undefined; // plan is all rest days — NextUpPage shows empty state
  })();

  const renderTab = () => {
    switch (activeTab) {
      case 'Home':     return (
        <HomeScreen
          onNavigate={setActiveTab}
          onOpenCoach={handleOpenCoach}
          onResumeSession={() => setWorkoutModal({ phase: 'active' })}
        />
      );
      case 'Cycle':    return <CycleScreen />;
      case 'Progress': return <ProgressScreen />;
      case 'Settings': return (
        <SettingsScreen
          onOpenExerciseBuilder={() => setShowBuilder(true)}
          onSignOut={signOut}
          userEmail={user?.email ?? undefined}
          userName={user?.displayName ?? undefined}
        />
      );
    }
  };

  return (
    <SafeAreaProvider>
      <AppShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        renderTab={renderTab}
        workoutModal={workoutModal}
        onHideSession={() => setWorkoutModal({ phase: 'hidden' })}
        onSessionFinish={handleSessionFinish}
        onSessionCleared={handleSessionCleared}
        finishedSession={finishedSession}
        nextDay={nextDay}
        onPostWorkoutDone={handlePostWorkoutDone}
        showRestTimer={showRestTimer}
        setShowRestTimer={setShowRestTimer}
        showBuilder={showBuilder}
        setShowBuilder={setShowBuilder}
        showCoach={showCoach}
        coachInitialMsg={coachInitialMsg}
        onCloseCoach={() => { setShowCoach(false); setCoachInitialMsg(undefined); }}
      />
    </SafeAreaProvider>
  );
}

// Split out so we can call `useSafeAreaInsets` (must be inside SafeAreaProvider).
interface ShellProps {
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
  renderTab: () => React.ReactNode;
  workoutModal: WorkoutModal;
  onHideSession: () => void;
  onSessionFinish: (session: WorkoutSession) => void;
  onSessionCleared: () => void;
  finishedSession: WorkoutSession | null;
  nextDay: WorkoutDay | undefined;
  onPostWorkoutDone: () => void;
  showRestTimer: boolean;
  setShowRestTimer: (v: boolean) => void;
  showBuilder: boolean;
  setShowBuilder: (v: boolean) => void;
  showCoach: boolean;
  coachInitialMsg: string | undefined;
  onCloseCoach: () => void;
}

function AppShell({
  activeTab, setActiveTab, renderTab,
  workoutModal, onHideSession, onSessionFinish, onSessionCleared,
  finishedSession, nextDay, onPostWorkoutDone,
  showRestTimer, setShowRestTimer,
  showBuilder, setShowBuilder,
  showCoach, coachInitialMsg, onCloseCoach,
}: ShellProps) {
  return (
    <View style={s.container}>
      {/* Content fills the FULL screen — dock overlays on top of it so the
          page background and tiles extend behind the dock + home indicator. */}
      <View style={s.content}>{renderTab()}</View>
      <FloatingDock activeTab={activeTab} onTabPress={setActiveTab} />

      {/* Single workout modal shared by ActiveSession and PostWorkoutSummary.
          Keeping it mounted through the active→summary swap avoids the iOS
          dismiss+present race that previously dropped the post-workout screen. */}
      <Modal
        visible={workoutModal.phase !== 'hidden'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={workoutModal.phase !== 'summary' ? onHideSession : () => {}}
      >
        <View style={{ flex: 1 }}>
          {workoutModal.phase === 'active' && (
            <ActiveSessionScreen
              onFinish={onSessionFinish}
              onBack={onHideSession}
              onClear={onSessionCleared}
            />
          )}
          {workoutModal.phase === 'summary' && finishedSession && (
            <PostWorkoutSummary
              session={finishedSession}
              nextDay={nextDay}
              onDone={onPostWorkoutDone}
            />
          )}
        </View>
      </Modal>

      <Modal visible={showRestTimer} animationType="slide" presentationStyle="fullScreen">
        <RestTimerScreen onClose={() => setShowRestTimer(false)} />
      </Modal>

      <Modal visible={showBuilder} animationType="slide" presentationStyle="fullScreen">
        <ExerciseBuilderScreen onClose={() => setShowBuilder(false)} />
      </Modal>

      <Modal visible={showCoach} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
        <CoachScreen
          onClose={onCloseCoach}
          initialMessage={coachInitialMsg}
        />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },
});
