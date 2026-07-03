import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar, UIManager, Platform, TouchableOpacity } from 'react-native';
import type { User } from 'firebase/auth';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore }     from './src/stores/authStore';
import { auth }             from './src/config/firebase';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Boot: start the Firebase Auth listener once
  useEffect(() => {
    const unsubscribe = startListener(
      async (user: User) => {
        // Signed in — load all data then start real-time sync
        setDataReady(false);
        setLoadError(null);
        try {
          await Promise.all([
            loadSettings(user.uid),
            loadPlans(user.uid),
            loadSessions(user.uid),
            loadPRs(user.uid),
          ]);
        } catch (e) {
          // Failed Firestore load (e.g. offline on first launch, before any
          // local cache exists) — surface a retry affordance instead of an
          // infinite spinner.
          if (auth.currentUser?.uid !== user.uid) return;
          setLoadError(e instanceof Error ? e.message : 'Could not load your data.');
          return;
        }
        // A sign-out (or switch to a different account) may have happened while
        // the loads above were in flight — bail out rather than resurrecting
        // this user's data and attaching Firestore listeners for a stale uid.
        if (auth.currentUser?.uid !== user.uid) return;
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
        setLoadError(null);
        // Clear per-user caches that aren't owned by a store's stopSync(), so
        // the next account signed in on this device doesn't see this user's
        // cached AI insight, widget snapshot, or saved plan presets.
        AsyncStorage.multiRemove([
          '@se7en_coach_cache',
          '@se7en_widget_state',
          '@se7en_plan_presets',
        ]).catch(() => {});
      },
    );
    return unsubscribe;
  }, [retryTick]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setRetryTick(t => t + 1);
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

  // Signed in but the initial data load failed (e.g. offline before any local
  // cache exists) — offer a retry instead of stranding the user on a spinner.
  if (loadError) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32 }}>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            Couldn't load your data
          </Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            Check your connection and try again.
          </Text>
          <TouchableOpacity
            onPress={retryLoad}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.accent }}
          >
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Retry</Text>
          </TouchableOpacity>
        </View>
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
