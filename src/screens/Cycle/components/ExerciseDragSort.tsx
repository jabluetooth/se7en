import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder, LayoutAnimation, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MUSCLE_TAG_COLOR, FONTS } from '../../../constants';
import { Exercise } from '../../../types';
import { usePlanStore } from '../../../stores/planStore';

const EX_H = 56;

// ─── Exercise row styles (shared by the row + the floating preview) ─────────

const er = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', height: EX_H, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)' },
  info:    { flex: 1, minWidth: 0 },
  name:    { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff', marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setInfo: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textSecondary },
  tag:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:  { fontSize: 10, fontWeight: '700', fontFamily: FONTS.headline },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});

interface Props {
  exercises:              Exercise[];
  planId:                 string;
  dayId:                  string;
  onEdit:                 (ex: Exercise) => void;
  onDelete:               (ex: Exercise) => void;
  onScrollEnabledChange?: (enabled: boolean) => void;
}

// Drag-to-reorder list for the exercises inside a day's editor cabinet.
// Uses per-ID PanResponders so handlers stay stable across re-renders.
export function ExerciseDragSort({
  exercises, planId, dayId, onEdit, onDelete, onScrollEnabledChange,
}: Props) {
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
