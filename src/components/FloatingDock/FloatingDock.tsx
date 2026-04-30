import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { BORDER_RADIUS, DOCK_HEIGHT, SPACING } from '../../constants';

export type TabName = 'Home' | 'Cycle' | 'Progress' | 'Settings';

interface Tab {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TABS: Tab[] = [
  { name: 'Home', icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  { name: 'Cycle', icon: 'calendar-outline', iconFocused: 'calendar', label: 'Cycle' },
  { name: 'Progress', icon: 'bar-chart-outline', iconFocused: 'bar-chart', label: 'Progress' },
  { name: 'Settings', icon: 'settings-outline', iconFocused: 'settings', label: 'Settings' },
];

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export function FloatingDock({ activeTab, onTabPress }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + SPACING.sm }]}>
      <View style={[styles.dock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {TABS.map((tab) => {
          const focused = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, focused && [styles.tabActive, { backgroundColor: colors.accentDim }]]}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={22}
                color={focused ? colors.accent : colors.textMuted}
              />
              {focused && (
                <Text style={[styles.label, { color: colors.accent }]}>{tab.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.md,
    right: SPACING.md,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  tabActive: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
