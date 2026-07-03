import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GRAD, COLORS } from '../../constants';

export type TabName = 'Home' | 'Cycle' | 'Progress' | 'Settings';

interface Tab { name: TabName; icon: string; iconFocused: string; }
const TABS: Tab[] = [
  { name: 'Home',     icon: 'home-outline',     iconFocused: 'home'     },
  { name: 'Cycle',    icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'Progress', icon: 'pulse-outline',    iconFocused: 'pulse'    },
  { name: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

// dock.tsx defaults: 40×40 circular icons (DEFAULT_SIZE). Touch has no cursor-proximity
// magnification, so all icons stay at base size; active state uses the orange gradient fill.
const ICON_SIZE   = 48;
const DOCK_HEIGHT = 72;   // 72 - 2*12 padding = 48 icon content area, fits exactly
const DOCK_RADIUS = 40;   // pill-shaped corners

interface Props { activeTab: TabName; onTabPress: (tab: TabName) => void; }

export function FloatingDock({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={s.shadowWrap}>
        {Platform.OS === 'ios' ? (
          // systemUltraThinMaterialDark = actual Apple system glass (matches GlassView)
          <BlurView intensity={50} tint="systemUltraThinMaterialDark" style={s.dock}>
            {/* Cool white tint — bg-white/10 */}
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
  const handlePress = (tab: TabName) => {
    if (tab !== activeTab) Haptics.selectionAsync().catch(() => {});
    onTabPress(tab);
  };

  return (
    <>
      {TABS.map((tab) => {
        const active = activeTab === tab.name;
        return active ? (
          <LinearGradient
            key={tab.name}
            colors={GRAD.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.iconCircle}
          >
            <TouchableOpacity
              style={s.iconInner}
              onPress={() => handlePress(tab.name)}
              activeOpacity={0.9}
              accessibilityRole="tab"
              accessibilityLabel={tab.name}
              accessibilityState={{ selected: true }}
            >
              <Ionicons name={tab.iconFocused as any} size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <TouchableOpacity
            key={tab.name}
            style={s.iconCircle}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.65}
            accessibilityRole="tab"
            accessibilityLabel={tab.name}
            accessibilityState={{ selected: false }}
          >
            <Ionicons name={tab.icon as any} size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
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
    // w-max equivalent — content-width, centered by parent's alignItems
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
    height: DOCK_HEIGHT,                         // bigger than reference's h-[58px]
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',       // border-white/20
    borderRadius: DOCK_RADIUS,                   // softer than rounded-2xl
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    overflow: 'hidden',
  },
  tint: {
    backgroundColor: 'rgba(255,255,255,0.10)',   // bg-white/10
    borderRadius: DOCK_RADIUS,
  },
  androidDock: {
    backgroundColor: 'rgba(20,22,30,0.92)',
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,                 // aspect-square rounded-full
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',                          // clips the active gradient
  },
  iconInner: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
});
