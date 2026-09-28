import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterFade, enterSettle, layoutSoft } from '../../motion/presets';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { RPEInput } from '../../components/RPEInput/RPEInput';
import { COLORS, FONTS } from '../../constants';
import type { SessionExercise, SetLog } from '../../types';
import type { LastSet } from '../../utils/exerciseHistory';
import { accentA, ink, themed } from '../../theme/runtime';

export interface Draft { weight: string; reps: string }

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** One tap on +/- moves this much. */
export function weightStep(unit: SessionExercise['weightUnit']): number {
  return unit === 'lb' ? 5 : unit === 'plates' ? 1 : 2.5;
}

interface Props {
  exercise:     SessionExercise;
  index:        number;
  count:        number;
  width:        number;
  bottomPad:    number;
  muscleTags:   string[];
  /** e.g. "3 × 8–10", from the plan. */
  targetLabel:  string | null;
  lastSets:     LastSet[];
  currentSetId: string | null;
  draft:        Draft | null;
  onDraft:      (d: Draft) => void;
  prSetIds:     ReadonlySet<string>;
  onUndo:       (set: SetLog) => void;
  onAddSet:     () => void;
  onRemoveSet:  () => void;
  /** Ask for effort once every set is logged and it hasn't been rated or skipped. */
  askEffort:    boolean;
  onRate:       (rpe: number, note: string) => void;
  onSkipRate:   () => void;
}

/**
 * One exercise, full screen: what it is, what you did last time, and its sets
 * as a table. Logged sets are compact rows; the set you're on opens into two
 * big steppers; the rest wait below, dimmed. The Log button itself lives in
 * the screen's bottom panel, within thumb reach.
 */
