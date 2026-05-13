import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Animated, TextInput, Switch,
  PanResponder, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { Badge, BadgeVariant } from '../../components/common/Badge';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, MUSCLE_TAG_COLOR, BAR_WEIGHTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { WorkoutDay, WorkoutSession, Exercise } from '../../types';
import { EXERCISE_LIBRARY } from '../../data/exercises';
import { ExerciseLibraryItem } from '../../types';
import { DayEditScreen } from './DayEditScreen';
import { SplitTypeSheet } from './SplitTypeSheet';
import { ExerciseFormSheet } from './ExerciseFormSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type DayStatus = 'completed' | 'missed' | 'rest' | 'current' | 'upcoming';

function dayIsRest(day: WorkoutDay): boolean {
  return day.isRestDay === true || day.label?.toLowerCase() === 'rest';
}

function getStatus(
  day: WorkoutDay,
  currentPos: number,
  sessions: WorkoutSession[],
): DayStatus {
  if (dayIsRest(day)) return 'rest';
  if (day.dayPosition === currentPos) return 'current';
  const last = sessions
    .filter(s => s.dayPosition === day.dayPosition)
    .sort((a, b) =>
      new Date(b.startedAt ?? b.finishedAt!).getTime() -
      new Date(a.startedAt ?? a.finishedAt!).getTime(),
    )[0];
  if (!last) return 'upcoming';
  return last.status === 'completed' ? 'completed' : last.status === 'missed' ? 'missed' : 'upcoming';
}

const STATUS_BADGE: Record<DayStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'Done',     variant: 'completed' },
  missed:    { label: 'Missed',   variant: 'missed'    },
  current:   { label: 'Today',    variant: 'current'   },
  upcoming:  { label: 'Upcoming', variant: 'upcoming'  },
  rest:      { label: 'Rest',     variant: 'rest'      },
};

function topTags(day: WorkoutDay): string[] {
  const counts: Record<string, number> = {};
  day.exercises.forEach(ex =>
    (ex.muscleTags ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }),
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

// ─── Smart exercise recommendations ──────────────────────────────────────────

const KEYWORD_TO_GROUP: Record<string, string[]> = {
  push: ['Chest', 'Shoulders', 'Triceps'],
  pull: ['Back', 'Biceps'],
  leg: ['Legs'], legs: ['Legs'],
  chest: ['Chest'], back: ['Back'],
  shoulder: ['Shoulders'], shoulders: ['Shoulders'],
  arm: ['Biceps', 'Triceps'], arms: ['Biceps', 'Triceps'],
  bicep: ['Biceps'], biceps: ['Biceps'],
  tricep: ['Triceps'], triceps: ['Triceps'],
  core: ['Core'], abs: ['Core'], ab: ['Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'],
  lower: ['Legs'], squat: ['Legs'], deadlift: ['Back', 'Legs'],
  glute: ['Legs'], quad: ['Legs'], hamstring: ['Legs'],
  calf: ['Legs'], calves: ['Legs'],
};

const LIB_GROUP_TO_TAGS: Record<string, string[]> = {
  Chest: ['Chest'], Back: ['Back'], Shoulders: ['Shoulders'],
  Biceps: ['Biceps'], Triceps: ['Triceps'], Core: ['Core'],
  Legs: ['Quads', 'Hamstrings', 'Glutes'],
};

function getRecommended(dayLabel: string, existingNames: Set<string>): ExerciseLibraryItem[] {
  const words = dayLabel.toLowerCase().split(/\W+/);
  const groups = new Set<string>();
  words.forEach(w => (KEYWORD_TO_GROUP[w] ?? []).forEach(g => groups.add(g)));

  const pool = groups.size === 0
    ? EXERCISE_LIBRARY
    : EXERCISE_LIBRARY.filter(ex => groups.has(ex.muscleGroup));

  return pool.filter(ex => !existingNames.has(ex.name.toLowerCase())).slice(0, 4);
}

// ─── Swipe actions (day-level: Edit / Clear) ─────────────────────────────────

const DAY_ACTIONS_WIDTH = 200;

function SwipeActions({
  dragX, onEdit, onClear,
}: { dragX: Animated.AnimatedInterpolation<number>; onEdit: () => void; onClear: () => void }) {
  const translateX = dragX.interpolate({
    inputRange: [-DAY_ACTIONS_WIDTH, 0], outputRange: [0, DAY_ACTIONS_WIDTH], extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[sw.row, { transform: [{ translateX }] }]}>
      <TouchableOpacity style={sw.editBtn} onPress={onEdit} activeOpacity={0.8}>
        <Ionicons name="pencil" size={16} color="#fff" />
        <Text style={sw.editTxt}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sw.clearBtn} onPress={onClear} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={sw.clearTxt}>Clear</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sw = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingRight: 16 },
  editBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginRight: 6 },
  editTxt:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  clearTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Exercise drag-sort ───────────────────────────────────────────────────────

