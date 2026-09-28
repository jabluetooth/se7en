import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Modal, Animated, PanResponder, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { useFeedback } from '../../components/feedback/Feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, SPLIT_TYPES, FONTS } from '../../constants';
import { WorkoutDay, WorkoutPlan } from '../../types';
import { FeedbackHost } from '../../components/feedback/Feedback';
import { accentA, dangerA, ink, restA, themed } from '../../theme/runtime';

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
              <View
                {...panHandlersRef.current[idx]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Reorder ${d.label}`}
                accessibilityHint="Drag to change day order"
              >
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

const dd = themed(() => StyleSheet.create({
  dayRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, height: DAY_H, paddingHorizontal: 14 },
  dayRowLifted:{ backgroundColor: accentA(0.08), borderRadius: 12 },
  badge:       { width: 26, height: 26, borderRadius: 8, backgroundColor: accentA(0.18), alignItems: 'center', justifyContent: 'center' },
  badgeRest:   { backgroundColor: restA(0.12) },
  badgeNum:    { fontSize: 12, fontFamily: FONTS.headline, color: COLORS.accent },
  badgeNumRest:{ color: COLORS.rest },
  label:       { flex: 1, fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  sub:         { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  line:        { height: 2, marginHorizontal: 14, borderRadius: 1, backgroundColor: COLORS.accent },
  float:       {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
}));

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function PlanEditSheet({ visible, plan, onClose }: Props) {
  const { updatePlan, deletePlan } = usePlanStore();
  const { settings, setActivePlan } = useSettingsStore();
  const { confirm } = useFeedback();

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

  const handleCustomSplitSelect = async () => {
    const ok = await confirm({
      title: 'Start a custom split?',
      message: 'Every day is emptied so you can build your own. Your workout history stays.',
      confirmLabel: 'Clear and customise',
      destructive: true,
    });
    if (!ok) return;
    setSplitPreset('Custom');
    setLocalDays(prev => prev.map(d => ({ ...d, exercises: [], isRestDay: false })));
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${plan.name}?`,
      message: 'The plan, its exercises and the history linked to it are gone for good.',
      confirmLabel: 'Delete plan',
      destructive: true,
    });
    if (!ok) return;
    if (settings.activePlanId === plan.id) setActivePlan(null);
    deletePlan(plan.id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <LinearGradient colors={GRAD.bg} locations={GRAD.bgLocations} start={GRAD.bgStart} end={GRAD.bgEnd} style={StyleSheet.absoluteFill} />

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {/* Handle */}
          <View style={f.handle} />

          {/* Header */}
          <View style={f.header}>
            <AnimatedPressable onPress={onClose}>
              <Text style={f.cancel}>Cancel</Text>
            </AnimatedPressable>
            <Text style={f.title}>Plan Settings</Text>
            <AnimatedPressable
              onPress={handleSave}
              disabled={!name.trim()}
              style={!name.trim() ? { opacity: 0.35 } : undefined}
            >
              <Text style={f.save}>Save</Text>
            </AnimatedPressable>
          </View>

          <ScrollView
            contentContainerStyle={f.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Plan name ── */}
            <Text style={f.sectionLabel}>Plan Name</Text>
            <View style={f.inputCard}>
              <TextInput
                style={f.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. My PPL"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
                autoCorrect={false}
              />
            </View>

            {/* ── Split type ── */}
            <Text style={f.sectionLabel}>Split Type</Text>
            <View style={f.chipGrid}>
              {SPLIT_TYPES.map(sp => {
                const active = splitPreset === sp;
                return (
                  <AnimatedPressable
                    key={sp}
                    onPress={() => sp === 'Custom' ? handleCustomSplitSelect() : handleSplitPreset(sp)}
                    style={[f.chip, active && f.chipActive]}
                  >
                    {active
                      ? <Ionicons name="checkmark-circle" size={13} color={COLORS.accent} style={{ marginRight: 4 }} />
                      : null
                    }
                    <Text style={[f.chipTxt, active && f.chipTxtActive]}>{sp}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {splitPreset === 'Custom' && (
              <>
                <Text style={f.subLabel}>Custom name (optional)</Text>
                <View style={[f.inputCard, { marginTop: 6 }]}>
                  <TextInput
                    style={f.textInput}
                    value={customSplit}
                    onChangeText={setCustomSplit}
                    placeholder="e.g. Chest/Back/Arms…"
                    placeholderTextColor={COLORS.textMuted}
                    returnKeyType="done"
                  />
                </View>
              </>
            )}

            {/* ── Description ── */}
            <Text style={f.sectionLabel}>Description</Text>
            <View style={f.inputCard}>
              <TextInput
                style={[f.textInput, { minHeight: 64 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Goals, notes, or reminders…"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
            </View>

            {/* ── Days order ── */}
            <View style={f.daysHeader}>
              <Text style={f.sectionLabel}>Day Order</Text>
              <Text style={f.daysHint}>Hold ≡ and drag to rearrange</Text>
            </View>
            <View style={f.daysCard}>
              <DayDragSort days={localDays} onReorder={handleReorderDays} />
            </View>

            {/* ── Danger zone ── */}
            <View style={f.dangerSection}>
              <AnimatedPressable onPress={handleDelete} style={f.deleteBtn}>
                <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                <Text style={f.deleteTxt}>Delete Plan</Text>
              </AnimatedPressable>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
        <FeedbackHost />
      </View>
    </Modal>
  );
}

const f = themed(() => StyleSheet.create({
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: ink(0.2), alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  cancel:       { fontSize: 16, fontFamily: FONTS.body, color: COLORS.accent },
  title:        { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.48 },
  save:         { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.accent },

  scroll:       { paddingHorizontal: 20, paddingTop: 4 },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0, marginBottom: 10, marginTop: 20 },
  subLabel:     { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 8, marginBottom: 0 },

  inputCard:    { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },
  textInput:    { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.text, padding: 0 },

  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: ink(0.14), backgroundColor: ink(0.07) },
  chipActive:   { borderColor: COLORS.accent, backgroundColor: accentA(0.15) },
  chipTxt:      { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  chipTxtActive:{ color: COLORS.accent, fontFamily: FONTS.headline },

  daysHeader:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, marginTop: 20 },
  daysHint:     { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLabel },
  daysCard:     { paddingVertical: 4, overflow: 'hidden', borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },

  dangerSection:{ marginTop: 32, alignItems: 'center' },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: dangerA(0.25), backgroundColor: dangerA(0.08) },
  deleteTxt:    { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.danger },
}));
