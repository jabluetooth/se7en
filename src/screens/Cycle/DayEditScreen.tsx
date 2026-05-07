import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Switch, Alert,
  Animated, PanResponder, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS, MUSCLE_TAG_COLOR } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { Exercise, WorkoutDay } from '../../types';
import { ExerciseFormSheet } from './ExerciseFormSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_H = 84;

interface Props {
  day:    WorkoutDay;
  planId: string;
  onBack: () => void;
}

// ─── Drag-sort list ───────────────────────────────────────────────────────────

interface DragSortProps {
  exercises:  Exercise[];
  onReorder:  (ids: string[]) => void;
  onEdit:     (ex: Exercise) => void;
  onDelete:   (ex: Exercise) => void;
}

function DragSortList({ exercises, onReorder, onEdit, onDelete }: DragSortProps) {
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const dragFromRef     = useRef<number | null>(null);
  const floatY          = useRef(new Animated.Value(0)).current;
  const swipeableRefs   = useRef<(Swipeable | null)[]>([]);

  const [dragFrom,      setDragFrom    ] = useState<number | null>(null);
  const [dropTo,        setDropTo      ] = useState<number | null>(null);
  const [isDragActive,  setIsDragActive] = useState(false);

  const snapshotRef = useRef<Exercise[]>(exercises);

  function makeHandlers(idx: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) =>
        // only claim gesture if mostly vertical
        Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,

      onPanResponderGrant: (evt) => {
        // Close any open swipe rows and disable them
        swipeableRefs.current.forEach(r => r?.close());
        containerRef.current?.measureInWindow((_x, y) => {
          containerTopRef.current = y;
        });
        snapshotRef.current = exercises;
        dragFromRef.current = idx;
        floatY.setValue(idx * ITEM_H);
        setDragFrom(idx);
        setDropTo(idx);
        setIsDragActive(true);
      },

      onPanResponderMove: (evt) => {
        const relY = evt.nativeEvent.pageY - containerTopRef.current;
        floatY.setValue(relY - ITEM_H / 2);
        const to = Math.max(0, Math.min(
          exercises.length - 1,
          Math.round(relY / ITEM_H),
        ));
        if (to !== dropTo) setDropTo(to);
      },

      onPanResponderRelease: () => {
        const from = dragFromRef.current ?? 0;
        const to   = dropTo ?? from;
        if (from !== to) {
          LayoutAnimation.configureNext({
            duration: 240,
            update:   { type: LayoutAnimation.Types.easeInEaseOut },
          });
          const ids = exercises.map(e => e.id);
          const [item] = ids.splice(from, 1);
          ids.splice(to, 0, item);
          onReorder(ids);
        }
        dragFromRef.current = null;
        setDragFrom(null);
        setDropTo(null);
        setIsDragActive(false);
      },

      onPanResponderTerminate: () => {
        dragFromRef.current = null;
        setDragFrom(null);
        setDropTo(null);
        setIsDragActive(false);
      },
    }).panHandlers;
  }

  return (
    <View ref={containerRef}>
      {exercises.map((ex, idx) => {
        const isActive  = dragFrom === idx;
        const showAbove = dropTo === idx && dragFrom !== null && dragFrom > idx;
        const showBelow = dropTo === idx && dragFrom !== null && dragFrom < idx;

        return (
          <View key={ex.id}>
            {showAbove && <View style={ds.insertLine} />}

            <View style={{ opacity: isActive ? 0.12 : 1, height: ITEM_H }}>
              <SwipeableDragRow
                exercise={ex}
                dragHandlers={makeHandlers(idx)}
                swipeEnabled={!isDragActive}
                swipeRef={r => { swipeableRefs.current[idx] = r; }}
                onEdit={() => onEdit(ex)}
                onDelete={() => onDelete(ex)}
              />
            </View>

            {showBelow && <View style={ds.insertLine} />}
          </View>
        );
      })}

      {/* Floating dragged copy */}
      {dragFrom !== null && (
        <Animated.View
          style={[ds.float, { transform: [{ translateY: floatY }] }]}
          pointerEvents="none"
        >
          <SwipeableDragRow
            exercise={snapshotRef.current[dragFrom]}
            dragHandlers={{}}
            swipeEnabled={false}
            swipeRef={() => {}}
            isDragging
            onEdit={() => {}}
            onDelete={() => {}}
          />
        </Animated.View>
      )}
    </View>
  );
}

