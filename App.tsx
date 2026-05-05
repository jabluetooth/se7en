import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, UIManager, Platform } from 'react-native';

// LayoutAnimation smooth reorder on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSettingsStore } from './src/stores/settingsStore';
import { usePlanStore } from './src/stores/planStore';
import { useSessionStore } from './src/stores/sessionStore';
import { usePRStore } from './src/stores/prStore';
import { OnboardingScreen } from './src/screens/Onboarding/OnboardingScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { COLORS } from './src/constants';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const { settings, loaded: settingsLoaded, load: loadSettings } = useSettingsStore();
  const { loaded: plansLoaded, load: loadPlans } = usePlanStore();
  const { loaded: sessionsLoaded, load: loadSessions } = useSessionStore();
  const { loaded: prsLoaded, load: loadPRs } = usePRStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([loadSettings(), loadPlans(), loadSessions(), loadPRs()]).then(() => {
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (initialized) {
      setOnboardingDone(settings.activePlanId !== null);
    }
  }, [initialized, settings.activePlanId]);

  const isDark = settings.theme === 'dark';
  const bg = isDark ? COLORS.background : COLORS.lightBackground;

  if (!initialized || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={bg}
        />
        {!onboardingDone ? (
          <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
        ) : (
          <AppNavigator />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
