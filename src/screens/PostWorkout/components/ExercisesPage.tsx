import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { EASE_OUT, TIMING } from '../../../motion/tokens';
import { InfoTip } from '../../../components/common/InfoTip';
import { COLORS, FONTS } from '../../../constants';
import type { SessionExercise, WorkoutSession } from '../../../types';
import { useSettingsStore } from '../../../stores/settingsStore';
import { ink, themed } from '../../../theme/runtime';

interface Props {
  session:     WorkoutSession;
  width:       number;
  /** Bars grow in the first time this page is shown. */
  active:      boolean;
  bottomInset: number;
}

const KG_PER_LB = 0.45359237;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

interface Row {
  id:    string;
  name:  string;
  value: number;
  sets:  string;
  rpe:   number | null;
  note:  string;
  pr:    boolean;
}

function repsOf(s: SessionExercise['sets'][number]) {
  return s.actualRepsToFailure ?? s.actualReps;
}

/**
 * Page 2: what each exercise contributed, as a bar chart. One bar per
 * exercise, longest first, with the total written at the end of the bar and
 * the sets underneath as plain numbers. Weighted lifts (weight × reps,
 * converted to your unit) and reps-only lifts get separate charts so the two
 * never share a scale. Orange marks a new record; everything else is grey.
 */
export function ExercisesPage({ session, width, active, bottomInset }: Props) {
  const unit = useSettingsStore(st => st.settings.defaultWeightUnit ?? 'kg');
  const recordIds = new Set((session.prDetails ?? []).filter(d => !d.isFirst).map(d => d.exerciseId));

  const weighted: Row[] = [];
  const repsOnly: Row[] = [];
  for (const ex of session.exercises) {
    const done = ex.sets.filter(s => s.isCompleted);
    if (done.length === 0) continue;
    const isWeighted = ex.weightUnit === 'kg' || ex.weightUnit === 'lb';
    const factor = !isWeighted || ex.weightUnit === unit ? 1 : ex.weightUnit === 'kg' ? 1 / KG_PER_LB : KG_PER_LB;
    const row: Row = {
      id: ex.id,
      name: ex.exerciseName,
      value: isWeighted
        ? done.reduce((a, s) => a + repsOf(s) * (s.actualWeight ?? 0) * factor, 0)
        : done.reduce((a, s) => a + repsOf(s), 0),
      sets: done
        .map(s => (isWeighted && s.actualWeight != null ? `${fmt(s.actualWeight)}×${repsOf(s)}` : `${repsOf(s)}`))
        .join('  '),
      rpe: ex.rpe != null && ex.rpe > 0 ? ex.rpe : null,
      note: ex.exerciseNote ?? '',
      pr: recordIds.has(ex.exerciseId),
    };
    (isWeighted ? weighted : repsOnly).push(row);
  }
  weighted.sort((a, b) => b.value - a.value);
  repsOnly.sort((a, b) => b.value - a.value);

  const chartW = width - 32;

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {weighted.length > 0 && (
        <Chart
          title={`Volume by exercise`}
          info={`Weight × reps across the sets you logged, in ${unit}. Longest bar first. Orange bars are exercises where you set a record today.`}
          rows={weighted}
          unit={unit}
          width={chartW}
          active={active}
        />
      )}
      {repsOnly.length > 0 && (
        <Chart
          title="Reps by exercise"
          info="Bodyweight and plate-loaded exercises, counted in total reps so they aren't mixed with weighted volume."
          rows={repsOnly}
          unit="reps"
          width={chartW}
          active={active}
          offset={weighted.length}
        />
      )}
      {weighted.length === 0 && repsOnly.length === 0 && (
        <Text style={s.empty}>No sets were logged in this workout.</Text>
      )}
    </ScrollView>
  );
}

function Chart({ title, info, rows, unit, width, active, offset = 0 }: {
  title: string; info: string; rows: Row[]; unit: string; width: number; active: boolean; offset?: number;
}) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <View style={s.chart}>
      <View style={s.titleRow}>
        <Text style={s.title}>{title}</Text>
        <InfoTip title={title} text={info} />
      </View>
      {rows.map((r, i) => (
        <View
          key={r.id}
          style={s.row}
          accessible
          accessibilityLabel={`${r.name}, ${Math.round(r.value).toLocaleString()} ${unit}${r.pr ? ', new record' : ''}. Sets ${r.sets}.`}
        >
          <View style={s.labelRow}>
            <Text style={s.name} numberOfLines={1}>{r.name}</Text>
            {r.pr && <Text style={s.prTxt}>Record</Text>}
            <Text style={[s.value, r.pr && { color: COLORS.accent }]}>
              {Math.round(r.value).toLocaleString()} <Text style={s.unit}>{unit}</Text>
            </Text>
          </View>
          <Bar fraction={r.value / max} width={width} pr={r.pr} active={active} index={offset + i} />
          <Text style={s.sets} numberOfLines={2}>
            {r.sets}{r.rpe != null ? `   ·   RPE ${r.rpe}` : ''}
          </Text>
          {r.note ? <Text style={s.note} numberOfLines={2}>{r.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Bar({ fraction, width, pr, active, index }: { fraction: number; width: number; pr: boolean; active: boolean; index: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    if (active && grow.value === 0) {
      grow.value = withDelay(Math.min(index, 8) * 50, withTiming(1, { duration: 600, easing: EASE_OUT, reduceMotion: TIMING.standard.reduceMotion }));
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return (
    <Animated.View
      style={[
        s.bar,
        { width: Math.max(4, fraction * width), transformOrigin: 'left', backgroundColor: pr ? COLORS.accent : ink(0.28) },
        style,
      ]}
    />
  );
}

const s = themed(() => StyleSheet.create({
  page:     { paddingHorizontal: 16, paddingTop: 12, gap: 32 },
  chart:    { gap: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:    { fontSize: 17, fontFamily: FONTS.headline, color: COLORS.text },
  row:      { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name:     { flexShrink: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  prTxt:    { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.accent },
  value:    { marginLeft: 'auto', fontSize: 16, fontFamily: FONTS.display, color: COLORS.text, fontVariant: ['tabular-nums'] },
  unit:     { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  bar:      { height: 10, borderRadius: 5 },
  sets:     { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  note:     { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, fontStyle: 'italic' },
  empty:    { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
}));
