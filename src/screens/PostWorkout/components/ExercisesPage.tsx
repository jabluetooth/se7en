import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassView } from '../../../components/common/GlassView';
import { COLORS } from '../../../constants';
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
  session: WorkoutSession;
  width:   number;
}

// Page 2 — stacked volume bar + per-exercise expandable cards.
export function ExercisesPage({ session, width }: Props) {
  const [openId,   setOpenId]   = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'volume' | 'order'>('volume');

  const exStats = session.exercises.map((ex, originalIdx) => {
    const completed = ex.sets.filter(s => s.isCompleted);
    const volume    = completed.reduce(
      (a, s) => a + (s.actualRepsToFailure ?? s.actualReps) * (s.actualWeight ?? 1),
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
      contentContainerStyle={[s.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
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
        <View style={s.bar}>
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
        </View>
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
          <GlassView
            key={x.ex.id}
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
                <Text style={s.name} numberOfLines={1}>{x.ex.exerciseName}</Text>

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

              <Svg
                width={14} height={14} viewBox="0 0 24 24" fill="none"
                style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] } as any}
              >
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            {open && (
              <View style={s.table}>
                <View style={s.tableHead}>
                  {['Set', 'Weight', 'Reps', 'Vol'].map((h, hi) => (
                    <Text key={hi} style={[s.th, hi > 0 && s.thRight]}>{h}</Text>
                  ))}
                </View>
                {x.completed.map((set, si) => {
                  const reps = set.actualRepsToFailure ?? set.actualReps;
                  const vol  = Math.round(reps * (set.actualWeight ?? 1));
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
              </View>
            )}
          </GlassView>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page:             { flex: 1, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'space-between' },

  // Section header
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle:      { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.9 },

  // Sort toggle
  toggle:           { flexDirection: 'row', backgroundColor: 'rgba(255,240,220,0.05)', borderRadius: 9, padding: 3, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  togglePill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  togglePillActive: { backgroundColor: 'rgba(255,240,220,0.14)' },
  toggleTxt:        { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.2 },
  toggleTxtActive:  { color: '#fff', fontWeight: '800' },

  // Stacked bar
  bar:      { flexDirection: 'row', height: 32, marginBottom: 14, gap: 2 },
  barSeg:   { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  barLabel: { fontSize: 11, fontWeight: '800', color: '#0d0d0f', letterSpacing: 0.3 },

  // Card
  card:     { overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  marker:   { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  info:     { flex: 1, minWidth: 0, gap: 7 },
  name:     { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)' },
  chipTxt:  { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.1 },

  // Expanded set table
  table:     { borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', backgroundColor: 'rgba(0,0,0,0.18)' },
  tableHead: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9 },
  th:        { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  thRight:   { textAlign: 'right' },
  tableRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  td:        { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  tdRight:   { textAlign: 'right' },
  // Exercise note
  noteRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  noteLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, width: 34 },
  noteTxt:   { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', lineHeight: 18 },
});
