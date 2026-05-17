import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet,
  Animated, PanResponder, LayoutAnimation, Platform,
} from 'react-native';
import { GlassView } from '../../../components/common/GlassView';
import { usePlanStore } from '../../../stores/planStore';
import { COLORS } from '../../../constants';
import { WorkoutDay, WorkoutSession } from '../../../types';
import { getStatus } from '../helpers';
import { DayCard, dc } from './DayCard';

// Initial guess for a day card's rendered height — used to seed the drag-sort
// layout map before onLayout fires with the real measurement.
const CARD_EST_H = 88;

interface Props {
  days:                   WorkoutDay[];
  planId:                 string;
  sessions:               WorkoutSession[];
  currentPos:             number;
  onEdit:                 (day: WorkoutDay) => void;
  onClear:                (day: WorkoutDay) => void;
  onDone:                 (day: WorkoutDay) => void;
  onScrollEnabledChange?: (enabled: boolean) => void;
}

// Drag-to-reorder list for the seven day cards. Reorders move the WHOLE day
// object (id + dayPosition + content) so each card's session-history-derived
// badge travels with it instead of staying glued to a slot.
export function DayListDragSort({
  days, planId, sessions, currentPos, onEdit, onClear, onDone, onScrollEnabledChange,
}: Props) {
  const { updatePlan }  = usePlanStore();
  const containerRef    = useRef<View>(null);
  const containerTopRef = useRef(0);
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
  const currentPosRef = useRef(currentPos);
  const sessionsRef   = useRef(sessions);
  daysRef.current       = days;
  onScrollRef.current   = onScrollEnabledChange;
  updatePlanRef.current = updatePlan;
  planIdRef.current     = planId;
  currentPosRef.current = currentPos;
  sessionsRef.current   = sessions;

  // First index in the sorted list that is not locked (completed or past rest).
  // Draggable cards cannot be dropped above this boundary.
  const minDropRef = useRef(0);
  minDropRef.current = (() => {
    const idx = daysRef.current.findIndex(d => {
      const st = getStatus(d, currentPosRef.current, sessionsRef.current);
      return st !== 'completed' && !(st === 'rest' && d.dayPosition < currentPosRef.current);
    });
    return idx === -1 ? 0 : idx;
  })();

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTo,   setDropTo  ] = useState<number | null>(null);

  // Measure once after mount; re-measured on each grant.
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

  // Per-card PanResponders — each handler captures its own idx via closure.
  const panHandlersRef = useRef<any[]>([]);
  if (panHandlersRef.current.length !== days.length) {
    panHandlersRef.current = days.map((_, idx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,

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
          const relY    = evt.nativeEvent.pageY - containerTopRef.current;
          const h       = layoutsRef.current[dragFromRef.current ?? 0]?.height ?? CARD_EST_H;
          floatY.setValue(Math.max(0, relY - h / 2));
          const newTo   = Math.max(findAt(relY), minDropRef.current);
          if (newTo !== dropToRef.current) { dropToRef.current = newTo; setDropTo(newTo); }
        },

        onPanResponderRelease: () => {
          const from = dragFromRef.current ?? 0;
          const to   = Math.max(dropToRef.current ?? from, minDropRef.current);
          if (from !== to) {
            LayoutAnimation.configureNext({ duration: 220, update: { type: LayoutAnimation.Types.easeInEaseOut } });
            // Move the WHOLE day object (id, dayPosition, label, exercises, …)
            // so its identity — and therefore its session history → status badge
            // — travels with the card.
            const reordered = [...snapshotRef.current];
            const [moved]   = reordered.splice(from, 1);
            reordered.splice(to, 0, moved);
            updatePlanRef.current(planIdRef.current, { days: reordered });
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
              isToday={day.dayPosition === currentPos}
              currentPos={currentPos}
              onEdit={() => onEdit(day)}
              onClear={() => onClear(day)}
              onDone={() => onDone(day)}
              dragHandlers={(() => {
                const st = getStatus(day, currentPos, sessions);
                const locked = st === 'completed' || (st === 'rest' && day.dayPosition < currentPos);
                return locked ? undefined : panHandlersRef.current[idx];
              })()}
              onScrollEnabledChange={onScrollEnabledChange}
            />
            {showBelow && <View style={dl.line} />}
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
  line:       { height: 2, borderRadius: 1, backgroundColor: COLORS.accent, marginVertical: 2, marginHorizontal: 16 },
  floatCard:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  floatLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  float: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 999,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
    }),
  },
});
