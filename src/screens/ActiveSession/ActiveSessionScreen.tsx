import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { AppBackground } from '../../components/ui/AppBackground';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS } from '../../constants';
import { WorkoutSession } from '../../types';
import { sessionTotalVolume } from '../../utils/volume';
import { RestTimerScreen } from '../RestTimer/RestTimerScreen';

interface Props {
  onFinish: (session: WorkoutSession) => void;
}

export function ActiveSessionScreen({ onFinish }: Props) {
  const { activeSession, sessionTimer, finishSession, skipDay, clearActiveSession } = useSessionStore();
  const { activePlan } = usePlanStore();
  const [restCtx, setRestCtx] = useState<{
    exerciseName:     string;
    setNumber:        number;
    actualReps:       number;
    actualWeight:     number | null;
    weightUnit:       string;
    nextExerciseName: string | null;
  } | null>(null);

  if (!activeSession) return null;

  const mins      = Math.floor(sessionTimer / 60);
  const secs      = sessionTimer % 60;
  const timeStr   = `${mins}:${String(secs).padStart(2, '0')}`;
  const totalSets = activeSession.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = activeSession.exercises.reduce((a, e) => a + e.sets.filter(s => s.isCompleted).length, 0);
  const pct       = totalSets > 0 ? doneSets / totalSets : 0;
  const volume    = Math.round(sessionTotalVolume(activeSession.exercises));

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
      <AppBackground />

      <Modal
        visible={!!restCtx}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setRestCtx(null)}
      >
        {restCtx && (
          <RestTimerScreen
            exerciseName={restCtx.exerciseName}
            setNumber={restCtx.setNumber}
            actualReps={restCtx.actualReps}
            actualWeight={restCtx.actualWeight}
            weightUnit={restCtx.weightUnit}
            nextExerciseName={restCtx.nextExerciseName}
            onClose={() => setRestCtx(null)}
          />
        )}
      </Modal>

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerSup}>
            Day {activeSession.dayPosition} · {activePlan?.name ?? ''}
          </Text>
          <Text style={s.headerTitle}>{activeSession.dayLabel}</Text>
        </View>

        {/* ── Stats row ──────────────────────────────────── */}
        <View style={s.statsRow}>
          <GlassView radius={12} style={s.statChip}>
            <Text style={s.statValue}>{doneSets}/{totalSets}</Text>
            <Text style={s.statLabel}>Sets Done</Text>
          </GlassView>

          <GlassView radius={12} style={s.statChip}>
            <View style={s.timerInner}>
              <View style={s.glowDot} />
              <Text style={s.statValueAccent}>{timeStr}</Text>
            </View>
            <Text style={s.statLabel}>in progress</Text>
          </GlassView>

          <GlassView radius={12} style={s.statChip}>
            <Text style={s.statValue}>{volume}</Text>
            <Text style={s.statLabel}>Volume (kg)</Text>
          </GlassView>
        </View>

        {/* ── Session progress card ───────────────────────── */}
        <GlassView radius={16} style={s.progressCard}>
          <View style={s.progressHeader}>
            <Text style={s.progressSetsLabel}>{doneSets} / {totalSets} sets</Text>
            <Text style={s.progressPct}>{Math.round(pct * 100)}%</Text>
          </View>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={GRAD.progress}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any }]}
            />
          </View>

          <View style={s.divider} />

          {activeSession.exercises.map(ex => {
            const exDone = ex.sets.filter(st => st.isCompleted).length;
            return (
              <View key={ex.id} style={s.exRow}>
                <Text style={s.exName} numberOfLines={1}>{ex.exerciseName}</Text>
                <View style={s.dotRow}>
                  {ex.sets.map(st => (
                    <View key={st.id} style={[s.dot, st.isCompleted && s.dotDone]} />
                  ))}
                </View>
                <Text style={[s.exCount, exDone === ex.sets.length && s.exCountDone]}>
                  {exDone}/{ex.sets.length}
                </Text>
              </View>
            );
          })}
        </GlassView>

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
              onSetComplete={(name, num, reps, weight, unit) => {
                const curIdx = activeSession.exercises.findIndex(e => e.exerciseName === name);
                const curEx  = activeSession.exercises[curIdx];
                const isLast = curEx ? num >= curEx.sets.length : false;
                const nextEx = isLast ? activeSession.exercises[curIdx + 1] : null;
                setRestCtx({
                  exerciseName:     name,
                  setNumber:        num,
                  actualReps:       reps,
                  actualWeight:     weight,
                  weightUnit:       unit,
                  nextExerciseName: nextEx?.exerciseName ?? null,
                });
              }}
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

  header:        { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  headerSup:     { fontSize: 12, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle:   { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.9, lineHeight: 33 },

  statsRow:      { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  statChip:      { flex: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', gap: 2 },
  statValue:     { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statValueAccent: { fontSize: 17, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statLabel:     { fontSize: 10, fontWeight: '600', color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.4 },
  timerInner:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  glowDot:       { width: 7, height: 7, borderRadius: 99, backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4 },

  progressCard:      { marginHorizontal: 20, marginBottom: 12, padding: 14 },
  progressHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressSetsLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  progressPct:       { fontSize: 12, fontWeight: '700', color: COLORS.accent, fontVariant: ['tabular-nums'] },
  progressTrack:     { height: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill:      { height: '100%', borderRadius: 99 },
  divider:           { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 12, marginBottom: 8 },
  exRow:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  exName:            { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  dotRow:            { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot:               { width: 7, height: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotDone:           { backgroundColor: COLORS.accent },
  exCount:           { fontSize: 11, fontWeight: '700', color: COLORS.textLabel, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
  exCountDone:       { color: COLORS.accent },

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
