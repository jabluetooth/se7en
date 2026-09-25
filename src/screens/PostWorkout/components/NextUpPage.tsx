import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../../constants';
import { WorkoutDay, Exercise } from '../../../types';
import { enterFade, enterRise } from '../../../motion/presets';

interface Props {
  nextDay?:    WorkoutDay;
  width:       number;
  visible:     boolean;
  bottomInset: number;
}

// Page 3 — what's coming next time. The exercise list is only mounted the
// first time this page is on screen, so its staggered entrance plays when
// the user actually swipes here instead of finishing unseen off-screen.
export function NextUpPage({ nextDay, width, visible, bottomInset }: Props) {
  const [seen, setSeen] = useState(visible);
  useEffect(() => { if (visible) setSeen(true); }, [visible]);

  if (!nextDay) {
    return (
      <View style={[s.page, s.center, { width, paddingBottom: bottomInset }]}>
        <Ionicons name="moon-outline" size={36} color={COLORS.textLabel} />
        <Text style={s.empty}>Nothing scheduled next</Text>
        <Text style={s.emptySub}>Rest and recover. You've earned it.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={s.head}>
        <Text style={s.eyebrow}>Up next</Text>
        <Text style={s.dayName}>{nextDay.label}</Text>
        <Text style={s.daySub}>
          Day {nextDay.dayPosition} · {nextDay.exercises.length} exercise{nextDay.exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {seen && (
        <View style={s.list}>
          {nextDay.exercises.map((ex, i) => (
            <Animated.View key={ex.id} entering={enterRise(i)} style={s.row}>
              <Text style={s.index}>{i + 1}</Text>
              <View style={s.rowText}>
                <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                <Text style={s.exMeta}>{planLabel(ex)}</Text>
              </View>
            </Animated.View>
          ))}
          <Animated.Text entering={enterFade.delay(260)} style={s.footnote}>
            Your numbers from today will be waiting as "last time" on each set.
          </Animated.Text>
        </View>
      )}
    </ScrollView>
  );
}

/** "4 sets × 8–10 · 60 kg", "3 sets to failure", "3 sets × 12". */
function planLabel(ex: Exercise): string {
  const sets = `${ex.targetSets} set${ex.targetSets === 1 ? '' : 's'}`;
  const reps = ex.toFailure
    ? ' to failure'
    : ex.targetRepsMax && ex.targetRepsMax !== ex.targetRepsMin
      ? ` × ${ex.targetRepsMin}–${ex.targetRepsMax}`
      : ex.targetRepsMin ? ` × ${ex.targetRepsMin}` : '';
  const weight = ex.targetWeight && ex.targetWeight > 0 && ex.weightUnit !== 'bodyweight'
    ? ` · ${ex.targetWeight} ${ex.weightUnit}`
    : '';
  return sets + reps + weight;
}

const s = StyleSheet.create({
  page:     { paddingHorizontal: 16, paddingTop: 8 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty:    { fontSize: 17, fontFamily: FONTS.headline, color: COLORS.textSecondary, marginTop: 14 },
  emptySub: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },

  head:     { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 26 },
  eyebrow:  { fontSize: 11, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.88, textTransform: 'uppercase' },
  dayName:  { fontSize: 32, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1.28, lineHeight: 36, textAlign: 'center' },
  daySub:   { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },

  list:     { gap: 10 },
  row:      {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,240,220,0.04)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)',
  },
  index:    { width: 22, fontSize: 15, fontFamily: FONTS.dataBold, color: COLORS.textLabel, textAlign: 'center' },
  rowText:  { flex: 1, minWidth: 0, gap: 3 },
  exName:   { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.4 },
  exMeta:   { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  footnote: { marginTop: 10, fontSize: 12, fontFamily: FONTS.body, color: COLORS.textLabel, textAlign: 'center', lineHeight: 18 },
});
