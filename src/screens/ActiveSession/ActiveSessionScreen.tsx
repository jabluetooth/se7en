import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlassView } from '../../components/common/GlassView';
import { AppBackground } from '../../components/ui/AppBackground';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS, FONTS } from '../../constants';
import { WorkoutSession } from '../../types';
import { sessionTotalVolume } from '../../utils/volume';
import { RestTimerScreen } from '../RestTimer/RestTimerScreen';

interface Props {
  onFinish: (session: WorkoutSession) => void;
  onBack?:  () => void;
  onClear?: () => void;
}

export function ActiveSessionScreen({ onFinish, onBack, onClear }: Props) {
  const { activeSession, sessionTimer, finishSession, skipDay, clearActiveSession } = useSessionStore();
  const { activePlan } = usePlanStore();
  const insets = useSafeAreaInsets();
  const [isFinishing, setIsFinishing] = useState(false);
  const [restCtx, setRestCtx] = useState<{
    exerciseName:     string;
    setNumber:        number;
    actualReps:       number;
    actualWeight:     number | null;
    weightUnit:       string;
    nextExerciseName: string | null;
    initialSecs:      number;
  } | null>(null);

  if (!activeSession) return null;

  const mins      = Math.floor(sessionTimer / 60);
  const secs      = sessionTimer % 60;
  // Past 60 min, switch to `h:mm hr` (e.g. 80 min → 1:20hr). Under an hour
  // keeps the second-precision `m:ss` so short sessions still tick visibly.
  const timeStr   = mins >= 60
    ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}hr`
    : `${mins}:${String(secs).padStart(2, '0')}`;
  const totalSets = activeSession.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = activeSession.exercises.reduce((a, e) => a + e.sets.filter(s => s.isCompleted).length, 0);
  const pct       = totalSets > 0 ? doneSets / totalSets : 0;
  const volume      = Math.round(sessionTotalVolume(activeSession.exercises));
  const activeExIdx = activeSession.exercises.findIndex(ex => !ex.isCompleted);

  // Volume unit derived from the session's exercises. `bodyweight` contributes
  // reps (per utils/volume.ts), so display it as "reps". Mixed units fall back
  // to "mixed" so the figure isn't mislabelled.
  const volumeUnit = (() => {
    const units = [...new Set(activeSession.exercises.map(e => e.weightUnit))];
    if (units.length === 0) return 'kg';
    if (units.length > 1)  return 'mixed';
    return units[0] === 'bodyweight' ? 'reps' : units[0];
  })();

  const handleFinish = async () => {
    // Guard against a second tap re-entering finishSession while the first
    // call's Firestore round-trip is still in flight — that could append a
    // duplicate finished session and re-fire PR notifications.
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const session = await finishSession();
      if (session) onFinish(session);
    } finally {
      setIsFinishing(false);
    }
  };

  const doSkip = async () => {
    await skipDay(
      activeSession.planId,
      activeSession.dayPosition,
      activeSession.dayLabel,
      'Other',
    );
    onClear?.();       // close the modal before clearing so there is no blank flash
    clearActiveSession();
  };

  const handleSkip = () => {
    Alert.alert(
      `Skip ${activeSession.dayLabel}?`,
      doneSets > 0
        ? `You've logged ${doneSets} set${doneSets === 1 ? '' : 's'} — skipping discards this in-progress session instead of finishing it.`
        : 'This discards the in-progress session instead of finishing it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip Day', style: 'destructive', onPress: doSkip },
      ],
    );
  };

  return (
    <View style={s.root}>
      <AppBackground />

      <Modal
        visible={!!restCtx}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
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
            initialSecs={restCtx.initialSecs}
            onClose={() => setRestCtx(null)}
          />
        )}
      </Modal>

      <View style={[s.safe, { paddingTop: insets.top }]}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          {onBack && (
            <TouchableOpacity
              style={s.backBtn}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Text style={s.backIcon}>‹</Text>
              <Text style={s.backTxt}>Home</Text>
            </TouchableOpacity>
          )}
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
            <Text style={s.statLabel}>Volume ({volumeUnit})</Text>
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
              defaultExpanded={idx === activeExIdx}
              isActive={idx === activeExIdx}
              onSetComplete={(name, num, reps, weight, unit) => {
                const curIdx  = activeSession.exercises.findIndex(e => e.exerciseName === name);
                const curEx   = activeSession.exercises[curIdx];
                const isLast  = curEx ? num >= curEx.sets.length : false;
                const nextEx  = isLast ? activeSession.exercises[curIdx + 1] : null;
                // Resolve per-exercise rest timer from plan (falls back to 90s app default)
                const planEx  = activePlan?.days.flatMap(d => d.exercises).find(e => e.id === curEx?.exerciseId);
                const initSecs = planEx?.restTimerSecs ?? 90;
                setRestCtx({
                  exerciseName:     name,
                  setNumber:        num,
                  actualReps:       reps,
                  actualWeight:     weight,
                  weightUnit:       unit,
                  nextExerciseName: nextEx?.exerciseName ?? null,
                  initialSecs:      initSecs,
                });
              }}
            />
          ))}

          {/* ── Finish / Skip at end of list ───────────── */}
          <View style={s.finishSection}>
            <TouchableOpacity
              style={[s.finishBtn, isFinishing && { opacity: 0.6 }]}
              onPress={handleFinish}
              disabled={isFinishing}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Finish Workout"
              accessibilityState={{ disabled: isFinishing, busy: isFinishing }}
            >
              <LinearGradient
                colors={GRAD.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.finishGrad}
              >
                <Text style={s.finishTxt}>{isFinishing ? 'Finishing…' : 'Finish Workout'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.skipBtn}
              onPress={handleSkip}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Skip Day"
            >
              <GlassView radius={16} style={s.skipInner}>
                <Text style={s.skipTxt}>Skip Day</Text>
              </GlassView>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  safe:          { flex: 1 },

  header:        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, zIndex: 10 },
  backBtn:       { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 10, alignSelf: 'flex-start' },
  backIcon:      { fontSize: 22, color: COLORS.textMuted, lineHeight: 24 },
  backTxt:       { fontSize: 13, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textMuted },
  headerSup:     { fontSize: 12, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.96, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle:   { fontSize: 30, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -1.20, lineHeight: 33 },

  statsRow:      { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  statChip:      { flex: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', gap: 2 },
  statValue:     { fontSize: 17, fontWeight: '800', fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -0.68, fontVariant: ['tabular-nums'] },
  statValueAccent: { fontSize: 17, fontWeight: '800', fontFamily: FONTS.data, color: COLORS.accent, letterSpacing: -0.68, fontVariant: ['tabular-nums'] },
  statLabel:     { fontSize: 10, fontWeight: '600', fontFamily: FONTS.label, color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.80 },
  timerInner:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  glowDot:       { width: 7, height: 7, borderRadius: 99, backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4 },

  progressCard:      { marginHorizontal: 20, marginBottom: 12, padding: 14 },
  progressHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressSetsLabel: { fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textMuted },
  progressPct:       { fontSize: 12, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent, fontVariant: ['tabular-nums'] },
  progressTrack:     { height: 3, borderRadius: 99, backgroundColor: 'rgba(255,240,220,0.08)', overflow: 'hidden' },
  progressFill:      { height: '100%', borderRadius: 99 },
  divider:           { height: 1, backgroundColor: 'rgba(255,240,220,0.07)', marginTop: 12, marginBottom: 8 },
  exRow:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  exName:            { flex: 1, fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  dotRow:            { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot:               { width: 7, height: 7, borderRadius: 99, backgroundColor: 'rgba(255,240,220,0.15)' },
  dotDone:           { backgroundColor: COLORS.accent },
  exCount:           { fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textLabel, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
  exCountDone:       { color: COLORS.accent },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  finishSection: { marginTop: 24, gap: 10 },
  finishBtn:     { borderRadius: 16, overflow: 'hidden' },
  finishGrad:    { height: 56, alignItems: 'center', justifyContent: 'center' },
  finishTxt:     { fontSize: 16, fontWeight: '800', fontFamily: FONTS.display, color: '#000', letterSpacing: -0.64 },
  skipBtn:       { borderRadius: 16 },
  skipInner:     { height: 50, alignItems: 'center', justifyContent: 'center' },
  skipTxt:       { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