const ds = StyleSheet.create({
  insertLine: {
    height: 2, marginHorizontal: 8, borderRadius: 1,
    backgroundColor: COLORS.accent,
  },
  float: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
    }),
  },
});

// ─── Swipeable drag row ───────────────────────────────────────────────────────

interface RowProps {
  exercise:      Exercise;
  dragHandlers:  any;
  swipeEnabled:  boolean;
  swipeRef:      (ref: Swipeable | null) => void;
  isDragging?:   boolean;
  onEdit:        () => void;
  onDelete:      () => void;
}

function SwipeableDragRow({
  exercise, dragHandlers, swipeEnabled, swipeRef,
  isDragging, onEdit, onDelete,
}: RowProps) {
  const tags   = exercise.muscleTags ?? [];
  const setInfo = exercise.setType === 'toFailure'
    ? `${exercise.targetSets} × failure`
    : [
        exercise.targetSets, '×',
        exercise.targetRepsMin === exercise.targetRepsMax || !exercise.targetRepsMax
          ? String(exercise.targetRepsMin ?? '–')
          : `${exercise.targetRepsMin}–${exercise.targetRepsMax}`,
        exercise.targetWeight ? `@ ${exercise.targetWeight} ${exercise.weightUnit}` : '',
      ].filter(Boolean).join(' ');

  const renderRightActions = () => (
    <View style={rr.actionsRow}>
      <TouchableOpacity style={rr.editBtn} onPress={onEdit} activeOpacity={0.82}>
        <Ionicons name="pencil" size={16} color="#fff" />
        <Text style={rr.btnTxt}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={rr.deleteBtn} onPress={onDelete} activeOpacity={0.82}>
        <Ionicons name="trash" size={16} color="#fff" />
        <Text style={rr.btnTxt}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      enabled={swipeEnabled}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      <GlassView
        opacity={isDragging ? 'high' : 'mid'}
        radius={14}
        style={[rr.card, isDragging && rr.cardLifted]}
      >
        {/* Drag handle — only the ≡ icon owns the PanResponder */}
        <View {...dragHandlers} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={rr.handle}>
          <Ionicons name="reorder-three-outline" size={22} color={COLORS.textMuted} />
        </View>

        {/* Content */}
        <View style={rr.content}>
          <Text style={rr.name} numberOfLines={1}>{exercise.name}</Text>
          <Text style={rr.info}>{setInfo}</Text>
          {tags.length > 0 && (
            <View style={rr.tagsRow}>
              {tags.map(tag => (
                <View
                  key={tag}
                  style={[
                    rr.tag,
                    {
                      backgroundColor: (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '1A',
                      borderColor:     (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '40',
                    },
                  ]}
                >
                  <Text style={[rr.tagTxt, { color: MUSCLE_TAG_COLOR[tag] ?? COLORS.textSecondary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Hint for hidden swipe actions */}
        <Ionicons name="chevron-back" size={13} color={COLORS.textLabel} style={{ marginRight: 2 }} />
      </GlassView>
    </Swipeable>
  );
}

const rr = StyleSheet.create({
  card:       {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 10, height: ITEM_H,
  },
  cardLifted: { borderColor: 'rgba(10,132,255,0.40)' },
  handle:     { paddingHorizontal: 2 },
  content:    { flex: 1, minWidth: 0 },
  name:       { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.2, marginBottom: 2 },
  info:       { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  tagsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  tagTxt:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, paddingLeft: 6 },
  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginRight: 6 },
  deleteBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.danger, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12 },
  btnTxt:     { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function DayEditScreen({ day, planId, onBack }: Props) {
  const { updateDay, updateExercise, deleteExercise, reorderExercises, addExercise } = usePlanStore();

  const [label,   setLabel  ] = useState(day.label);
  const [isRest,  setIsRest ] = useState(day.isRestDay);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [adding,  setAdding ] = useState(false);

  const exercises = [...day.exercises].sort((a, b) => a.order - b.order);

  const commitLabel = () => {
    if (label.trim() && label.trim() !== day.label)
      updateDay(planId, day.id, { label: label.trim() });
  };

  const toggleRest = (val: boolean) => {
    setIsRest(val);
    updateDay(planId, day.id, { isRestDay: val });
  };

  const confirmDelete = (ex: Exercise) => {
    Alert.alert(`Remove "${ex.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteExercise(planId, day.id, ex.id) },
    ]);
  };

  const handleSave = (data: Omit<Exercise, 'id' | 'createdAt'>) => {
    if (editing) updateExercise(planId, day.id, editing.id, data);
    else addExercise(planId, day.id, data);
    setEditing(null);
    setAdding(false);
  };

  return (
    <>
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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

            <GlassView opacity="mid" radius={14} style={s.toggleCard}>
              <View>
                <Text style={s.toggleLbl}>Rest Day</Text>
                <Text style={s.toggleSub}>No exercises — recovery only</Text>
              </View>
              <Switch
                value={isRest}
                onValueChange={toggleRest}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: COLORS.accent }}
                thumbColor="#fff"
                ios_backgroundColor="rgba(255,255,255,0.12)"
              />
            </GlassView>

            {!isRest && (
              <>
                <View style={s.exHeader}>
                  <View>
                    <Text style={s.exTitle}>Exercises</Text>
                    <Text style={s.exHint}>Swipe left to edit/delete · Hold ≡ to reorder</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setEditing(null); setAdding(true); }}
                    style={s.addWrap}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.addGrad}>
                      <Ionicons name="add" size={15} color="#fff" />
                      <Text style={s.addTxt}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {exercises.length > 0 ? (
                  <DragSortList
                    exercises={exercises}
                    onReorder={ids => reorderExercises(planId, day.id, ids)}
                    onEdit={ex => { setEditing(ex); setAdding(true); }}
                    onDelete={confirmDelete}
                  />
                ) : (
                  <GlassView opacity="low" radius={14} style={s.emptyCard}>
                    <Text style={s.emptyTxt}>No exercises yet.</Text>
                    <Text style={s.emptySub}>Tap Add to get started.</Text>
                  </GlassView>
                )}
              </>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        </SafeAreaView>
      </View>

      <ExerciseFormSheet
        visible={adding}
        initial={editing}
        dayLabel={day.label}
        nextOrder={exercises.length + 1}
        onSave={handleSave}
        onClose={() => { setEditing(null); setAdding(false); }}
      />
    </>
  );
}

const s = StyleSheet.create({

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTxt:    { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  dayPos:     { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  scroll:     { paddingHorizontal: 16, paddingTop: 4 },
  nameCard:   { padding: 14, marginBottom: 10 },
  fieldLbl:   { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  nameInput:  { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, paddingVertical: 2 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginBottom: 20 },
  toggleLbl:  { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  toggleSub:  { fontSize: 12, color: COLORS.textMuted },
  exHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  exTitle:    { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginBottom: 2 },
  exHint:     { fontSize: 11, color: COLORS.textLabel },
  addWrap:    { borderRadius: 10, overflow: 'hidden' },
  addGrad:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  addTxt:     { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyCard:  { padding: 24, alignItems: 'center', marginTop: 4 },
  emptyTxt:   { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  emptySub:   { fontSize: 12, color: COLORS.textMuted },
});
