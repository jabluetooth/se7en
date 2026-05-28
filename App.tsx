import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar, UIManager, Platform } from 'react-native';
import type { User } from 'firebase/auth';
import { useFonts } from 'expo-font';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore }     from './src/stores/authStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { usePlanStore }     from './src/stores/planStore';
import { useSessionStore }  from './src/stores/sessionStore';
import { usePRStore }       from './src/stores/prStore';
import { AuthScreen }       from './src/screens/Auth/AuthScreen';
import { OnboardingScreen } from './src/screens/Onboarding/OnboardingScreen';
import { AppNavigator }     from './src/navigation/AppNavigator';
import { COLORS }           from './src/constants';

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_400Regular:           require('@expo-google-fonts/syne/400Regular/Syne_400Regular.ttf'),
    Syne_500Medium:            require('@expo-google-fonts/syne/500Medium/Syne_500Medium.ttf'),
    Syne_600SemiBold:          require('@expo-google-fonts/syne/600SemiBold/Syne_600SemiBold.ttf'),
    Syne_700Bold:              require('@expo-google-fonts/syne/700Bold/Syne_700Bold.ttf'),
    Syne_800ExtraBold:         require('@expo-google-fonts/syne/800ExtraBold/Syne_800ExtraBold.ttf'),
    JetBrainsMono_400Regular:  require('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
    JetBrainsMono_700Bold:     require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
    JetBrainsMono_800ExtraBold: require('@expo-google-fonts/jetbrains-mono/800ExtraBold/JetBrainsMono_800ExtraBold.ttf'),
  });

  const { initialised, startListener } = useAuthStore();
  const { settings, load: loadSettings, startSync: syncSettings, stopSync: stopSettings } = useSettingsStore();
  const { load: loadPlans,    startSync: syncPlans,    stopSync: stopPlans    } = usePlanStore();
  const { load: loadSessions, startSync: syncSessions, stopSync: stopSessions } = useSessionStore();
  const { load: loadPRs,      startSync: syncPRs,      stopSync: stopPRs     } = usePRStore();

  const [dataReady, setDataReady] = useState(false);

  // Boot: start the Firebase Auth listener once
  useEffect(() => {
    const unsubscribe = startListener(
      async (user: User) => {
        // Signed in — load all data then start real-time sync
        setDataReady(false);
        await Promise.all([
          loadSettings(user.uid),
          loadPlans(user.uid),
          loadSessions(user.uid),
          loadPRs(user.uid),
        ]);
        syncSettings(user.uid);
        syncPlans(user.uid);
        syncSessions(user.uid);
        syncPRs(user.uid);
        setDataReady(true);
      },
      () => {
        // Signed out — stop listeners and wipe local state
        stopSettings();
        stopPlans();
        stopSessions();
        stopPRs();
        setDataReady(false);
      },
    );
    return unsubscribe;
  }, []);

  const user = useAuthStore(s => s.user);

  // Wait for custom fonts before rendering anything
  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  // Splash while Firebase resolves auth state
  if (!initialised) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  // Not signed in → auth screens
  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <AuthScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Signed in but data still loading → spinner
  if (!dataReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        {settings.activePlanId === null ? (
          <OnboardingScreen onComplete={() => {}} />
        ) : (
          <AppNavigator />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
