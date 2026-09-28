import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../../components/common/GlassView';
import { TrophyIcon } from '../../../components/common/TrophyIcon';
import { COLORS, FONTS } from '../../../constants';
import { WorkoutSession } from '../../../types';
import { useSessionStore } from '../../../stores/sessionStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { enterFade, enterRise } from '../../../motion/presets';
import { COUNT_STAGGER, useCountUp } from '../../../motion/useCountUp';
import { summarizeSession, prMetricLabel, fmtRecord } from '../../../utils/sessionSummary';
import { VolumeLineGraph } from './VolumeLineGraph';
import { accentA, ink, themed } from '../../../theme/runtime';

interface Props {
  session: WorkoutSession;
  width:   number;
  /** True while this page is the one on screen; counters and the graph wait for it. */
  active:  boolean;
  /** Space to leave under the content for the sticky Done button. */
  bottomInset: number;
}

const num = (n: number) => Math.round(n).toLocaleString();

// Page 1 — the payoff: what you did, how it compares, and any new records.
export function SummaryPage({ session, width, active, bottomInset }: Props) {
  const history = useSessionStore(st => st.sessions);
  const unit = useSettingsStore(st => st.settings.defaultWeightUnit ?? 'kg');
  const sum = useMemo(() => summarizeSession(session, history, unit), [session, history, unit]);

  const load = useCountUp(sum.load, { enabled: active });
  const sets = useCountUp(sum.sets, { enabled: active, delay: COUNT_STAGGER });
  const reps = useCountUp(sum.reps, { enabled: active, delay: COUNT_STAGGER * 2 });

  const finishedDate = session.finishedAt
    ? new Date(session.finishedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';
  const graphWidth = Math.min(width - 32, 360);
  const hasLoad = sum.load > 0;

  const comparison = (() => {
    if (!sum.previous || sum.previous.load <= 0 || !hasLoad) {
      return sum.previous
        ? null
        : { icon: 'flag-outline' as const, text: `First ${session.dayLabel} day logged. This is your baseline.`, tone: 'muted' as const };
    }
    const delta = sum.load - sum.previous.load;
    const pct = Math.round((delta / sum.previous.load) * 100);
    if (Math.abs(pct) < 1) return { icon: 'remove-outline' as const, text: `Same volume as your last ${session.dayLabel} day`, tone: 'muted' as const };
    return delta > 0
      ? { icon: 'trending-up' as const, text: `${num(delta)} ${unit} more than your last ${session.dayLabel} day (+${pct}%)`, tone: 'up' as const }
      : { icon: 'trending-down' as const, text: `${num(-delta)} ${unit} less than your last ${session.dayLabel} day`, tone: 'muted' as const };
  })();

  const best = sum.points[sum.bestIdx];

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {/* ── Identity ─────────────────────────────────────── */}
      <Animated.View entering={enterFade} style={s.top}>
        <GlassView radius={99} style={s.chip}>
          <TrophyIcon size={12} color={COLORS.accent} />
          <Text style={s.chipText}>Workout complete</Text>
          <Text style={s.chipDot}>·</Text>
          <Text style={s.chipDate}>{finishedDate}</Text>
        </GlassView>
        <Text style={s.name}>{session.dayLabel}</Text>
        <Text style={s.nameSub}>Day {session.dayPosition} · {session.duration} min</Text>
      </Animated.View>

      {/* ── Headline numbers ─────────────────────────────── */}
      <Animated.View entering={enterRise(1)} style={s.stats}>
        {hasLoad && (
          <View style={s.heroStat} accessible accessibilityLabel={`${num(sum.load)} ${unit} lifted`}>
            <Text style={s.heroVal}>{num(load)}</Text>
            <Text style={s.heroUnit}>{unit} lifted</Text>
          </View>
        )}
        <View style={s.smallStats}>
          <View style={s.smallStat} accessible accessibilityLabel={`${sum.sets} sets`}>
            <Text style={s.smallVal}>{num(sets)}</Text>
            <Text style={s.smallLbl}>Sets</Text>
          </View>
          <View style={s.smallDivider} />
          <View style={s.smallStat} accessible accessibilityLabel={`${sum.reps} reps`}>
            <Text style={s.smallVal}>{num(reps)}</Text>
            <Text style={s.smallLbl}>Reps</Text>
          </View>
          <View style={s.smallDivider} />
          <View style={s.smallStat} accessible accessibilityLabel={`${sum.minutes} minutes`}>
            <Text style={s.smallVal}>{sum.minutes}</Text>
            <Text style={s.smallLbl}>Minutes</Text>
          </View>
        </View>
        {comparison && (
          <View style={s.compare}>
            <Ionicons name={comparison.icon} size={15} color={comparison.tone === 'up' ? COLORS.accent : COLORS.textMuted} />
            <Text style={[s.compareTxt, comparison.tone === 'up' && { color: COLORS.accent }]}>{comparison.text}</Text>
          </View>
        )}
      </Animated.View>

      {/* ── New records ──────────────────────────────────── */}
      {sum.records.length > 0 && (
        <Animated.View entering={enterRise(2)} style={s.prCard}>
          <View style={s.prHead}>
            <TrophyIcon size={16} color={COLORS.accent} />
            <Text style={s.prTitle}>
              {sum.records.length === 1 ? 'New personal record' : `${sum.records.length} new personal records`}
            </Text>
          </View>
          {sum.records.map((r, i) => {
            const gain = r.value - r.previous;
            return (
              <Animated.View
                key={`${r.exerciseId}-${r.metric}`}
                entering={enterRise(3 + i)}
                style={[s.prRow, i > 0 && s.prRowBorder]}
                accessible
                accessibilityLabel={`${r.exerciseName}, ${prMetricLabel(r)}: ${fmtRecord(r.value, r.unit)}, up from ${fmtRecord(r.previous, r.unit)}`}
              >
                <View style={s.prInfo}>
                  <Text style={s.prExercise} numberOfLines={1}>{r.exerciseName}</Text>
                  <Text style={s.prMetric}>{prMetricLabel(r)}</Text>
                </View>
                <View style={s.prValues}>
                  <Text style={s.prValue}>{fmtRecord(r.value, r.unit)}</Text>
                  <Text style={s.prWas}>
                    was {fmtRecord(r.previous, r.unit)} · +{fmtRecord(gain, r.unit)}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      )}
      {sum.records.length === 0 && sum.baselines.length > 0 && (
        <Animated.View entering={enterRise(2)} style={s.baseline}>
          <Ionicons name="flag-outline" size={16} color={COLORS.textSecondary} />
          <Text style={s.baselineTxt}>
            First time logging {sum.baselines.length === 1 ? sum.baselines[0].exerciseName : `${sum.baselines.length} exercises`}.
            {' '}These numbers are the ones to beat next time.
          </Text>
        </Animated.View>
      )}

      {/* ── Every set ────────────────────────────────────── */}
      {sum.points.length > 0 && (
        <Animated.View entering={enterRise(3)} style={s.graphBlock}>
          <View style={s.graphLabelRow}>
            <Text style={s.graphTitle}>Every set</Text>
            <Text style={s.graphAxis}>volume, in the order you lifted</Text>
          </View>
          <VolumeLineGraph data={sum.points} peakIdx={sum.bestIdx} width={graphWidth} animate={active} />
          <View style={s.pillRow}>
            {best && (
              <View style={s.pill}>
                <Text style={s.pillLbl}>Best set</Text>
                <Text style={s.pillVal} numberOfLines={1}>
                  {best.weight > 0 ? `${best.weight} ${best.unit} × ${best.reps}` : `${best.reps} reps`} · {best.exName}
                </Text>
              </View>
            )}
            {sum.heaviest && (
              <View style={s.pill}>
                <Text style={s.pillLbl}>Heaviest</Text>
                <Text style={s.pillVal} numberOfLines={1}>{sum.heaviest.weight} {sum.heaviest.unit} · {sum.heaviest.exName}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const s = themed(() => StyleSheet.create({
  page:        { paddingHorizontal: 16, paddingTop: 4, gap: 22 },

  top:         { alignItems: 'center', gap: 4 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  chipText:    { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.accent, letterSpacing: 0 },
  chipDot:     { fontSize: 11, fontFamily: FONTS.headline, color: COLORS.textMuted },
  chipDate:    { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  name:        { fontSize: 40, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.3, lineHeight: 44, textAlign: 'center' },
  nameSub:     { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },

  stats:       { alignItems: 'center', gap: 14 },
  heroStat:    { alignItems: 'center' },
  heroVal:     { fontSize: 64, fontFamily: FONTS.hero, color: COLORS.accent, letterSpacing: -2.5, fontVariant: ['tabular-nums'], lineHeight: 68 },
  heroUnit:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, letterSpacing: 0 },
  smallStats:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  smallStat:   { flex: 1, alignItems: 'center', gap: 2 },
  smallVal:    { fontSize: 24, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  smallLbl:    { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textLabel, letterSpacing: 0 },
  smallDivider:{ width: StyleSheet.hairlineWidth, height: 28, backgroundColor: ink(0.14) },
  compare:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: ink(0.05) },
  compareTxt:  { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary, flexShrink: 1 },

  prCard:      {
    borderRadius: 18, borderWidth: 1, borderColor: accentA(0.35),
    backgroundColor: accentA(0.07), paddingHorizontal: 16, paddingVertical: 14,
  },
  prHead:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  prTitle:     { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.accent, letterSpacing: -0.2 },
  prRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  prRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: accentA(0.25) },
  prInfo:      { flex: 1, minWidth: 0, gap: 2 },
  prExercise:  { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.3 },
  prMetric:    { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  prValues:    { alignItems: 'flex-end', gap: 2 },
  prValue:     { fontSize: 17, fontFamily: FONTS.dataBold, color: COLORS.accent },
  prWas:       { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textMuted },

  baseline:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: ink(0.05) },
  baselineTxt: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary, lineHeight: 19 },

  graphBlock:  { alignItems: 'center', gap: 10 },
  graphLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 4 },
  graphTitle:  { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
  graphAxis:   { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },
  pillRow:     { alignSelf: 'stretch', gap: 8 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: accentA(0.08), borderWidth: 1, borderColor: accentA(0.22), borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  pillLbl:     { fontSize: 12, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0, width: 72 },
  pillVal:     { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.text },
}));
