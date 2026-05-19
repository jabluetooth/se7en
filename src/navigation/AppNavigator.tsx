import React, { useState } from 'react';
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
import { useSessionStore }          from '../stores/sessionStore';
import { usePlanStore }             from '../stores/planStore';
import { useAuthStore }             from '../stores/authStore';
import { SPACING }                  from '../constants';
import { WorkoutSession }           from '../types';

export function AppNavigator() {
  const [activeTab,       setActiveTab      ] = useState<TabName>('Home');
  const [showPostWorkout, setShowPostWorkout ] = useState(false);
  const [showRestTimer,   setShowRestTimer   ] = useState(false);
  const [showBuilder,     setShowBuilder     ] = useState(false);
  const [finishedSession, setFinishedSession ] = useState<WorkoutSession | null>(null);

  const { activeSession }            = useSessionStore();
  const { activePlan }               = usePlanStore();
  const { signOut, user }            = useAuthStore();

  // "Next Up" must mirror the Cycle screen's slot order — NOT dayPosition+1.
  // After a drag-reorder on the Cycle screen, slot N+1 holds whatever workout
  // the user dragged there, which may have any dayPosition. We locate the
  // finished session by its stable dayPosition, then walk forward through the
  // slot array (wrapping at 7) and skip rest days so the user sees the next
  // actual workout — exactly what the Cycle screen shows as "tomorrow".
  const nextDay = (() => {
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
  const showActiveSession            = activeSession !== null;

  const handleSessionFinish = (session: WorkoutSession) => {
    setFinishedSession(session);
    setShowPostWorkout(true);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'Home':     return <HomeScreen onNavigate={setActiveTab} />;
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
      <View style={s.container}>
        <View style={s.content}>{renderTab()}</View>
        <FloatingDock activeTab={activeTab} onTabPress={setActiveTab} />

        <Modal visible={showActiveSession} animationType="slide" presentationStyle="fullScreen">
          <ActiveSessionScreen onFinish={handleSessionFinish} />
        </Modal>

        <Modal visible={showPostWorkout} animationType="slide" presentationStyle="fullScreen">
          {finishedSession && (
            <PostWorkoutSummary
              session={finishedSession}
              nextDay={nextDay}
              onDone={() => { setShowPostWorkout(false); setFinishedSession(null); setActiveTab('Home'); }}
            />
          )}
        </Modal>

        <Modal visible={showRestTimer} animationType="slide" presentationStyle="fullScreen">
          <RestTimerScreen onClose={() => setShowRestTimer(false)} />
        </Modal>

        <Modal visible={showBuilder} animationType="slide" presentationStyle="fullScreen">
          <ExerciseBuilderScreen onClose={() => setShowBuilder(false)} />
        </Modal>
      </View>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content:   { flex: 1, paddingBottom: 72 + SPACING.sm },
});
