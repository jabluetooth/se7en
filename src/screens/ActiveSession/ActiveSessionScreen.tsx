import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS } from '../../constants';
import { WorkoutSession } from '../../types';

interface Props {
  onFinish: (session: WorkoutSession) => void;
}

export function ActiveSessionScreen({ onFinish }: Props) {
  const { activeSession, sessionTimer, finishSession, skipDay, clearActiveSession } = useSessionStore();
  const { activePlan } = usePlanStore();

  if (!activeSession) return null;

  const mins      = Math.floor(sessionTimer / 60);
  const secs      = sessionTimer % 60;
  const timeStr   = `${mins}:${String(secs).padStart(2, '0')}`;
  const totalSets = activeSession.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = activeSession.exercises.reduce((a, e) => a + e.sets.filter(s => s.isCompleted).length, 0);
  const pct       = totalSets > 0 ? doneSets / totalSets : 0;

  const handleFinish = async () => {
    const session = await finishSession();
    if (session) onFinish(session);
  };

  const handleSkip = async () => {
    await skipDay(
      activeSession.planId,
      activeSession.dayPosition,
      activeSession.dayLabel,
      'Other',
    );
    clearActiveSession();
  };

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
        <View style={[s.orb, { top: -60, right: -50, width: 240, height: 240, backgroundColor: 'rgba(144,53,240,0.10)' }]} />
        <View style={[s.orb, { bottom: 100, left: -60, width: 220, height: 220, backgroundColor: 'rgba(76,170,240,0.07)'  }]} />
      </View>

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerSup}>
              Day {activeSession.dayPosition} · {activePlan?.name ?? ''}
            </Text>
            <Text style={s.headerTitle}>{activeSession.dayLabel}</Text>
          </View>

          <View style={s.headerRight}>
            {/* Live elapsed timer */}
            <GlassView radius={12} style={s.timerBadge}>
              <Text style={s.timerText}>{timeStr}</Text>
            </GlassView>
          </View>
        </View>

        {/* Progress bar */}
        <View style={s.progressWrap}>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={GRAD.progress}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any }]}
            />
          </View>
          <Text style={s.progressLabel}>{doneSets}/{totalSets} sets</Text>
        </View>

        {/* ── Exercise list ──────────────────────────────── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeSession.exercises.map((ex, idx) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              defaultExpanded={idx === 0}
            />
          ))}

          {/* ── Finish / Skip at end of list ───────────── */}
          <View style={s.finishSection}>
            <TouchableOpacity
              style={s.finishBtn}
              onPress={handleFinish}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={GRAD.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.finishGrad}
              >
                <Text style={s.finishTxt}>Finish Workout</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.skipBtn}
              onPress={handleSkip}
              activeOpacity={0.75}
            >
              <GlassView radius={16} style={s.skipInner}>
                <Text style={s.skipTxt}>Skip Day</Text>
              </GlassView>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  safe:          { flex: 1 },
  orb:           { position: 'absolute', borderRadius: 999 },

  header:        {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerLeft:    { flex: 1, marginRight: 12 },
  headerSup:     { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:   { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerRight:   { alignItems: 'flex-end' },

  timerBadge:    { paddingHorizontal: 14, paddingVertical: 8 },
  timerText:     { fontSize: 22, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },

  progressWrap:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 99 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, minWidth: 56, textAlign: 'right' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  finishSection: { marginTop: 24, gap: 10 },
  finishBtn:     { borderRadius: 16, overflow: 'hidden' },
  finishGrad:    { height: 56, alignItems: 'center', justifyContent: 'center' },
  finishTxt:     { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
  skipBtn:       { borderRadius: 16 },
  skipInner:     { height: 50, alignItems: 'center', justifyContent: 'center' },
  skipTxt:       { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});
