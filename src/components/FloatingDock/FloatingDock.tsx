import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { GRAD, COLORS } from '../../constants';

export type TabName = 'Home' | 'Cycle' | 'Progress' | 'Settings';

interface Tab { name: TabName; icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap; }
const TABS: Tab[] = [
  { name: 'Home',     icon: 'home-outline',     iconFocused: 'home'     },
  { name: 'Cycle',    icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'Progress', icon: 'pulse-outline',    iconFocused: 'pulse'    },
  { name: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

const ICON_SIZE   = 48;
const GAP         = 10;
const PAD         = 12;
const DOCK_HEIGHT = ICON_SIZE + PAD * 2;
const DOCK_RADIUS = 40;

interface Props { activeTab: TabName; onTabPress: (tab: TabName) => void; }

export function FloatingDock({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrapper, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <View style={s.shadowWrap}>
        {Platform.OS === 'ios' ? (
          // systemUltraThinMaterialDark = actual Apple system glass (matches GlassView)
          <BlurView intensity={50} tint="systemUltraThinMaterialDark" style={s.dock}>
            <View style={[StyleSheet.absoluteFill, s.tint]} />
            <DockContent activeTab={activeTab} onTabPress={onTabPress} />
          </BlurView>
        ) : (
          <View style={[s.dock, s.androidDock]}>
            <DockContent activeTab={activeTab} onTabPress={onTabPress} />
          </View>
        )}
      </View>
    </View>
  );
}

function DockContent({ activeTab, onTabPress }: Props) {
  const index = Math.max(0, TABS.findIndex(t => t.name === activeTab));

  // One accent circle that glides to the active icon, rather than each icon
  // swapping its own background on and off.
  const x = useSharedValue(index * (ICON_SIZE + GAP));
  useEffect(() => { x.value = withTiming(index * (ICON_SIZE + GAP), TIMING.standard); }, [index]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const handlePress = (tab: TabName) => {
    if (tab !== activeTab) fireHaptic('selection');
    onTabPress(tab);
  };

  return (
    <>
      <Animated.View style={[s.indicator, indicator]} pointerEvents="none">
        <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {TABS.map(tab => {
        const active = activeTab === tab.name;
        return (
          <AnimatedPressable
            key={tab.name}
            scale="strong"
            style={s.iconCircle}
            onPress={() => handlePress(tab.name)}
            accessibilityRole="tab"
            accessibilityLabel={tab.name}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={active ? tab.iconFocused : tab.icon}
              size={active ? 24 : 22}
              color={active ? '#fff' : COLORS.textSecondary}
            />
          </AnimatedPressable>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center',
  },
  shadowWrap: {
    borderRadius: DOCK_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius:  28,
      },
      android: { elevation: 16 },
    }),
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DOCK_HEIGHT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: DOCK_RADIUS,
    paddingHorizontal: PAD,
    paddingVertical: PAD,
    gap: GAP,
    overflow: 'hidden',
  },
  tint: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: DOCK_RADIUS,
  },
  androidDock: {
    backgroundColor: 'rgba(20,22,30,0.92)',
  },
  indicator: {
    position: 'absolute',
    left: PAD, top: PAD,
    width: ICON_SIZE, height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: 'hidden',
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
