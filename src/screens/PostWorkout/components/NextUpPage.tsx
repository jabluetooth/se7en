import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { TrophyIcon } from '../../../components/common/TrophyIcon';
import { COLORS } from '../../../constants';
import { WorkoutDay, Exercise } from '../../../types';

interface Props {
  nextDay?: WorkoutDay;
  width:    number;
  visible:  boolean;
}

// Page 3 — minimal centered identity block + staggered bottom-to-top reveal
// of the upcoming exercises. The `visible` prop drives the animation so it
// only fires when the user actually swipes to this page.
export function NextUpPage({ nextDay, width, visible }: Props) {
  if (!nextDay) {
    return (
      <View style={[s.page, { width, alignItems: 'center', justifyContent: 'center' }]}>
        <TrophyIcon size={40} color={COLORS.textLabel} />
        <Text style={s.empty}>No next workout scheduled</Text>
        <Text style={s.emptySub}>Rest and recover — you've earned it.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { width, alignItems: 'center', paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered identity block — mirrors the Summary page's header */}
      <View style={s.head}>
        <Text style={s.eyebrow}>Up Next</Text>
        <Text style={s.dayName}>{nextDay.label}</Text>
        <Text style={s.daySub}>
          Day {nextDay.dayPosition} · {nextDay.exercises.length} exercise{nextDay.exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={s.list}>
        {nextDay.exercises.map((ex, i) => (
          <UpcomingRow key={ex.id} ex={ex} index={i} visible={visible} />
        ))}
      </View>
    </ScrollView>
  );
}

function UpcomingRow({ ex, index, visible }:
  { ex: Exercise; index: number; visible: boolean }) {
  const translateY = useRef(new Animated.Value(28)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  // Drive the stagger off `visible` (true only when Page 3 is the active pager
  // page). Without this gate the animations would all fire on mount of the
  // pager — long before the user swiped over — and finish before being seen.
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          delay: 80 + index * 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          delay: 80 + index * 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(28);
      opacity.setValue(0);
    }
  }, [visible, index, translateY, opacity]);

  // Formula display: sets × reps × weight = volume
  const repsLabel = ex.toFailure
    ? 'fail'
    : ex.targetRepsMin === ex.targetRepsMax || !ex.targetRepsMax
      ? `${ex.targetRepsMin ?? '–'}`
      : `${ex.targetRepsMin}–${ex.targetRepsMax}`;

  const hasWeight = ex.targetWeight != null && ex.targetWeight > 0 && ex.weightUnit !== 'bodyweight';
  const vol       = hasWeight && !ex.toFailure && ex.targetRepsMin
    ? ex.targetSets * ex.targetRepsMin * (ex.targetWeight ?? 0)
    : null;
  const volLabel  = vol != null
    ? vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : `${Math.round(vol)}`
    : null;

  return (
    <Animated.View style={[s.row, { opacity, transform: [{ translateY }] }]}>
      <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
      <Text style={s.exMeta}>
        {ex.targetSets} × {repsLabel}
        {hasWeight ? ` × ${ex.targetWeight}${ex.weightUnit}` : ''}
        {volLabel ? ` = ${volLabel}` : ''}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  page:     { flex: 1, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'space-between' },

  // Empty state
  empty:    { fontSize: 16, fontWeight: '600', color: COLORS.textMuted, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.textLabel, marginTop: 6 },

  // Centered header
  head:     { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 28, alignSelf: 'stretch' },
  eyebrow:  { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  dayName:  { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 36, textAlign: 'center' },
  daySub:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Animated list
  list:     { gap: 22, alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 8 },
  row:      { alignItems: 'center', gap: 5, alignSelf: 'stretch' },
  exName:   { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3, textAlign: 'center' },
  exMeta:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.3, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
