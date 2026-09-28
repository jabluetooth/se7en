import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { enterFade, enterSettle } from '../../motion/presets';
import { GRAD, COLORS, FONTS } from '../../constants';
import { SetLog, SessionExercise } from '../../types';
import { usePRStore } from '../../stores/prStore';
import { isSetPR } from '../../utils/prDetection';
import type { LastSet } from '../../utils/exerciseHistory';
import { accentA, ink, themed } from '../../theme/runtime';

interface Props {
  set:             SetLog;
  exercise:        SessionExercise;
  /** What the user did on this set number last time, for the hint chip. */
  lastSet?:        LastSet;
  /** Only the most recently logged set of an exercise can be undone. */
  canUndo?:        boolean;
  onComplete:      (data: Partial<SetLog>) => void;
  onUndo?:         () => void;
  onSetComplete?:  (exerciseName: string, setNumber: number, actualReps: number, actualWeight: number | null, weightUnit: string) => void;
}

/** One tap on +/- moves this much. */
function weightStep(unit: SessionExercise['weightUnit']): number {
  return unit === 'lb' ? 5 : unit === 'plates' ? 1 : 2.5;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ─── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  caption:      string;
  value:        string;
  placeholder:  string;
  step:         number;
  decimal?:     boolean;
  onChange:     (v: string) => void;
  a11yName:     string;
}

