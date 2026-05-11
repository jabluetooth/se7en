import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { AppBackground } from '../../components/ui/AppBackground';
import {
  GRAD, COLORS, MUSCLE_TAGS, MUSCLE_TAG_COLOR,
  SET_TYPE_LABELS, BAR_WEIGHTS,
} from '../../constants';
import { Exercise, SetType, WeightUnit } from '../../types';
import { EXERCISE_LIBRARY } from '../../data/exercises';
import { ExerciseLibraryItem } from '../../types';

// ─── Keyword → muscle group mapping ──────────────────────────────────────────

const KEYWORD_TO_GROUPS: Record<string, string[]> = {
  push: ['Chest', 'Shoulders', 'Triceps'], pull: ['Back', 'Biceps'],
  leg: ['Legs'], legs: ['Legs'], quad: ['Legs'], hamstring: ['Legs'], glute: ['Legs'],
  chest: ['Chest'], back: ['Back'],
  shoulder: ['Shoulders'], shoulders: ['Shoulders'],
  arm: ['Biceps', 'Triceps'], arms: ['Biceps', 'Triceps'],
  bicep: ['Biceps'], biceps: ['Biceps'], tricep: ['Triceps'], triceps: ['Triceps'],
  core: ['Core'], abs: ['Core'], ab: ['Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Legs'], cardio: [], full: [],
};

const LIB_GROUP_TO_TAGS: Record<string, string[]> = {
  Chest: ['Chest'], Back: ['Back'], Shoulders: ['Shoulders'],
  Biceps: ['Biceps'], Triceps: ['Triceps'], Core: ['Core'],
  Legs: ['Quads', 'Hamstrings', 'Glutes'],
};

function getGroupsFromLabel(label: string): string[] {
  const groups = new Set<string>();
  label.toLowerCase().split(/\s+/).forEach(w => {
    (KEYWORD_TO_GROUPS[w] ?? []).forEach(g => groups.add(g));
  });
  return [...groups];
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  value, min, max, onChange,
}: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={st.row}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        style={st.btn}
        activeOpacity={0.7}
      >
        <Ionicons name="remove" size={20} color={value <= min ? COLORS.textLabel : COLORS.textSecondary} />
      </TouchableOpacity>
      <View style={st.val}>
        <Text style={st.num}>{value}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        style={st.btn}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={20} color={value >= max ? COLORS.textLabel : COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,240,220,0.07)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  val: { minWidth: 56, alignItems: 'center', paddingHorizontal: 12 },
  num: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
});

// ─── Search suggestions ───────────────────────────────────────────────────────

