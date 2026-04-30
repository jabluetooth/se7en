import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FloatingDock, TabName } from '../components/FloatingDock/FloatingDock';
import { HomeScreen } from '../screens/Home/HomeScreen';
import { CycleScreen } from '../screens/Cycle/CycleScreen';
import { ProgressScreen } from '../screens/Progress/ProgressScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { useTheme } from '../hooks/useTheme';
import { DOCK_HEIGHT, SPACING } from '../constants';

export function AppNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const { colors } = useTheme();

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'Cycle':
        return <CycleScreen />;
      case 'Progress':
        return <ProgressScreen />;
      case 'Settings':
        return <SettingsScreen />;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>{renderScreen()}</View>
        <FloatingDock activeTab={activeTab} onTabPress={setActiveTab} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingBottom: DOCK_HEIGHT + SPACING.xl },
});
