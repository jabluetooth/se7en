import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePRStore } from '../../stores/prStore';
import { GRAD, COLORS } from '../../constants';
import { WorkoutSession, PersonalRecord } from '../../types';
import { CycleOrbitWidget } from './CycleOrbitWidget';
import { DaySlider } from './DaySlider';
import { MissionCard } from './MissionCard';
import { ContributionHeatmap } from './ContributionHeatmap';
import { BentoGrid } from './BentoGrid';

// HomeScreen is idle-only — active sessions are handled by ActiveSessionScreen
// (shown as a modal in AppNavigator whenever activeSession !== null).

function computeStreak(sessions: WorkoutSession[]): number {
  const completed = sessions
    .filter(s => s.status === 'completed' && s.finishedAt)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime());

  if (completed.length === 0) return 0;

  let streak = 1;
  let prev   = new Date(completed[0].finishedAt!);
  prev.setHours(0, 0, 0, 0);

  for (let i = 1; i < completed.length; i++) {
    const cur = new Date(completed[i].finishedAt!);
    cur.setHours(0, 0, 0, 0);
    if ((prev.getTime() - cur.getTime()) / 86_400_000 <= 1.5) {
      streak++;
      prev = cur;
    } else {
      break;
    }
  }
  return streak;
}

export function HomeScreen() {
  const { activePlan }                          = usePlanStore();
  const { sessions, startSession }              = useSessionStore();
  const { settings }                            = useSettingsStore();
  const { records }                             = usePRStore();

  const currentDay   = activePlan?.days.find(d => d.dayPosition === settings.currentDayPosition);
  const planSessions = activePlan ? sessions.filter(s => s.planId === activePlan.id) : sessions;

  const streak: number = computeStreak(planSessions);
  const latestPR: PersonalRecord | null = records.length > 0
    ? [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    : null;

  const handleStart = () => {
    if (!activePlan || !currentDay) return;
    startSession(activePlan.id, currentDay);
    // AppNavigator detects activeSession !== null and opens ActiveSessionScreen
  };

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <LinearGradient
          colors={GRAD.bg}
          locations={GRAD.bgLocations}
          start={GRAD.bgStart}
          end={GRAD.bgEnd}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.emptyTitle}>No plan active</Text>
        <Text style={s.emptySub}>Head to Settings to set up your plan.</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={GRAD.bg}
        locations={GRAD.bgLocations}
        start={GRAD.bgStart}
        end={GRAD.bgEnd}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.orb, { top: -80,  right: -60,  width: 280, height: 280, backgroundColor: 'rgba(144,53,240,0.11)' }]} />
        <View style={[s.orb, { bottom: 180, left: -70, width: 240, height: 240, backgroundColor: 'rgba(123,94,250,0.09)' }]} />
        <View style={[s.orb, { top: 300,  right: -40,  width: 180, height: 180, backgroundColor: 'rgba(76,170,240,0.07)'  }]} />
      </View>

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
        >
          <CycleOrbitWidget
            currentDay={settings.currentDayPosition}
            sessions={planSessions}
          />

          <DaySlider
            days={activePlan.days}
            currentDay={settings.currentDayPosition}
            sessions={planSessions}
          />

          <MissionCard
            currentDay={currentDay}
            currentDayNum={settings.currentDayPosition}
            onStart={handleStart}
          />

          <ContributionHeatmap sessions={planSessions} />

          <BentoGrid
            sessions={planSessions}
            latestPR={latestPR}
            streak={streak}
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
  orb:        { position: 'absolute', borderRadius: 999 },
  header:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel:  { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  dateText:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  logoBadge:  { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  logoNum:    { fontSize: 22, fontWeight: '900', color: COLORS.accent },
  scroll:     { flex: 1 },
  scrollContent: { paddingTop: 4 },
  bottomPad:  { height: 120 },
});
