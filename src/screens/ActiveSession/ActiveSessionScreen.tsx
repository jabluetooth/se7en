import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { useFeedback } from '../../components/feedback/Feedback';
import { AppBackground } from '../../components/ui/AppBackground';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS, FONTS } from '../../constants';
import { WorkoutSession } from '../../types';
import { sessionTotalVolume } from '../../utils/volume';
import { RestTimerBar, type RestContext } from './RestTimerBar';

interface Props {
  onFinish: (session: WorkoutSession) => void;
  onBack?:  () => void;
  onClear?: () => void;
}

const FOOTER_H = 76;

export function ActiveSessionScreen({ onFinish, onBack, onClear }: Props) {
  const { activeSession, sessionTimer, finishSession, skipDay, clearActiveSession } = useSessionStore();
  const { activePlan } = usePlanStore();
  const { confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  const [isFinishing, setIsFinishing] = useState(false);
  const [rest, setRest] = useState<RestContext | null>(null);
  const restSeq = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef(new Map<string, number>());

  const totalSets = activeSession?.exercises.reduce((a, e) => a + e.sets.length, 0) ?? 0;
  const doneSets  = activeSession?.exercises.reduce((a, e) => a + e.sets.filter(st => st.isCompleted).length, 0) ?? 0;
  const pct       = totalSets > 0 ? doneSets / totalSets : 0;
  const allDone   = totalSets > 0 && doneSets === totalSets;

  // Footer progress bar fills smoothly. When the last set is logged, the
  // Finish button fills in with the accent colour and a haptic confirms it.
  const fill = useSharedValue(pct);
  useEffect(() => { fill.value = withTiming(pct, TIMING.emphasis); }, [pct]);
  useEffect(() => { if (allDone) fireHaptic('success'); }, [allDone]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (!activeSession) return null;

  const mins    = Math.floor(sessionTimer / 60);
  const secs    = sessionTimer % 60;
  const timeStr = mins >= 60
    ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}h`
    : `${mins}:${String(secs).padStart(2, '0')}`;

  const volume      = Math.round(sessionTotalVolume(activeSession.exercises));
  const activeExIdx = activeSession.exercises.findIndex(ex => !ex.isCompleted);
  const volumeUnit = (() => {
    const units = [...new Set(activeSession.exercises.map(e => e.weightUnit))];
    if (units.length === 0) return 'kg';
    if (units.length > 1)  return 'mixed';
    return units[0] === 'bodyweight' ? 'reps' : units[0];
  })();

  const handleSetComplete = (name: string, num: number) => {
    const exercises = activeSession.exercises;
    const curIdx = exercises.findIndex(e => e.exerciseName === name);
    const curEx  = exercises[curIdx];
    if (!curEx) return;
    const moreSets = num < curEx.sets.length;
    const nextEx   = exercises.slice(curIdx + 1).find(e => !e.isCompleted);
    const nextLabel = moreSets
      ? `Up next: set ${num + 1} · ${curEx.exerciseName}`
      : nextEx
      ? `Up next: ${nextEx.exerciseName}`
      : 'Last set done. Finish when you are ready.';
    // Resolve the per-exercise rest length from the plan (90 s app default).
    const planEx = activePlan?.days.flatMap(d => d.exercises).find(e => e.id === curEx.exerciseId);
    setRest({
      id: ++restSeq.current,
      exerciseName: moreSets ? curEx.exerciseName : nextEx?.exerciseName ?? curEx.exerciseName,
      nextSetNumber: moreSets ? num + 1 : 1,
      nextLabel,
      seconds: planEx?.restTimerSecs ?? 90,
    });
  };

  // After an exercise is wrapped up, bring the next unfinished one into view.
  const advanceFrom = (exerciseId: string) => {
    const exercises = activeSession.exercises;
    const from = exercises.findIndex(e => e.id === exerciseId);
    const next = exercises.slice(from + 1).find(e => !e.isCompleted) ?? exercises.find(e => !e.isCompleted);
    if (!next) return;
    const y = cardY.current.get(next.id);
    if (y != null) setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 260);
  };

  const handleFinish = async () => {
    // Guard against a second tap re-entering finishSession while the first is
    // in flight: that could append a duplicate session and re-fire PR alerts.
    if (isFinishing) return;
    if (!allDone) {
      const left = totalSets - doneSets;
      const ok = await confirm({
        title: 'Finish early?',
        message: `${left} set${left === 1 ? ' is' : 's are'} not logged yet. They won't count toward this workout.`,
        confirmLabel: 'Finish workout',
        cancelLabel: 'Keep going',
      });
      if (!ok) return;
    }
    setIsFinishing(true);
    setRest(null);
    try {
      fireHaptic('success');
      const session = await finishSession();
      if (session) onFinish(session);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleSkip = async () => {
    const ok = await confirm({
      title: `Skip ${activeSession.dayLabel}?`,
      message: doneSets > 0
        ? `You've logged ${doneSets} set${doneSets === 1 ? '' : 's'}. Skipping throws this session away instead of saving it.`
        : 'This ends the session without saving it.',
      confirmLabel: 'Skip day',
      cancelLabel: 'Keep training',
      destructive: true,
    });
    if (!ok) return;
    await skipDay(activeSession.planId, activeSession.dayPosition, activeSession.dayLabel, 'Other');
    onClear?.();       // close the modal before clearing so there is no blank flash
    clearActiveSession();
  };

  const footerBottom = insets.bottom + 10;

  return (
    <View style={s.root}>
      <AppBackground />

      <View style={[s.safe, { paddingTop: insets.top }]}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            {onBack ? (
              <AnimatedPressable
                scale="strong"
                style={s.headerBtn}
                onPress={onBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back to Home. Your workout keeps running."
              >
                <Ionicons name="chevron-down" size={22} color={COLORS.textSecondary} />
              </AnimatedPressable>
            ) : <View style={s.headerBtn} />}
            <AnimatedPressable
              scale="strong"
              style={s.skipBtn}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip this workout day"
            >
              <Text style={s.skipTxt}>Skip day</Text>
            </AnimatedPressable>
          </View>
          <Text style={s.headerSup}>Day {activeSession.dayPosition} · {activePlan?.name ?? ''}</Text>
          <Text style={s.headerTitle}>{activeSession.dayLabel}</Text>
        </View>

        {/* ── Stats row ──────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statBlock}>
            <Text style={s.statValue}>{doneSets}/{totalSets}</Text>
            <Text style={s.statLabel}>Sets</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBlock}>
            <View style={s.timerInner}>
              <View style={s.liveDot} />
              <Text style={s.statValueAccent}>{timeStr}</Text>
            </View>
            <Text style={s.statLabel}>Time</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBlock}>
            <Text style={s.statValue}>{volume.toLocaleString()}</Text>
            <Text style={s.statLabel}>Volume ({volumeUnit})</Text>
          </View>
        </View>

        {/* ── Exercises ──────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: FOOTER_H + footerBottom + (rest ? 110 : 20) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {activeSession.exercises.map((ex, idx) => (
            <View key={ex.id} onLayout={e => cardY.current.set(ex.id, e.nativeEvent.layout.y)}>
              <ExerciseCard
                exercise={ex}
                defaultExpanded={idx === activeExIdx}
                isActive={idx === activeExIdx}
                onSetComplete={handleSetComplete}
                onAdvance={() => advanceFrom(ex.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      {rest && (
        <RestTimerBar
          key="rest"
          ctx={rest}
          bottom={footerBottom + FOOTER_H + 8}
          onDismiss={() => setRest(null)}
        />
      )}

      {/* ── Sticky footer ────────────────────────────────── */}
      <View style={[s.footer, { paddingBottom: footerBottom }]}>
        <View style={s.track}>
          <Animated.View style={[s.trackFill, fillStyle]}>
            <LinearGradient colors={GRAD.progress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <View>
          <AnimatedPressable
            scale="subtle"
            style={[s.finishBtn, !allDone && s.finishBtnQuiet, isFinishing && { opacity: 0.6 }]}
            onPress={handleFinish}
            disabled={isFinishing}
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            accessibilityState={{ disabled: isFinishing, busy: isFinishing }}
          >
            <Text style={[s.finishTxt, !allDone && s.finishTxtQuiet]}>
              {isFinishing ? 'Finishing…' : allDone ? 'Finish workout' : `Finish workout · ${doneSets}/${totalSets} sets`}
            </Text>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  safe:          { flex: 1 },
  header:        { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  headerTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  headerBtn:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  skipBtn:       { height: 36, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,240,220,0.14)' },
  skipTxt:       { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  headerSup:     { fontSize: 12, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.96, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle:   { fontSize: 30, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1.2, lineHeight: 34 },
  statsRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  statBlock:     { flex: 1, alignItems: 'center', gap: 3 },
  statDivider:   { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: 'rgba(255,240,220,0.14)' },
  statValue:     { fontSize: 21, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statValueAccent: { fontSize: 21, fontFamily: FONTS.data, color: COLORS.accent, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statLabel:     { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.8 },
  timerInner:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 2 },
  footer:        {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10, gap: 10,
    backgroundColor: 'rgba(12,10,8,0.94)', borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)',
  },
  track:         { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,220,0.08)', overflow: 'hidden' },
  trackFill:     { height: '100%', borderRadius: 2, overflow: 'hidden' },
  finishBtn:     { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  finishBtnQuiet:{ backgroundColor: 'rgba(255,140,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)' },
  finishTxt:     { fontSize: 16, fontFamily: FONTS.display, color: '#000', letterSpacing: -0.4 },
  finishTxtQuiet:{ color: COLORS.accent },
});
