import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../common/GlassView';
import { GRAD, COLORS } from '../../constants';
import { SetLog, SessionExercise } from '../../types';

interface Props { set: SetLog; setIndex: number; exercise: SessionExercise; onComplete: (data: Partial<SetLog>) => void; }

export function SetLogger({ set, setIndex, exercise, onComplete }: Props) {
  const isFailure    = exercise.setType === 'toFailure';
  const isBodyweight = exercise.weightUnit === 'bodyweight';
  const [weight, setWeight] = useState(String(set.actualWeight ?? set.targetWeight ?? ''));
  const [reps,   setReps  ] = useState(String(isFailure ? (set.actualRepsToFailure ?? '') : (set.actualReps || '')));
  const [note,   setNote  ] = useState(set.notes ?? '');

  if (set.isCompleted) {
    return (
      <View style={s.doneRow}>
        <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.doneCheck}>
          <Ionicons name='checkmark' size={13} color='#000' />
        </LinearGradient>
        <Text style={s.doneLabel}>S{set.setNumber}</Text>
        {!isBodyweight && <Text style={s.doneVal}>{set.actualWeight ?? '-'}{exercise.weightUnit}</Text>}
        <Text style={s.doneVal}>{isFailure ? set.actualRepsToFailure : set.actualReps} reps</Text>
        {set.notes ? <Text style={s.doneNote} numberOfLines={1}>{set.notes}</Text> : null}
      </View>
    );
  }

  const handleComplete = () => {
    onComplete({
      actualReps:          isFailure ? 0 : parseInt(reps, 10) || 0,
      actualRepsToFailure: isFailure ? parseInt(reps, 10) || 0 : null,
      actualWeight:        isBodyweight ? null : parseFloat(weight) || 0,
      notes: note,
    });
  };

  return (
    <GlassView radius={10} style={s.row}>
      <Text style={s.setNum}>S{set.setNumber}</Text>
      <View style={s.fields}>
        {!isBodyweight && (
          <View style={s.field}>
            <Text style={s.fieldLbl}>Weight</Text>
            <TextInput style={s.input} value={weight} onChangeText={setWeight} keyboardType='numeric' placeholder={String(set.targetWeight ?? '0')} placeholderTextColor={COLORS.textMuted} selectTextOnFocus />
          </View>
        )}
        <View style={s.field}>
          <Text style={s.fieldLbl}>{isFailure ? 'Fail reps' : 'Reps'}</Text>
          <TextInput style={s.input} value={reps} onChangeText={setReps} keyboardType='numeric' placeholder={isFailure ? '0' : String(set.targetReps ?? '0')} placeholderTextColor={COLORS.textMuted} selectTextOnFocus />
        </View>
      </View>
      <TouchableOpacity onPress={handleComplete} activeOpacity={0.85} style={s.checkWrap}>
        <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.checkBtn}>
          <Ionicons name='checkmark' size={18} color='#000' />
        </LinearGradient>
      </TouchableOpacity>
    </GlassView>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 6, gap: 8 },
  setNum:    { fontSize: 12, fontWeight: '800', color: COLORS.accent, width: 24, letterSpacing: -0.3 },
  fields:    { flex: 1, flexDirection: 'row', gap: 6 },
  field:     { flex: 1 },
  fieldLbl:  { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  input:     { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 8, height: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#fff' },
  checkWrap: { borderRadius: 10, overflow: 'hidden' },
  checkBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  doneRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6, gap: 8, backgroundColor: 'rgba(123,94,250,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(123,94,250,0.20)' },
  doneCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontSize: 12, fontWeight: '800', color: COLORS.accent, width: 24 },
  doneVal:   { fontSize: 13, fontWeight: '600', color: '#fff' },
  doneNote:  { fontSize: 11, color: COLORS.textMuted, flex: 1 },
});
