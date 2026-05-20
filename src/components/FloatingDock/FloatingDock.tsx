import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
const ICON_SIZE = 40;

interface Props { activeTab: TabName; onTabPress: (tab: TabName) => void; }

export function FloatingDock({ activeTab, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={s.shadowWrap}>
        {Platform.OS === 'ios' ? (
          // Intensity 50 ≈ Tailwind backdrop-blur-md (12px) from dock.tsx
          <BlurView intensity={50} tint="dark" style={s.dock}>
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
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.9}
            >
              <Ionicons name={tab.iconFocused as any} size={22} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <TouchableOpacity
            key={tab.name}
            style={s.iconCircle}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.65}
          >
            <Ionicons name={tab.icon as any} size={20} color={COLORS.textSecondary} />
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
    borderRadius: 16,
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
    height: 58,                                  // h-[58px]
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',       // border-white/20
    borderRadius: 16,                            // rounded-2xl
    paddingHorizontal: 8,                        // p-2
    paddingVertical: 8,
    gap: 8,                                      // gap-2
    overflow: 'hidden',
  },
  tint: {
    backgroundColor: 'rgba(255,255,255,0.10)',   // bg-white/10
    borderRadius: 16,
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
