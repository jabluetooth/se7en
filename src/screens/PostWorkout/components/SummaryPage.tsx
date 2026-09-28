import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { InfoTip } from '../../../components/common/InfoTip';
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
        <Text style={s.eyebrow}>Workout complete · {finishedDate}</Text>
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
            <Ionicons name={comparison.icon} size={15} color={comparison.tone === 'up' ? COLORS.success : COLORS.textMuted} />
            <Text style={[s.compareTxt, comparison.tone === 'up' && { color: COLORS.success }]}>{comparison.text}</Text>
          </View>
        )}
      </Animated.View>

      {/* ── New records ──────────────────────────────────── */}
      {sum.records.length > 0 && (
        <Animated.View entering={enterRise(2)} style={s.prCard}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>
              {sum.records.length === 1 ? 'New record' : `${sum.records.length} new records`}
            </Text>
            <InfoTip title="Records" text="A record is your heaviest weight, most reps or most volume on an exercise, beating every previous workout." />
          </View>
          {sum.records.map((r, i) => {
            const gain = r.value - r.previous;
            return (
              <Animated.View
                key={`${r.exerciseId}-${r.metric}`}
                entering={enterRise(3 + i)}
                style={s.prRow}
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
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Every set</Text>
            <InfoTip title="Every set" text="Each point is one set's volume (weight × reps), in the order you lifted them. The highlighted point is your biggest set." />
          </View>
          <VolumeLineGraph data={sum.points} peakIdx={sum.bestIdx} width={graphWidth} animate={active} />
          <View style={s.pillRow}>
            {best && (
              <View style={s.pill}>
                <Text style={s.pillLbl}>Biggest set</Text>
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
  page:        { paddingHorizontal: 20, paddingTop: 8, gap: 30 },

  top:         { alignItems: 'center', gap: 4 },
  eyebrow:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  name:        { fontSize: 40, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.3, lineHeight: 44, textAlign: 'center' },
  nameSub:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, textAlign: 'center', fontVariant: ['tabular-nums'] },

  stats:       { alignItems: 'center', gap: 16 },
  heroStat:    { alignItems: 'center' },
  heroVal:     { fontSize: 64, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -2.5, fontVariant: ['tabular-nums'], lineHeight: 68 },
  heroUnit:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  smallStats:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  smallStat:   { flex: 1, alignItems: 'center', gap: 2 },
  smallVal:    { fontSize: 24, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  smallLbl:    { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  smallDivider:{ width: StyleSheet.hairlineWidth, height: 28, backgroundColor: COLORS.border },
  compare:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compareTxt:  { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, flexShrink: 1, textAlign: 'center' },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  sectionTitle:{ fontSize: 17, fontFamily: FONTS.headline, color: COLORS.text },

  prCard:      { gap: 4 },
  prRow:       {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  prInfo:      { flex: 1, minWidth: 0, gap: 2 },
  prExercise:  { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
  prMetric:    { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  prValues:    { alignItems: 'flex-end', gap: 2 },
  prValue:     { fontSize: 18, fontFamily: FONTS.hero, color: COLORS.accent, fontVariant: ['tabular-nums'] },
  prWas:       { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },

  baseline:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  baselineTxt: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, lineHeight: 20 },

  graphBlock:  { alignItems: 'center', gap: 12 },
  pillRow:     { alignSelf: 'stretch' },
  pill:        {
    flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  pillLbl:     { width: 96, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  pillVal:     { flex: 1, fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text, fontVariant: ['tabular-nums'] },
}));
