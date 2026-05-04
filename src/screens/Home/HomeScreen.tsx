import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { Button } from '../../components/common/Button';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, SPACING } from '../../constants';

const QUOTES = [
  'The pain you feel today is the strength you feel tomorrow.',
  'Discipline: doing it even when you do not feel like it.',
  'Every rep is a vote for who you are becoming.',
  'Show up. That is already more than most.',
  'Progress, not perfection.',
];

interface Props { onFinish: () => void; }

export function HomeScreen({ onFinish }: Props) {
  const { activePlan } = usePlanStore();
  const { activeSession, startSession, finishSession, skipDay, sessionTimer } = useSessionStore();
  const { settings } = useSettingsStore();
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const currentDay = activePlan?.days.find(d => d.dayPosition === settings.currentDayPosition);
  const isRest     = currentDay?.isRestDay ?? false;
  const totalSets  = activeSession ? activeSession.exercises.reduce((a, e) => a + e.sets.length, 0) : 0;
  const doneSets   = activeSession ? activeSession.exercises.reduce((a, e) => a + e.sets.filter(s => s.isCompleted).length, 0) : 0;
  const pct        = totalSets > 0 ? doneSets / totalSets : 0;
  const mins       = Math.floor(sessionTimer / 60);
  const secs       = sessionTimer % 60;
  const timeStr    = mins + ':' + String(secs).padStart(2, '0');
  const volume     = activeSession
    ? activeSession.exercises.reduce((a, e) =>
        a + e.sets.filter(s => s.isCompleted).reduce((b, s) => b + (s.actualWeight ?? 0) * (s.actualReps || 1), 0), 0)
    : 0;
  const volumeStr = volume >= 1000 ? (volume / 1000).toFixed(1) + 'k' : String(volume);

  const handleStartSession = () => {
    if (!activePlan || !currentDay) return;
    startSession(activePlan.id, currentDay);
  };

  const handleSkip = () => {
    if (!activePlan || !currentDay) return;
    skipDay(activePlan.id, currentDay.dayPosition, currentDay.label, 'Other');
  };

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />
        <Text style={s.emptyTitle}>No plan active</Text>
        <Text style={s.emptySub}>Set up a plan in Settings to get started.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.orb, { top: -100, right: -80, width: 300, height: 300, backgroundColor: 'rgba(144,53,240,0.12)' }]} />
        <View style={[s.orb, { bottom: 120, left: -80, width: 260, height: 260, backgroundColor: 'rgba(123,94,250,0.10)' }]} />
        <View style={[s.orb, { top: 300, right: -50, width: 200, height: 200, backgroundColor: 'rgba(76,170,240,0.08)' }]} />
      </View>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.quotePad}>
          <GlassView opacity="mid" radius={999} style={s.quoteRow}>
            <Text style={s.quoteGlyph}>*</Text>
            <Text style={s.quoteText} numberOfLines={1}>{QUOTES[quoteIdx]}</Text>
            <View style={s.quoteDots}>
              {QUOTES.map((_, i) => <View key={i} style={[s.dot, i === quoteIdx && s.dotActive]} />)}
            </View>
          </GlassView>
        </View>
        <View style={s.header}>
          <View>
            <Text style={s.dayCycle}>Day {settings.currentDayPosition}</Text>
            <Text style={s.title}>{currentDay?.label ?? 'Rest Day'}</Text>
          </View>
          <GlassView radius={14} style={s.logoBadge} glow>
            <Text style={s.logoNum}>7</Text>
          </GlassView>
        </View>
        {activeSession ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.statsRow}>
              {[
                { label: 'Sets Done', value: doneSets + '/' + totalSets, accent: true  },
                { label: 'Timer',     value: timeStr,                     accent: false },
                { label: 'Volume',    value: volumeStr + ' kg',           accent: false },
              ].map((stat, i) => (
                <GlassView key={i} radius={16} style={s.statCard}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={[s.statValue, stat.accent && s.statAccent]}>{stat.value}</Text>
                </GlassView>
              ))}
            </View>
            <GlassView radius={16} style={s.progressCard}>
              <View style={s.progressHeader}>
                <Text style={s.progressLbl}>Session Progress</Text>
                <Text style={s.progressPct}>{Math.round(pct * 100)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <LinearGradient colors={GRAD.progress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: pct * 100 + '%' as any }]} />
              </View>
              <View style={s.pills}>
                {activeSession.exercises.map((ex, i) => {
                  const d = ex.sets.filter(s => s.isCompleted).length;
                  const a = d === ex.sets.length;
                  return (
                    <View key={i} style={[s.pill, a && s.pillDone]}>
                      <View style={[s.pillDot, a && s.pillDotDone]} />
                      <Text style={[s.pillText, a && s.pillTextDone]}>{ex.exerciseName.split(' ')[0]}</Text>
                      <Text style={s.pillCount}>{d}/{ex.sets.length}</Text>
                    </View>
                  );
                })}
              </View>
            </GlassView>
            {activeSession.exercises.map(ex => <ExerciseCard key={ex.id} exercise={ex} />)}
            <View style={{ height: 140 }} />
          </ScrollView>
        ) : (
          <View style={s.startWrap}>
            {isRest ? (
              <Text style={s.restMsg}>Recovery Day. Your muscles grow during rest.</Text>
            ) : (
              <>
                <Text style={s.workoutMeta}>{currentDay?.exercises.length ?? 0} exercises planned</Text>
                <Button label="Start Workout" onPress={handleStartSession} size="lg" />
              </>
            )}
          </View>
        )}
        {activeSession && (
          <View style={s.cta}>
            <TouchableOpacity style={s.ctaBtn} onPress={async () => { await finishSession(); onFinish(); }} activeOpacity={0.9}>
              <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaGrad}>
                <Text style={s.ctaText}>Finish Workout</Text>
              </LinearGradient>
            </TouchableOpacity>
            <GlassView radius={16} style={s.skipBtn}>
              <TouchableOpacity onPress={handleSkip} style={s.skipInner}>
                <Text style={s.skipText}>Skip</Text>
              </TouchableOpacity>
            </GlassView>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:     { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:       { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  orb:            { position: 'absolute', borderRadius: 999 },
  quotePad:       { paddingHorizontal: 16, paddingBottom: 8 },
  quoteRow:       { paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quoteGlyph:     { fontSize: 13, color: COLORS.accent },
  quoteText:      { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' },
  quoteDots:      { flexDirection: 'row', gap: 3 },
  dot:            { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)' },
  dotActive:      { width: 12, backgroundColor: COLORS.accent },
  header:         { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayCycle:       { fontSize: 12, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 },
  title:          { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  logoBadge:      { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', padding: 0 },
  logoNum:        { fontSize: 24, fontWeight: '900', color: COLORS.accent },
  scroll:         { paddingHorizontal: 16 },
  statsRow:       { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard:       { flex: 1, padding: 12 },
  statLabel:      { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  statValue:      { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  statAccent:     { color: COLORS.accent },
  progressCard:   { padding: 16, marginBottom: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLbl:    { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  progressPct:    { fontSize: 16, fontWeight: '900', color: COLORS.accent },
  progressTrack:  { height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 },
  progressFill:   { height: '100%', borderRadius: 99 },
  pills:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  pillDone:       { backgroundColor: 'rgba(123,94,250,0.15)', borderColor: 'rgba(123,94,250,0.35)' },
  pillDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textMuted },
  pillDotDone:    { backgroundColor: COLORS.accent },
  pillText:       { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  pillTextDone:   { color: COLORS.accent },
  pillCount:      { fontSize: 10, color: COLORS.textMuted },
  startWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  restMsg:        { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  workoutMeta:    { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  cta:            { position: 'absolute', bottom: 96, left: 16, right: 16, flexDirection: 'row', gap: 10 },
  ctaBtn:         { flex: 1, borderRadius: 16, overflow: 'hidden' },
  ctaGrad:        { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  ctaText:        { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: -0.2 },
  skipBtn:        { borderRadius: 16 },
  skipInner:      { height: 54, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  skipText:       { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
});
