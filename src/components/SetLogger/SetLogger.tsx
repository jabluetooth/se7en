import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../common/GlassView';
import { GRAD, COLORS } from '../../constants';
import { SetLog, SessionExercise } from '../../types';

interface Props {
  set:             SetLog;
  setIndex:        number;
  exercise:        SessionExercise;
  onComplete:      (data: Partial<SetLog>) => void;
  onSetComplete?:  (exerciseName: string, setNumber: number, actualReps: number, actualWeight: number | null, weightUnit: string) => void;
}

// ─── Inline rest timer ────────────────────────────────────────────────────────

const REST_DEFAULT = 90;
const REST_PRESETS = [45, 60, 90, 120];

function InlineRestTimer({ onDismiss }: { onDismiss: () => void }) {
  const [total,   setTotal  ] = useState(REST_DEFAULT);
  const [seconds, setSeconds] = useState(REST_DEFAULT);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop interval based on `running`
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const isDone = seconds === 0;
  const mins   = Math.floor(seconds / 60);
  const secs   = seconds % 60;
  const pct    = seconds / total;

  const applyPreset = (val: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotal(val);
    setSeconds(val);
    setRunning(true);
  };

  return (
    <View style={r.wrap}>
      {/* Main row: icon + countdown + skip */}
      <View style={r.mainRow}>
        <View style={r.iconCol}>
          <Text style={[r.icon, isDone && r.iconDone]}>
            {isDone ? '→' : '⏱'}
          </Text>
        </View>

        <View style={r.centerCol}>
          <Text style={r.restLabel}>REST</Text>
          {isDone ? (
            <Text style={r.doneText}>Ready — go!</Text>
          ) : (
            <View style={r.countdownRow}>
              <Text style={r.countdown}>
                {mins}:{String(secs).padStart(2, '0')}
              </Text>
              {/* Small progress dots */}
              <View style={r.dotTrack}>
                <View style={[r.dotFill, { width: `${Math.round(pct * 100)}%` as any }]} />
              </View>
            </View>
          )}
        </View>

        {/* Preset pills */}
        <View style={r.presetsCol}>
          {REST_PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => applyPreset(p)}
              style={[r.preset, seconds === p && !isDone && r.presetActive]}
              activeOpacity={0.7}
            >
              <Text style={[r.presetTxt, seconds === p && !isDone && r.presetTxtActive]}>
                {p < 60 ? `${p}s` : `${p / 60}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={onDismiss} style={r.closeBtn} activeOpacity={0.7}>
          <Text style={r.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SetLogger ────────────────────────────────────────────────────────────────

export function SetLogger({ set, setIndex, exercise, onComplete, onSetComplete }: Props) {
  const isFailure    = exercise.setType === 'toFailure';
  const isBodyweight = exercise.weightUnit === 'bodyweight';

  const [weight,   setWeight  ] = useState(String(set.actualWeight ?? set.targetWeight ?? ''));
  const [reps,     setReps    ] = useState(String(isFailure ? (set.actualRepsToFailure ?? '') : (set.actualReps || '')));
  const [note,     setNote    ] = useState(set.notes ?? '');
  const [showRest, setShowRest] = useState(false);

  const handleComplete = () => {
    const actualRepsNum   = parseInt(reps, 10) || 0;
    const actualWeightNum = isBodyweight ? null : parseFloat(weight) || 0;
    onComplete({
      actualReps:          isFailure ? 0 : actualRepsNum,
      actualRepsToFailure: isFailure ? actualRepsNum : null,
      actualWeight:        actualWeightNum,
      notes: note,
    });
    if (onSetComplete) {
      onSetComplete(exercise.exerciseName, set.setNumber, actualRepsNum, actualWeightNum, exercise.weightUnit);
    } else {
      setShowRest(true);
    }
  };

  if (set.isCompleted) {
    return (
      <View>
        {/* Done summary row */}
        <View style={s.doneRow}>
          <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doneCheck}>
            <Ionicons name="checkmark" size={13} color="#000" />
          </LinearGradient>
          <Text style={s.doneLabel}>S{set.setNumber}</Text>
          {!isBodyweight && (
            <Text style={s.doneVal}>{set.actualWeight ?? '-'}{exercise.weightUnit}</Text>
          )}
          <Text style={s.doneVal}>
            {isFailure ? set.actualRepsToFailure : set.actualReps} reps
          </Text>
          {set.notes ? <Text style={s.doneNote} numberOfLines={1}>{set.notes}</Text> : null}

          {/* Rest toggle button (visible when timer is not showing) */}
          {!showRest && (
            <TouchableOpacity
              onPress={() => setShowRest(true)}
              style={s.restToggle}
              activeOpacity={0.75}
            >
              <Text style={s.restToggleTxt}>REST</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Inline rest timer */}
        {showRest && (
          <InlineRestTimer onDismiss={() => setShowRest(false)} />
        )}
      </View>
    );
  }

  return (
    <GlassView radius={10} style={s.row}>
      <Text style={s.setNum}>S{set.setNumber}</Text>
      <View style={s.fields}>
        {!isBodyweight && (
          <View style={s.field}>
            <Text style={s.fieldLbl}>Weight</Text>
            <TextInput
              style={s.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder={String(set.targetWeight ?? '0')}
              placeholderTextColor={COLORS.textMuted}
              selectTextOnFocus
            />
          </View>
        )}
        <View style={s.field}>
          <Text style={s.fieldLbl}>{isFailure ? 'Fail reps' : 'Reps'}</Text>
          <TextInput
            style={s.input}
            value={reps}
            onChangeText={setReps}
            keyboardType="numeric"
            placeholder={isFailure ? '0' : String(set.targetReps ?? '0')}
            placeholderTextColor={COLORS.textMuted}
            selectTextOnFocus
          />
        </View>
      </View>
      <TouchableOpacity onPress={handleComplete} activeOpacity={0.85} style={s.checkWrap}>
        <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.checkBtn}>
          <Ionicons name="checkmark" size={18} color="#000" />
        </LinearGradient>
      </TouchableOpacity>
    </GlassView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 6, gap: 8 },
  setNum:       { fontSize: 12, fontWeight: '800', color: COLORS.accent, width: 24, letterSpacing: -0.3 },
  fields:       { flex: 1, flexDirection: 'row', gap: 6 },
  field:        { flex: 1 },
  fieldLbl:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  input:        { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 8, height: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#fff' },
  checkWrap:    { borderRadius: 10, overflow: 'hidden' },
  checkBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },

  doneRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 0, gap: 8, backgroundColor: 'rgba(10,132,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(10,132,255,0.20)' },
  doneCheck:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  doneLabel:    { fontSize: 12, fontWeight: '800', color: COLORS.accent, width: 24 },
  doneVal:      { fontSize: 13, fontWeight: '600', color: '#fff' },
  doneNote:     { fontSize: 11, color: COLORS.textMuted, flex: 1 },
  restToggle:   { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(10,132,255,0.28)', backgroundColor: 'rgba(10,132,255,0.10)' },
  restToggleTxt:{ fontSize: 9, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.8 },
});

const r = StyleSheet.create({
  wrap:          { backgroundColor: 'rgba(100,210,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(100,210,255,0.16)', padding: 10, marginBottom: 6, marginTop: 2 },
  mainRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCol:       { width: 24, alignItems: 'center' },
  icon:          { fontSize: 16, color: COLORS.rest },
  iconDone:      { color: COLORS.accent },
  centerCol:     { flex: 1, minWidth: 0 },
  restLabel:     { fontSize: 8, fontWeight: '800', color: COLORS.rest, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  countdownRow:  { gap: 4 },
  countdown:     { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  dotTrack:      { height: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 2 },
  dotFill:       { height: '100%', borderRadius: 99, backgroundColor: COLORS.rest },
  doneText:      { fontSize: 15, fontWeight: '800', color: COLORS.accent },
  presetsCol:    { flexDirection: 'row', gap: 4 },
  preset:        { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' },
  presetActive:  { borderColor: COLORS.rest, backgroundColor: 'rgba(100,210,255,0.13)' },
  presetTxt:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
  presetTxtActive:{ color: COLORS.rest },
  closeBtn:      { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { fontSize: 12, color: COLORS.textMuted, fontWeight: '700' },
});
