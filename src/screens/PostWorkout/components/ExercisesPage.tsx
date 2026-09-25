import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { TrophyIcon } from '../../../components/common/TrophyIcon';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import { enterFade, layoutSoft } from '../../../motion/presets';
import { GlassView } from '../../../components/common/GlassView';
import { COLORS, FONTS } from '../../../constants';
import { WorkoutSession } from '../../../types';
import { fmtVol } from '../../../utils/format';

// Per-exercise colour palette — locked to the exercise's *original* index so
// the same exercise keeps its hue regardless of how the list is sorted.
const EX_COLORS = [COLORS.accent, COLORS.rest, COLORS.warning, '#A78BFA'];

function rpeColor(n: number): string {
  if (n <= 4) return '#30D158';
  if (n <= 6) return '#FFD60A';
  if (n <= 8) return '#FF8C00';
  return '#FF453A';
}

interface Props {
  session:     WorkoutSession;
  width:       number;
  /** The volume bar grows in the first time this page is shown. */
  active:      boolean;
  bottomInset: number;
}

// Reps count as "volume" only for reps-only exercises; a weighted set with no
// weight logged contributes nothing rather than a misleading reps × 1.
const setVol = (reps: number, weight: number | null, unit: string) =>
  unit === 'bodyweight' || unit === 'plates' ? reps : reps * (weight ?? 0);

function Chevron({ open }: { open: boolean }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => { turn.value = withTiming(open ? 1 : 0, TIMING.standard); }, [open]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
    </Animated.View>
  );
}

