import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TIMING } from '../../motion/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { COLORS, FONTS } from '../../constants';
import { themed } from '../../theme/runtime';

export type TabName = 'Home' | 'Cycle' | 'Progress' | 'Settings';

interface Tab {
  name:   TabName;
  label:  string;
  icon:   keyof typeof Ionicons.glyphMap;
  iconOn: keyof typeof Ionicons.glyphMap;
}

// Internal names stay as they were (screens and stores refer to them); the
// labels are what people see.
const TABS: Tab[] = [
  { name: 'Home',     label: 'Today',    icon: 'today-outline',          iconOn: 'today'          },
  { name: 'Cycle',    label: 'Plan',     icon: 'calendar-clear-outline', iconOn: 'calendar-clear' },
  { name: 'Progress', label: 'Progress', icon: 'stats-chart-outline',    iconOn: 'stats-chart'    },
  { name: 'Settings', label: 'Settings', icon: 'settings-outline',       iconOn: 'settings'       },
];

/** Height of the bar above the home indicator. useDockClearance adds the inset. */
export const TAB_BAR_HEIGHT = 56;

interface Props { activeTab: TabName; onTabPress: (tab: TabName) => void; }

/**
 * A plain, full-width tab bar with labels. It replaced the floating dock of
 * icon circles: labels make each tab obvious at a glance, and a flat bar
 * doesn't compete with the screen above it.
 */
export function FloatingDock({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {TABS.map(tab => {
        const active = tab.name === activeTab;
        return (
          <AnimatedPressable
            key={tab.name}
            scale="strong"
            style={s.tab}
            onPress={() => {
              if (!active) fireHaptic('selection');
              onTabPress(tab.name);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <TabIcon active={active} name={active ? tab.iconOn : tab.icon} />
            <Text style={[s.label, active && s.labelOn]}>{tab.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

/** The selected icon rises a point or two and grows a touch; nothing more. */
function TabIcon({ active, name }: { active: boolean; name: keyof typeof Ionicons.glyphMap }) {
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => { on.value = withTiming(active ? 1 : 0, TIMING.standard); }, [active]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -1.5 * on.value }, { scale: 1 + 0.06 * on.value }],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={23} color={active ? COLORS.accent : COLORS.textLabel} />
    </Animated.View>
  );
}

const s = themed(() => StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    paddingTop: 6,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  tab:     { flex: 1, height: TAB_BAR_HEIGHT - 6, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label:   { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textLabel },
  labelOn: { color: COLORS.accent },
}));
