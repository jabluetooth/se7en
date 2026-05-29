import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../../components/common/GlassView';
import { Badge } from '../../../components/common/Badge';
import { usePlanStore } from '../../../stores/planStore';
import { GRAD, COLORS, MUSCLE_TAG_COLOR, BAR_WEIGHTS, FONTS } from '../../../constants';
import { WorkoutDay, Exercise, ExerciseLibraryItem } from '../../../types';
import { ExerciseFormSheet } from '../ExerciseFormSheet';
import { DayStatus, STATUS_BADGE, dayIsRest, topTags, getRecommended, LIB_GROUP_TO_TAGS } from '../helpers';
import { SwipeActions, DoneAction } from './SwipeActions';
import { ExerciseDragSort } from './ExerciseDragSort';

interface Props {
  day:           WorkoutDay;
  planId:        string;
  status:        DayStatus;
  isToday:       boolean;
  currentPos:    number;
  displayDayNum: number;          // 1-indexed slot position in the visible list
  onEdit:        () => void;
  onClear:       () => void;
  onDone?:       () => void;
  dragHandlers?:         object;
  onScrollEnabledChange?: (enabled: boolean) => void;
}

export function DayCard({
  day, planId, status, isToday, currentPos, displayDayNum,
  onEdit, onClear, onDone, dragHandlers, onScrollEnabledChange,
}: Props) {
  const { addExercise, updateExercise, deleteExercise, updateDay } = usePlanStore();
  const swipeRef   = useRef<Swipeable>(null);
  const isCurrent  = isToday;
  const isDone     = status === 'completed';
  // "Past" is now slot-based so dragging a rest day into a past slot dims
  // correctly and dragging it into a future slot un-dims it.
  const isPastRest = status === 'rest' && displayDayNum < currentPos;
  const tags       = topTags(day);

  // showList  = tap → read-only exercise list
  // showEditor = Edit button → full cabinet with add/edit/delete
  const [showList,    setShowList   ] = useState(false);
  const [showEditor,  setShowEditor ] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingEx,   setEditingEx  ] = useState<Exercise | null>(null);
  const [editLabel,   setEditLabel  ] = useState(day.label);

  // Keep editLabel in sync when the plan updates from outside (e.g. Firestore sync)
  useEffect(() => { setEditLabel(day.label); }, [day.label]);

  const commitLabel = () => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== day.label)
      updateDay(planId, day.id, { label: trimmed });
  };

  const handleEdit  = () => { swipeRef.current?.close(); setShowList(false); setShowEditor(e => !e); };
  const handleClear = () => { swipeRef.current?.close(); onClear(); };
  const handleDone  = () => { swipeRef.current?.close(); onDone?.(); };

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
        renderLeftActions={!isRest && !isDone && onDone ? (_p, dragX) => (
          <DoneAction dragX={dragX} onPress={handleDone} />
        ) : undefined}
        renderRightActions={(_p, dragX) => (
          <SwipeActions dragX={dragX} onEdit={handleEdit} onClear={handleClear} />
        )}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
        enabled={!showEditor}
      >
        {/* swipeContent clips card + list to rounded corners WITHOUT clipping the
            Swipeable's action areas — the outer dc.wrap has no overflow:hidden. */}
        <View style={dc.swipeContent}>
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
                'rgba(255,255,255,0.10)'
              }
              glow={isCurrent}
            >
              {/* Dim overlay for completed / past-rest days */}
              {(isDone || isPastRest) && (
                <View style={dc.dimOverlay} pointerEvents="none" />
              )}

              <View style={[dc.dragHandle, !dragHandlers && { opacity: 0.2 }]} {...(dragHandlers ?? {})}>
                <Ionicons name="reorder-three-outline" size={20} color={COLORS.textMuted} />
              </View>

              {isCurrent ? (
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dc.numBadge}>
                  <Text style={dc.numActive}>{displayDayNum}</Text>
                </LinearGradient>
              ) : (
                <View style={[dc.numBadge, dc.numBadgeMuted]}>
                  <Text style={[dc.num, (isDone || isPastRest) && { color: COLORS.accent }]}>
                    {isDone || isPastRest ? '✓' : displayDayNum}
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
            <GlassView radius={0} style={dc.cabinet} borderColor="rgba(255,255,255,0.10)">
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
        <View style={dc.editorClip}>
        <GlassView radius={0} style={dc.cabinet} borderColor="rgba(255,140,0,0.20)">

          {/* Day name */}
          <Text style={dc.labelHint}>DAY NAME</Text>
          <GlassView opacity="low" radius={10} style={dc.labelField}>
            <TextInput
              style={dc.labelInput}
              value={editLabel}
              onChangeText={setEditLabel}
              onBlur={commitLabel}
              onSubmitEditing={commitLabel}
              placeholder="e.g. Push Day"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              maxLength={50}
            />
          </GlassView>

          <View style={dc.restToggleRow}>
            <Text style={dc.restToggleLbl}>Rest Day</Text>
            <Switch
              value={isRest}
              onValueChange={val => {
                const update: Partial<WorkoutDay> = { isRestDay: val };
                if (val) {
                  // Rest = no exercises (Cycle screen rule). Drop them when
                  // flipping to rest so the day is "empty" by definition;
                  // it can't be marked Done either (see SwipeActions).
                  update.exercises = [];
                } else if (day.label?.toLowerCase() === 'rest') {
                  // When turning off rest, clear the "Rest" label so the
                  // label-based fallback in dayIsRest() doesn't snap it back.
                  update.label = `Day ${displayDayNum}`;
                }
                updateDay(planId, day.id, update);
              }}
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
        <View style={dc.capBottom} />
        </View>
      )}

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

