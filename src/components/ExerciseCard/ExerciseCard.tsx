import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassView } from '../common/GlassView';
import { ProgressRing } from '../common/ProgressRing';
import { SetTypeBadge } from '../common/SetTypeBadge';
import { SetLogger } from '../SetLogger/SetLogger';
import { COLORS, SPACING, MUSCLE_TAG_COLOR } from '../../constants';
import { SessionExercise, SetLog } from '../../types';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { findExercise } from '../../data/exercises';

interface Props {
  exercise:         SessionExercise;
  defaultExpanded?: boolean;
  isActive?:        boolean;
  onSetComplete?:   (exerciseName: string, setNumber: number, actualReps: number, actualWeight: number | null, weightUnit: string) => void;
}

export function ExerciseCard({ exercise, defaultExpanded, isActive, onSetComplete }: Props) {
  const { completeSet } = useSessionStore();
  const { activePlan }  = usePlanStore();
  const [expanded, setExpanded] = useState(
    defaultExpanded !== undefined ? defaultExpanded : !exercise.isCompleted,
  );
  const done  = exercise.sets.filter(s => s.isCompleted).length;
  const total = exercise.sets.length;
  const allDone = done === total;

  // Auto-expand when this exercise becomes the active one
  useEffect(() => {
    if (isActive && !allDone) setExpanded(true);
  }, [isActive]);

  // Library tags take precedence (specific); fall back to plan exercise tags for custom exercises
  const libEx      = findExercise(exercise.exerciseId);
  const planEx     = activePlan?.days.flatMap(d => d.exercises).find(e => e.id === exercise.exerciseId);
  const muscleTags = (libEx?.muscleTags ?? planEx?.muscleTags ?? []).slice(0, 2);

  return (
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
      <TouchableOpacity style={s.header} onPress={() => setExpanded(p => !p)} activeOpacity={0.8}>
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
          </View>
        </View>
        <View style={[s.chevron, expanded && s.chevronUp]}>
          <Text style={s.chevronText}>{'>'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.sets}>
          {exercise.sets.map((set, idx) => (
            <SetLogger
              key={set.id}
              set={set}
              setIndex={idx}
              exercise={exercise}
              onComplete={(data) => completeSet(exercise.id, set.id, data)}
              onSetComplete={onSetComplete}
            />
          ))}
        </View>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  card:         { marginBottom: SPACING.sm, overflow: 'hidden' },
  cardDone:     {},
  cardExpanded: {},
  header:       { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  info:         { flex: 1, minWidth: 0 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  name:         { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  nameDone:     { color: COLORS.accent },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta:         { fontSize: 12, color: COLORS.textMuted },
  musclePill:   { borderRadius: 99, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  musclePillText:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  chevron:      { transform: [{ rotate: '90deg' }] },
  chevronUp:    { transform: [{ rotate: '270deg' }] },
  chevronText:  { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  sets:         { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)' },
});
