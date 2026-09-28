import React, { useState, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { DRIFT, TIMING } from '../motion/tokens';
import { View, StyleSheet, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingDock, TabName }    from '../components/FloatingDock/FloatingDock';
import { HomeScreen }               from '../screens/Home/HomeScreen';
import { CycleScreen }              from '../screens/Cycle/CycleScreen';
import { ProgressScreen }           from '../screens/Progress/ProgressScreen';
import { SettingsScreen }           from '../screens/Settings/SettingsScreen';
import { PostWorkoutSummary }       from '../screens/PostWorkout/PostWorkoutSummary';
import { ActiveSessionScreen }      from '../screens/ActiveSession/ActiveSessionScreen';
import { ExerciseBuilderScreen }    from '../screens/ExerciseBuilder/ExerciseBuilderScreen';
import { CoachScreen }              from '../screens/Coach/CoachScreen';
import { useSessionStore }          from '../stores/sessionStore';
import { usePlanStore }             from '../stores/planStore';
import { useAuthStore }             from '../stores/authStore';
import { WorkoutSession, WorkoutDay } from '../types';
import { FeedbackHost } from '../components/feedback/Feedback';
import { themed } from '../theme/runtime';

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

// Survives the remount App does on a theme switch, so flipping Dark/Light
// in Settings keeps you on Settings instead of jumping back to Home.
let lastTab: TabName = 'Home';

export function AppNavigator() {
  const [activeTab,       setActiveTab      ] = useState<TabName>(lastTab);
  useEffect(() => { lastTab = activeTab; }, [activeTab]);
  const [workoutModal,    setWorkoutModal    ] = useState<WorkoutModal>({ phase: 'hidden' });
  const [showBuilder,     setShowBuilder     ] = useState(false);
  const [showCoach,       setShowCoach       ] = useState(false);
  const [coachInitialMsg, setCoachInitialMsg ] = useState<string | undefined>();

  const { activeSession, clearActiveSession } = useSessionStore();
  const { activePlan }     = usePlanStore();
  const { signOut, user }  = useAuthStore();

  // Auto-raise the session modal when a session is started (e.g. from HomeScreen).
  useEffect(() => {
    if (activeSession) {
      setWorkoutModal(prev => prev.phase === 'hidden' ? { phase: 'active' } : prev);
    }
  }, [activeSession]);

  // Clear activeSession only AFTER PostWorkoutSummary has mounted so the Modal
  // is never empty between the active→summary content swap.  finishSession()
  // deliberately keeps activeSession alive; we clean it up here.
  useEffect(() => {
    if (workoutModal.phase === 'summary' && activeSession) {
      clearActiveSession();
    }
  }, [workoutModal.phase, activeSession, clearActiveSession]);

  // Atomically swap from 'active' → 'summary' inside the same modal.
  // No dismiss+present cycle, so iOS never drops the incoming screen.
  const handleSessionFinish = (session: WorkoutSession) => {
    setWorkoutModal({ phase: 'summary', session });
  };

  const handlePostWorkoutDone = () => {
    setWorkoutModal({ phase: 'hidden' });
    setActiveTab('Home');
    if (activeSession) clearActiveSession();
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

  // Tabs are mounted the first time they're opened, then kept alive so each
  // keeps its scroll position and loaded state instead of rebuilding on every
  // switch.
  const [visited, setVisited] = useState<TabName[]>([activeTab]);
  useEffect(() => {
    setVisited(v => (v.includes(activeTab) ? v : [...v, activeTab]));
  }, [activeTab]);

  const renderTab = (tab: TabName) => {
    switch (tab) {
      case 'Home':     return (
        <HomeScreen
          onNavigate={setActiveTab}
          onOpenCoach={handleOpenCoach}
          onResumeSession={() => setWorkoutModal({ phase: 'active' })}
        />
      );
      case 'Cycle':    return <CycleScreen />;
      case 'Progress': return <ProgressScreen onStartWorkout={() => setActiveTab('Home')} />;
      case 'Settings': return (
        <SettingsScreen
          onOpenExerciseBuilder={() => setShowBuilder(true)}
          onOpenPlan={() => setActiveTab('Cycle')}
          onSignOut={() => { lastTab = 'Home'; return signOut(); }}
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
        visited={visited}
        workoutModal={workoutModal}
        onHideSession={() => setWorkoutModal({ phase: 'hidden' })}
        onSessionFinish={handleSessionFinish}
        onSessionCleared={handleSessionCleared}
        finishedSession={finishedSession}
        nextDay={nextDay}
        onPostWorkoutDone={handlePostWorkoutDone}
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
  renderTab: (tab: TabName) => React.ReactNode;
  visited: TabName[];
  workoutModal: WorkoutModal;
  onHideSession: () => void;
  onSessionFinish: (session: WorkoutSession) => void;
  onSessionCleared: () => void;
  finishedSession: WorkoutSession | null;
  nextDay: WorkoutDay | undefined;
  onPostWorkoutDone: () => void;
  showBuilder: boolean;
  setShowBuilder: (v: boolean) => void;
  showCoach: boolean;
  coachInitialMsg: string | undefined;
  onCloseCoach: () => void;
}

function AppShell({
  activeTab, setActiveTab, renderTab, visited,
  workoutModal, onHideSession, onSessionFinish, onSessionCleared,
  finishedSession, nextDay, onPostWorkoutDone,
  showBuilder, setShowBuilder,
  showCoach, coachInitialMsg, onCloseCoach,
}: ShellProps) {
  return (
    <View style={s.container}>
      {/* Content fills the FULL screen — dock overlays on top of it so the
          page background and tiles extend behind the dock + home indicator. */}
      <View style={s.content}>
        {visited.map(tab => (
          <TabScene key={tab} active={tab === activeTab}>{renderTab(tab)}</TabScene>
        ))}
      </View>
      <FloatingDock activeTab={activeTab} onTabPress={setActiveTab} />

      {/* Single workout modal shared by ActiveSession and PostWorkoutSummary.
          Keeping it mounted through the active→summary swap avoids the iOS
          dismiss+present race that previously dropped the post-workout screen.
          No statusBarTranslucent: that prop is Android-oriented (this app
          already handles Android's status bar via edgeToEdgeEnabled in
          gradle.properties) and on iOS it was leaving a native status-bar-height
          strip across the top of the screen that silently swallowed touches
          meant for header buttons in the top corners — a fullScreen Modal
          already positions content correctly below the status bar without it. */}
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
          <FeedbackHost />
        </View>
      </Modal>

      <Modal visible={showBuilder} animationType="slide" presentationStyle="fullScreen">
        <ExerciseBuilderScreen onClose={() => setShowBuilder(false)} />
        <FeedbackHost />
      </Modal>

      <Modal visible={showCoach} animationType="slide" presentationStyle="fullScreen">
        <CoachScreen
          onClose={onCloseCoach}
          initialMessage={coachInitialMsg}
        />
        <FeedbackHost />
      </Modal>
    </View>
  );
}

/**
 * One tab's screen. The active one fades in while drifting a few points into
 * place; inactive ones fade out, stop receiving touches, and are then taken
 * out of layout (display: none) so hidden screens cost nothing to draw, while
 * staying mounted.
 */
function TabScene({ active, children }: { active: boolean; children: React.ReactNode }) {
  const shown = useSharedValue(active ? 1 : 0);
  const [hidden, setHidden] = useState(!active);

  useEffect(() => {
    if (active) {
      setHidden(false);
      shown.value = withTiming(1, TIMING.standard);
      return;
    }
    shown.value = withTiming(0, TIMING.quick);
    const t = setTimeout(() => setHidden(true), TIMING.quick.duration + 40);
    return () => clearTimeout(t);
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * DRIFT }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, hidden && { display: 'none' }]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

const s = themed(() => StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1 },
}));
