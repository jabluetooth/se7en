import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { enterFade } from '../../motion/presets';
import { useFeedback } from '../../components/feedback/Feedback';
import { AppBackground } from '../../components/ui/AppBackground';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { usePRStore } from '../../stores/prStore';
import { COLORS, FONTS } from '../../constants';
import type { SessionExercise, SetLog, WorkoutSession } from '../../types';
import { isSetPR } from '../../utils/prDetection';
import { lastPerformance } from '../../utils/exerciseHistory';
import { findExercise } from '../../data/exercises';
import { RestPanel, type RestContext } from './RestPanel';
import { ExerciseFocus, fmtNum, type Draft } from './ExerciseFocus';
import { themed } from '../../theme/runtime';

interface Props {
  onFinish: (session: WorkoutSession) => void;
  onBack?:  () => void;
  onClear?: () => void;
}

const DEFAULT_REST_S = 90;

/**
 * The workout, one exercise at a time. Swipe (or tap a segment of the
 * progress bar) to move between exercises. The bottom panel holds the one
 * thing to do next: log the set, rest, move on, or finish.
 */
export function ActiveSessionScreen({ onFinish, onBack, onClear }: Props) {
  const {
    activeSession, sessionTimer, sessions, finishSession, skipDay, clearActiveSession,
    completeSet, uncompleteSet, addSet, removeLastSet, setExerciseRPE,
  } = useSessionStore();
  const { activePlan } = usePlanStore();
  const { confirm, actions } = useFeedback();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const exercises = activeSession?.exercises ?? [];
  const firstOpen = Math.max(0, exercises.findIndex(e => e.sets.some(st => !st.isCompleted)));

  const [page, setPage] = useState(firstOpen);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [prSetIds, setPrSetIds] = useState<ReadonlySet<string>>(new Set());
  const [rated, setRated] = useState<ReadonlySet<string>>(new Set());
  const [rest, setRest] = useState<RestContext | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const restSeq = useRef(0);
  const pagerRef = useRef<ScrollView>(null);

  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = exercises.reduce((a, e) => a + e.sets.filter(st => st.isCompleted).length, 0);
  const allDone   = totalSets > 0 && doneSets === totalSets;
  useEffect(() => { if (allDone) fireHaptic('success'); }, [allDone]);

  const planExercises = useMemo(() => activePlan?.days.flatMap(d => d.exercises) ?? [], [activePlan]);
  const planExOf = (ex: SessionExercise) => planExercises.find(e => e.id === ex.exerciseId);

  const lastByExercise = useMemo(() => {
    const m = new Map<string, ReturnType<typeof lastPerformance>>();
    for (const ex of exercises) m.set(ex.id, lastPerformance(sessions, ex.exerciseId, ex.exerciseName));
    return m;
    // Only needs recomputing when the exercise list itself changes.
  }, [sessions, activeSession?.id, exercises.length]);

  if (!activeSession) return null;

  const ex = exercises[Math.min(page, exercises.length - 1)];
  const currentSet = ex?.sets.find(st => !st.isCompleted) ?? null;

  // ── Drafts: what the current set's steppers show ─────────────────────────
  // The previous set you just logged, else what you did on this set last
  // time, else the plan's target.
  const defaultDraft = (e: SessionExercise, set: SetLog): Draft => {
    const idx = e.sets.findIndex(x => x.id === set.id);
    const prev = idx > 0 ? e.sets[idx - 1] : null;
    const last = lastByExercise.get(e.id)?.[idx];
    const isFailure = e.setType === 'toFailure';
    const prevReps = prev?.isCompleted ? (isFailure ? prev.actualRepsToFailure : prev.actualReps) : null;
    const weight = prev?.isCompleted && prev.actualWeight != null
      ? prev.actualWeight
      : last?.weight ?? set.targetWeight;
    const reps = set.targetReps ?? prevReps ?? last?.reps ?? null;
    return {
      weight: weight != null ? fmtNum(weight) : '',
      reps:   reps != null ? String(reps) : '',
    };
  };
  const draftFor = (e: SessionExercise, set: SetLog) => drafts[set.id] ?? defaultDraft(e, set);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(exercises.length - 1, i));
    setPage(clamped);
    pagerRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  /** Next exercise that still has sets to log, searching forward then wrapping. */
  const nextOpenIndex = (from: number): number => {
    for (let k = 1; k <= exercises.length; k++) {
      const i = (from + k) % exercises.length;
      if (exercises[i].sets.some(st => !st.isCompleted)) return i;
    }
    return -1;
  };

  // ── Logging ──────────────────────────────────────────────────────────────
  const logSet = () => {
    if (!ex || !currentSet) return;
    const d = draftFor(ex, currentSet);
    const isFailure = ex.setType === 'toFailure';
    const isBodyweight = ex.weightUnit === 'bodyweight';
    const reps = parseInt(d.reps, 10);
    if (!Number.isFinite(reps) || reps <= 0) {
      fireHaptic('warning');
      return;
    }
    const typed = parseFloat(d.weight);
    const weight = isBodyweight ? null : Number.isFinite(typed) ? typed : 0;

    // Live, best-effort PR check; the authoritative record is still written by
    // detectPRs() at finishSession().
    const isPR = isSetPR(weight, reps, isFailure ? reps : null, usePRStore.getState().getPR(ex.exerciseId));
    if (isPR) setPrSetIds(prev => new Set(prev).add(currentSet.id));
    fireHaptic(isPR ? 'success' : 'medium');

    completeSet(ex.id, currentSet.id, {
      actualReps:          isFailure ? 0 : reps,
      actualRepsToFailure: isFailure ? reps : null,
      actualWeight:        weight,
    });

    // Rest before whatever comes next, unless this was the very last set.
    const setsLeftHere = ex.sets.filter(st => !st.isCompleted && st.id !== currentSet.id).length;
    const setsLeftAll = totalSets - doneSets - 1;
    const secs = planExOf(ex)?.restTimerSecs ?? DEFAULT_REST_S;
    if (setsLeftAll <= 0 || secs <= 0) { setRest(null); return; }

    const nextIdx = setsLeftHere > 0 ? page : nextOpenIndex(page);
    const nextEx = nextIdx >= 0 ? exercises[nextIdx] : ex;
    const nextSetNo = setsLeftHere > 0 ? currentSet.setNumber + 1 : 1;
    setRest({
      id: ++restSeq.current,
      exerciseName: nextEx.exerciseName,
      nextSetNumber: nextSetNo,
      nextLabel: setsLeftHere > 0 ? `set ${nextSetNo} of ${ex.sets.length}` : nextEx.exerciseName,
      seconds: secs,
    });
  };

  const undoSet = (set: SetLog) => {
    uncompleteSet(ex.id, set.id);
    setPrSetIds(prev => { const n = new Set(prev); n.delete(set.id); return n; });
    setDrafts(prev => ({
      ...prev,
      [set.id]: {
        weight: set.actualWeight != null ? fmtNum(set.actualWeight) : '',
        reps: String((ex.setType === 'toFailure' ? set.actualRepsToFailure : set.actualReps) ?? ''),
      },
    }));
    setRest(null);
  };

  // Rating (or skipping) effort wraps the exercise up and moves on.
  const wrapUp = () => {
    setRated(prev => new Set(prev).add(ex.id));
    const next = nextOpenIndex(page);
    if (next >= 0 && next !== page) setTimeout(() => goTo(next), 220);
  };

  // ── Finish / skip ────────────────────────────────────────────────────────
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
        ? `You've logged ${doneSets} set${doneSets === 1 ? '' : 's'}. Skipping throws this workout away instead of saving it.`
        : 'This ends the workout without saving it.',
      confirmLabel: 'Skip workout',
      cancelLabel: 'Keep training',
      destructive: true,
    });
    if (!ok) return;
    await skipDay(activeSession.planId, activeSession.dayPosition, activeSession.dayLabel, 'Other');
    onClear?.();       // close the modal before clearing so there is no blank flash
    clearActiveSession();
  };

  const openMenu = () => actions({
    title: activeSession.dayLabel,
    options: [
      { label: 'Finish workout', icon: 'flag-outline', onPress: handleFinish },
      { label: 'Skip this workout', icon: 'close-circle-outline', destructive: true, onPress: handleSkip },
    ],
  });

  // ── Clock ────────────────────────────────────────────────────────────────
  const mins = Math.floor(sessionTimer / 60);
  const secs = sessionTimer % 60;
  const timeStr = mins >= 60
    ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`;

  // ── Bottom panel ─────────────────────────────────────────────────────────
  const nextIdx = nextOpenIndex(page);
  const nextEx = nextIdx >= 0 && nextIdx !== page ? exercises[nextIdx] : null;
  const setsLeftHere = ex ? ex.sets.filter(st => !st.isCompleted).length : 0;
  const upNext = currentSet
    ? setsLeftHere > 1
      ? `${setsLeftHere - 1} more set${setsLeftHere - 1 === 1 ? '' : 's'} after this`
      : nextEx ? `Then ${nextEx.exerciseName}` : 'Last set of the workout'
    : null;

  const panel = (() => {
    if (rest) return <RestPanel key={rest.id} ctx={rest} onDismiss={() => setRest(null)} />;
    if (currentSet) {
      return (
        <Animated.View entering={enterFade} style={s.panelCol}>
          {upNext && <Text style={s.upNext} numberOfLines={1}>{upNext}</Text>}
          <AnimatedPressable
            style={s.primary}
            onPress={logSet}
            accessibilityRole="button"
            accessibilityLabel={`Log set ${currentSet.setNumber}`}
          >
            <Ionicons name="checkmark" size={22} color={COLORS.onAccent} />
            <Text style={s.primaryTxt}>Log set {currentSet.setNumber}</Text>
          </AnimatedPressable>
        </Animated.View>
      );
    }
    if (!allDone && nextIdx >= 0) {
      return (
        <Animated.View entering={enterFade} style={s.panelCol}>
          <Text style={s.upNext} numberOfLines={1}>{ex.exerciseName} done</Text>
          <AnimatedPressable
            haptic="light"
            style={s.primary}
            onPress={() => { setRated(prev => new Set(prev).add(ex.id)); goTo(nextIdx); }}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${exercises[nextIdx].exerciseName}`}
          >
            <Text style={s.primaryTxt} numberOfLines={1}>Next · {exercises[nextIdx].exerciseName}</Text>
            <Ionicons name="arrow-forward" size={20} color={COLORS.onAccent} />
          </AnimatedPressable>
        </Animated.View>
      );
    }
    return (
      <Animated.View entering={enterFade} style={s.panelCol}>
        <Text style={s.upNext}>Every set logged</Text>
        <AnimatedPressable
          style={[s.primary, isFinishing && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={isFinishing}
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          accessibilityState={{ busy: isFinishing }}
        >
          <Ionicons name="flag" size={19} color={COLORS.onAccent} />
          <Text style={s.primaryTxt}>{isFinishing ? 'Finishing…' : 'Finish workout'}</Text>
        </AnimatedPressable>
      </Animated.View>
    );
  })();

  return (
    <View style={s.root}>
      <AppBackground />
      <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Top bar ── */}
        <View style={s.topBar}>
          {onBack ? (
            <AnimatedPressable scale="strong" style={s.iconBtn} onPress={onBack} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Minimise. Your workout keeps running.">
              <Ionicons name="chevron-down" size={22} color={COLORS.text} />
            </AnimatedPressable>
          ) : <View style={s.iconBtn} />}
          <View style={s.clock} accessibilityLabel={`Workout time ${timeStr}`}>
            <View style={s.liveDot} />
            <Text style={s.clockTxt}>{timeStr}</Text>
          </View>
          <AnimatedPressable scale="strong" style={s.iconBtn} onPress={openMenu} hitSlop={8}
            accessibilityRole="button" accessibilityLabel="Workout options">
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.text} />
          </AnimatedPressable>
        </View>

        {/* ── Progress, one segment per exercise (tap to jump) ── */}
        <View style={s.segments} accessibilityRole="tablist">
          {exercises.map((e, i) => (
            <Segment
              key={e.id}
              fraction={e.sets.length ? e.sets.filter(st => st.isCompleted).length / e.sets.length : 0}
              active={i === page}
              onPress={() => { fireHaptic('selection'); goTo(i); }}
              label={`${e.exerciseName}, ${e.sets.filter(st => st.isCompleted).length} of ${e.sets.length} sets`}
            />
          ))}
        </View>
        <Text style={s.dayLabel} numberOfLines={1}>{activeSession.dayLabel} · {doneSets} of {totalSets} sets</Text>

        {/* ── Exercises ── */}
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: firstOpen * width, y: 0 }}
          onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyboardShouldPersistTaps="handled"
          style={s.pager}
        >
          {exercises.map((e, i) => {
            const cur = e.sets.find(st => !st.isCompleted) ?? null;
            const planEx = planExOf(e);
            const libEx = findExercise(e.exerciseId);
            const tags = (libEx?.muscleTags ?? planEx?.muscleTags ?? e.muscleTags ?? []).slice(0, 2);
            const target = planEx
              ? planEx.toFailure
                ? `${planEx.targetSets} × failure`
                : planEx.targetRepsMax && planEx.targetRepsMax !== planEx.targetRepsMin
                  ? `${planEx.targetSets} × ${planEx.targetRepsMin}–${planEx.targetRepsMax}`
                  : planEx.targetRepsMin ? `${planEx.targetSets} × ${planEx.targetRepsMin}` : null
              : null;
            const done = e.sets.length > 0 && e.sets.every(st => st.isCompleted);
            return (
              <ExerciseFocus
                key={e.id}
                exercise={e}
                index={i}
                count={exercises.length}
                width={width}
                bottomPad={32}
                muscleTags={tags}
                targetLabel={target}
                lastSets={lastByExercise.get(e.id) ?? []}
                currentSetId={cur?.id ?? null}
                draft={cur ? draftFor(e, cur) : null}
                onDraft={d => cur && setDrafts(prev => ({ ...prev, [cur.id]: d }))}
                prSetIds={prSetIds}
                onUndo={set => { if (i === page) undoSet(set); }}
                onAddSet={() => addSet(e.id)}
                onRemoveSet={() => removeLastSet(e.id)}
                askEffort={done && !rated.has(e.id) && (e.rpe == null || e.rpe === 0)}
                onRate={(rpe, note) => { setExerciseRPE(e.id, rpe, note); if (i === page) wrapUp(); }}
                onSkipRate={() => { if (i === page) wrapUp(); else setRated(prev => new Set(prev).add(e.id)); }}
              />
            );
          })}
        </ScrollView>

        {/* ── The one thing to do next ── */}
        <View style={[s.panel, { paddingBottom: insets.bottom + 12 }]}>
          {panel}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Segment({ fraction, active, onPress, label }: { fraction: number; active: boolean; onPress: () => void; label: string }) {
  const fill = useSharedValue(fraction);
  useEffect(() => { fill.value = withTiming(fraction, TIMING.emphasis); }, [fraction]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <AnimatedPressable
      scale={1}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12 }}
      style={s.segHit}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View style={[s.seg, active && s.segActive]}>
        <Animated.View style={[s.segFill, fillStyle]} />
      </View>
    </AnimatedPressable>
  );
}

const s = themed(() => StyleSheet.create({
  root:      { flex: 1 },
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 6 },
  iconBtn:   { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  clock:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent },
  clockTxt:  { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text, fontVariant: ['tabular-nums'] },

  segments:  { flexDirection: 'row', gap: 5, paddingHorizontal: 20, marginTop: 14 },
  segHit:    { flex: 1, paddingVertical: 4 },
  seg:       { height: 5, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  segActive: { height: 5, backgroundColor: COLORS.textLabel },
  segFill:   { height: '100%', backgroundColor: COLORS.accent },
  dayLabel:  { paddingHorizontal: 20, marginTop: 6, fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textLabel, fontVariant: ['tabular-nums'] },

  pager:     { flex: 1 },

  panel:     {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  panelCol:  { gap: 10 },
  upNext:    { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, textAlign: 'center' },
  primary:   {
    height: 60, borderRadius: 18, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
    backgroundColor: COLORS.accent,
  },
  primaryTxt:{ flexShrink: 1, fontSize: 18, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: -0.2 },
}));
