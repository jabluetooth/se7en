import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import {
  GRAD, COLORS, MUSCLE_TAGS, MUSCLE_TAG_COLOR,
  SET_TYPE_LABELS, BAR_WEIGHTS,
} from '../../constants';
import { Exercise, SetType, WeightUnit } from '../../types';
import { EXERCISE_LIBRARY } from '../../data/exercises';
import { ExerciseLibraryItem } from '../../types';

// ─── Smart keyword → muscle-group mapping ────────────────────────────────────
// Maps day-label keywords to exercise library muscleGroup values

const KEYWORD_TO_GROUPS: Record<string, string[]> = {
  push:       ['Chest', 'Shoulders', 'Triceps'],
  pull:       ['Back', 'Biceps'],
  leg:        ['Legs'],
  legs:       ['Legs'],
  quad:       ['Legs'],
  hamstring:  ['Legs'],
  glute:      ['Legs'],
  chest:      ['Chest'],
  back:       ['Back'],
  shoulder:   ['Shoulders'],
  shoulders:  ['Shoulders'],
  arm:        ['Biceps', 'Triceps'],
  arms:       ['Biceps', 'Triceps'],
  bicep:      ['Biceps'],
  biceps:     ['Biceps'],
  tricep:     ['Triceps'],
  triceps:    ['Triceps'],
  core:       ['Core'],
  abs:        ['Core'],
  ab:         ['Core'],
  upper:      ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower:      ['Legs'],
  cardio:     [],      // show all
  full:       [],      // show all
};

// Library muscleGroup → muscleTags used on Exercise
const LIB_GROUP_TO_TAGS: Record<string, string[]> = {
  Chest:     ['Chest'],
  Back:      ['Back'],
  Shoulders: ['Shoulders'],
  Biceps:    ['Biceps'],
  Triceps:   ['Triceps'],
  Core:      ['Core'],
  Legs:      ['Quads', 'Hamstrings', 'Glutes'],
};

function getGroupsFromLabel(label: string): string[] {
  if (!label) return [];
  const words = label.toLowerCase().split(/\s+/);
  const groups = new Set<string>();
  words.forEach(w => {
    const matches = KEYWORD_TO_GROUPS[w];
    if (matches) matches.forEach(g => groups.add(g));
  });
  return [...groups];
}

// ─── Suggestion panel ─────────────────────────────────────────────────────────

interface SuggestionPanelProps {
  nameQuery:   string;
  dayLabel:    string;
  onSelect:    (item: ExerciseLibraryItem) => void;
}