function Suggestions({
  query, dayLabel, onSelect,
}: { query: string; dayLabel: string; onSelect: (item: ExerciseLibraryItem) => void }) {
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      return EXERCISE_LIBRARY.filter(e => e.name.toLowerCase().includes(q)).slice(0, 5);
    }
    const groups = getGroupsFromLabel(dayLabel);
    const pool   = groups.length === 0
      ? EXERCISE_LIBRARY
      : EXERCISE_LIBRARY.filter(e => groups.includes(e.muscleGroup));
    return pool.slice(0, 5);
  }, [query, dayLabel]);

  if (items.length === 0) return null;

  return (
    <View style={sg.wrap}>
      <Text style={sg.label}>
        {query.trim().length >= 2 ? 'Matching' : `Suggested for "${dayLabel}"`}
      </Text>
      {items.map(item => (
        <TouchableOpacity key={item.id} style={sg.row} onPress={() => onSelect(item)} activeOpacity={0.75}>
          <View style={sg.left}>
            <Text style={sg.name}>{item.name}</Text>
            <Text style={sg.meta}>
              {item.defaultSets}×{item.defaultRepsMin}–{item.defaultRepsMax}
              {item.defaultWeight > 0 ? ` · ${item.defaultWeight}${item.defaultUnit}` : ''}
            </Text>
          </View>
          <View style={[sg.badge, { backgroundColor: (MUSCLE_TAG_COLOR[item.muscleGroup] ?? '#fff') + '22', borderColor: (MUSCLE_TAG_COLOR[item.muscleGroup] ?? '#fff') + '44' }]}>
            <Text style={[sg.badgeTxt, { color: MUSCLE_TAG_COLOR[item.muscleGroup] ?? COLORS.textSecondary }]}>
              {item.muscleGroup}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sg = StyleSheet.create({
  wrap:     { marginTop: 10, marginBottom: 6 },
  label:    { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)', backgroundColor: 'rgba(255,240,220,0.04)', marginBottom: 6 },
  left:     { flex: 1 },
  name:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  meta:     { fontSize: 11, color: COLORS.textMuted },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
});

// ─── Form ──────────────────────────────────────────────────────────────────────

interface Props {
  visible:   boolean;
  initial:   Exercise | null;
  dayLabel:  string;
  nextOrder: number;
  onSave:    (data: Omit<Exercise, 'id' | 'createdAt'>) => void;
  onClose:   () => void;
}

const SET_TYPES: SetType[] = [
  'standard', 'repRange', 'toFailure', 'superset', 'dropSet', 'pyramid', 'progressive',
];
const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb', 'bodyweight', 'plates'];

export function ExerciseFormSheet({ visible, initial, dayLabel, nextOrder, onSave, onClose }: Props) {
  const [name,       setName      ] = useState('');
  const [sets,       setSets      ] = useState(4);
  const [repsMin,    setRepsMin   ] = useState(8);
  const [repsMax,    setRepsMax   ] = useState(12);
  const [advanced,   setAdvanced  ] = useState(false);

  // Advanced fields
  const [setType,    setSetType   ] = useState<SetType>('repRange');
  const [weight,     setWeight    ] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [tags,       setTags      ] = useState<string[]>([]);
  const [notes,      setNotes     ] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setName(initial.name);
      setSets(initial.targetSets);
      setRepsMin(initial.targetRepsMin ?? 8);
      setRepsMax(initial.targetRepsMax ?? 12);
      setSetType(initial.setType);
      setWeight(initial.targetWeight ? String(initial.targetWeight) : '');
      setWeightUnit(initial.weightUnit);
      setTags(initial.muscleTags ?? []);
      setNotes(initial.notes ?? '');
      setAdvanced(false);
    } else {
      // Defaults + auto-suggest tags from day label
      setName(''); setSets(3); setRepsMin(8); setRepsMax(12);
      setSetType('repRange'); setWeight(''); setWeightUnit('kg'); setNotes('');
      setAdvanced(false);
      const groups = getGroupsFromLabel(dayLabel);
      setTags(groups.length > 0 ? [...new Set(groups.flatMap(g => LIB_GROUP_TO_TAGS[g] ?? []))] : []);
    }
  }, [visible, initial, dayLabel]);

  const fillFromLibrary = (item: ExerciseLibraryItem) => {
    setName(item.name);
    setSets(item.defaultSets);
    setRepsMin(item.defaultRepsMin);
    setRepsMax(item.defaultRepsMax);
    setWeight(item.defaultWeight > 0 ? String(item.defaultWeight) : '');
    setWeightUnit(item.defaultUnit as WeightUnit);
    setTags(LIB_GROUP_TO_TAGS[item.muscleGroup] ?? []);
    setSetType('repRange');
  };

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name:          name.trim(),
      order:         initial?.order ?? nextOrder,
      setType,
      supersetGroup: initial?.supersetGroup ?? null,
      targetSets:    sets,
      targetRepsMin: setType === 'toFailure' ? null : repsMin,
      targetRepsMax: setType === 'toFailure' ? null : repsMax,
      toFailure:     setType === 'toFailure',
      targetWeight:  weight ? parseFloat(weight) : null,
      weightUnit,
      barType:       initial?.barType  ?? 'barbell',
      barWeight:     initial?.barWeight ?? BAR_WEIGHTS['barbell'],
      perSetTargets: initial?.perSetTargets ?? null,
      notes:         notes.trim(),
      muscleTags:    tags,
    });
  };

  const isEdit  = initial !== null;
  const canSave = name.trim().length > 0;
  const showSuggestions = !isEdit || name.trim().length >= 2;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={f.handle} />

          {/* Header */}
          <View style={f.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={f.headerSide}>
              <Text style={f.cancel}>Cancel</Text>
            </TouchableOpacity>
            <TextInput
              style={f.titleInput}
              value={name}
              onChangeText={setName}
              placeholder="Exercise name…"
              placeholderTextColor="rgba(255,240,220,0.30)"
              returnKeyType="done"
              autoCorrect={false}
              autoFocus={!isEdit}
              textAlign="center"
            />
            <TouchableOpacity onPress={handleSave} disabled={!canSave} activeOpacity={0.8} style={[f.headerSide, f.headerRight, !canSave && { opacity: 0.35 }]}>
              <Text style={f.save}>Save</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={f.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              {showSuggestions && (
                <Suggestions query={name} dayLabel={dayLabel} onSelect={fillFromLibrary} />
              )}

              {/* ── Sets ── */}
              <View style={f.stackSection}>
                <Text style={f.fieldLabel}>Sets</Text>
                <View style={f.stepperWrap}>
                  <Stepper value={sets} min={1} max={20} onChange={setSets} />
                </View>
              </View>

              {/* ── Min Reps ── */}
              <View style={f.stackSection}>
                <Text style={f.fieldLabel}>Min Reps</Text>
                <View style={f.stepperWrap}>
                  <Stepper value={repsMin} min={1} max={100} onChange={v => { setRepsMin(v); if (v > repsMax) setRepsMax(v); }} />
                </View>
              </View>

              {/* ── Max Reps ── */}
              <View style={f.stackSection}>
                <Text style={f.fieldLabel}>Max Reps</Text>
                <View style={f.stepperWrap}>
                  <Stepper value={repsMax} min={1} max={100} onChange={v => { setRepsMax(v); if (v < repsMin) setRepsMin(v); }} />
                </View>
              </View>

              {/* ── Advanced toggle ── */}
              <TouchableOpacity
                onPress={() => setAdvanced(a => !a)}
                style={f.advancedToggle}
                activeOpacity={0.75}
              >
                <Text style={f.advancedLabel}>Advanced</Text>
                <View style={f.advancedRight}>
                  {tags.length > 0 && (
                    <View style={f.tagDot} />
                  )}
                  <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>

              {advanced && (
                <>
                  {/* Set type */}
                  <Text style={f.fieldLabel}>Set Type</Text>
                  <View style={f.chipGrid}>
                    {SET_TYPES.map(st => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setSetType(st)}
                        style={[f.chip, setType === st && f.chipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[f.chipTxt, setType === st && f.chipTxtActive]}>
                          {SET_TYPE_LABELS[st]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Weight */}
                  <View style={[f.quickRow, { marginTop: 20 }]}>
                    <View style={f.quickField}>
                      <Text style={f.fieldLabel}>Weight</Text>
                      <GlassView opacity="low" radius={12} style={f.weightWrap}>
                        <TextInput
                          style={f.weightInput}
                          value={weight}
                          onChangeText={setWeight}
                          placeholder="0"
                          placeholderTextColor="rgba(255,240,220,0.25)"
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      </GlassView>
                    </View>
                    <View style={f.quickDivider} />
                    <View style={f.quickField}>
                      <Text style={f.fieldLabel}>Unit</Text>
                      <View style={f.unitCol}>
                        {WEIGHT_UNITS.map(u => (
                          <TouchableOpacity
                            key={u}
                            onPress={() => setWeightUnit(u)}
                            style={[f.unitBtn, weightUnit === u && f.unitBtnActive]}
                            activeOpacity={0.8}
                          >
                            <Text style={[f.unitTxt, weightUnit === u && f.unitTxtActive]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Muscle tags */}
                  <Text style={[f.fieldLabel, { marginTop: 20 }]}>Muscles</Text>
                  <View style={f.chipGrid}>
                    {MUSCLE_TAGS.map(tag => {
                      const active = tags.includes(tag);
                      const color  = MUSCLE_TAG_COLOR[tag] ?? COLORS.accent;
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleTag(tag)}
                          activeOpacity={0.8}
                          style={[
                            f.chip,
                            active
                              ? { backgroundColor: color + '22', borderColor: color + '55' }
                              : undefined,
                          ]}
                        >
                          {active && <Ionicons name="checkmark-circle" size={12} color={color} style={{ marginRight: 3 }} />}
                          <Text style={[f.chipTxt, active && { color }]}>{tag}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Notes */}
                  <Text style={[f.fieldLabel, { marginTop: 20 }]}>Notes</Text>
                  <GlassView opacity="low" radius={12} style={f.notesWrap}>
                    <TextInput
                      style={f.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Cues, reminders…"
                      placeholderTextColor="rgba(255,240,220,0.25)"
                      multiline
                    />
                  </GlassView>
                </>
              )}

              {/* Save button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                style={[f.saveBtn, { opacity: canSave ? 1 : 0.35 }]}
                activeOpacity={0.85}
              >
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={f.saveGrad}>
                  <Text style={f.saveTxt}>{isEdit ? 'Save Changes' : 'Add Exercise'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const f = StyleSheet.create({
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,220,0.20)', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  headerSide:  { width: 60 },
  headerRight: { alignItems: 'flex-end' },
  cancel:      { fontSize: 16, color: COLORS.accent },
  titleInput:  { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3, textAlign: 'center', padding: 0 },
  save:        { fontSize: 16, fontWeight: '700', color: COLORS.accent },

  scroll:     { paddingHorizontal: 20, paddingTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },

  // Vertically stacked sections (sets, min reps, max reps)
  stackSection: { marginTop: 24 },
  stepperWrap:  { marginTop: 10 },

  // Side-by-side row (used in advanced weight/unit section)
  quickRow:    { flexDirection: 'row', gap: 0, marginTop: 20 },
  quickField:  { flex: 1 },
  quickDivider:{ width: 1, backgroundColor: 'rgba(255,240,220,0.07)', marginHorizontal: 16, marginTop: 24 },

  // Advanced toggle
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,240,220,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.09)' },
  advancedLabel:  { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  advancedRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },

  // Chips
  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.06)' },
  chipActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(255,140,0,0.14)' },
  chipTxt:    { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.accent },

  // Weight
  weightWrap:  { paddingHorizontal: 14, paddingVertical: 14 },
  weightInput: { fontSize: 22, fontWeight: '700', color: '#fff', padding: 0, textAlign: 'center' },

  // Unit
  unitCol:    { gap: 6 },
  unitBtn:    { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)', alignItems: 'center' },
  unitBtnActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(255,140,0,0.12)' },
  unitTxt:    { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  unitTxtActive: { color: COLORS.accent },

  // Notes
  notesWrap:  { paddingHorizontal: 14, paddingVertical: 12 },
  notesInput: { fontSize: 15, color: '#fff', padding: 0, minHeight: 60 },

  // Save
  saveBtn:    { marginTop: 28, borderRadius: 14, overflow: 'hidden' },
  saveGrad:   { paddingVertical: 16, alignItems: 'center' },
  saveTxt:    { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});