const EX_H = 56;

// ─── Exercise row styles (shared by ExerciseDragSort) ────────────────────────

const er = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', height: EX_H, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)' },
  info:    { flex: 1, minWidth: 0 },
  name:    { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setInfo: { fontSize: 12, color: COLORS.textSecondary },
  tag:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:  { fontSize: 10, fontWeight: '700' },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});

interface ExerciseDragProps {
  exercises:              Exercise[];
  planId:                 string;
  dayId:                  string;
  onEdit:                 (ex: Exercise) => void;
  onDelete:               (ex: Exercise) => void;
  onScrollEnabledChange?: (enabled: boolean) => void;
}

function ExerciseDragSort({ exercises, planId, dayId, onEdit, onDelete, onScrollEnabledChange }: ExerciseDragProps) {
  const { reorderExercises } = usePlanStore();
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const dragFromRef     = useRef<number | null>(null);
  const dropToRef       = useRef<number | null>(null);
  const floatY          = useRef(new Animated.Value(0)).current;

  const exRef = useRef(exercises);
  exRef.current = exercises;

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTo,   setDropTo  ] = useState<number | null>(null);
  const snapshotRef = useRef<Exercise[]>(exercises);

  const onContainerLayout = () => {
    containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
  };

  // One PanResponder per exercise ID — cached so handlers are never recreated mid-drag
  const panCache = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  useEffect(() => {
    const ids = new Set(exercises.map(e => e.id));
    Object.keys(panCache.current).forEach(id => {
      if (!ids.has(id)) delete panCache.current[id];
    });
  }, [exercises]);

  function getHandlers(exerciseId: string) {
    if (!panCache.current[exerciseId]) {
      panCache.current[exerciseId] = PanResponder.create({
        // Claim the touch immediately — prevents ScrollView from stealing the gesture
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,

        onPanResponderGrant: (evt) => {
          onScrollEnabledChange?.(false);
          const cur    = exRef.current;
          const curIdx = cur.findIndex(e => e.id === exerciseId);
          // Synchronous calibration: er.iconBtn is 34px centred in a EX_H=56px row.
          // pageY − locationY = top of the icon button.
          // Subtract the button's top margin within the row, then curIdx rows above.
          const iconTop = evt.nativeEvent.pageY - evt.nativeEvent.locationY;
          containerTopRef.current = iconTop - (EX_H - 34) / 2 - curIdx * EX_H;
          // Also async-refresh for accuracy if layout changed (e.g. after scroll)
          containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
          snapshotRef.current = cur;
          dragFromRef.current = curIdx;
          dropToRef.current   = curIdx;
          floatY.setValue(curIdx * EX_H);
          setDragFrom(curIdx);
          setDropTo(curIdx);
        },

        onPanResponderMove: (evt) => {
          const relY  = evt.nativeEvent.pageY - containerTopRef.current;
          floatY.setValue(relY - EX_H / 2);
          const len   = exRef.current.length;
          const newTo = Math.max(0, Math.min(len - 1, Math.round(relY / EX_H)));
          if (newTo !== dropToRef.current) { dropToRef.current = newTo; setDropTo(newTo); }
        },

        onPanResponderRelease: () => {
          const from = dragFromRef.current ?? 0;
          const to   = dropToRef.current   ?? from;
          if (from !== to) {
            LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
            const reordered = [...snapshotRef.current];
            const [moved] = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            reorderExercises(planId, dayId, reordered.map(e => e.id));
          }
          dragFromRef.current = null; dropToRef.current = null;
          setDragFrom(null); setDropTo(null);
          onScrollEnabledChange?.(true);
        },

        onPanResponderTerminate: () => {
          dragFromRef.current = null; dropToRef.current = null;
          setDragFrom(null); setDropTo(null);
          onScrollEnabledChange?.(true);
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
        const setInfo = ex.setType === 'toFailure'
          ? `${ex.targetSets}× failure`
          : [
              `${ex.targetSets}×`,
              ex.targetRepsMin === ex.targetRepsMax || !ex.targetRepsMax
                ? String(ex.targetRepsMin ?? '–')
                : `${ex.targetRepsMin}–${ex.targetRepsMax}`,
              ex.targetWeight ? `@ ${ex.targetWeight}${ex.weightUnit}` : '',
            ].filter(Boolean).join(' ');
        return (
          <View key={ex.id}>
            {showAbove && <View style={ed.line} />}
            <View style={[er.row, isActive && { opacity: 0.5 }]}>
              <View {...getHandlers(ex.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={er.iconBtn}>
                <Ionicons name="reorder-three-outline" size={18} color={COLORS.textMuted} />
              </View>
              <View style={er.info}>
                <Text style={er.name} numberOfLines={1}>{ex.name}</Text>
                <View style={er.metaRow}>
                  <Text style={er.setInfo}>{setInfo}</Text>
                  {(ex.muscleTags ?? []).slice(0, 2).map(t => (
                    <View key={t} style={[er.tag, { backgroundColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '22', borderColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '44' }]}>
                      <Text style={[er.tagTxt, { color: MUSCLE_TAG_COLOR[t] ?? COLORS.textSecondary }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity onPress={() => onEdit(ex)} style={er.iconBtn} activeOpacity={0.7}>
                <Ionicons name="pencil-outline" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(ex)} style={er.iconBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
            {showBelow && <View style={ed.line} />}
          </View>
        );
      })}

      {dragFrom !== null && (
        <Animated.View style={[ed.float, { transform: [{ translateY: floatY }] }]} pointerEvents="none">
          <View style={[er.row, ed.rowLifted]}>
            <View style={er.iconBtn}>
              <Ionicons name="reorder-three-outline" size={18} color={COLORS.textMuted} />
            </View>
            <View style={er.info}>
              <Text style={er.name} numberOfLines={1}>{snapshotRef.current[dragFrom]?.name}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const ed = StyleSheet.create({
  line:      { height: 2, borderRadius: 1, backgroundColor: COLORS.accent, marginVertical: 1 },
  rowLifted: { backgroundColor: 'rgba(255,140,0,0.08)', borderRadius: 10 },
  float: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
});

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  planId,
  status,
  onEdit,
  onClear,
  onScrollEnabledChange,
}: {
  day: WorkoutDay;
  planId: string;
  status: DayStatus;
  onEdit: () => void;
  onClear: () => void;
  onScrollEnabledChange?: (enabled: boolean) => void;
}) {
  const { addExercise, updateExercise, deleteExercise, updateDay } = usePlanStore();
  const swipeRef   = useRef<Swipeable>(null);
  const isCurrent  = status === 'current';
  const isDone     = status === 'completed';
  const tags       = topTags(day);

  // showList  = tap → read-only exercise list
  // showEditor = Edit button → full cabinet with add/edit/delete
  const [showList,    setShowList   ] = useState(false);
  const [showEditor,  setShowEditor ] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEx,   setEditingEx  ] = useState<Exercise | null>(null);

  const handleEdit = () => {
    swipeRef.current?.close();
    setShowList(false);
    setShowEditor(e => !e);   // toggle editor from Edit button
  };
  const handleClear = () => { swipeRef.current?.close(); onClear(); };

  const isRest        = dayIsRest(day);
  const existingNames = new Set(day.exercises.map(e => e.name.toLowerCase()));
  const recommended   = isRest ? [] : getRecommended(day.label, existingNames);

  const openAdd  = () => { setEditingEx(null); setFormVisible(true); };
  const openEdit = (ex: Exercise) => { setEditingEx(ex); setFormVisible(true); };

  const handleSave = (data: Omit<Exercise, 'id' | 'createdAt'>) => {
    if (editingEx) updateExercise(planId, day.id, editingEx.id, data);
    else           addExercise(planId, day.id, data);
    setFormVisible(false);
    setEditingEx(null);
  };

  const handleDelete = (ex: Exercise) => {
    Alert.alert(`Remove "${ex.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteExercise(planId, day.id, ex.id) },
    ]);
  };

  const quickAdd = (item: ExerciseLibraryItem) => {
    const barType = (item.barType as any) ?? 'barbell';
    addExercise(planId, day.id, {
      name:          item.name,
      order:         day.exercises.length + 1,
      setType:       (item.setType as any) ?? 'repRange',
      supersetGroup: null,
      targetSets:    item.defaultSets ?? 3,
      targetRepsMin: item.defaultRepsMin ?? 8,
      targetRepsMax: item.defaultRepsMax ?? 12,
      toFailure:     false,
      barType,
      barWeight:     BAR_WEIGHTS[barType] ?? 0,
      targetWeight:  item.defaultWeight ?? 0,
      weightUnit:    (item.defaultUnit as any) ?? 'kg',
      perSetTargets: null,
      muscleTags:    LIB_GROUP_TO_TAGS[item.muscleGroup] ?? [],
      notes:         '',
    });
  };

  const exercises = [...day.exercises].sort((a, b) => a.order - b.order);

  return (
    <View style={dc.wrap}>
      {/* Swipeable covers only the card header + read-only list.
          The editor cabinet lives OUTSIDE so RNGH never intercepts
          the exercise PanResponder drag handles. */}
      <Swipeable
        ref={swipeRef}
        renderRightActions={(_p, dragX) => (
          <SwipeActions dragX={dragX} onEdit={handleEdit} onClear={handleClear} />
        )}
        overshootRight={false}
        friction={2}
        enabled={!showEditor}
      >
        <View>
          {/* ── Card header ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { setShowList(l => !l); setShowEditor(false); }}
          >
            <GlassView
              radius={(showList || showEditor) ? 0 : 16}
              style={[dc.card, isCurrent && dc.cardCurrent]}
              borderColor={
                isCurrent ? 'rgba(255,140,0,0.45)' :
                isDone    ? 'rgba(255,140,0,0.20)' :
                'rgba(255,240,220,0.08)'
              }
              glow={isCurrent}
            >
              <View style={dc.dragHandle} pointerEvents="none">
                <Ionicons name="reorder-three-outline" size={20} color={COLORS.textMuted} />
              </View>

              {isCurrent ? (
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dc.numBadge}>
                  <Text style={dc.numActive}>{day.dayPosition}</Text>
                </LinearGradient>
              ) : (
                <View style={[dc.numBadge, dc.numBadgeMuted]}>
                  <Text style={[dc.num, isDone && { color: COLORS.accent }]}>
                    {isDone ? '✓' : day.dayPosition}
                  </Text>
                </View>
              )}

              <View style={dc.content}>
                <View style={dc.nameRow}>
                  <Text style={[dc.label, isCurrent && { color: COLORS.accent }]} numberOfLines={1}>
                    {day.label}
                  </Text>
                  {isCurrent && <View style={dc.todayDot} />}
                </View>
                <Text style={dc.sub}>
                  {isRest ? 'Recovery day' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}
                </Text>
                {tags.length > 0 && (
                  <View style={dc.tagsRow}>
                    {tags.map(tag => (
                      <View key={tag} style={[dc.tag, { backgroundColor: (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '1A', borderColor: (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '44' }]}>
                        <Text style={[dc.tagTxt, { color: MUSCLE_TAG_COLOR[tag] ?? COLORS.textSecondary }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={dc.right}>
                <Badge label={STATUS_BADGE[status].label} variant={STATUS_BADGE[status].variant} size="xs" />
                <Ionicons
                  name={(showList || showEditor) ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={showEditor ? COLORS.accent : COLORS.textMuted}
                  style={{ marginTop: 6 }}
                />
              </View>
            </GlassView>
          </TouchableOpacity>

          {/* ── Read-only list (tap) — safe inside Swipeable, no drag needed ── */}
          {showList && !showEditor && (
            <GlassView radius={0} style={dc.cabinet} borderColor="rgba(255,240,220,0.08)">
              {isRest ? (
                <Text style={dc.restTxt}>Recovery day — no exercises scheduled.</Text>
              ) : exercises.length > 0 ? (
                <View style={dc.exList}>
                  {exercises.map(ex => (
                    <View key={ex.id} style={dc.readRow}>
                      <View style={dc.readInfo}>
                        <Text style={dc.readName} numberOfLines={1}>{ex.name}</Text>
                        <Text style={dc.readMeta}>
                          {ex.targetSets}× {ex.targetRepsMin ?? '–'}{ex.targetRepsMax && ex.targetRepsMax !== ex.targetRepsMin ? `–${ex.targetRepsMax}` : ''} reps
                          {ex.targetWeight ? ` · ${ex.targetWeight}${ex.weightUnit}` : ''}
                        </Text>
                      </View>
                      {(ex.muscleTags ?? []).slice(0, 1).map(t => (
                        <View key={t} style={[dc.readTag, { backgroundColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '22', borderColor: (MUSCLE_TAG_COLOR[t] ?? '#fff') + '44' }]}>
                          <Text style={[dc.readTagTxt, { color: MUSCLE_TAG_COLOR[t] ?? COLORS.textSecondary }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={dc.emptyTxt}>No exercises yet. Swipe left → Edit to add.</Text>
              )}
            </GlassView>
          )}

          {showList && !showEditor && <View style={dc.capBottom} />}
        </View>
      </Swipeable>

      {/* ── Editor cabinet — OUTSIDE Swipeable so RNGH doesn't block PanResponder ── */}
      {showEditor && (
        <GlassView radius={0} style={dc.cabinet} borderColor="rgba(255,140,0,0.20)">
          <View style={dc.restToggleRow}>
            <Text style={dc.restToggleLbl}>Rest Day</Text>
            <Switch
              value={isRest}
              onValueChange={val => updateDay(planId, day.id, { isRestDay: val })}
              trackColor={{ false: 'rgba(255,240,220,0.12)', true: COLORS.accent }}
              thumbColor="#fff"
              ios_backgroundColor="rgba(255,240,220,0.12)"
            />
          </View>

          {isRest ? (
            <Text style={dc.restTxt}>Recovery day — no exercises scheduled.</Text>
          ) : (
            <>
              {recommended.length > 0 && (
                <View style={dc.recSection}>
                  <Text style={dc.recLabel}>Suggested for {day.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dc.recRow}>
                    {recommended.map(item => (
                      <TouchableOpacity key={item.id} style={dc.recChip} onPress={() => quickAdd(item)} activeOpacity={0.75}>
                        <Ionicons name="add" size={13} color={COLORS.accent} />
                        <Text style={dc.recChipTxt} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {exercises.length > 0 && (
                <View style={dc.exList}>
                  <ExerciseDragSort
                    exercises={exercises}
                    planId={planId}
                    dayId={day.id}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onScrollEnabledChange={onScrollEnabledChange}
                  />
                </View>
              )}

              {exercises.length === 0 && recommended.length === 0 && (
                <Text style={dc.emptyTxt}>No exercises yet. Tap Add Exercise to get started.</Text>
              )}

              <TouchableOpacity style={dc.addBtn} onPress={openAdd} activeOpacity={0.8}>
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dc.addGrad}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={dc.addTxt}>Add Exercise</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </GlassView>
      )}
      {showEditor && <View style={dc.capBottom} />}

      {/* Exercise form sheet */}
      <ExerciseFormSheet
        visible={formVisible}
        initial={editingEx}
        dayLabel={day.label}
        nextOrder={exercises.length + 1}
        onSave={handleSave}
        onClose={() => { setFormVisible(false); setEditingEx(null); }}
      />
    </View>
  );
}

const dc = StyleSheet.create({
  wrap:         { marginBottom: 10, borderRadius: 16, overflow: 'hidden' },
  card:         { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  dragHandle:   { width: 26, alignItems: 'center', justifyContent: 'center', marginLeft: -2 },
  cardCurrent:  {},
  numBadge:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numBadgeMuted:{ backgroundColor: 'rgba(255,240,220,0.07)' },
  num:          { fontSize: 17, fontWeight: '700', color: COLORS.textSecondary },
  numActive:    { fontSize: 17, fontWeight: '700', color: '#fff' },
  content:      { flex: 1, minWidth: 0 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label:        { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flexShrink: 1 },
  todayDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  sub:          { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag:          { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:       { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  right:        { alignItems: 'flex-end', justifyContent: 'center', gap: 0 },

  // Cabinet
  cabinet:      { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  recSection:   { marginBottom: 12 },
  recLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  recRow:       { gap: 8, flexDirection: 'row' },
  recChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)', backgroundColor: 'rgba(255,140,0,0.10)' },
  recChipTxt:   { fontSize: 12, fontWeight: '600', color: COLORS.accent, maxWidth: 120 },
  exList:       { marginBottom: 8 },
  // Read-only row
  readRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.05)' },
  readInfo:     { flex: 1 },
  readName:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  readMeta:     { fontSize: 12, color: COLORS.textMuted },
  readTag:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginLeft: 8 },
  readTagTxt:   { fontSize: 10, fontWeight: '700' },
  emptyTxt:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 16 },
  addBtn:       { borderRadius: 12, overflow: 'hidden', marginBottom: 12, marginTop: 4 },
  addGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  addTxt:       { fontSize: 14, fontWeight: '700', color: '#fff' },
  restTxt:       { fontSize: 13, color: COLORS.textSecondary },
  capBottom:     { height: 0 },
  restToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)' },
  restToggleLbl: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});

// ─── Day list drag-sort ───────────────────────────────────────────────────────

function DayListDragSort({
  days, planId, sessions, currentPos, onEdit, onClear, onScrollEnabledChange,
}: {
  days:                   WorkoutDay[];
  planId:                 string;
  sessions:               WorkoutSession[];
  currentPos:             number;
  onEdit:                 (day: WorkoutDay) => void;
  onClear:                (day: WorkoutDay) => void;
  onScrollEnabledChange?: (enabled: boolean) => void;
}) {
  const { updatePlan }  = usePlanStore();
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
  const CARD_EST_H      = 88;
  // Pre-populated with estimates; onLayout overwrites with real values.
  const layoutsRef = useRef<{ y: number; height: number }[]>(
    days.map((_, i) => ({ y: i * CARD_EST_H, height: CARD_EST_H })),
  );
  const dragFromRef   = useRef<number | null>(null);
  const dropToRef     = useRef<number | null>(null);
  const floatY        = useRef(new Animated.Value(0)).current;
  const daysRef       = useRef(days);
  const snapshotRef   = useRef(days);
  const onScrollRef   = useRef(onScrollEnabledChange);
  const updatePlanRef = useRef(updatePlan);
  const planIdRef     = useRef(planId);
  daysRef.current       = days;
  onScrollRef.current   = onScrollEnabledChange;
  updatePlanRef.current = updatePlan;
  planIdRef.current     = planId;

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTo,   setDropTo  ] = useState<number | null>(null);

  // Measure once after mount; re-measured on each grant.
  // locationY in PanResponder is relative to the touch target (deepest view),
  // NOT the container — we use pageY - containerTopRef for correct relY.
  useEffect(() => {
    containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
  }, []);

  const findAt = (relY: number) => {
    const ls = layoutsRef.current;
    for (let i = 0; i < ls.length; i++) {
      const { y, height } = ls[i] ?? { y: i * CARD_EST_H, height: CARD_EST_H };
      if (relY <= y + height * 0.5) return i;
    }
    return Math.max(0, ls.length - 1);
  };

  // Per-card overlays — each handler captures its own idx via closure.
  // Overlays sit at top:0, height:72 (header only), so exercise handles in the
  // cabinet (below that) are never intercepted.
  const panHandlersRef = useRef<any[]>([]);
  if (panHandlersRef.current.length !== days.length) {
    panHandlersRef.current = days.map((_, idx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2,

        onPanResponderGrant: () => {
          containerRef.current?.measureInWindow((_x, y) => { containerTopRef.current = y; });
          onScrollRef.current?.(false);
          snapshotRef.current = daysRef.current;
          dragFromRef.current = idx;
          dropToRef.current   = idx;
          floatY.setValue(layoutsRef.current[idx]?.y ?? idx * CARD_EST_H);
          setDragFrom(idx);
          setDropTo(idx);
        },

        onPanResponderMove: (evt) => {
          const relY = evt.nativeEvent.pageY - containerTopRef.current;
          const h    = layoutsRef.current[dragFromRef.current ?? 0]?.height ?? CARD_EST_H;
          floatY.setValue(Math.max(0, relY - h / 2));
          const newTo = findAt(relY);
          if (newTo !== dropToRef.current) { dropToRef.current = newTo; setDropTo(newTo); }
        },

        onPanResponderRelease: () => {
          const from = dragFromRef.current ?? 0;
          const to   = dropToRef.current   ?? from;
          if (from !== to) {
            LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
            const contents = [...snapshotRef.current].map(d => ({
              label: d.label, isRestDay: d.isRestDay, exercises: d.exercises,
            }));
            const [removed] = contents.splice(from, 1);
            contents.splice(to, 0, removed);
            const newDays = snapshotRef.current.map((d, i) => ({
              ...d, label: contents[i].label, isRestDay: contents[i].isRestDay, exercises: contents[i].exercises,
            }));
            updatePlanRef.current(planIdRef.current, { days: newDays });
          }
          onScrollRef.current?.(true);
          dragFromRef.current = null; dropToRef.current = null;
          setDragFrom(null); setDropTo(null);
        },

        onPanResponderTerminate: () => {
          onScrollRef.current?.(true);
          dragFromRef.current = null; dropToRef.current = null;
          setDragFrom(null); setDropTo(null);
        },
      }).panHandlers,
    );
  }

  return (
    <View ref={containerRef}>
      {days.map((day, idx) => {
        const isActive  = dragFrom === idx;
        const showAbove = dropTo === idx && dragFrom !== null && dragFrom > idx;
        const showBelow = dropTo === idx && dragFrom !== null && dragFrom < idx;
        return (
          <View
            key={day.id}
            onLayout={e => {
              layoutsRef.current[idx] = {
                y:      e.nativeEvent.layout.y,
                height: e.nativeEvent.layout.height,
              };
            }}
            style={isActive ? { opacity: 0.4 } : undefined}
          >
            {showAbove && <View style={dl.line} />}
            <DayCard
              day={day}
              planId={planId}
              status={getStatus(day, currentPos, sessions)}
              onEdit={() => onEdit(day)}
              onClear={() => onClear(day)}
              onScrollEnabledChange={onScrollEnabledChange}
            />
            {showBelow && <View style={dl.line} />}
            {/* Overlay covers only the card header (height:72). Cabinet exercises sit below
                this boundary so their own drag handles are never intercepted here. */}
            <View
              {...panHandlersRef.current[idx]}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              style={dl.handleOverlay}
            />
          </View>
        );
      })}

      {dragFrom !== null && (
        <Animated.View style={[dl.float, { transform: [{ translateY: floatY }], opacity: 0.92 }]} pointerEvents="none">
          <GlassView radius={16} style={dl.floatCard} borderColor="rgba(255,240,220,0.18)">
            <View style={[dc.numBadge, dc.numBadgeMuted]}>
              <Text style={dc.num}>{snapshotRef.current[dragFrom]?.dayPosition}</Text>
            </View>
            <Text style={dl.floatLabel} numberOfLines={1}>
              {snapshotRef.current[dragFrom]?.label}
            </Text>
          </GlassView>
        </Animated.View>
      )}
    </View>
  );
}

const dl = StyleSheet.create({
  line:          { height: 2, borderRadius: 1, backgroundColor: COLORS.accent, marginVertical: 2, marginHorizontal: 16 },
  // Covers only the card header (72 px tall). Cabinet exercises live below this
  // boundary, so their own PanResponder handles are never stolen.
  handleOverlay: { position: 'absolute', left: 14, top: 0, height: 72, width: 40, zIndex: 50 },
  floatCard:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  floatLabel:    { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  float: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
    }),
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CycleScreen() {
  const { activePlan, updateDay, updatePlan } = usePlanStore();
  const { sessions }                          = useSessionStore();
  const { settings }                          = useSettingsStore();

  const [editingDay,    setEditingDay   ] = useState<WorkoutDay | null>(null);
  const [planExpanded,  setPlanExpanded ] = useState(false);
  const [splitSheetOpen,setSplitSheetOpen] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [editName,      setEditName     ] = useState('');
  const [editSplit,     setEditSplit    ] = useState('');

  const openPlanEdit = () => {
    if (!activePlan) return;
    setEditName(activePlan.name);
    setEditSplit(activePlan.splitType);
    setPlanExpanded(e => !e);
  };

  const savePlan = () => {
    if (!activePlan || !editName.trim()) return;
    updatePlan(activePlan.id, { name: editName.trim(), splitType: editSplit });
    setPlanExpanded(false);
  };

  const handleSplitSelect = (sp: string) => {
    if (sp === 'Custom') {
      Alert.alert(
        'Use Custom Split?',
        'This will clear all exercises from every day.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Use Custom',
            style: 'destructive',
            onPress: () => {
              setEditSplit('Custom');
              activePlan?.days.forEach(d =>
                updateDay(activePlan.id, d.id, { exercises: [], isRestDay: false }),
              );
            },
          },
        ],
      );
    } else {
      setEditSplit(sp);
    }
  };

  if (editingDay && activePlan) {
    const freshDay = activePlan.days.find(d => d.id === editingDay.id) ?? editingDay;
    return (
      <DayEditScreen
        day={freshDay}
        planId={activePlan.id}
        onBack={() => setEditingDay(null)}
      />
    );
  }

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <AppBackground />
        <Text style={s.emptyTitle}>No active plan</Text>
        <Text style={s.emptySub}>Set up a plan in Settings.</Text>
      </View>
    );
  }

  const days   = [...activePlan.days].sort((a, b) => a.dayPosition - b.dayPosition);
  const recent = sessions.slice(-14);
  const done   = recent.filter(ss => ss.status === 'completed').length;
  const rate   = recent.length === 0 ? 0 : Math.round((done / recent.length) * 100);
  const bars   = recent.map(ss => ss.status === 'completed' ? 1 : 0);

  const handleClear = (day: WorkoutDay) => {
    Alert.alert(
      `Clear ${day.label}?`,
      'This will remove all exercises and mark it as a rest day.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => updateDay(activePlan.id, day.id, { isRestDay: true, exercises: [] }) },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.planLabel}>{activePlan.splitType}</Text>
            <Text style={s.title}>{activePlan.name}</Text>
          </View>
          <TouchableOpacity onPress={openPlanEdit} style={[s.editBtn, planExpanded && s.editBtnActive]} activeOpacity={0.7}>
            <Ionicons
              name={planExpanded ? 'chevron-up' : 'pencil-outline'}
              size={17}
              color={planExpanded ? COLORS.accent : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Plan edit cabinet (inline, same pattern as day card) ── */}
        {planExpanded && (
          <GlassView radius={16} style={s.planCabinet} borderColor="rgba(255,140,0,0.22)">

            {/* Plan name */}
            <Text style={s.cabinetLabel}>PLAN NAME</Text>
            <GlassView opacity="low" radius={10} style={s.nameField}>
              <TextInput
                style={s.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Plan name"
                placeholderTextColor="rgba(255,240,220,0.25)"
                returnKeyType="done"
                autoCorrect={false}
              />
            </GlassView>

            {/* Split type */}
            <Text style={[s.cabinetLabel, { marginTop: 14 }]}>SPLIT TYPE</Text>
            <TouchableOpacity
              style={s.splitBtn}
              onPress={() => setSplitSheetOpen(true)}
              activeOpacity={0.8}
            >
              <View style={s.splitBtnLeft}>
                <View style={s.splitDot} />
                <Text style={s.splitBtnTxt}>{editSplit || 'Select split…'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Actions row */}
            <View style={s.cabinetActions}>
              <TouchableOpacity onPress={savePlan} style={s.saveBtn} activeOpacity={0.85} disabled={!editName.trim()}>
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveGrad}>
                  <Text style={s.saveTxt}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassView>
        )}

        {/* ── Completion card ── */}
        <GlassView radius={16} style={s.rateCard}>
          <View style={s.rateRow}>
            <View>
              <Text style={s.rateLabel}>Last 14 sessions</Text>
              <View style={s.rateNumRow}>
                <Text style={s.rateVal}>{rate}%</Text>
                <Text style={s.rateSub}> completion</Text>
              </View>
            </View>
            <View style={s.bars}>
              {(bars.length === 0 ? Array(7).fill(0) : bars).map((v, i) => (
                <View key={i} style={[s.barBg, { height: v ? 22 : 8 }]}>
                  {!!v && (
                    <LinearGradient
                      colors={GRAD.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ flex: 1, borderRadius: 3 }}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        </GlassView>

        <Text style={s.hint}>Tap to view · Drag ≡ to reorder · Swipe left to edit or clear</Text>

        {/* ── Day list ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          scrollEnabled={scrollEnabled}
        >
          <DayListDragSort
            days={days}
            planId={activePlan.id}
            sessions={sessions}
            currentPos={settings.currentDayPosition}
            onEdit={setEditingDay}
            onClear={handleClear}
            onScrollEnabledChange={setScrollEnabled}
          />
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Split type picker */}
      <SplitTypeSheet
        visible={splitSheetOpen}
        current={editSplit}
        onSelect={sp => handleSplitSelect(sp)}
        onClose={() => setSplitSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  // Header
  header:         { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planLabel:      { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  title:          { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  editBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,240,220,0.07)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  editBtnActive:  { borderColor: 'rgba(255,140,0,0.50)', backgroundColor: 'rgba(255,140,0,0.12)' },

  // Plan edit cabinet
  planCabinet:    { marginHorizontal: 16, marginBottom: 10, padding: 14 },
  cabinetLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  nameField:      { paddingHorizontal: 12, paddingVertical: 11 },
  nameInput:      { fontSize: 16, fontWeight: '600', color: '#fff', padding: 0 },
  splitBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.07)' },
  splitBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  splitBtnTxt:    { fontSize: 15, fontWeight: '600', color: '#fff' },
  cabinetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 14 },
  saveBtn:        { borderRadius: 10, overflow: 'hidden' },
  saveGrad:       { paddingHorizontal: 22, paddingVertical: 9 },
  saveTxt:        { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Completion card
  rateCard:   { marginHorizontal: 16, padding: 16, marginBottom: 8 },
  rateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rateLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rateNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  rateVal:    { fontSize: 30, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.5 },
  rateSub:    { fontSize: 13, color: COLORS.textSecondary },
  bars:       { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barBg:      { width: 8, borderRadius: 3, backgroundColor: 'rgba(255,240,220,0.10)' },

  hint:       { fontSize: 11, color: COLORS.textLabel, textAlign: 'center', marginBottom: 8, letterSpacing: 0.2 },
  list:       { paddingHorizontal: 16 },
});
