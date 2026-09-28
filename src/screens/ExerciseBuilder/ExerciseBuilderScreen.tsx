import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { Button } from '../../components/common/Button';
import { COLORS, SPACING, SET_TYPE_LABELS, BORDER_RADIUS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { SetType, BarType, WeightUnit } from '../../types';
import { accentA, ink, themed } from '../../theme/runtime';

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

const STEP_LABELS = ['Basics', 'Volume', 'Review'] as const;

// ── Sub-components hoisted to module scope — declaring them inside the screen
// body would create a new component identity on every render and cause the
// entire step UI to unmount/remount on each keystroke.

function StepDot({ i, step, onJump }:
  { i: number; step: number; onJump: (i: number) => void }) {
  return (
    <View style={s.stepRow}>
      <AnimatedPressable
        onPress={() => i < step && onJump(i)}
        style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]}
      >
        {i < step ? (
          <View style={[s.stepDotGrad, { backgroundColor: COLORS.accent }]}>
            <Text style={s.stepCheckmark}>+</Text>
          </View>
        ) : (
          <Text style={[s.stepNum, i === step && s.stepNumActive]}>{i + 1}</Text>
        )}
      </AnimatedPressable>
      <Text style={[s.stepLabel, i === step && s.stepLabelActive]}>{STEP_LABELS[i]}</Text>
      {i < STEP_LABELS.length - 1 && <View style={[s.stepLine, i < step && s.stepLineDone]} />}
    </View>
  );
}

function LabelRow({ label }: { label: string }) {
  return <Text style={s.fieldLabel}>{label}</Text>;
}

