import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { enterFade, layoutSoft } from '../../motion/presets';
import { lastPerformance } from '../../utils/exerciseHistory';
import { GlassView } from '../common/GlassView';
import { ProgressRing } from '../common/ProgressRing';
import { SetTypeBadge } from '../common/SetTypeBadge';
import { SetLogger } from '../SetLogger/SetLogger';
import { RPEInput } from '../RPEInput/RPEInput';
import { COLORS, SPACING, MUSCLE_TAG_COLOR, FONTS } from '../../constants';
import { SessionExercise, SetLog } from '../../types';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { findExercise } from '../../data/exercises';

function rpeColor(n: number): string {
  if (n <= 4) return '#30D158';
  if (n <= 6) return '#FFD60A';
  if (n <= 8) return '#FF8C00';
  return '#FF453A';
}

interface Props {
  exercise:         SessionExercise;
  defaultExpanded?: boolean;
  isActive?:        boolean;
  onSetComplete?:   (exerciseName: string, setNumber: number, actualReps: number, actualWeight: number | null, weightUnit: string) => void;
  /** Called once the exercise is wrapped up (effort rated or skipped), so the
   *  screen can bring the next exercise into view. */
  onAdvance?:       () => void;
}

export function ExerciseCard({ exercise, defaultExpanded, isActive, onSetComplete, onAdvance }: Props) {
  const { completeSet, uncompleteSet, setExerciseRPE, addSet, removeLastSet } = useSessionStore();
  const history = useSessionStore(st => st.sessions);
  const lastSets = useMemo(
    () => lastPerformance(history, exercise.exerciseId, exercise.exerciseName),
    [history, exercise.exerciseId, exercise.exerciseName],
  );
  // Only the most recently logged set can be undone, so undo never punches a
  // hole in the middle of an exercise.
  const lastDoneIdx = exercise.sets.reduce((acc, st, i) => (st.isCompleted ? i : acc), -1);
  const { activePlan }  = usePlanStore();
  const [expanded, setExpanded] = useState(
    defaultExpanded !== undefined ? defaultExpanded : !exercise.isCompleted,
  );
  const prevAllDone = useRef(false);
  const done    = exercise.sets.filter(s => s.isCompleted).length;
  const total   = exercise.sets.length;
  const allDone = done === total && total > 0;

  // Auto-expand when this exercise becomes the active one
  useEffect(() => {
    if (isActive && !allDone) setExpanded(true);
  }, [isActive]);

  const [rpeSkipped,  setRpeSkipped ] = useState(false);
  const [editingRpe,  setEditingRpe ] = useState(false);

  // Auto-expand RPE section when last set is just completed
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setExpanded(true);
      setRpeSkipped(false);
      setEditingRpe(false);
    }
    prevAllDone.current = allDone;
  }, [allDone]);

  const chevron = useSharedValue(expanded ? 1 : 0);
  useEffect(() => { chevron.value = withTiming(expanded ? 1 : 0, TIMING.standard); }, [expanded]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevron.value * 180}deg` }] }));

  // Wrapping up: rating (or skipping) effort collapses the card and hands off
  // to the next exercise.
  const finishExercise = () => {
    setExpanded(false);
    onAdvance?.();
  };

  // Library tags take precedence (specific); fall back to plan exercise tags for custom exercises
  const libEx      = findExercise(exercise.exerciseId);
  const planEx     = activePlan?.days.flatMap(d => d.exercises).find(e => e.id === exercise.exerciseId);
  const muscleTags = (libEx?.muscleTags ?? planEx?.muscleTags ?? []).slice(0, 2);

  return (
    <Animated.View layout={layoutSoft}>
    <GlassView
      radius={16}
      style={[s.card, allDone && s.cardDone, expanded && !allDone && s.cardExpanded]}
      glow={allDone}
      borderColor={
        allDone  ? 'rgba(255,140,0,0.30)' :
        isActive ? 'rgba(255,140,0,0.50)' :
        expanded ? 'rgba(255,255,255,0.20)' :
                   'rgba(255,255,255,0.10)'
      }
    >
      <AnimatedPressable
        style={s.header}
        onPress={() => setExpanded(p => !p)}
        accessibilityRole="button"
        accessibilityLabel={`${exercise.exerciseName}, ${done} of ${total} sets complete`}
        accessibilityState={{ expanded }}
      >
        <ProgressRing value={done} max={total} size={44} strokeWidth={3} label={done + '/' + total} />
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={[s.name, allDone && s.nameDone]}>{exercise.exerciseName}</Text>
            <SetTypeBadge type={exercise.setType} />
          </View>
          <View style={s.metaRow}>
            <Text style={s.meta}>
              {exercise.setType === 'toFailure'
                ? total + ' x failure'
                : (() => {
                    const t = exercise.sets[0];
                    if (!t) return '';
                    const w = t.targetWeight ? t.targetWeight + exercise.weightUnit : '';
                    const r = t.targetReps ? t.targetReps + ' reps' : '';
                    return total + ' x ' + [r, w].filter(Boolean).join(' @ ');
                  })()
              }
            </Text>
            {muscleTags.map(tag => {
              const col = MUSCLE_TAG_COLOR[tag] ?? COLORS.textSecondary;
              return (
                <View key={tag} style={[s.musclePill, { backgroundColor: col + '22', borderColor: col + '55' }]}>
                  <Text style={[s.musclePillText, { color: col }]}>{tag}</Text>
                </View>
              );
            })}
            {exercise.rpe != null && (
              <View style={[s.rpePill, { backgroundColor: rpeColor(exercise.rpe) + '22', borderColor: rpeColor(exercise.rpe) + '55' }]}>
                <Text style={[s.rpePillText, { color: rpeColor(exercise.rpe) }]}>RPE {exercise.rpe}</Text>
              </View>
            )}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={20} color={COLORS.textMuted} />
        </Animated.View>
      </AnimatedPressable>

      {expanded && (
        <Animated.View entering={enterFade} style={s.sets}>
          {exercise.sets.map((set, idx) => (
            <SetLogger
              key={set.id}
              set={set}
              exercise={exercise}
              lastSet={lastSets[idx]}
              canUndo={idx === lastDoneIdx}
              onComplete={(data) => completeSet(exercise.id, set.id, data)}
              onUndo={() => uncompleteSet(exercise.id, set.id)}
              onSetComplete={onSetComplete}
            />
          ))}

          {/* Add / Remove set controls — always visible when expanded */}
          <View style={s.setControls}>
            {exercise.sets.length > 1 && !exercise.sets[exercise.sets.length - 1]?.isCompleted && (
              <AnimatedPressable
                style={s.removeSetBtn}
                onPress={() => removeLastSet(exercise.id)}
                accessibilityRole="button"
                accessibilityLabel="Remove last set"
              >
                <Text style={s.removeSetTxt}>− Remove Set</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable
              style={s.addSetBtn}
              onPress={() => addSet(exercise.id)}
              accessibilityRole="button"
              accessibilityLabel="Add set"
            >
              <Text style={s.addSetTxt}>+ Add Set</Text>
            </AnimatedPressable>
          </View>

          {/* RPE capture — shown once all sets are done */}
          {allDone && (() => {
            const rpeLogged = exercise.rpe != null && exercise.rpe > 0;

            // Already logged + not editing → show saved summary
            if (rpeLogged && !editingRpe) {
              return (
                <View style={s.rpeSaved}>
                  <View style={[s.rpeSavedBadge, { borderColor: rpeColor(exercise.rpe!) + '55', backgroundColor: rpeColor(exercise.rpe!) + '18' }]}>
                    <Text style={[s.rpeSavedNum, { color: rpeColor(exercise.rpe!) }]}>RPE {exercise.rpe}</Text>
                  </View>
                  {exercise.exerciseNote ? (
                    <Text style={s.rpeSavedNote} numberOfLines={2}>{exercise.exerciseNote}</Text>
                  ) : null}
                  <AnimatedPressable onPress={() => setEditingRpe(true)} style={s.rpeEditBtn}>
                    <Text style={s.rpeEditTxt}>Edit</Text>
                  </AnimatedPressable>
                </View>
              );
            }

            // Skipped and not editing → nothing (already past this exercise)
            if (rpeSkipped && !editingRpe) return null;

            // Show input (first time or editing)
            return (
              <RPEInput
                initialRpe={editingRpe ? exercise.rpe : undefined}
                initialNote={editingRpe ? (exercise.exerciseNote ?? '') : ''}
                onSave={(rpe, note) => {
                  const firstTime = !editingRpe;
                  setExerciseRPE(exercise.id, rpe, note);
                  setEditingRpe(false);
                  if (firstTime) finishExercise();
                }}
                onSkip={editingRpe ? undefined : () => { setRpeSkipped(true); finishExercise(); }}
              />
            );
          })()}
        </Animated.View>
      )}
    </GlassView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card:          { marginBottom: SPACING.sm, overflow: 'hidden' },
  cardDone:      {},
  cardExpanded:  {},
  header:        { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  info:          { flex: 1, minWidth: 0 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  name:          { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.48 },
  nameDone:      { color: COLORS.accent },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta:          { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  musclePill:    { borderRadius: 99, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  musclePillText:{ fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline },
  rpePill:       { borderRadius: 99, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  rpePillText:   { fontSize: 11, fontWeight: '800', fontFamily: FONTS.display },
  sets:          { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)' },
  setControls:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: SPACING.sm, marginTop: 2 },
  addSetBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: COLORS.accent + '55', backgroundColor: COLORS.accent + '18' },
  addSetTxt:     { fontSize: 12, fontWeight: '800', fontFamily: FONTS.headline, color: COLORS.accent, letterSpacing: 0.3 },
  removeSetBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,100,100,0.35)', backgroundColor: 'rgba(255,100,100,0.10)' },
  removeSetTxt:  { fontSize: 12, fontWeight: '700', fontFamily: FONTS.headline, color: '#FF6B6B', letterSpacing: 0.3 },
  // RPE saved summary
  rpeSaved:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)', marginTop: SPACING.xs },
  rpeSavedBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  rpeSavedNum:   { fontSize: 13, fontWeight: '800', fontFamily: FONTS.display },
  rpeSavedNote:  { flex: 1, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, fontStyle: 'italic' },
  rpeEditBtn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,240,220,0.14)', backgroundColor: 'rgba(255,240,220,0.05)' },
  rpeEditTxt:    { fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textLabel },
});
