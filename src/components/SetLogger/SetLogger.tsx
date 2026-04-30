import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { SetLog, SessionExercise } from '../../types';
import { BORDER_RADIUS, SPACING } from '../../constants';

interface Props {
  set: SetLog;
  setIndex: number;
  exercise: SessionExercise;
  onComplete: (data: Partial<SetLog>) => void;
  onOpenPlateCalc: (set: SetLog) => void;
}

export function SetLogger({ set, setIndex, exercise, onComplete, onOpenPlateCalc }: Props) {
  const { colors } = useTheme();
  const isFailure = exercise.setType === 'toFailure';
  const isBodyweight = exercise.weightUnit === 'bodyweight';
  const isPlatesOnly = exercise.weightUnit === 'plates';

  const [weight, setWeight] = useState(String(set.actualWeight ?? set.targetWeight ?? ''));
  const [reps, setReps] = useState(String(isFailure ? (set.actualRepsToFailure ?? 0) : set.actualReps));
  const [note, setNote] = useState(set.notes);
  const [noteExpanded, setNoteExpanded] = useState(false);

  if (set.isCompleted) {
    return (
      <TouchableOpacity
        style={[styles.completedRow, { backgroundColor: colors.accentDim, borderColor: colors.accent }]}
        onLongPress={() => {/* swipe to edit - TODO */}}
        activeOpacity={0.8}
      >
        <View style={styles.completedLeft}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={[styles.completedLabel, { color: colors.textSecondary }]}>Set {set.setNumber}</Text>
        </View>
        <View style={styles.completedRight}>
          {!isBodyweight && !isPlatesOnly && (
            <Text style={[styles.completedValue, { color: colors.text }]}>
              {set.actualWeight ?? '—'}{exercise.weightUnit}
            </Text>
          )}
          <Text style={[styles.completedValue, { color: colors.text }]}>
            {isFailure ? set.actualRepsToFailure : set.actualReps} reps
          </Text>
        </View>
        {set.notes ? (
          <Text style={[styles.completedNote, { color: colors.textSecondary }]} numberOfLines={1}>
            📝 {set.notes}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  }

  const handleComplete = () => {
    const numReps = parseInt(reps, 10) || 0;
    const numWeight = parseFloat(weight) || 0;
    onComplete({
      actualReps: isFailure ? 0 : numReps,
      actualRepsToFailure: isFailure ? numReps : null,
      actualWeight: isBodyweight ? null : numWeight,
      notes: note,
    });
  };

  const targetLabel = () => {
    if (isBodyweight) return `Set ${set.setNumber} · Bodyweight`;
    if (set.targetReps !== null && set.targetWeight !== null) {
      return `Set ${set.setNumber} · Target: ${set.targetReps} reps @ ${set.targetWeight}${exercise.weightUnit}`;
    }
    return `Set ${set.setNumber}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[styles.setLabel, { color: colors.textSecondary }]}>{targetLabel()}</Text>

      <View style={styles.inputRow}>
        {/* Weight */}
        {!isBodyweight && (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.numberInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                placeholder={String(set.targetWeight ?? 0)}
                placeholderTextColor={colors.textMuted}
              />
              {!isPlatesOnly && (
                <TouchableOpacity
                  style={[styles.calcBtn, { backgroundColor: colors.accentDim }]}
                  onPress={() => onOpenPlateCalc(set)}
                >
                  <Ionicons name="layers-outline" size={14} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Reps */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
            {isFailure ? 'Reps (failure)' : 'Reps'}
          </Text>
          <TextInput
            style={[styles.numberInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={reps}
            onChangeText={setReps}
            keyboardType="numeric"
            placeholder={isFailure ? '0' : String(set.targetReps ?? 0)}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Complete button */}
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: colors.accent }]}
          onPress={handleComplete}
        >
          <Ionicons name="checkmark" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Notes */}
      <TouchableOpacity
        style={styles.noteToggle}
        onPress={() => setNoteExpanded((p) => !p)}
      >
        <Ionicons name={noteExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        <Text style={[styles.noteToggleText, { color: colors.textMuted }]}>
          {note ? `Note: ${note}` : 'Add note'}
        </Text>
      </TouchableOpacity>
      {noteExpanded && (
        <TextInput
          style={[styles.noteInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Felt strong, increase weight next session"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  setLabel: { fontSize: 11, fontWeight: '600', marginBottom: SPACING.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  field: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  weightRow: { flexDirection: 'row', gap: SPACING.xs, alignItems: 'center' },
  numberInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    height: 44,
  },
  calcBtn: {
    width: 32,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  noteToggleText: { fontSize: 12 },
  noteInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
    fontSize: 13,
    minHeight: 60,
  },
  completedRow: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  completedLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flex: 1 },
  completedLabel: { fontSize: 13, fontWeight: '600' },
  completedRight: { flexDirection: 'row', gap: SPACING.sm },
  completedValue: { fontSize: 13, fontWeight: '600' },
  completedNote: { width: '100%', fontSize: 11 },
});