export function ExerciseFocus(p: Props) {
  const { exercise: ex } = p;
  const isBodyweight = ex.weightUnit === 'bodyweight';
  const isFailure = ex.setType === 'toFailure';
  const unitLabel = ex.weightUnit === 'plates' ? 'Plates' : ex.weightUnit;
  const lastDoneIdx = ex.sets.reduce((acc, st, i) => (st.isCompleted ? i : acc), -1);
  const allDone = ex.sets.length > 0 && ex.sets.every(st => st.isCompleted);
  const [editingEffort, setEditingEffort] = useState(false);

  const lastLine = p.lastSets.length > 0
    ? p.lastSets
        .map(l => (isBodyweight || l.weight == null ? `${l.reps}` : `${fmtNum(l.weight)}×${l.reps}`))
        .join(', ')
    : null;

  const repsOf = (st: SetLog) => (isFailure ? st.actualRepsToFailure : st.actualReps) ?? 0;

  return (
    <ScrollView
      style={{ width: p.width }}
      contentContainerStyle={[s.page, { paddingBottom: p.bottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={s.eyebrow} numberOfLines={1}>
        Exercise {p.index + 1} of {p.count}{p.muscleTags.length ? ` · ${p.muscleTags.join(', ')}` : ''}
      </Text>
      <View style={s.titleRow}>
        <Text style={s.title} accessibilityRole="header">{ex.exerciseName}</Text>
        <SetTypeBadge type={ex.setType} />
      </View>
      {(p.targetLabel || lastLine) && (
        <Text style={s.sub}>
          {p.targetLabel ? `Target ${p.targetLabel}` : ''}
          {p.targetLabel && lastLine ? ' · ' : ''}
          {lastLine ? `Last time ${lastLine}` : ''}
        </Text>
      )}

      {/* ── Sets ── */}
      <View style={s.table}>
        <View style={s.headRow}>
          <Text style={[s.headTxt, s.colSet]}>Set</Text>
          {!isBodyweight && <Text style={[s.headTxt, s.colVal]}>{unitLabel}</Text>}
          <Text style={[s.headTxt, s.colVal]}>{isFailure ? 'Reps to failure' : 'Reps'}</Text>
          <View style={s.colEnd} />
        </View>

        {ex.sets.map((st, i) => {
          if (st.id === p.currentSetId && p.draft) {
            return (
              <Animated.View key={st.id} layout={layoutSoft} entering={enterFade} style={s.current}>
                <Text style={s.currentNum}>{st.setNumber}</Text>
                {!isBodyweight && (
                  <Stepper
                    caption={unitLabel}
                    value={p.draft.weight}
                    step={weightStep(ex.weightUnit)}
                    decimal
                    onChange={w => p.onDraft({ ...p.draft!, weight: w })}
                    a11yName={`set ${st.setNumber} weight`}
                  />
                )}
                <Stepper
                  caption={isFailure ? 'Reps' : 'Reps'}
                  value={p.draft.reps}
                  step={1}
                  onChange={r => p.onDraft({ ...p.draft!, reps: r })}
                  a11yName={`set ${st.setNumber} reps`}
                />
              </Animated.View>
            );
          }

          if (st.isCompleted) {
            const canUndo = i === lastDoneIdx;
            const pr = p.prSetIds.has(st.id);
            return (
              <Animated.View key={st.id} layout={layoutSoft} style={s.row}>
                <Text style={[s.num, s.colSet]}>{st.setNumber}</Text>
                {!isBodyweight && <Text style={[s.val, s.colVal]}>{st.actualWeight != null ? fmtNum(st.actualWeight) : '–'}</Text>}
                <View style={[s.colVal, s.repsCell]}>
                  <Text style={s.val}>{repsOf(st)}</Text>
                  {pr && (
                    <Animated.View entering={enterSettle} style={s.pr}>
                      <Text style={s.prTxt}>PR</Text>
                    </Animated.View>
                  )}
                </View>
                <AnimatedPressable
                  scale="strong"
                  haptic={canUndo ? 'light' : 'none'}
                  disabled={!canUndo}
                  onPress={() => p.onUndo(st)}
                  style={[s.colEnd, s.check]}
                  hitSlop={8}
                  accessibilityRole={canUndo ? 'button' : undefined}
                  accessibilityLabel={canUndo ? `Set ${st.setNumber} logged. Tap to undo.` : `Set ${st.setNumber} logged`}
                >
                  <Animated.View entering={enterSettle} style={s.checkDot}>
                    <Ionicons name={canUndo ? 'arrow-undo' : 'checkmark'} size={canUndo ? 13 : 15} color={COLORS.onAccent} />
                  </Animated.View>
                </AnimatedPressable>
              </Animated.View>
            );
          }

          return (
            <Animated.View key={st.id} layout={layoutSoft} style={s.row}>
              <Text style={[s.num, s.colSet, s.upcoming]}>{st.setNumber}</Text>
              {!isBodyweight && (
                <Text style={[s.val, s.colVal, s.upcoming]}>
                  {st.targetWeight != null ? fmtNum(st.targetWeight) : p.lastSets[i]?.weight != null ? fmtNum(p.lastSets[i].weight!) : '–'}
                </Text>
              )}
              <Text style={[s.val, s.colVal, s.upcoming]}>
                {st.targetReps ?? p.lastSets[i]?.reps ?? '–'}
              </Text>
              <View style={s.colEnd} />
            </Animated.View>
          );
        })}
      </View>

      <View style={s.setBtns}>
        <AnimatedPressable scale="strong" haptic="selection" onPress={p.onAddSet} style={s.textBtn} accessibilityRole="button" accessibilityLabel="Add a set">
          <Ionicons name="add" size={16} color={COLORS.accent} />
          <Text style={s.textBtnTxt}>Add set</Text>
        </AnimatedPressable>
        {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1]?.isCompleted && (
          <AnimatedPressable scale="strong" haptic="selection" onPress={p.onRemoveSet} style={s.textBtn} accessibilityRole="button" accessibilityLabel="Remove the last set">
            <Ionicons name="remove" size={16} color={COLORS.textMuted} />
            <Text style={[s.textBtnTxt, { color: COLORS.textMuted }]}>Remove set</Text>
          </AnimatedPressable>
        )}
      </View>

      {/* ── Effort, once the sets are done ── */}
      {allDone && (p.askEffort || editingEffort) && (
        <Animated.View entering={enterFade}>
          <RPEInput
            initialRpe={editingEffort ? ex.rpe : undefined}
            initialNote={editingEffort ? ex.exerciseNote ?? '' : ''}
            onSave={(rpe, note) => { setEditingEffort(false); p.onRate(rpe, note); }}
            onSkip={editingEffort ? () => setEditingEffort(false) : p.onSkipRate}
          />
        </Animated.View>
      )}
      {allDone && !p.askEffort && !editingEffort && ex.rpe != null && ex.rpe > 0 && (
        <AnimatedPressable scale="subtle" onPress={() => setEditingEffort(true)} style={s.effort} accessibilityRole="button" accessibilityLabel={`Effort RPE ${ex.rpe}. Tap to change.`}>
          <Text style={s.effortTxt}>Effort · RPE {ex.rpe}</Text>
          {ex.exerciseNote ? <Text style={s.effortNote} numberOfLines={1}>{ex.exerciseNote}</Text> : null}
          <Text style={s.effortEdit}>Change</Text>
        </AnimatedPressable>
      )}
    </ScrollView>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  caption:  string;
  value:    string;
  step:     number;
  decimal?: boolean;
  onChange: (v: string) => void;
  a11yName: string;
}

function Stepper({ caption, value, step, decimal, onChange, a11yName }: StepperProps) {
  const current = () => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };
  const bump = (dir: 1 | -1) => onChange(fmtNum(Math.max(0, current() + dir * step)));

  return (
    <View style={st.wrap}>
      <Text style={st.caption}>{caption}</Text>
      <View style={st.row}>
        <AnimatedPressable scale="strong" haptic="selection" style={st.btn} onPress={() => bump(-1)}
          accessibilityRole="button" accessibilityLabel={`Decrease ${a11yName} by ${fmtNum(step)}`}>
          <Ionicons name="remove" size={22} color={COLORS.text} />
        </AnimatedPressable>
        <TextInput
          style={st.input}
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder="0"
          placeholderTextColor={COLORS.textLabel}
          selectTextOnFocus
          accessibilityLabel={a11yName}
        />
        <AnimatedPressable scale="strong" haptic="selection" style={st.btn} onPress={() => bump(1)}
          accessibilityRole="button" accessibilityLabel={`Increase ${a11yName} by ${fmtNum(step)}`}>
          <Ionicons name="add" size={22} color={COLORS.text} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = themed(() => StyleSheet.create({
  wrap:    { flex: 1, minWidth: 0, gap: 6 },
  caption: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.accent, textAlign: 'center' },
  row:     { flexDirection: 'row', alignItems: 'center', height: 58, borderRadius: 14, backgroundColor: COLORS.surface },
  btn:     { width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' },
  input:   {
    flex: 1, minWidth: 0, height: '100%', textAlign: 'center', padding: 0,
    fontSize: 26, fontFamily: FONTS.hero, color: COLORS.text, fontVariant: ['tabular-nums'],
  },
}));

const s = themed(() => StyleSheet.create({
  page:     { paddingHorizontal: 20, paddingTop: 18 },
  eyebrow:  { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  title:    { flexShrink: 1, fontSize: 30, lineHeight: 34, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.8 },
  sub:      { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 8, lineHeight: 20, fontVariant: ['tabular-nums'] },

  table:    { marginTop: 22 },
  headRow:  { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headTxt:  { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textLabel },
  colSet:   { width: 44 },
  colVal:   { flex: 1 },
  colEnd:   { width: 36, alignItems: 'flex-end' },

  row:      {
    flexDirection: 'row', alignItems: 'center', minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  num:      { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  val:      { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text, fontVariant: ['tabular-nums'] },
  upcoming: { color: COLORS.textLabel },
  repsCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pr:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: accentA(0.16) },
  prTxt:    { fontSize: 11, fontFamily: FONTS.display, color: COLORS.accent },
  check:    { justifyContent: 'center' },
  checkDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },

  current:    {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    marginVertical: 6, paddingVertical: 12, paddingHorizontal: 12, marginHorizontal: -12,
    borderRadius: 18, backgroundColor: accentA(0.1), borderWidth: 1.5, borderColor: accentA(0.55),
  },
  currentNum: { width: 22, fontSize: 18, fontFamily: FONTS.hero, color: COLORS.accent, paddingBottom: 18, textAlign: 'center' },

  setBtns:    { flexDirection: 'row', gap: 16, marginTop: 10 },
  textBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  textBtnTxt: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.accent },

  effort:     {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: ink(0.04),
  },
  effortTxt:  { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.text },
  effortNote: { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted },
  effortEdit: { marginLeft: 'auto', fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.accent },
}));