function Stepper({ caption, value, placeholder, step, decimal, onChange, a11yName }: StepperProps) {
  const current = () => {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
    const p = parseFloat(placeholder);
    return Number.isFinite(p) ? p : 0;
  };
  const bump = (dir: 1 | -1) => onChange(fmt(Math.max(0, current() + dir * step)));

  return (
    <View style={st.wrap}>
      <Text style={st.caption}>{caption}</Text>
      <View style={st.row}>
        <AnimatedPressable
          scale="strong"
          haptic="selection"
          style={st.btn}
          onPress={() => bump(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${a11yName} by ${fmt(step)}`}
        >
          <Ionicons name="remove" size={18} color={COLORS.textSecondary} />
        </AnimatedPressable>
        <TextInput
          style={st.input}
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          selectTextOnFocus
          accessibilityLabel={a11yName}
        />
        <AnimatedPressable
          scale="strong"
          haptic="selection"
          style={st.btn}
          onPress={() => bump(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${a11yName} by ${fmt(step)}`}
        >
          <Ionicons name="add" size={18} color={COLORS.textSecondary} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ─── SetLogger ────────────────────────────────────────────────────────────────

export function SetLogger({ set, exercise, lastSet, canUndo, onComplete, onUndo, onSetComplete }: Props) {
  const isFailure    = exercise.setType === 'toFailure';
  const isBodyweight = exercise.weightUnit === 'bodyweight';

  const [weight, setWeight] = useState(set.actualWeight != null ? fmt(set.actualWeight) : set.targetWeight != null ? fmt(set.targetWeight) : '');
  const [reps,   setReps]   = useState(() => {
    const logged = isFailure ? set.actualRepsToFailure : set.actualReps;
    return logged ? String(logged) : '';
  });
  const [justPRed, setJustPRed] = useState(false);

  // Placeholders show what a bare tap on ✓ will log: the plan's target, or
  // last time's numbers when the plan has none.
  const repsFallback   = set.targetReps ?? lastSet?.reps ?? null;
  const weightFallback = set.targetWeight ?? lastSet?.weight ?? null;

  const lastLabel = lastSet
    ? (isBodyweight || lastSet.weight == null
        ? `${lastSet.reps} reps`
        : `${fmt(lastSet.weight)} ${exercise.weightUnit} × ${lastSet.reps}`)
    : null;

  const fillFromLast = () => {
    if (!lastSet) return;
    fireHaptic('selection');
    if (!isBodyweight && lastSet.weight != null) setWeight(fmt(lastSet.weight));
    setReps(String(lastSet.reps));
  };

  const handleComplete = () => {
    const actualRepsNum = parseInt(reps, 10) || repsFallback || 0;
    const typedWeight = parseFloat(weight);
    const actualWeightNum = isBodyweight
      ? null
      : Number.isFinite(typedWeight) ? typedWeight : weightFallback ?? 0;

    // Live, best-effort check against the exercise's current PR. The
    // authoritative record is still written by detectPRs() at finishSession();
    // this lets the celebration fire the moment the set is logged.
    const existingPR = usePRStore.getState().getPR(exercise.exerciseId);
    const setPR = isSetPR(actualWeightNum, actualRepsNum, isFailure ? actualRepsNum : null, existingPR);
    setJustPRed(setPR);
    fireHaptic(setPR ? 'success' : 'medium');

    onComplete({
      actualReps:          isFailure ? 0 : actualRepsNum,
      actualRepsToFailure: isFailure ? actualRepsNum : null,
      actualWeight:        actualWeightNum,
    });
    onSetComplete?.(exercise.exerciseName, set.setNumber, actualRepsNum, actualWeightNum, exercise.weightUnit);
  };

  // ── Logged ──────────────────────────────────────────────────────────────────
  if (set.isCompleted) {
    const repsDone = isFailure ? set.actualRepsToFailure : set.actualReps;
    return (
      <Animated.View entering={enterFade} style={[s.doneRow, justPRed && s.doneRowPR]}>
        <Animated.View entering={enterSettle}>
          <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doneCheck}>
            <Ionicons name="checkmark" size={15} color={COLORS.onAccent} />
          </LinearGradient>
        </Animated.View>
        <Text style={s.doneLabel}>Set {set.setNumber}</Text>
        <Text style={s.doneVal} numberOfLines={1}>
          {isBodyweight || set.actualWeight == null
            ? `${repsDone ?? 0} reps`
            : `${fmt(set.actualWeight)} ${exercise.weightUnit} × ${repsDone ?? 0}`}
        </Text>
        {justPRed && (
          <Animated.View
            entering={enterSettle}
            style={s.prBadge}
          >
            <Ionicons name="trophy" size={11} color={COLORS.onAccent} />
            <Text style={s.prBadgeTxt}>PR</Text>
          </Animated.View>
        )}
        {canUndo && onUndo && (
          <AnimatedPressable
            scale="strong"
            haptic="light"
            style={s.undoBtn}
            onPress={() => { setJustPRed(false); onUndo(); }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Undo set ${set.setNumber}`}
          >
            <Ionicons name="arrow-undo" size={16} color={COLORS.textMuted} />
          </AnimatedPressable>
        )}
      </Animated.View>
    );
  }

  // ── To log ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.row}>
      <View style={s.topLine}>
        <Text style={s.setLabel}>Set {set.setNumber}</Text>
        {lastLabel && (
          <AnimatedPressable
            scale="strong"
            style={s.lastChip}
            onPress={fillFromLast}
            accessibilityRole="button"
            accessibilityLabel={`Last time ${lastLabel}. Tap to use these numbers.`}
          >
            <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
            <Text style={s.lastTxt}>Last {lastLabel}</Text>
          </AnimatedPressable>
        )}
      </View>
      <View style={s.controls}>
        {!isBodyweight && (
          <Stepper
            caption={exercise.weightUnit === 'plates' ? 'Plates' : `Weight · ${exercise.weightUnit}`}
            value={weight}
            placeholder={weightFallback != null ? fmt(weightFallback) : '0'}
            step={weightStep(exercise.weightUnit)}
            decimal
            onChange={setWeight}
            a11yName={`set ${set.setNumber} weight`}
          />
        )}
        <Stepper
          caption={isFailure ? 'Reps to failure' : 'Reps'}
          value={reps}
          placeholder={repsFallback != null ? String(repsFallback) : '0'}
          step={1}
          onChange={setReps}
          a11yName={`set ${set.setNumber} reps`}
        />
        <AnimatedPressable
          onPress={handleComplete}
          style={s.checkWrap}
          accessibilityRole="button"
          accessibilityLabel={`Log set ${set.setNumber}`}
          accessibilityHint="Uses the numbers shown, or the placeholders if you left a field empty"
        >
          <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.checkBtn}>
            <Ionicons name="checkmark" size={24} color={COLORS.onAccent} />
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = themed(() => StyleSheet.create({
  wrap:    { flex: 1, minWidth: 0 },
  caption: { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textLabel, letterSpacing: 0, marginBottom: 5 },
  row:     {
    flexDirection: 'row', alignItems: 'center', height: 48,
    borderRadius: 12, borderWidth: 1, borderColor: ink(0.1), backgroundColor: ink(0.04),
  },
  btn:     { width: 36, height: '100%', alignItems: 'center', justifyContent: 'center' },
  input:   { flex: 1, minWidth: 0, height: '100%', textAlign: 'center', fontSize: 18, fontFamily: FONTS.dataBold, color: COLORS.text, padding: 0 },
}));

const s = themed(() => StyleSheet.create({
  row:       { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ink(0.08) },
  topLine:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 28 },
  setLabel:  { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.accent, letterSpacing: -0.2 },
  lastChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: ink(0.05), borderWidth: 1, borderColor: ink(0.1) },
  lastTxt:   { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  controls:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  checkWrap: { borderRadius: 14 },
  checkBtn:  { width: 52, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  doneRow:   {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingHorizontal: 12, marginVertical: 4, borderRadius: 12,
    backgroundColor: accentA(0.07), borderWidth: 1, borderColor: accentA(0.2),
  },
  doneRowPR: { backgroundColor: accentA(0.14), borderColor: accentA(0.55) },
  doneCheck: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontSize: 13, fontFamily: FONTS.headline, color: COLORS.accent, width: 44 },
  doneVal:   { flex: 1, fontSize: 15, fontFamily: FONTS.dataBold, color: COLORS.text },
  prBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, backgroundColor: COLORS.accent },
  prBadgeTxt:{ fontSize: 11, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: 0.4 },
  undoBtn:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
}));
