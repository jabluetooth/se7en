import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { COLORS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { CycleOrbitWidget } from './CycleOrbitWidget';
import { DaySlider } from './DaySlider';
import { MissionCard } from './MissionCard';
import { ContributionHeatmap } from './ContributionHeatmap';
import { HighlightSlideshow } from './HighlightSlideshow';
import { TabName } from '../../components/FloatingDock/FloatingDock';

// HomeScreen is idle-only — active sessions are handled by ActiveSessionScreen
// (shown as a modal in AppNavigator whenever activeSession !== null).

interface Props {
  onNavigate: (tab: TabName) => void;
}

export function HomeScreen({ onNavigate }: Props) {
  const { activePlan }             = usePlanStore();
  const { sessions, startSession } = useSessionStore();
  const { settings }               = useSettingsStore();

  const currentDay   = activePlan?.days.find(d => d.dayPosition === settings.currentDayPosition);
  const planSessions = activePlan ? sessions.filter(s => s.planId === activePlan.id) : sessions;

  const handleStart = () => {
    if (!activePlan || !currentDay) return;
    startSession(activePlan.id, currentDay);
    // AppNavigator detects activeSession !== null and opens ActiveSessionScreen
  };

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <AppBackground />
        <Text style={s.emptyTitle}>No plan active</Text>
        <Text style={s.emptySub}>Head to Settings to set up your plan.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.planLabel}>{activePlan.name}</Text>
            <Text style={s.dateText}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </Text>
          </View>
          <GlassView radius={14} glow style={s.logoBadge}>
            <Text style={s.logoNum}>7</Text>
          </GlassView>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* ── Orbit + slider ── */}
          <CycleOrbitWidget
            currentDay={settings.currentDayPosition}
            sessions={planSessions}
          />

          <DaySlider
            days={activePlan.days}
            currentDay={settings.currentDayPosition}
            sessions={planSessions}
          />

          {/* ── Mission card ── */}
          <MissionCard
            currentDay={currentDay}
            currentDayNum={settings.currentDayPosition}
            onStart={handleStart}
          />

          {/* ── Divider ── */}
          <View style={s.sectionGap} />

          {/* ── Heatmap ── */}
          <ContributionHeatmap sessions={planSessions} activePlan={activePlan} />

          {/* ── Highlight slideshow ── */}
          <HighlightSlideshow
            sessions={planSessions}
            currentDay={settings.currentDayPosition}
            onNavigate={onNavigate}
          />

          <View style={s.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  safe:       { flex: 1 },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  header:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  dateText:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  logoBadge:  { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  logoNum:    { fontSize: 22, fontWeight: '900', color: COLORS.accent },
  scroll:      { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 8 },
  sectionGap:  { height: 8 },
  bottomPad:   { height: 120 },
});
