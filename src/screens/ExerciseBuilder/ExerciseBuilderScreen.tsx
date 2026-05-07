import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { Button } from '../../components/common/Button';
import { GRAD, COLORS, SPACING, SET_TYPE_LABELS, BORDER_RADIUS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { SetType, BarType, WeightUnit } from '../../types';

interface Props { onClose: () => void; onSave?: (data: any) => void; }

const SET_TYPES: { id: SetType; desc: string; icon: string }[] = [
  { id: 'standard',    desc: 'Fixed reps & weight',       icon: 'S' },
  { id: 'repRange',    desc: 'Min-max rep target',         icon: 'R' },
  { id: 'toFailure',   desc: 'Max reps to failure',        icon: 'F' },
  { id: 'superset',    desc: 'Two exercises back-to-back', icon: '+' },
  { id: 'dropSet',     desc: 'Decreasing weight each set', icon: 'D' },
  { id: 'pyramid',     desc: 'Per-set individual targets', icon: 'P' },
  { id: 'progressive', desc: 'Increasing targets each set',icon: '^' },
];

const BAR_TYPES: { id: BarType; label: string; weight: string }[] = [
  { id: 'barbell',  label: 'Barbell',  weight: '20kg' },
  { id: 'ezbar',    label: 'EZ Bar',   weight: '10kg' },
  { id: 'smith',    label: 'Smith',    weight: '15kg' },
  { id: 'dumbbell', label: 'Dumbbell', weight: '-'    },
  { id: 'none',     label: 'None',     weight: '0kg'  },
];

const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb', 'plates', 'bodyweight'];

export function ExerciseBuilderScreen({ onClose, onSave }: Props) {
  const [step,        setStep       ] = useState(0);
  const [name,        setName       ] = useState('');
  const [setType,     setSetType    ] = useState<SetType>('repRange');
  const [sets,        setSets       ] = useState(4);
  const [repsMin,     setRepsMin    ] = useState(8);
  const [repsMax,     setRepsMax    ] = useState(12);
  const [weight,      setWeight     ] = useState(60);
  const [weightUnit,  setWeightUnit ] = useState<WeightUnit>('kg');
  const [barType,     setBarType    ] = useState<BarType>('barbell');
  const [notes,       setNotes      ] = useState('');

  const steps = ['Basics', 'Volume', 'Review'];
  const isFailure = setType === 'toFailure';

  const StepDot = ({ i }: { i: number }) => (
    <View style={s.stepRow}>
      <TouchableOpacity onPress={() => i < step && setStep(i)}
        style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]}>
        {i < step
          ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.stepDotGrad}><Text style={s.stepCheckmark}>+</Text></LinearGradient>
          : <Text style={[s.stepNum, i === step && s.stepNumActive]}>{i + 1}</Text>}
      </TouchableOpacity>
      <Text style={[s.stepLabel, i === step && s.stepLabelActive]}>{steps[i]}</Text>
      {i < steps.length - 1 && <View style={[s.stepLine, i < step && s.stepLineDone]} />}
    </View>
  );

  const LabelRow = ({ label }: { label: string }) => (
    <Text style={s.fieldLabel}>{label}</Text>
  );

  const Counter = ({ value, onChange, min = 1, max = 20 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
    <GlassView radius={12} style={s.counter}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={s.counterBtn}>
        <Text style={s.counterBtnText}>-</Text>
      </TouchableOpacity>
      <Text style={s.counterValue}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={s.counterBtn}>
        <Text style={s.counterBtnText}>+</Text>
      </TouchableOpacity>
    </GlassView>
  );

  const handleSave = () => {
    onSave?.({ name, setType, sets, repsMin, repsMax, weight, weightUnit, barType, notes });
    onClose();
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn}>
            <Text style={s.backText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>{name || 'New Exercise'}</Text>
        </View>

        {/* Step indicators */}
        <View style={s.steps}>
          {steps.map((_, i) => <StepDot key={i} i={i} />)}
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* STEP 0: Basics */}
          {step === 0 && (
            <>
              <LabelRow label="Exercise Name" />
              <TextInput style={s.nameInput} value={name} onChangeText={setName}
                placeholder="e.g. Bench Press" placeholderTextColor={COLORS.textMuted} />

              <LabelRow label="Set Type" />
              {SET_TYPES.map(st => (
                <TouchableOpacity key={st.id} onPress={() => setSetType(st.id)} activeOpacity={0.8}
                  style={[s.typeBtn, setType === st.id && s.typeBtnActive]}>
                  <View style={[s.typeIcon, setType === st.id && s.typeIconActive]}>
                    {setType === st.id
                      ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.typeIconGrad}><Text style={s.typeIconTextActive}>{st.icon}</Text></LinearGradient>
                      : <Text style={s.typeIconText}>{st.icon}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.typeName, setType === st.id && s.typeNameActive]}>{SET_TYPE_LABELS[st.id]}</Text>
                    <Text style={s.typeDesc}>{st.desc}</Text>
                  </View>
                  {setType === st.id && (
                    <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.typeCheck}>
                      <Text style={s.typeCheckText}>+</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* STEP 1: Volume */}
          {step === 1 && (
            <>
              <LabelRow label="Number of Sets" />
              <Counter value={sets} onChange={setSets} />

              {!isFailure && (
                <>
                  <LabelRow label={setType === 'repRange' ? 'Rep Range' : 'Target Reps'} />
                  <View style={s.repRow}>
                    <GlassView radius={12} style={s.repField}>
                      <Text style={s.repSubLabel}>Min</Text>
                      <TextInput style={s.repInput} value={String(repsMin)} onChangeText={v => setRepsMin(parseInt(v) || 0)} keyboardType="numeric" />
                    </GlassView>
                    {setType === 'repRange' && (
                      <>
                        <Text style={s.repDash}>-</Text>
                        <GlassView radius={12} style={s.repField}>
                          <Text style={s.repSubLabel}>Max</Text>
                          <TextInput style={s.repInput} value={String(repsMax)} onChangeText={v => setRepsMax(parseInt(v) || 0)} keyboardType="numeric" />
                        </GlassView>
                      </>
                    )}
                  </View>
                </>
              )}
              {isFailure && (
                <GlassView radius={12} style={s.failureNote}>
                  <Text style={s.failureTitle}>To Failure</Text>
                  <Text style={s.failureDesc}>Log actual reps reached after each set.</Text>
                </GlassView>
              )}

              <LabelRow label="Weight Unit" />
              <View style={s.unitRow}>
                {WEIGHT_UNITS.map(u => (
                  <TouchableOpacity key={u} onPress={() => setWeightUnit(u)} style={[s.unitBtn, weightUnit === u && s.unitBtnActive]}>
                    {weightUnit === u
                      ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.unitGrad}><Text style={s.unitTextActive}>{u}</Text></LinearGradient>
                      : <Text style={s.unitText}>{u}</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {weightUnit !== 'bodyweight' && (
                <>
                  <LabelRow label="Bar Type" />
                  {BAR_TYPES.map(bt => (
                    <TouchableOpacity key={bt.id} onPress={() => setBarType(bt.id)} activeOpacity={0.8}
                      style={[s.barBtn, barType === bt.id && s.barBtnActive]}>
                      <Text style={[s.barLabel, barType === bt.id && s.barLabelActive]}>{bt.label}</Text>
                      <Text style={s.barWeight}>{bt.weight}</Text>
                    </TouchableOpacity>
                  ))}

                  <LabelRow label={'Target Weight (' + weightUnit + ')'} />
                  <GlassView radius={12} style={s.weightCounter}>
                    <TouchableOpacity onPress={() => setWeight(w => Math.max(0, w - 2.5))} style={s.counterBtn}>
                      <Text style={s.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={s.weightValue}>{weight} <Text style={s.weightUnit}>{weightUnit}</Text></Text>
                    <TouchableOpacity onPress={() => setWeight(w => w + 2.5)} style={s.counterBtn}>
                      <Text style={s.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </GlassView>
                </>
              )}

              <LabelRow label="Notes (optional)" />
              <TextInput style={s.notesInput} value={notes} onChangeText={setNotes} multiline
                placeholder="e.g. Slow eccentric, pause at bottom" placeholderTextColor={COLORS.textMuted} />
            </>
          )}

          {/* STEP 2: Review */}
          {step === 2 && (
            <GlassView radius={16} style={s.reviewCard}>
              <Text style={s.reviewName}>{name || 'Unnamed'}</Text>
              <View style={s.reviewBadges}>
                <SetTypeBadge type={setType} />
                <Badge label={barType} variant="neutral" size="xs" />
              </View>
              {[
                { lbl: 'Sets',   val: String(sets) },
                { lbl: 'Reps',   val: isFailure ? 'To Failure' : setType === 'repRange' ? repsMin + '-' + repsMax : String(repsMin) },
                { lbl: 'Weight', val: weightUnit === 'bodyweight' ? 'Bodyweight' : weight + ' ' + weightUnit },
                { lbl: 'Bar',    val: BAR_TYPES.find(b => b.id === barType)?.label ?? barType },
              ].map((r, i) => (
                <View key={i} style={[s.reviewRow, i < 3 && s.reviewRowBorder]}>
                  <Text style={s.reviewLbl}>{r.lbl}</Text>
                  <Text style={s.reviewVal}>{r.val}</Text>
                </View>
              ))}
              {notes ? <Text style={s.reviewNotes}>{notes}</Text> : null}
            </GlassView>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom nav */}
        <View style={s.bottomNav}>
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={s.backNavBtn}>
              <GlassView radius={14} style={s.backNavInner}><Text style={s.backNavText}>Back</Text></GlassView>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.nextBtn} activeOpacity={0.9}
            onPress={step < 2 ? () => setStep(s => s + 1) : handleSave}>
            <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.nextGrad}>
              <Text style={s.nextText}>{step === 2 ? 'Add Exercise' : 'Continue'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({

  header:           { paddingHorizontal: 20, paddingBottom: 14 },
  backBtn:          { marginBottom: 6 },
  backText:         { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  title:            { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  steps:            { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 4 },
  stepRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot:          { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stepDotActive:    { borderColor: COLORS.accent },
  stepDotDone:      { borderColor: 'transparent' },
  stepDotGrad:      { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  stepCheckmark:    { fontSize: 13, fontWeight: '900', color: '#000' },
  stepNum:          { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
  stepNumActive:    { color: COLORS.accent },
  stepLabel:        { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  stepLabelActive:  { color: '#fff', fontWeight: '700' },
  stepLine:         { width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 1, marginLeft: 2 },
  stepLineDone:     { backgroundColor: COLORS.accent },
  scroll:           { paddingHorizontal: 20 },
  fieldLabel:       { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  nameInput:        { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, height: 52, paddingHorizontal: 16, color: '#fff', fontSize: 17, fontWeight: '600' },
  typeBtn:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  typeBtnActive:    { backgroundColor: 'rgba(123,94,250,0.10)', borderColor: 'rgba(123,94,250,0.40)' },
  typeIcon:         { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  typeIconActive:   {},
  typeIconGrad:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  typeIconText:     { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },
  typeIconTextActive: { fontSize: 14, fontWeight: '700', color: '#000' },
  typeName:         { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  typeNameActive:   { color: COLORS.accent },
  typeDesc:         { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  typeCheck:        { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeCheckText:    { fontSize: 12, fontWeight: '900', color: '#000' },
  counter:          { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 4 },
  counterBtn:       { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  counterBtnText:   { fontSize: 20, fontWeight: '700', color: '#fff' },
  counterValue:     { flex: 1, textAlign: 'center', fontSize: 34, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.5 },
  repRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repField:         { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  repSubLabel:      { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  repInput:         { fontSize: 22, fontWeight: '900', color: '#fff', height: 44, letterSpacing: -0.4 },
  repDash:          { fontSize: 18, color: COLORS.textMuted },
  failureNote:      { padding: 14 },
  failureTitle:     { fontSize: 15, fontWeight: '700', color: COLORS.danger, marginBottom: 3 },
  failureDesc:      { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  unitRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  unitBtn:          { borderRadius: 10, overflow: 'hidden' },
  unitBtnActive:    {},
  unitGrad:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  unitText:         { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: COLORS.textMuted, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  unitTextActive:   { fontSize: 13, fontWeight: '700', color: '#000' },
  barBtn:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  barBtnActive:     { backgroundColor: 'rgba(123,94,250,0.10)', borderColor: 'rgba(123,94,250,0.35)' },
  barLabel:         { fontSize: 15, fontWeight: '600', color: '#fff' },
  barLabelActive:   { color: COLORS.accent },
  barWeight:        { fontSize: 12, color: COLORS.textMuted },
  weightCounter:    { flexDirection: 'row', alignItems: 'center', padding: 12 },
  weightValue:      { flex: 1, textAlign: 'center', fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  weightUnit:       { fontSize: 13, fontWeight: '400', color: COLORS.textSecondary },
  notesInput:       { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, minHeight: 80 },
  reviewCard:       { padding: 20 },
  reviewName:       { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 8 },
  reviewBadges:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  reviewRowBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  reviewLbl:        { fontSize: 14, color: COLORS.textSecondary },
  reviewVal:        { fontSize: 14, fontWeight: '700', color: '#fff' },
  reviewNotes:      { marginTop: 12, fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  bottomNav:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32, backgroundColor: 'rgba(11,8,20,0.85)' },
  backNavBtn:       { borderRadius: 14 },
  backNavInner:     { height: 54, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  backNavText:      { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  nextBtn:          { flex: 1, borderRadius: 14, overflow: 'hidden' },
  nextGrad:         { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  nextText:         { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: -0.2 },
});