function Counter({ value, onChange, min = 1, max = 20 }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={s.counter}>
      <AnimatedPressable onPress={() => onChange(Math.max(min, value - 1))} style={s.counterBtn}>
        <Text style={s.counterBtnText}>-</Text>
      </AnimatedPressable>
      <Text style={s.counterValue}>{value}</Text>
      <AnimatedPressable onPress={() => onChange(Math.min(max, value + 1))} style={s.counterBtn}>
        <Text style={s.counterBtnText}>+</Text>
      </AnimatedPressable>
    </View>
  );
}

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

  const isFailure = setType === 'toFailure';

  const handleSave = () => {
    onSave?.({ name, setType, sets, repsMin, repsMax, weight, weightUnit, barType, notes });
    onClose();
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <AnimatedPressable onPress={onClose} style={s.backBtn}>
            <Text style={s.backText}>{'<'} Back</Text>
          </AnimatedPressable>
          <Text style={s.title}>{name || 'New Exercise'}</Text>
        </View>

        {/* Step indicators */}
        <View style={s.steps}>
          {STEP_LABELS.map((_, i) => (
            <StepDot key={i} i={i} step={step} onJump={setStep} />
          ))}
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
                <AnimatedPressable key={st.id} onPress={() => setSetType(st.id)}
                  style={[s.typeBtn, setType === st.id && s.typeBtnActive]}>
                  <View style={[s.typeIcon, setType === st.id && s.typeIconActive]}>
                    {setType === st.id
                      ? <View style={[s.typeIconGrad, { backgroundColor: COLORS.accent }]}><Text style={s.typeIconTextActive}>{st.icon}</Text></View>
                      : <Text style={s.typeIconText}>{st.icon}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.typeName, setType === st.id && s.typeNameActive]}>{SET_TYPE_LABELS[st.id]}</Text>
                    <Text style={s.typeDesc}>{st.desc}</Text>
                  </View>
                  {setType === st.id && (
                    <View style={[s.typeCheck, { backgroundColor: COLORS.accent }]}>
                      <Text style={s.typeCheckText}>+</Text>
                    </View>
                  )}
                </AnimatedPressable>
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
                    <View style={s.repField}>
                      <Text style={s.repSubLabel}>Min</Text>
                      <TextInput style={s.repInput} value={String(repsMin)} onChangeText={v => setRepsMin(parseInt(v) || 0)} keyboardType="numeric" />
                    </View>
                    {setType === 'repRange' && (
                      <>
                        <Text style={s.repDash}>-</Text>
                        <View style={s.repField}>
                          <Text style={s.repSubLabel}>Max</Text>
                          <TextInput style={s.repInput} value={String(repsMax)} onChangeText={v => setRepsMax(parseInt(v) || 0)} keyboardType="numeric" />
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
              {isFailure && (
                <View style={s.failureNote}>
                  <Text style={s.failureTitle}>To Failure</Text>
                  <Text style={s.failureDesc}>Log actual reps reached after each set.</Text>
                </View>
              )}

              <LabelRow label="Weight Unit" />
              <View style={s.unitRow}>
                {WEIGHT_UNITS.map(u => (
                  <AnimatedPressable key={u} onPress={() => setWeightUnit(u)} style={[s.unitBtn, weightUnit === u && s.unitBtnActive]}>
                    {weightUnit === u
                      ? <View style={[s.unitGrad, { backgroundColor: COLORS.accent }]}><Text style={s.unitTextActive}>{u}</Text></View>
                      : <Text style={s.unitText}>{u}</Text>}
                  </AnimatedPressable>
                ))}
              </View>

              {weightUnit !== 'bodyweight' && (
                <>
                  <LabelRow label="Bar Type" />
                  {BAR_TYPES.map(bt => (
                    <AnimatedPressable key={bt.id} onPress={() => setBarType(bt.id)}
                      style={[s.barBtn, barType === bt.id && s.barBtnActive]}>
                      <Text style={[s.barLabel, barType === bt.id && s.barLabelActive]}>{bt.label}</Text>
                      <Text style={s.barWeight}>{bt.weight}</Text>
                    </AnimatedPressable>
                  ))}

                  <LabelRow label={'Target Weight (' + weightUnit + ')'} />
                  <View style={s.weightCounter}>
                    <AnimatedPressable onPress={() => setWeight(w => Math.max(0, w - 2.5))} style={s.counterBtn}>
                      <Text style={s.counterBtnText}>-</Text>
                    </AnimatedPressable>
                    <Text style={s.weightValue}>{weight} <Text style={s.weightUnit}>{weightUnit}</Text></Text>
                    <AnimatedPressable onPress={() => setWeight(w => w + 2.5)} style={s.counterBtn}>
                      <Text style={s.counterBtnText}>+</Text>
                    </AnimatedPressable>
                  </View>
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
            <AnimatedPressable onPress={() => setStep(s => s - 1)} style={s.backNavBtn}>
              <GlassView radius={14} style={s.backNavInner}><Text style={s.backNavText}>Back</Text></GlassView>
            </AnimatedPressable>
          )}
          <AnimatedPressable style={s.nextBtn}
            onPress={step < 2 ? () => setStep(s => s + 1) : handleSave}>
            <View style={[s.nextGrad, { backgroundColor: COLORS.accent }]}>
              <Text style={s.nextText}>{step === 2 ? 'Add Exercise' : 'Continue'}</Text>
            </View>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = themed(() => StyleSheet.create({

  header:           { paddingHorizontal: 20, paddingBottom: 14, zIndex: 10 },
  backBtn:          { marginBottom: 6 },
  backText:         { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  title:            { fontSize: 26, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1.04 },
  steps:            { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 4 },
  stepRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot:          { width: 24, height: 24, borderRadius: 12, backgroundColor: ink(0.08), borderWidth: 1, borderColor: ink(0.14), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stepDotActive:    { borderColor: COLORS.accent },
  stepDotDone:      { borderColor: 'transparent' },
  stepDotGrad:      { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  stepCheckmark:    { fontSize: 13, fontFamily: FONTS.display, color: COLORS.onAccent },
  stepNum:          { fontSize: 11, fontFamily: FONTS.display, color: COLORS.textMuted },
  stepNumActive:    { color: COLORS.accent },
  stepLabel:        { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  stepLabelActive:  { color: COLORS.text, fontFamily: FONTS.headline },
  stepLine:         { width: 20, height: 2, backgroundColor: ink(0.12), borderRadius: 1, marginLeft: 2 },
  stepLineDone:     { backgroundColor: COLORS.accent },
  scroll:           { paddingHorizontal: 20 },
  fieldLabel:       { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0, marginBottom: 8, marginTop: 16 },
  nameInput:        { backgroundColor: ink(0.06), borderWidth: 1, borderColor: ink(0.12), borderRadius: 12, height: 52, paddingHorizontal: 16, color: COLORS.text, fontSize: 17, fontFamily: FONTS.semibold },
  typeBtn:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: ink(0.05), borderWidth: 1, borderColor: ink(0.1) },
  typeBtnActive:    { backgroundColor: accentA(0.1), borderColor: accentA(0.4) },
  typeIcon:         { width: 34, height: 34, borderRadius: 10, backgroundColor: ink(0.08), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  typeIconActive:   {},
  typeIconGrad:     { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  typeIconText:     { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.textMuted },
  typeIconTextActive: { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.onAccent },
  typeName:         { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.45 },
  typeNameActive:   { color: COLORS.accent },
  typeDesc:         { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 1 },
  typeCheck:        { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeCheckText:    { fontSize: 12, fontFamily: FONTS.display, color: COLORS.onAccent },
  counter:          { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 4, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  counterBtn:       { width: 42, height: 42, borderRadius: 10, backgroundColor: ink(0.06), borderWidth: 1, borderColor: ink(0.12), alignItems: 'center', justifyContent: 'center' },
  counterBtnText:   { fontSize: 20, fontFamily: FONTS.headline, color: COLORS.text },
  counterValue:     { flex: 1, textAlign: 'center', fontSize: 34, fontFamily: FONTS.data, color: COLORS.accent, letterSpacing: -1.36 },
  repRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  repField:         { flex: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  repSubLabel:      { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0, marginBottom: 3 },
  repInput:         { fontSize: 22, fontFamily: FONTS.data, color: COLORS.text, height: 44, letterSpacing: -0.88 },
  repDash:          { fontSize: 18, fontFamily: FONTS.body, color: COLORS.textMuted },
  failureNote:      { padding: 14, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  failureTitle:     { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.danger, marginBottom: 3 },
  failureDesc:      { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 18 },
  unitRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  unitBtn:          { borderRadius: 10, overflow: 'hidden' },
  unitBtnActive:    {},
  unitGrad:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  unitText:         { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontFamily: FONTS.headline, color: COLORS.textMuted, backgroundColor: ink(0.06), borderRadius: 10, borderWidth: 1, borderColor: ink(0.12), overflow: 'hidden' },
  unitTextActive:   { fontSize: 13, fontFamily: FONTS.headline, color: COLORS.onAccent },
  barBtn:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: ink(0.05), borderWidth: 1, borderColor: ink(0.1) },
  barBtnActive:     { backgroundColor: accentA(0.1), borderColor: accentA(0.35) },
  barLabel:         { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.text },
  barLabelActive:   { color: COLORS.accent },
  barWeight:        { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  weightCounter:    { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  weightValue:      { flex: 1, textAlign: 'center', fontSize: 30, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -1.20 },
  weightUnit:       { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary },
  notesInput:       { backgroundColor: ink(0.05), borderWidth: 1, borderColor: ink(0.1), borderRadius: 12, padding: 12, color: COLORS.text, fontSize: 14, fontFamily: FONTS.body, minHeight: 80 },
  reviewCard:       { padding: 20 },
  reviewName:       { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.88, marginBottom: 8 },
  reviewBadges:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  reviewRowBorder:  { borderBottomWidth: 1, borderBottomColor: ink(0.07) },
  reviewLbl:        { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary },
  reviewVal:        { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.text },
  reviewNotes:      { marginTop: 12, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 18 },
  bottomNav:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 32, backgroundColor: COLORS.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  backNavBtn:       { borderRadius: 14 },
  backNavInner:     { height: 54, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  backNavText:      { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  nextBtn:          { flex: 1, borderRadius: 14, overflow: 'hidden' },
  nextGrad:         { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  nextText:         { fontSize: 16, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: -0.64 },
}));
