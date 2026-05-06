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
  const { signOut, user }            = useAuthStore();
  const showActiveSession            = activeSession !== null;

  const handleSessionFinish = (session: WorkoutSession) => {
    setFinishedSession(session);
    setShowPostWorkout(true);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'Home':     return <HomeScreen />;
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
