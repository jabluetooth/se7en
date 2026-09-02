import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppBackground } from '../../components/ui/AppBackground';
import {
  COLORS, MUSCLE_TAGS, MUSCLE_TAG_COLOR,
  SET_TYPE_LABELS, BAR_WEIGHTS, FONTS,
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
    <View
      style={st.row}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[
        { name: 'increment', label: 'Increase' },
        { name: 'decrement', label: 'Decrease' },
      ]}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
      }}
    >
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        style={st.btn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        disabled={value <= min}
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
        accessibilityRole="button"
        accessibilityLabel="Increase"
        disabled={value >= max}
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
  num: { fontSize: 26, fontWeight: '800', fontFamily: FONTS.data, color: '#fff', letterSpacing: -1.04 },
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
  label:    { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)', backgroundColor: 'rgba(255,240,220,0.04)', marginBottom: 6 },
  left:     { flex: 1 },
  name:     { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff', marginBottom: 2 },
  meta:     { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  badge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: '700', fontFamily: FONTS.headline },
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

const TIMER_MAX  = 300; // 5 minutes
const TIMER_STEP = 15;  // snap every 15 s

// ─── Rest Timer Slider ────────────────────────────────────────────────────────

function RestTimerSlider({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  // trackWRef: always-current width read by PanResponder callbacks (avoids stale closure).
  // trackW state: triggers a re-render so fill + thumb positions update after layout.
  const trackWRef   = useRef(1);
  const [trackW, setTrackW] = useState(1);
  // onChangeRef keeps the callback fresh without recreating the PanResponder.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const snap = (raw: number) =>
    Math.round(Math.max(0, Math.min(TIMER_MAX, raw)) / TIMER_STEP) * TIMER_STEP;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) =>
      onChangeRef.current(snap((e.nativeEvent.locationX / trackWRef.current) * TIMER_MAX)),
    onPanResponderMove: (e) =>
      onChangeRef.current(snap((e.nativeEvent.locationX / trackWRef.current) * TIMER_MAX)),
  })).current;

  const pct    = value / TIMER_MAX;
  const fillW  = trackW * pct;
  // Keep thumb fully within the track: left-clamp at 0, right-clamp so thumb doesn't overflow
  const thumbL = Math.max(0, Math.min(trackW - 22, trackW * pct - 11));

  const fmt = (s: number) =>
    s === 0 ? 'Off' : s < 60 ? `${s}s` : Number.isInteger(s / 60) ? `${s / 60}min` : `${s}s`;

  const TICKS = [0, 60, 120, 180, 240, 300];

  return (
    <View>
      <View
        {...pan.panHandlers}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          trackWRef.current = w;
          setTrackW(w);
        }}
        style={sl.track}
        accessibilityRole="adjustable"
        accessibilityLabel="Rest timer duration"
        accessibilityValue={{ min: 0, max: TIMER_MAX, now: value, text: fmt(value) }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase rest timer' },
          { name: 'decrement', label: 'Decrease rest timer' },
        ]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'increment') onChangeRef.current(snap(value + TIMER_STEP));
          if (e.nativeEvent.actionName === 'decrement') onChangeRef.current(snap(value - TIMER_STEP));
        }}
      >
        <View style={sl.trackBg} />
        <View style={[sl.trackFg, { width: fillW }]} />
        <View style={[sl.thumb, { left: thumbL }]} pointerEvents="none" />
      </View>

      <View style={sl.ticks}>
        {TICKS.map(t => {
          const active = Math.abs(value - t) < TIMER_STEP / 2;
          return (
            <View key={t} style={sl.tickWrap}>
              <View style={[sl.tick, active && sl.tickActive]} />
              <Text style={[sl.tickLbl, active && sl.tickLblActive]}>{fmt(t)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  track:    { height: 36, justifyContent: 'center', marginBottom: 2 },
  trackBg:  { position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,240,220,0.12)' },
  trackFg:  { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  thumb:    { position: 'absolute', top: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
              shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  ticks:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tickWrap: { alignItems: 'center', gap: 3 },
  tick:     { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,240,220,0.18)' },
  tickActive:   { backgroundColor: COLORS.accent },
  tickLbl:      { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textLabel, fontWeight: '500' },
  tickLblActive:{ fontFamily: FONTS.headline, color: COLORS.accent, fontWeight: '700' },
});

const SET_TYPES: SetType[] = [
  'standard', 'repRange', 'toFailure', 'superset', 'dropSet', 'pyramid', 'progressive',
];
const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb', 'bodyweight', 'plates'];

export function ExerciseFormSheet({ visible, initial, dayLabel, nextOrder, onSave, onClose }: Props) {
  const [name,       setName      ] = useState('');
  const [sets,       setSets      ] = useState(4);
  const [repsMin,    setRepsMin   ] = useState(8);
  const [repsMax,    setRepsMax   ] = useState(12);
  const [restTimerSecs, setRestTimerSecs] = useState(90);
  const [advanced,      setAdvanced     ] = useState(false);

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
      setRestTimerSecs(initial.restTimerSecs ?? 90);
      setAdvanced(false);
    } else {
      // Defaults + auto-suggest tags from day label
      setName(''); setSets(3); setRepsMin(8); setRepsMax(12);
      setSetType('repRange'); setWeight(''); setWeightUnit('kg'); setNotes('');
      setRestTimerSecs(90);
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
      restTimerSecs: restTimerSecs,
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
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={f.handle} />

          {/* Header */}
          <View style={f.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={f.headerSide} accessibilityRole="button" accessibilityLabel="Cancel">
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
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
              style={[f.headerSide, f.headerRight, !canSave && { opacity: 0.35 }]}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
            >
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

              {/* ── Rest Timer ── */}
              <View style={f.stackSection}>
                <View style={f.restHeader}>
                  <Text style={f.fieldLabel}>Rest Timer</Text>
                  <Text style={f.restCurrent}>
                    {restTimerSecs === 0
                      ? 'Off'
                      : restTimerSecs < 60
                      ? `${restTimerSecs}s`
                      : Number.isInteger(restTimerSecs / 60)
                      ? `${restTimerSecs / 60}min`
                      : `${restTimerSecs}s`}
                  </Text>
                </View>
                <RestTimerSlider value={restTimerSecs} onChange={setRestTimerSecs} />
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
                  <Text style={[f.fieldLabel, { marginTop: 20 }]}>Set Type</Text>
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
                      <View style={f.weightWrap}>
                        <TextInput
                          style={f.weightInput}
                          value={weight}
                          onChangeText={setWeight}
                          placeholder="0"
                          placeholderTextColor="rgba(255,240,220,0.25)"
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      </View>
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
                  <View style={f.notesWrap}>
                    <TextInput
                      style={f.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Cues, reminders…"
                      placeholderTextColor="rgba(255,240,220,0.25)"
                      multiline
                    />
                  </View>
                </>
              )}

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
  cancel:      { fontSize: 16, fontFamily: FONTS.body, color: COLORS.accent },
  titleInput:  { flex: 1, fontSize: 17, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.51, textAlign: 'center', padding: 0 },
  save:        { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent },

  scroll:     { paddingHorizontal: 20, paddingTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },

  // Vertically stacked sections (sets, min reps, max reps)
  stackSection: { marginTop: 24 },
  stepperWrap:  { marginTop: 10 },

  // Side-by-side row (used in advanced weight/unit section)
  quickRow:    { flexDirection: 'row', gap: 0, marginTop: 20 },
  quickField:  { flex: 1 },
  quickDivider:{ width: 1, backgroundColor: 'rgba(255,240,220,0.07)', marginHorizontal: 16, marginTop: 24 },

  // Rest timer
  restHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  restCurrent: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent },

  // Advanced toggle
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,240,220,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.09)' },
  advancedLabel:  { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  advancedRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },

  // Chips
  chipGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.06)' },
  chipActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(255,140,0,0.14)' },
  chipTxt:    { fontSize: 13, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.accent },

  // Weight
  weightWrap:  { paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  weightInput: { fontSize: 22, fontWeight: '700', color: '#fff', padding: 0, textAlign: 'center' },

  // Unit
  unitCol:    { gap: 6 },
  unitBtn:    { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)', alignItems: 'center' },
  unitBtnActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(255,140,0,0.12)' },
  unitTxt:    { fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  unitTxtActive: { color: COLORS.accent },

  // Notes
  notesWrap:  { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  notesInput: { fontSize: 15, fontFamily: FONTS.body, color: '#fff', padding: 0, minHeight: 60 },
});