function SuggestionPanel({ nameQuery, dayLabel, onSelect }: SuggestionPanelProps) {
  const suggestions = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();

    if (q.length >= 2) {
      // Name-based search
      return EXERCISE_LIBRARY
        .filter(ex => ex.name.toLowerCase().includes(q))
        .slice(0, 6);
    }

    // Day-label based suggestions
    const groups = getGroupsFromLabel(dayLabel);
    if (groups.length === 0) return EXERCISE_LIBRARY.slice(0, 6);
    return EXERCISE_LIBRARY
      .filter(ex => groups.includes(ex.muscleGroup))
      .slice(0, 8);
  }, [nameQuery, dayLabel]);

  if (suggestions.length === 0) return null;

  const label = nameQuery.trim().length >= 2
    ? 'Matching exercises'
    : `Suggested for "${dayLabel}"`;

  return (
    <View style={sp.container}>
      <Text style={sp.label}>{label}</Text>
      {suggestions.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onSelect(item)}
          style={sp.row}
          activeOpacity={0.75}
        >
          <View style={sp.rowLeft}>
            <Text style={sp.exName}>{item.name}</Text>
            <Text style={sp.exMeta}>
              {item.defaultSets} × {item.defaultRepsMin}–{item.defaultRepsMax}
              {item.defaultWeight > 0 ? ` @ ${item.defaultWeight} ${item.defaultUnit}` : ''}
            </Text>
          </View>
          <View style={[
            sp.groupBadge,
            { backgroundColor: (MUSCLE_TAG_COLOR[item.muscleGroup] ?? '#fff') + '1A',
              borderColor:      (MUSCLE_TAG_COLOR[item.muscleGroup] ?? '#fff') + '40' },
          ]}>
            <Text style={[sp.groupTxt, { color: MUSCLE_TAG_COLOR[item.muscleGroup] ?? COLORS.textSecondary }]}>
              {item.muscleGroup}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sp = StyleSheet.create({
  container:  { marginTop: 12, marginBottom: 4 },
  label:      { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 6 },
  rowLeft:    { flex: 1 },
  exName:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  exMeta:     { fontSize: 11, color: COLORS.textMuted },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  groupTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Form sheet ───────────────────────────────────────────────────────────────

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
  const [tags,       setTags      ] = useState<string[]>([]);
  const [setType,    setSetType   ] = useState<SetType>('standard');
  const [sets,       setSets      ] = useState('4');
  const [repsMin,    setRepsMin   ] = useState('8');
  const [repsMax,    setRepsMax   ] = useState('12');
  const [weight,     setWeight    ] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [notes,      setNotes     ] = useState('');
  const [page,       setPage      ] = useState<'basics' | 'volume' | 'tags'>('basics');

  useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name);
        setTags(initial.muscleTags ?? []);
        setSetType(initial.setType);
        setSets(String(initial.targetSets));
        setRepsMin(String(initial.targetRepsMin ?? 8));
        setRepsMax(String(initial.targetRepsMax ?? 12));
        setWeight(String(initial.targetWeight ?? ''));
        setWeightUnit(initial.weightUnit);
        setNotes(initial.notes ?? '');
      } else {
        setName(''); setTags([]); setSetType('standard');
        setSets('4'); setRepsMin('8'); setRepsMax('12');
        setWeight(''); setWeightUnit('kg'); setNotes('');
      }
      setPage('basics');
    }
  }, [visible, initial]);

  // Auto-suggest tags when day label changes (new exercise only)
  useEffect(() => {
    if (!initial && visible && tags.length === 0) {
      const groups = getGroupsFromLabel(dayLabel);
      if (groups.length > 0) {
        const suggestedTags = [...new Set(
          groups.flatMap(g => LIB_GROUP_TO_TAGS[g] ?? [])
        )];
        setTags(suggestedTags);
      }
    }
  }, [visible, dayLabel, initial]);

  const fillFromLibrary = (item: ExerciseLibraryItem) => {
    setName(item.name);
    setSets(String(item.defaultSets));
    setRepsMin(String(item.defaultRepsMin));
    setRepsMax(String(item.defaultRepsMax));
    setWeight(item.defaultWeight > 0 ? String(item.defaultWeight) : '');
    setWeightUnit(item.defaultUnit as WeightUnit);
    setTags(LIB_GROUP_TO_TAGS[item.muscleGroup] ?? []);
    setPage('volume');
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
      targetSets:    parseInt(sets, 10) || 3,
      targetRepsMin: setType === 'toFailure' ? null : parseInt(repsMin, 10) || null,
      targetRepsMax: setType === 'toFailure' ? null : parseInt(repsMax, 10) || null,
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#08090F' }}>
        <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {/* Handle */}
          <View style={f.handle} />

          {/* Header */}
          <View style={f.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={f.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={f.sheetTitle}>{isEdit ? 'Edit Exercise' : 'Add Exercise'}</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
              style={!canSave ? { opacity: 0.35 } : undefined}
            >
              <Text style={f.save}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Page tabs */}
          <View style={f.tabs}>
            {(['basics', 'volume', 'tags'] as const).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPage(p)}
                style={[f.tab, page === p && f.tabActive]}
                activeOpacity={0.8}
              >
                <Text style={[f.tabTxt, page === p && f.tabTxtActive]}>
                  {p === 'basics' ? 'Basics' : p === 'volume' ? 'Volume' : 'Muscles'}
                </Text>
                {/* Dot indicator: tags already selected */}
                {p === 'tags' && tags.length > 0 && (
                  <View style={f.tabDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={f.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Basics ── */}
              {page === 'basics' && (
                <>
                  <FieldLabel>Exercise Name</FieldLabel>
                  <GlassView opacity="mid" radius={12} style={f.inputWrap}>
                    <TextInput
                      style={f.nameInput}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Bench Press"
                      placeholderTextColor={COLORS.textMuted}
                      autoFocus={!isEdit}
                      returnKeyType="done"
                    />
                  </GlassView>

                  {/* Smart suggestions */}
                  <SuggestionPanel
                    nameQuery={name}
                    dayLabel={dayLabel}
                    onSelect={fillFromLibrary}
                  />

                  <FieldLabel style={{ marginTop: 20 }}>Set Type</FieldLabel>
                  <View style={f.setTypeGrid}>
                    {SET_TYPES.map(st => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setSetType(st)}
                        style={[f.setTypeBtn, setType === st && f.setTypeBtnActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[f.setTypeTxt, setType === st && f.setTypeTxtActive]}>
                          {SET_TYPE_LABELS[st]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <FieldLabel style={{ marginTop: 20 }}>Notes</FieldLabel>
                  <GlassView opacity="mid" radius={12} style={f.inputWrap}>
                    <TextInput
                      style={[f.nameInput, { minHeight: 60 }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Cues or reminders…"
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                    />
                  </GlassView>
                </>
              )}

              {/* ── Volume ── */}
              {page === 'volume' && (
                <>
                  <FieldLabel>Sets</FieldLabel>
                  <View style={f.stepperRow}>
                    <StepBtn onPress={() => setSets(s => String(Math.max(1, (parseInt(s)||1) - 1)))} icon="remove" />
                    <GlassView opacity="high" radius={12} style={f.stepperVal}>
                      <Text style={f.stepperNum}>{sets}</Text>
                    </GlassView>
                    <StepBtn onPress={() => setSets(s => String(Math.min(20, (parseInt(s)||1) + 1)))} icon="add" />
                  </View>

                  {setType !== 'toFailure' && (
                    <>
                      <FieldLabel style={{ marginTop: 24 }}>Reps</FieldLabel>
                      <View style={f.repsRow}>
                        {(
                          [
                            ['Min', repsMin, setRepsMin] as const,
                            ['Max', repsMax, setRepsMax] as const,
                          ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]
                        ).map(([lbl, val, set], i) => (
                          <React.Fragment key={lbl}>
                            <View style={f.repsField}>
                              <Text style={f.repsLbl}>{lbl}</Text>
                              <GlassView opacity="mid" radius={12} style={f.repsInput}>
                                <TextInput
                                  style={f.repsNum}
                                  value={val}
                                  onChangeText={set}
                                  keyboardType="numeric"
                                  selectTextOnFocus
                                />
                              </GlassView>
                            </View>
                            {i === 0 && <Text style={f.repsDash}>–</Text>}
                          </React.Fragment>
                        ))}
                      </View>
                    </>
                  )}
                  {setType === 'toFailure' && (
                    <Text style={f.failureNote}>No rep target for "To Failure" sets.</Text>
                  )}

                  <FieldLabel style={{ marginTop: 24 }}>Target Weight</FieldLabel>
                  <GlassView opacity="mid" radius={12} style={f.inputWrap}>
                    <TextInput
                      style={f.nameInput}
                      value={weight}
                      onChangeText={setWeight}
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                  </GlassView>

                  <FieldLabel style={{ marginTop: 16 }}>Weight Unit</FieldLabel>
                  <View style={f.unitRow}>
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
                </>
              )}

              {/* ── Muscles ── */}
              {page === 'tags' && (
                <>
                  {/* Context hint when day label implies muscles */}
                  {getGroupsFromLabel(dayLabel).length > 0 && (
                    <View style={f.contextBanner}>
                      <Ionicons name="sparkles-outline" size={13} color={COLORS.accent} />
                      <Text style={f.contextTxt}>
                        Suggested for <Text style={{ color: COLORS.accent }}>{dayLabel}</Text>
                      </Text>
                    </View>
                  )}
                  <Text style={f.tagHint}>
                    Select all muscle groups this exercise works.
                  </Text>
                  <View style={f.tagGrid}>
                    {MUSCLE_TAGS.map(tag => {
                      const active = tags.includes(tag);
                      const color  = MUSCLE_TAG_COLOR[tag] ?? COLORS.accent;
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleTag(tag)}
                          activeOpacity={0.8}
                          style={[
                            f.tagChip,
                            active
                              ? { backgroundColor: color + '22', borderColor: color + '66' }
                              : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.10)' },
                          ]}
                        >
                          {active && (
                            <Ionicons name="checkmark-circle" size={13} color={color} style={{ marginRight: 4 }} />
                          )}
                          <Text style={[f.tagChipTxt, { color: active ? color : COLORS.textSecondary }]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[f.fieldLabel, style]}>{children}</Text>;
}

function StepBtn({ onPress, icon }: { onPress: () => void; icon: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassView opacity="mid" radius={12} style={f.stepBtnInner}>
        <Ionicons name={icon as any} size={20} color={COLORS.textSecondary} />
      </GlassView>
    </TouchableOpacity>
  );
}

const f = StyleSheet.create({
  handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.20)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 },
  cancel:         { fontSize: 16, color: COLORS.accent },
  sheetTitle:     { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  save:           { fontSize: 16, fontWeight: '700', color: COLORS.accent },

  tabs:           { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 },
  tab:            { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabActive:      { backgroundColor: 'rgba(255,255,255,0.12)' },
  tabTxt:         { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTxtActive:   { color: '#fff', fontWeight: '700' },
  tabDot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.accent },

  scroll:         { paddingHorizontal: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },

  inputWrap:      { padding: 14 },
  nameInput:      { fontSize: 16, fontWeight: '600', color: '#fff', padding: 0 },

  setTypeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setTypeBtn:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' },
  setTypeBtnActive:{ borderColor: COLORS.accent, backgroundColor: 'rgba(10,132,255,0.12)' },
  setTypeTxt:     { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  setTypeTxtActive:{ color: COLORS.accent },

  stepperRow:     { flexDirection: 'row', alignItems: 'center', gap: 20, justifyContent: 'center', marginBottom: 4 },
  stepBtnInner:   { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepperVal:     { paddingHorizontal: 28, paddingVertical: 12, alignItems: 'center', minWidth: 80 },
  stepperNum:     { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },

  repsRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  repsField:      { flex: 1 },
  repsLbl:        { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  repsInput:      { padding: 0 },
  repsNum:        { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', height: 52, padding: 12 },
  repsDash:       { fontSize: 22, color: COLORS.textMuted, paddingBottom: 12 },
  failureNote:    { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 8 },

  unitRow:        { flexDirection: 'row', gap: 6 },
  unitBtn:        { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center' },
  unitBtnActive:  { borderColor: COLORS.accent, backgroundColor: 'rgba(10,132,255,0.12)' },
  unitTxt:        { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'capitalize' },
  unitTxtActive:  { color: COLORS.accent },

  contextBanner:  { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: 'rgba(10,132,255,0.08)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.20)', marginBottom: 12 },
  contextTxt:     { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  tagHint:        { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14, lineHeight: 18 },
  tagGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  tagChipTxt:     { fontSize: 13, fontWeight: '600' },
});
