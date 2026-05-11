import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Animated, PanResponder,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { COLORS, MUSCLE_TAG_COLOR } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { Exercise, WorkoutDay } from '../../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_H = 64;

interface Props {
  day:    WorkoutDay;
  planId: string;
  onBack: () => void;
}

// ─── Drag-to-reorder list (reorder only, no add/edit/delete) ─────────────────

interface DragListProps {
  exercises: Exercise[];
  onReorder: (ids: string[]) => void;
}

function DragList({ exercises, onReorder }: DragListProps) {
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const dragFromRef     = useRef<number | null>(null);
  const dropToRef       = useRef<number | null>(null);
  const floatY          = useRef(new Animated.Value(0)).current;

  // Always-current reference to exercises — prevents stale closures in gesture handlers
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTo,   setDropTo  ] = useState<number | null>(null);
  const snapshotRef = useRef<Exercise[]>(exercises);

  // Measure container on layout so the offset is always fresh when a drag starts
  const onContainerLayout = () => {
    containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
  };

  // Cache one PanResponder per exercise ID — never recreated on re-render
  const panCache = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  // Remove stale entries when exercises change (e.g. after deletion)
  useEffect(() => {
    const ids = new Set(exercises.map(e => e.id));
    Object.keys(panCache.current).forEach(id => {
      if (!ids.has(id)) delete panCache.current[id];
    });
  }, [exercises]);

  function getHandlers(exerciseId: string) {
    if (!panCache.current[exerciseId]) {
      panCache.current[exerciseId] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,

        onPanResponderGrant: () => {
          // Re-measure in case scroll position changed since last layout
          containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
          const exs = exercisesRef.current;
          const idx = exs.findIndex(e => e.id === exerciseId);
          snapshotRef.current = exs;
          dragFromRef.current = idx;
          dropToRef.current   = idx;
          floatY.setValue(idx * ITEM_H);
          setDragFrom(idx);
          setDropTo(idx);
        },

        onPanResponderMove: (evt) => {
          const relY = evt.nativeEvent.pageY - containerTopRef.current;
          floatY.setValue(relY - ITEM_H / 2);
          const len = exercisesRef.current.length;
          const to  = Math.max(0, Math.min(len - 1, Math.round(relY / ITEM_H)));
          dropToRef.current = to;
          setDropTo(to);
        },

        onPanResponderRelease: () => {
          const from = dragFromRef.current ?? 0;
          const to   = dropToRef.current   ?? from;
          if (from !== to) {
            LayoutAnimation.configureNext({ duration: 240, update: { type: LayoutAnimation.Types.easeInEaseOut } });
            const ids = exercisesRef.current.map(e => e.id);
            const [item] = ids.splice(from, 1);
            ids.splice(to, 0, item);
            onReorder(ids);
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
      });
    }
    return panCache.current[exerciseId].panHandlers;
  }

  return (
    <View ref={containerRef} onLayout={onContainerLayout}>
      {exercises.map((ex, idx) => {
        const isActive  = dragFrom === idx;
        const showAbove = dropTo === idx && dragFrom !== null && dragFrom > idx;
        const showBelow = dropTo === idx && dragFrom !== null && dragFrom < idx;
        const tags      = (ex.muscleTags ?? []).slice(0, 2);

        return (
          <View key={ex.id}>
            {showAbove && <View style={dl.line} />}

            <View style={[dl.row, isActive && { opacity: 0.15 }]}>
              {/* Drag handle — handlers stable across re-renders */}
              <View {...getHandlers(ex.id)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={dl.handle}>
                <Ionicons name="reorder-three-outline" size={22} color={COLORS.textMuted} />
              </View>

              <View style={dl.badge}>
                <Text style={dl.badgeNum}>{idx + 1}</Text>
              </View>

              <View style={dl.info}>
                <Text style={dl.name} numberOfLines={1}>{ex.name}</Text>
                {tags.length > 0 && (
                  <View style={dl.tagsRow}>
                    {tags.map(t => (
                      <View key={t} style={[dl.tag, { backgroundColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '22', borderColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '44' }]}>
                        <Text style={[dl.tagTxt, { color: MUSCLE_TAG_COLOR[t] ?? COLORS.textSecondary }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <Text style={dl.setInfo}>
                {ex.targetSets}×{ex.targetRepsMin ?? '–'}{ex.targetRepsMax && ex.targetRepsMax !== ex.targetRepsMin ? `–${ex.targetRepsMax}` : ''}
              </Text>
            </View>

            {showBelow && <View style={dl.line} />}
          </View>
        );
      })}

      {/* Floating ghost of dragged item */}
      {dragFrom !== null && (
        <Animated.View style={[dl.float, { transform: [{ translateY: floatY }] }]} pointerEvents="none">
          <View style={[dl.row, dl.rowLifted]}>
            <Ionicons name="reorder-three-outline" size={22} color={COLORS.textMuted} style={dl.handle} />
            <View style={dl.badge}>
              <Text style={dl.badgeNum}>{dragFrom + 1}</Text>
            </View>
            <View style={dl.info}>
              <Text style={dl.name} numberOfLines={1}>{snapshotRef.current[dragFrom]?.name}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const dl = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', height: ITEM_H, gap: 10, paddingRight: 4 },
  rowLifted:{ backgroundColor: 'rgba(255,140,0,0.09)', borderRadius: 12 },
  handle:   { paddingHorizontal: 2 },
  badge:    { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,240,220,0.08)', alignItems: 'center', justifyContent: 'center' },
  badgeNum: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  info:     { flex: 1, minWidth: 0 },
  name:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 3 },
  tagsRow:  { flexDirection: 'row', gap: 4 },
  tag:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:   { fontSize: 9, fontWeight: '700' },
  setInfo:  { fontSize: 12, color: COLORS.textMuted, flexShrink: 0 },
  line:     { height: 2, marginHorizontal: 8, borderRadius: 1, backgroundColor: COLORS.accent },
  float:    {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
    }),
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function DayEditScreen({ day, planId, onBack }: Props) {
  const { updateDay, reorderExercises } = usePlanStore();

  const [label,  setLabel ] = useState(day.label);
  const [isRest, setIsRest] = useState(day.isRestDay);

  const exercises = [...day.exercises].sort((a, b) => a.order - b.order);

  const commitLabel = () => {
    if (label.trim() && label.trim() !== day.label)
      updateDay(planId, day.id, { label: label.trim() });
  };

  const toggleRest = (val: boolean) => {
    setIsRest(val);
    updateDay(planId, day.id, { isRestDay: val });
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={COLORS.accent} />
            <Text style={s.backTxt}>Cycle</Text>
          </TouchableOpacity>
          <Text style={s.dayPos}>Day {day.dayPosition}</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Day name */}
          <GlassView opacity="mid" radius={14} style={s.nameCard}>
            <Text style={s.fieldLbl}>Day Name</Text>
            <TextInput
              style={s.nameInput}
              value={label}
              onChangeText={setLabel}
              onBlur={commitLabel}
              onSubmitEditing={commitLabel}
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
          </GlassView>

          {/* Rest day toggle */}
          <GlassView opacity="mid" radius={14} style={s.toggleCard}>
            <View>
              <Text style={s.toggleLbl}>Rest Day</Text>
              <Text style={s.toggleSub}>No exercises — recovery only</Text>
            </View>
            <Switch
              value={isRest}
              onValueChange={toggleRest}
              trackColor={{ false: 'rgba(255,240,220,0.12)', true: COLORS.accent }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,240,220,0.12)"
            />
          </GlassView>

          {/* Exercise order (reorder only) */}
          {!isRest && exercises.length > 0 && (
            <>
              <View style={s.exHeader}>
                <Text style={s.exTitle}>Exercise Order</Text>
                <Text style={s.exHint}>Hold ≡ to reorder</Text>
              </View>
              <GlassView opacity="low" radius={14} style={s.exCard}>
                <DragList
                  exercises={exercises}
                  onReorder={ids => reorderExercises(planId, day.id, ids)}
                />
              </GlassView>
              <Text style={s.tip}>Add, edit, or delete exercises from the Cycle screen cabinet.</Text>
            </>
          )}

          {!isRest && exercises.length === 0 && (
            <GlassView opacity="low" radius={14} style={s.emptyCard}>
              <Ionicons name="barbell-outline" size={28} color={COLORS.textLabel} style={{ marginBottom: 8 }} />
              <Text style={s.emptyTxt}>No exercises yet</Text>
              <Text style={s.emptySub}>Tap a day card on the Cycle screen to add exercises.</Text>
            </GlassView>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt:    { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  dayPos:     { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  scroll:     { paddingHorizontal: 16, paddingTop: 4 },

  nameCard:   { padding: 14, marginBottom: 10 },
  fieldLbl:   { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  nameInput:  { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, paddingVertical: 2 },

  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 20 },
  toggleLbl:  { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  toggleSub:  { fontSize: 12, color: COLORS.textMuted },

  exHeader:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  exTitle:    { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  exHint:     { fontSize: 11, color: COLORS.textLabel },
  exCard:     { paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  tip:        { fontSize: 11, color: COLORS.textLabel, textAlign: 'center', lineHeight: 16 },

  emptyCard:  { padding: 32, alignItems: 'center', marginTop: 4 },
  emptyTxt:   { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
});