// Page 2 — stacked volume bar + per-exercise expandable cards.
export function ExercisesPage({ session, width, active, bottomInset }: Props) {
  const recordIds = new Set((session.prDetails ?? []).filter(d => !d.isFirst).map(d => d.exerciseId));

  // Grow the stacked bar in from the left once, the first time the page shows.
  const grow = useSharedValue(0);
  useEffect(() => {
    if (active && grow.value === 0) grow.value = withTiming(1, { duration: 700, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion });
  }, [active]);
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  const [openId,   setOpenId]   = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'volume' | 'order'>('volume');

  const exStats = session.exercises.map((ex, originalIdx) => {
    const completed = ex.sets.filter(s => s.isCompleted);
    const volume    = completed.reduce(
      (a, s) => a + setVol(s.actualRepsToFailure ?? s.actualReps, s.actualWeight, ex.weightUnit),
      0,
    );
    const totalReps = completed.reduce(
      (a, s) => a + (s.actualRepsToFailure ?? s.actualReps),
      0,
    );
    const bestSet = completed.reduce<typeof completed[0] | null>(
      (b, s) => ((s.actualWeight ?? 0) > (b?.actualWeight ?? 0) ? s : b),
      null,
    );
    return {
      ex, completed, volume, totalReps, bestSet,
      color: EX_COLORS[originalIdx % EX_COLORS.length],
    };
  });

  const totalVolume = exStats.reduce((a, x) => a + x.volume, 0);
  const list        = sortMode === 'volume'
    ? [...exStats].sort((a, b) => b.volume - a.volume)
    : exStats;

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* ── Section header: title + sort toggle ─────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Volume Breakdown</Text>
        <View style={s.toggle}>
          {(['volume', 'order'] as const).map(mode => {
            const active = sortMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setSortMode(mode)}
                style={[s.togglePill, active && s.togglePillActive]}
              >
                <Text style={[s.toggleTxt, active && s.toggleTxtActive]}>
                  {mode === 'volume' ? 'By volume' : 'By order'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Stacked volume bar ─────────────────────────── */}
      {totalVolume > 0 && (
        <Animated.View style={[s.bar, { transformOrigin: 'left' }, growStyle]}>
          {list.map((x, i) => {
            const pct = x.volume / totalVolume;
            if (pct <= 0) return null;
            const isFirst = i === 0;
            const isLast  = i === list.length - 1;
            return (
              <View
                key={x.ex.id}
                style={[
                  s.barSeg,
                  { flex: pct, backgroundColor: x.color },
                  isFirst && { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
                  isLast  && { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
                ]}
              >
                {pct >= 0.15 && (
                  <Text style={s.barLabel} numberOfLines={1}>{Math.round(pct * 100)}%</Text>
                )}
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* ── Exercise rows ─────────────────────────────── */}
      {list.map((x, i) => {
        const open       = openId === x.ex.id;
        const isFirst    = i === 0;
        const isLast     = i === list.length - 1;
        const prevOpen   = !isFirst && openId === list[i - 1].ex.id;
        const nextOpen   = !isLast  && openId === list[i + 1].ex.id;
        const gapAbove   = isFirst || open || prevOpen;
        const gapBelow   = isLast  || open || nextOpen;
        const marginBot  = isLast ? 0 : (open || nextOpen ? 14 : 4);
        const showWeight = x.ex.weightUnit !== 'bodyweight';
        const volLabel   = `${fmtVol(x.volume)}${showWeight ? ' ' + x.ex.weightUnit : ' reps'}`;

        return (
          <Animated.View key={x.ex.id} layout={layoutSoft}>
          <GlassView
            radius={0}
            style={[
              s.card,
              { borderTopLeftRadius:    gapAbove ? 12 : 0,
                borderTopRightRadius:   gapAbove ? 12 : 0,
                borderBottomLeftRadius: gapBelow ? 12 : 0,
                borderBottomRightRadius:gapBelow ? 12 : 0,
                marginBottom: marginBot },
            ]}
          >
            <Pressable
              onPress={() => setOpenId(open ? null : x.ex.id)}
              style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
            >
              <View style={[s.marker, { backgroundColor: x.color }]} />

              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>{x.ex.exerciseName}</Text>
                  {recordIds.has(x.ex.exerciseId) && (
                    <View style={s.prTag} accessibilityLabel="New personal record">
                      <TrophyIcon size={11} color="#000" />
                      <Text style={s.prTagTxt}>PR</Text>
                    </View>
                  )}
                </View>

                <View style={s.chipsRow}>
                  <View style={s.chip}>
                    <Text style={s.chipTxt}>{x.completed.length}/{x.ex.sets.length} sets</Text>
                  </View>
                  <View style={[
                    s.chip,
                    { backgroundColor: x.color + '22', borderColor: x.color + '55' },
                  ]}>
                    <Text style={[s.chipTxt, { color: x.color, fontWeight: '700' }]}>{volLabel}</Text>
                  </View>
                  {showWeight && x.bestSet && x.bestSet.actualWeight != null && (
                    <View style={s.chip}>
                      <Text style={s.chipTxt}>
                        best {x.bestSet.actualWeight}{x.ex.weightUnit} × {x.bestSet.actualRepsToFailure ?? x.bestSet.actualReps}
                      </Text>
                    </View>
                  )}
                  {x.ex.rpe != null && x.ex.rpe > 0 && (
                    <View style={[s.chip, { backgroundColor: rpeColor(x.ex.rpe) + '22', borderColor: rpeColor(x.ex.rpe) + '55' }]}>
                      <Text style={[s.chipTxt, { color: rpeColor(x.ex.rpe), fontWeight: '800' }]}>RPE {x.ex.rpe}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Chevron open={open} />
            </Pressable>

            {open && (
              <Animated.View entering={enterFade} style={s.table}>
                <View style={s.tableHead}>
                  {['Set', 'Weight', 'Reps', 'Vol'].map((h, hi) => (
                    <Text key={hi} style={[s.th, hi > 0 && s.thRight]}>{h}</Text>
                  ))}
                </View>
                {x.completed.map((set, si) => {
                  const reps = set.actualRepsToFailure ?? set.actualReps;
                  const vol  = Math.round(setVol(reps, set.actualWeight, x.ex.weightUnit));
                  return (
                    <View key={si} style={s.tableRow}>
                      <Text style={s.td}>S{set.setNumber}</Text>
                      <Text style={[s.td, s.tdRight]}>
                        {set.actualWeight != null ? `${set.actualWeight}${x.ex.weightUnit}` : '—'}
                      </Text>
                      <Text style={[s.td, s.tdRight]}>{reps}</Text>
                      <Text style={[s.td, s.tdRight, { color: COLORS.textMuted }]}>{vol}</Text>
                    </View>
                  );
                })}
                {x.ex.exerciseNote ? (
                  <View style={s.noteRow}>
                    <Text style={s.noteLabel}>Note</Text>
                    <Text style={s.noteTxt}>{x.ex.exerciseNote}</Text>
                  </View>
                ) : null}
              </Animated.View>
            )}
          </GlassView>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:             { paddingHorizontal: 16, paddingTop: 8 },

  // Section header
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle:      { fontSize: 12, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.96 },

  // Sort toggle
  toggle:           { flexDirection: 'row', backgroundColor: 'rgba(255,240,220,0.05)', borderRadius: 9, padding: 3, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  togglePill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  togglePillActive: { backgroundColor: 'rgba(255,240,220,0.14)' },
  toggleTxt:        { fontSize: 11, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textMuted },
  toggleTxtActive:  { color: '#fff', fontWeight: '800', fontFamily: FONTS.display },

  // Stacked bar
  bar:      { flexDirection: 'row', height: 32, marginBottom: 14, gap: 2 },
  barSeg:   { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  barLabel: { fontSize: 11, fontWeight: '800', fontFamily: FONTS.display, color: '#0d0d0f' },

  // Card
  card:     { overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  marker:   { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  info:     { flex: 1, minWidth: 0, gap: 7 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:     { flexShrink: 1, fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.48 },
  prTag:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, backgroundColor: COLORS.accent },
  prTagTxt: { fontSize: 11, fontFamily: FONTS.display, color: '#000', letterSpacing: 0.3 },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)' },
  chipTxt:  { fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },

  // Expanded set table
  table:     { borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', backgroundColor: 'rgba(0,0,0,0.18)' },
  tableHead: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9 },
  th:        { fontSize: 11, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.88, flex: 1 },
  thRight:   { textAlign: 'right' },
  tableRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  td:        { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff', flex: 1 },
  tdRight:   { textAlign: 'right' },
  // Exercise note
  noteRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  noteLabel: { fontSize: 11, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.80, marginTop: 2, width: 34 },
  noteTxt:   { flex: 1, fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 18 },
});
