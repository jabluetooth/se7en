import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassView } from '../common/GlassView';
import { ProgressRing } from '../common/ProgressRing';
import { SetTypeBadge } from '../common/SetTypeBadge';
import { SetLogger } from '../SetLogger/SetLogger';
import { COLORS, SPACING, SET_TYPE_LABELS, BORDER_RADIUS } from '../../constants';
import { SessionExercise, SetLog } from '../../types';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  exercise:        SessionExercise;
  defaultExpanded?: boolean; // override initial open/closed state
}

export function ExerciseCard({ exercise, defaultExpanded }: Props) {
  const { completeSet } = useSessionStore();
  const [expanded, setExpanded] = useState(
    defaultExpanded !== undefined ? defaultExpanded : !exercise.isCompleted,
  );
  const done  = exercise.sets.filter(s => s.isCompleted).length;
  const total = exercise.sets.length;
  const allDone = done === total;

  return (
    <GlassView
      radius={16}
      style={[
        s.card,
        allDone && s.cardDone,
        expanded && !allDone && s.cardExpanded,
      ]}
      glow={allDone}
      borderColor={allDone ? 'rgba(123,94,250,0.40)' : expanded ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}
    >
      <TouchableOpacity style={s.header} onPress={() => setExpanded(p => !p)} activeOpacity={0.8}>
        <ProgressRing value={done} max={total} size={44} strokeWidth={3} label={done + '/' + total} />
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={[s.name, allDone && s.nameDone]}>{exercise.exerciseName}</Text>
            <SetTypeBadge type={exercise.setType} />
          </View>
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
  meta:         { fontSize: 12, color: COLORS.textMuted },
  chevron:      { transform: [{ rotate: '90deg' }] },
  chevronUp:    { transform: [{ rotate: '270deg' }] },
  chevronText:  { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  sets:         { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
});
