import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { Badge, BadgeVariant } from '../../components/common/Badge';
import { SectionHeader } from '../../components/common/SectionHeader';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, SPACING, ANALYTICS_DEFAULT_DAYS } from '../../constants';
import { subDays } from 'date-fns';
import { WorkoutDay, WorkoutSession } from '../../types';

type DayStatus = 'completed' | 'missed' | 'rest' | 'current' | 'upcoming';

function getStatus(day: WorkoutDay, currentPos: number, sessions: WorkoutSession[]): DayStatus {
  if (day.isRestDay) return 'rest';
  if (day.dayPosition === currentPos) return 'current';
  const last = sessions.filter(s => s.dayPosition === day.dayPosition)
    .sort((a, b) => new Date(b.startedAt ?? b.finishedAt!).getTime() - new Date(a.startedAt ?? a.finishedAt!).getTime())[0];
  if (!last) return 'upcoming';
  return last.status === 'completed' ? 'completed' : last.status === 'missed' ? 'missed' : 'upcoming';
}

const STATUS: Record<DayStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: '+ Done',   variant: 'completed' },
  missed:    { label: 'x Missed', variant: 'missed'    },
  current:   { label: 'Today',    variant: 'current'   },
  upcoming:  { label: 'Upcoming', variant: 'upcoming'  },
  rest:      { label: 'Rest',     variant: 'rest'      },
};

export function CycleScreen() {
  const { activePlan } = usePlanStore();
  const { sessions } = useSessionStore();
  const { settings } = useSettingsStore();

  const cutoff = subDays(new Date(), ANALYTICS_DEFAULT_DAYS);
  const recent = sessions.filter(s => s.startedAt && new Date(s.startedAt) >= cutoff);
  const rate = recent.length === 0 ? 0 : Math.round(recent.filter(s => s.status === 'completed').length / recent.length * 100);
  const bars = recent.slice(-14).map(s => s.status === 'completed' ? 1 : 0);

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />
        <Text style={s.emptyTitle}>No active plan</Text>
        <Text style={s.emptySub}>Set up a plan in Settings.</Text>
      </View>
    );
  }

  const days = [...activePlan.days].sort((a, b) => a.dayPosition - b.dayPosition);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.orb, { top: -80, left: -60, width: 280, height: 280, backgroundColor: 'rgba(144,53,240,0.12)' }]} />
        <View style={[s.orb, { bottom: 60, right: -80, width: 240, height: 240, backgroundColor: 'rgba(76,170,240,0.08)' }]} />
      </View>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.accent}>Cycle 4</Text>
          <Text style={s.title}>7-Day Cycle</Text>
          <Text style={s.sub}>{activePlan.name}</Text>
        </View>
        <GlassView radius={16} style={s.rateCard}>
          <View style={s.rateTop}>
            <View>
              <Text style={s.rateLabel}>Last 2 weeks</Text>
              <View style={s.rateRow}>
                <Text style={s.rateValue}>{rate}%</Text>
                <Text style={s.rateSub}> completion</Text>
              </View>
            </View>
            <View style={s.bars}>
              {bars.map((done, i) => (
                <View key={i} style={[s.bar, { height: done ? 20 : 8, opacity: done ? 1 : 0.3 }]}>
                  {done ? <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, borderRadius: 3 }} /> : null}
                </View>
              ))}
            </View>
          </View>
        </GlassView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {days.map(day => {
            const status = getStatus(day, settings.currentDayPosition, sessions);
            const isCurrent = status === 'current';
            const isDone = status === 'completed';
            return (
              <GlassView
                key={day.id}
                radius={16}
                style={[s.dayCard, isCurrent && s.dayCardCurrent]}
                borderColor={isCurrent ? 'rgba(123,94,250,0.50)' : isDone ? 'rgba(123,94,250,0.22)' : 'rgba(255,255,255,0.08)'}
                glow={isCurrent}
              >
                <View style={s.dayLeft}>
                  {isCurrent ? (
                    <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.dayNum}>
                      <Text style={s.dayNumTextActive}>{day.dayPosition}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.dayNum, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Text style={[s.dayNumText, isDone && { color: COLORS.accent }]}>
                        {isDone ? '+' : day.dayPosition}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={s.dayNameRow}>
                      <Text style={[s.dayName, isCurrent && s.dayNameActive]}>{day.label}</Text>
                    </View>
                    <Text style={s.daySub}>{day.isRestDay ? 'Recovery' : day.exercises.length + ' exercises'}</Text>
                  </View>
                </View>
                <Badge label={STATUS[status].label} variant={STATUS[status].variant} size="xs" />
              </GlassView>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:      { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:        { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  orb:             { position: 'absolute', borderRadius: 999 },
  header:          { paddingHorizontal: 20, paddingBottom: 16 },
  accent:          { fontSize: 12, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 },
  title:           { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub:             { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  rateCard:        { marginHorizontal: 16, padding: 16, marginBottom: 12 },
  rateTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rateLabel:       { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rateRow:         { flexDirection: 'row', alignItems: 'baseline' },
  rateValue:       { fontSize: 32, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.5 },
  rateSub:         { fontSize: 13, color: COLORS.textSecondary },
  bars:            { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar:             { width: 8, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  scroll:          { paddingHorizontal: 16 },
  dayCard:         { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  dayCardCurrent:  {},
  dayLeft:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayNum:          { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayNumText:      { fontSize: 17, fontWeight: '900', color: COLORS.textSecondary },
  dayNumTextActive:{ fontSize: 17, fontWeight: '900', color: '#000' },
  dayNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  dayName:         { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  dayNameActive:   { color: COLORS.accent },
  daySub:          { fontSize: 13, color: COLORS.textSecondary },
});
