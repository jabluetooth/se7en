import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GRAD, COLORS, SPACING, BORDER_RADIUS } from '../../constants';

export type TabName = 'Home' | 'Cycle' | 'Progress' | 'Settings';

interface Tab { name: TabName; icon: string; iconFocused: string; label: string; }
const TABS: Tab[] = [
  { name: 'Home',     icon: 'home-outline',    iconFocused: 'home',      label: 'Home'     },
  { name: 'Cycle',    icon: 'calendar-outline', iconFocused: 'calendar',  label: 'Cycle'    },
  { name: 'Progress', icon: 'pulse-outline',    iconFocused: 'pulse',     label: 'Progress' },
  { name: 'Settings', icon: 'settings-outline', iconFocused: 'settings',  label: 'Settings' },
];

interface Props { activeTab: TabName; onTabPress: (tab: TabName) => void; }

export function FloatingDock({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={s.dock}>
        {TABS.map((tab) => {
          const active = activeTab === tab.name;
          return active ? (
            // Active: iOS-blue gradient pill with white icon + label
            <LinearGradient
              key={tab.name}
              colors={GRAD.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.activePill}
            >
              <TouchableOpacity
                style={s.activeInner}
                onPress={() => onTabPress(tab.name)}
                activeOpacity={0.9}
              >
                <Ionicons name={tab.iconFocused as any} size={19} color="#fff" />
                <Text style={s.activeLabel}>{tab.label}</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            // Inactive: icon only, muted grey
            <TouchableOpacity
              key={tab.name}
              style={s.inactiveTab}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.65}
            >
              <Ionicons name={tab.icon as any} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:     {
    position: 'absolute', bottom: 0, left: SPACING.md, right: SPACING.md,
    alignItems: 'center',
  },
  dock:        {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: 4,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.40,
        shadowRadius:  24,
      },
      android: { elevation: 12 },
    }),
  },
  activePill:  { borderRadius: BORDER_RADIUS.full, overflow: 'hidden' },
  activeInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 9, gap: 7,
  },
  activeLabel: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  inactiveTab: { flex: 1, alignItems: 'center', paddingVertical: 9 },
});
