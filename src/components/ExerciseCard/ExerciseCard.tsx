import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { SessionExercise, SetLog } from '../../types';
import { SetLogger } from '../SetLogger/SetLogger';
import { Badge } from '../common/Badge';
import { SET_TYPE_LABELS, BORDER_RADIUS, SPACING } from '../../constants';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  exercise: SessionExercise;
  onOpenPlateCalc: (set: SetLog, exercise: SessionExercise) => void;
}

export function ExerciseCard({ exercise, onOpenPlateCalc }: Props) {
  const { colors } = useTheme();
  const { completeSet } = useSessionStore();
  const [expanded, setExpanded] = useState(!exercise.isCompleted);

  const completedSets = exercise.sets.filter((s) => s.isCompleted).length;
  const totalSets = exercise.sets.length;
  const progress = `${completedSets}/${totalSets}`;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: exercise.isCompleted ? colors.accent : colors.border }]}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((p) => !p)} activeOpacity={0.8}>
        <View style={styles.headerLeft}>
          {exercise.isCompleted && (
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={styles.checkIcon} />
          )}
          <View>
            <Text style={[styles.name, { color: colors.text }]}>{exercise.exerciseName}</Text>
            <View style={styles.meta}>
              <Badge label={SET_TYPE_LABELS[exercise.setType] ?? exercise.setType} />
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>{progress} sets</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {/* Sets */}
      {expanded && (
        <View style={styles.sets}>
          {exercise.sets.map((set, idx) => (
            <SetLogger
              key={set.id}
              set={set}
              setIndex={idx}
              exercise={exercise}
              onComplete={(data) => completeSet(exercise.id, set.id, data)}
              onOpenPlateCalc={(s) => onOpenPlateCalc(s, exercise)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
  checkIcon: { marginRight: 4 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  progressText: { fontSize: 12, fontWeight: '600' },
  sets: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
});
