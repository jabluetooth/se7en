import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Alert, Animated, PanResponder,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, SPLIT_TYPES } from '../../constants';
import { WorkoutDay, WorkoutPlan } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  visible:  boolean;
  plan:     WorkoutPlan;
  onClose:  () => void;
}

// ─── Day drag-sort ────────────────────────────────────────────────────────────

const DAY_H = 52;

interface DayDragProps {
  days:      WorkoutDay[];
  onReorder: (newDays: WorkoutDay[]) => void;
}

function DayDragSort({ days, onReorder }: DayDragProps) {
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const dragFromRef     = useRef<number | null>(null);
  const dropToRef       = useRef<number | null>(null);
  const floatY          = useRef(new Animated.Value(0)).current;
  const daysRef         = useRef(days);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTo,   setDropTo  ] = useState<number | null>(null);
  const snapshotRef = useRef<WorkoutDay[]>(days);

  // Keep daysRef current without triggering handler recreation
  daysRef.current = days;

  // ── Stable handler refs — built once per item, not on every render ──────────
  // Re-created only when the number of days changes.
  const panHandlersRef = useRef<any[]>([]);

  if (panHandlersRef.current.length !== days.length) {
    panHandlersRef.current = days.map((_, idx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  (_, gs) =>
          Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,

        onPanResponderGrant: () => {
          containerRef.current?.measureInWindow((_x, y) => {
            containerTopRef.current = y;
          });
          snapshotRef.current = daysRef.current;
          dragFromRef.current = idx;
          dropToRef.current   = idx;
          floatY.setValue(idx * DAY_H);
          setDragFrom(idx);
          setDropTo(idx);
        },

        onPanResponderMove: (evt) => {
          const relY  = evt.nativeEvent.pageY - containerTopRef.current;
          floatY.setValue(relY - DAY_H / 2);
          const newTo = Math.max(0, Math.min(daysRef.current.length - 1, Math.round(relY / DAY_H)));
          // Only re-render when the target slot actually changes
          if (newTo !== dropToRef.current) {
            dropToRef.current = newTo;
            setDropTo(newTo);
          }
        },

        onPanResponderRelease: () => {
          const from = dragFromRef.current ?? 0;
          const to   = dropToRef.current   ?? from;
          if (from !== to) {
            LayoutAnimation.configureNext({
              duration: 220,
              update: { type: LayoutAnimation.Types.easeInEaseOut },
            });
            const contents = [...snapshotRef.current].map(d => ({
              label: d.label, isRestDay: d.isRestDay, exercises: d.exercises,
            }));
            const [removed] = contents.splice(from, 1);
            contents.splice(to, 0, removed);
            const newDays = snapshotRef.current.map((d, i) => ({
              ...d,
              label:     contents[i].label,
              isRestDay: contents[i].isRestDay,
              exercises: contents[i].exercises,
            }));
            onReorder(newDays);
          }
          dragFromRef.current = null;
          dropToRef.current   = null;
          setDragFrom(null);
          setDropTo(null);
        },

        onPanResponderTerminate: () => {
          dragFromRef.current = null;
          dropToRef.current   = null;
          setDragFrom(null);
          setDropTo(null);
        },
      }).panHandlers,
    );
  }

  return (
    <View ref={containerRef}>
      {days.map((d, idx) => {
        const isActive  = dragFrom === idx;
        const showAbove = dropTo === idx && dragFrom !== null && dragFrom > idx;
        const showBelow = dropTo === idx && dragFrom !== null && dragFrom < idx;

        return (
          <View key={d.id}>
            {showAbove && <View style={dd.line} />}

            <View style={[dd.dayRow, isActive && { opacity: 0.15 }]}>
              {/* Stable drag handle — uses pre-built handler ref */}
              <View {...panHandlersRef.current[idx]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="reorder-three-outline" size={20} color={COLORS.textMuted} />
              </View>

              <View style={[dd.badge, d.isRestDay && dd.badgeRest]}>
                <Text style={[dd.badgeNum, d.isRestDay && dd.badgeNumRest]}>
                  {d.dayPosition}
                </Text>
              </View>

              <Text style={dd.label} numberOfLines={1}>{d.label}</Text>

              <Text style={dd.sub}>
                {d.isRestDay ? 'Rest' : `${d.exercises.length} ex`}
              </Text>
            </View>

            {showBelow && <View style={dd.line} />}
          </View>
        );
      })}

      {/* Floating copy */}
      {dragFrom !== null && (
        <Animated.View
          style={[dd.float, { transform: [{ translateY: floatY }] }]}
          pointerEvents="none"
        >
          <View style={[dd.dayRow, dd.dayRowLifted]}>
            <Ionicons name="reorder-three-outline" size={20} color={COLORS.textMuted} />
            <View style={[dd.badge, snapshotRef.current[dragFrom]?.isRestDay && dd.badgeRest]}>
              <Text style={[dd.badgeNum, snapshotRef.current[dragFrom]?.isRestDay && dd.badgeNumRest]}>
                {snapshotRef.current[dragFrom]?.dayPosition}
              </Text>
            </View>
            <Text style={dd.label} numberOfLines={1}>{snapshotRef.current[dragFrom]?.label}</Text>
            <Text style={dd.sub}>
              {snapshotRef.current[dragFrom]?.isRestDay
                ? 'Rest'
                : `${snapshotRef.current[dragFrom]?.exercises.length} ex`}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  dayRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, height: DAY_H, paddingHorizontal: 14 },
  dayRowLifted:{ backgroundColor: 'rgba(255,140,0,0.08)', borderRadius: 12 },
  badge:       { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,140,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  badgeRest:   { backgroundColor: 'rgba(100,210,255,0.12)' },
  badgeNum:    { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  badgeNumRest:{ color: COLORS.rest },
  label:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  sub:         { fontSize: 12, color: COLORS.textMuted },
  line:        { height: 2, marginHorizontal: 14, borderRadius: 1, backgroundColor: COLORS.accent },
  float:       {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
});

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function PlanEditSheet({ visible, plan, onClose }: Props) {
  const { updatePlan, deletePlan } = usePlanStore();
  const { settings, setActivePlan } = useSettingsStore();

  const [name,        setName      ] = useState('');
  const [splitPreset, setSplitPreset] = useState('');
  const [customSplit, setCustomSplit] = useState('');
  const [description, setDescription] = useState('');

  // Local copy of days for drag preview (before committing)
  const [localDays, setLocalDays] = useState<WorkoutDay[]>([]);

  useEffect(() => {
    if (visible) {
      setName(plan.name);
      const preset = SPLIT_TYPES.includes(plan.splitType as any) ? plan.splitType : 'Custom';
      setSplitPreset(preset);
      setCustomSplit(preset === 'Custom' ? plan.splitType : '');
      setDescription(plan.description ?? '');
      setLocalDays([...plan.days].sort((a, b) => a.dayPosition - b.dayPosition));
    }
  }, [visible, plan]);

  const effectiveSplitType = splitPreset === 'Custom'
    ? (customSplit.trim() || 'Custom')
    : splitPreset;

  const handleSave = () => {
    if (!name.trim()) return;
    updatePlan(plan.id, {
      name:        name.trim(),
      splitType:   effectiveSplitType,
      description: description.trim(),
      days:        localDays,
    });
    onClose();
  };

  // Only update local state during drag — persist happens in handleSave
  const handleReorderDays = (newDays: WorkoutDay[]) => {
    setLocalDays(newDays);
  };

  const handleSplitPreset = (sp: string) => {
    if (sp === 'Custom') {
      setSplitPreset('Custom');
      return;
    }
    if (splitPreset !== sp) {
      setSplitPreset(sp);
    }
  };

  const handleCustomSplitSelect = () => {
    Alert.alert(
      'Use Custom Split?',
      'This will clear all exercises from every day. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Use Custom',
          style: 'destructive',
          onPress: () => {
            setSplitPreset('Custom');
            setLocalDays(prev => prev.map(d => ({ ...d, exercises: [], isRestDay: false })));
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete "${plan.name}"?`,
      'All exercises and history linked to this plan will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Plan',
          style: 'destructive',
          onPress: () => {
            if (settings.activePlanId === plan.id) setActivePlan(null);
            deletePlan(plan.id);
            onClose();
          },
        },
      ],
    );
  };

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
            <Text style={f.title}>Plan Settings</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!name.trim()}
              activeOpacity={0.8}
              style={!name.trim() ? { opacity: 0.35 } : undefined}
            >
              <Text style={f.save}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={f.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Plan name ── */}
            <Text style={f.sectionLabel}>Plan Name</Text>
            <GlassView opacity="mid" radius={14} style={f.inputCard}>
              <TextInput
                style={f.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. My PPL"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
                autoCorrect={false}
              />
            </GlassView>

            {/* ── Split type ── */}
            <Text style={f.sectionLabel}>Split Type</Text>
            <View style={f.chipGrid}>
              {SPLIT_TYPES.map(sp => {
                const active = splitPreset === sp;
                return (
                  <TouchableOpacity
                    key={sp}
                    onPress={() => sp === 'Custom' ? handleCustomSplitSelect() : handleSplitPreset(sp)}
                    activeOpacity={0.8}
                    style={[f.chip, active && f.chipActive]}
                  >
                    {active
                      ? <Ionicons name="checkmark-circle" size={13} color={COLORS.accent} style={{ marginRight: 4 }} />
                      : null
                    }
                    <Text style={[f.chipTxt, active && f.chipTxtActive]}>{sp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {splitPreset === 'Custom' && (
              <>
                <Text style={f.subLabel}>Custom name (optional)</Text>
                <GlassView opacity="mid" radius={14} style={[f.inputCard, { marginTop: 6 }]}>
                  <TextInput
                    style={f.textInput}
                    value={customSplit}
                    onChangeText={setCustomSplit}
                    placeholder="e.g. Chest/Back/Arms…"
                    placeholderTextColor={COLORS.textMuted}
                    returnKeyType="done"
                  />
                </GlassView>
              </>
            )}

            {/* ── Description ── */}
            <Text style={f.sectionLabel}>Description</Text>
            <GlassView opacity="mid" radius={14} style={f.inputCard}>
              <TextInput
                style={[f.textInput, { minHeight: 64 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Goals, notes, or reminders…"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </GlassView>

            {/* ── Days order ── */}
            <View style={f.daysHeader}>
              <Text style={f.sectionLabel}>Day Order</Text>
              <Text style={f.daysHint}>Hold ≡ and drag to rearrange</Text>
            </View>
            <GlassView opacity="low" radius={14} style={f.daysCard}>
              <DayDragSort days={localDays} onReorder={handleReorderDays} />
            </GlassView>

            {/* ── Danger zone ── */}
            <View style={f.dangerSection}>
              <TouchableOpacity onPress={handleDelete} style={f.deleteBtn} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                <Text style={f.deleteTxt}>Delete Plan</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const f = StyleSheet.create({
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,220,0.20)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  cancel:       { fontSize: 16, color: COLORS.accent },
  title:        { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  save:         { fontSize: 16, fontWeight: '700', color: COLORS.accent },

  scroll:       { paddingHorizontal: 20, paddingTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1.0, marginBottom: 10, marginTop: 20 },
  subLabel:     { fontSize: 11, color: COLORS.textMuted, marginTop: 8, marginBottom: 0 },

  inputCard:    { paddingHorizontal: 14, paddingVertical: 13 },
  textInput:    { fontSize: 16, fontWeight: '600', color: '#fff', padding: 0 },

  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.14)', backgroundColor: 'rgba(255,240,220,0.07)' },
  chipActive:   { borderColor: COLORS.accent, backgroundColor: 'rgba(255,140,0,0.15)' },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive:{ color: COLORS.accent, fontWeight: '700' },

  daysHeader:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, marginTop: 20 },
  daysHint:     { fontSize: 11, color: COLORS.textLabel },
  daysCard:     { paddingVertical: 4, overflow: 'hidden' },

  dangerSection:{ marginTop: 32, alignItems: 'center' },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)', backgroundColor: 'rgba(255,69,58,0.08)' },
  deleteTxt:    { fontSize: 15, fontWeight: '600', color: COLORS.danger },
});