// ─── DayCard styles ──────────────────────────────────────────────────────────
// Exported so DayListDragSort can reuse the day-number badge styles in its
// floating drag preview.
export const dc = StyleSheet.create({
  wrap:         { marginBottom: 10 },
  swipeContent: { borderRadius: 16, overflow: 'hidden' },
  editorClip:   { overflow: 'hidden', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  card:         { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  dimOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  dragHandle:   { width: 26, alignItems: 'center', justifyContent: 'center', marginLeft: -2 },
  cardCurrent:  {},
  numBadge:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numBadgeMuted:{ backgroundColor: 'rgba(255,240,220,0.07)' },
  num:          { fontSize: 17, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textSecondary },
  numActive:    { fontSize: 17, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },
  content:      { flex: 1, minWidth: 0 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label:        { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.48, flexShrink: 1 },
  todayDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  sub:          { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, marginBottom: 6 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag:          { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:       { fontSize: 10, fontWeight: '700', fontFamily: FONTS.headline },
  right:        { alignItems: 'flex-end', justifyContent: 'center', gap: 0 },

  // Cabinet
  cabinet:      { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  labelHint:    { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.80, marginBottom: 7 },
  labelField:   { paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  labelInput:   { fontSize: 17, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.51, padding: 0 },
  recSection:   { marginBottom: 12 },
  recLabel:     { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.80, marginBottom: 8 },
  recRow:       { gap: 8, flexDirection: 'row' },
  recChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)', backgroundColor: 'rgba(255,140,0,0.10)' },
  recChipTxt:   { fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.accent, maxWidth: 120 },
  exList:       { marginBottom: 8 },

  // Read-only row
  readRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.05)' },
  readInfo:     { flex: 1 },
  readName:     { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff', marginBottom: 2 },
  readMeta:     { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  readTag:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginLeft: 8 },
  readTagTxt:   { fontSize: 10, fontWeight: '700', fontFamily: FONTS.headline },
  emptyTxt:     { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 16 },
  addBtn:       { borderRadius: 12, overflow: 'hidden', marginBottom: 12, marginTop: 4 },
  addGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  addTxt:       { fontSize: 14, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },
  restTxt:       { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary },
  capBottom:     { height: 0 },
  restToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)' },
  restToggleLbl: { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
