import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { InfoTip } from '../../components/common/InfoTip';
import { Segmented } from '../../components/common/Segmented';
import { fmtDate, fmtVol } from '../../utils/format';
import { aggregateExercises } from '../../utils/exerciseHistory';
import {
  summarize, deltaLabel, weeklyCounts, liftTrend, PERIOD_LABEL, type Period,
} from '../../utils/progressInsights';
import { useDockClearance } from '../../hooks/useDockClearance';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterRise } from '../../motion/presets';
import { GainCard } from './components/GainCard';
import { WeeklyBars } from './components/WeeklyBars';
import { ExerciseCard } from './components/ExerciseCard';
import { ink, themed } from '../../theme/runtime';

// Progress, read top to bottom: three numbers against the period before, the
// lift that improved most, how often you trained each week against your
// plan, the latest records, then every lift on one line each. Only data is
// on the screen; how each figure is worked out sits behind its ⓘ. One
// accent colour, used only for "now" and "best".

interface Props {
  /** Takes a brand-new user to Today to start their first workout. */
  onStartWorkout?: () => void;
}

const LIFTS_SHOWN = 6;

const PERIODS = [
  { value: '4w' as const, label: PERIOD_LABEL['4w'] },
  { value: '3m' as const, label: PERIOD_LABEL['3m'] },
  { value: 'all' as const, label: PERIOD_LABEL.all },
];

export function ProgressScreen({ onStartWorkout }: Props = {}) {
  const { sessions }   = useSessionStore();
  const { activePlan } = usePlanStore();
  const unit           = useSettingsStore(st => st.settings.defaultWeightUnit ?? 'kg');
  const { width }      = useWindowDimensions();
  const dockClearance  = useDockClearance();

  const [period,     setPeriod]     = useState<Period>('4w');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searching,  setSearching]  = useState(false);
  const [query,      setQuery]      = useState('');
  const [showAll,    setShowAll]    = useState(false);

  const totalWorkouts = useMemo(() => sessions.filter(s => s.status === 'completed').length, [sessions]);
  const summary = useMemo(() => summarize(sessions, period, unit), [sessions, period, unit]);
  const weeks = useMemo(() => weeklyCounts(sessions, period), [sessions, period]);

  const target = useMemo(() => {
    if (!activePlan || activePlan.days.length === 0) return null;
    const workouts = activePlan.days.filter(d => !d.isRestDay).length;
    return Math.round((workouts * 7 / activePlan.days.length) * 10) / 10;
  }, [activePlan]);

  // Every lift, most recently trained first.
  const lifts = useMemo(() => {
    const out: { h: ReturnType<typeof aggregateExercises>[number]; t: NonNullable<ReturnType<typeof liftTrend>> }[] = [];
    for (const h of aggregateExercises(sessions)) {
      const t = liftTrend(h, period);
      if (t) out.push({ h, t });
    }
    return out.sort((a, b) => new Date(b.t.lastAt).getTime() - new Date(a.t.lastAt).getTime());
  }, [sessions, period]);

  const q = query.trim().toLowerCase();
  const matching = q ? lifts.filter(l => l.h.exerciseName.toLowerCase().includes(q)) : lifts;
  const shown = q || showAll ? matching : matching.slice(0, LIFTS_SHOWN);

  const contentW = width - 40;
  const periodWords = period === 'all' ? 'all time' : `the last ${PERIOD_LABEL[period].toLowerCase()}`;

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {totalWorkouts === 0 ? (
          <>
            <Text style={[s.title, { paddingHorizontal: 20 }]}>Progress</Text>
            <FirstRun bottom={dockClearance} onStart={onStartWorkout} />
          </>
        ) : (
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: dockClearance }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.title} accessibilityRole="header">Progress</Text>

            <Segmented options={PERIODS} value={period} onChange={setPeriod} stretch a11yLabel="Time period" style={s.periods} />

            {/* ── Three numbers ── */}
            <Animated.View entering={enterRise(0)} style={s.figures}>
              <Figure value={String(summary.workouts)} label="Workouts" delta={deltaLabel(summary.workouts, summary.prevWorkouts)} />
              <Figure
                value={fmtVol(summary.volume)}
                unit={unit}
                label="Volume"
                delta={deltaLabel(Math.round(summary.volume), summary.prevVolume == null ? null : Math.round(summary.prevVolume), true)}
              />
              <Figure value={String(summary.records)} label={summary.records === 1 ? 'Record' : 'Records'} accent={summary.records > 0} />
            </Animated.View>
            <View style={s.captionRow}>
              <Text style={s.caption}>
                {period === 'all' ? 'All time' : `Last ${PERIOD_LABEL[period].toLowerCase()} vs the ${PERIOD_LABEL[period].toLowerCase()} before`}
              </Text>
              <InfoTip
                title="How these are counted"
                text={`Workouts: completed sessions. Volume: weight × reps over every logged set, in ${unit}; bodyweight sets aren't included. Records: new bests on weight, reps or volume. The line under each compares with the period just before.`}
                size={15}
              />
            </View>

            {/* ── Biggest gain ── */}
            <Section
              title="Biggest gain"
              info={`The lift whose top set went up the most, as a share of where it started, over ${periodWords}. The line shows its top set each workout, from the one just before the period to now.`}
            >
              <GainCard gain={summary.gain} width={contentW} />
            </Section>

            {/* ── Consistency ── */}
            <Section
              title="Workouts per week"
              info={target
                ? `Each column is one week, Monday to Sunday. The dashed line is your plan's pace: ${target} workouts a week. This week is orange.`
                : 'Each column is one week, Monday to Sunday. This week is orange.'}
            >
              <WeeklyBars bars={weeks} target={target} width={contentW} />
            </Section>

            {/* ── Latest records ── */}
            {summary.recentPRs.length > 0 && (
              <Section title="Latest records" info="New heaviest top sets in this period, newest first, with the best they replaced.">
                <View>
                  {summary.recentPRs.slice(0, 3).map((pr, i) => (
                    <View key={`${pr.exerciseId}-${pr.finishedAt}-${i}`} style={s.prRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.prName} numberOfLines={1}>{pr.exerciseName}</Text>
                        <Text style={s.prSub}>{fmtDate(pr.finishedAt)} · was {pr.previous}</Text>
                      </View>
                      <Text style={s.prVal}>{pr.value}<Text style={s.prUnit}> {pr.unit}</Text></Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* ── Lifts ── */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Lifts</Text>
                <InfoTip
                  title="Lifts"
                  text="Each row: your latest top set, its trend over the period, and how much it changed from the first workout in the period. An orange dot means a new best. Tap a lift for its full history."
                  size={15}
                />
                <AnimatedPressable
                  scale="strong"
                  onPress={() => { setSearching(v => !v); setQuery(''); }}
                  style={s.searchBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={searching ? 'Close search' : 'Search lifts'}
                >
                  <Ionicons name={searching ? 'close' : 'search'} size={18} color={COLORS.textSecondary} />
                </AnimatedPressable>
              </View>

              {searching && (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search lifts"
                  placeholderTextColor={COLORS.textLabel}
                  style={s.search}
                  autoFocus
                  returnKeyType="search"
                  accessibilityLabel="Search lifts"
                />
              )}

              {shown.length === 0 ? (
                <Text style={s.empty}>{q ? `No lifts match "${query.trim()}".` : 'Finish a workout to see your lifts here.'}</Text>
              ) : (
                <View>
                  {shown.map(({ h, t }) => (
                    <ExerciseCard
                      key={h.exerciseId}
                      history={h}
                      trend={t}
                      expanded={expandedId === h.exerciseId}
                      onToggle={() => setExpandedId(id => (id === h.exerciseId ? null : h.exerciseId))}
                      chartWidth={contentW}
                    />
                  ))}
                </View>
              )}

              {!q && matching.length > LIFTS_SHOWN && (
                <AnimatedPressable onPress={() => setShowAll(v => !v)} style={s.more} accessibilityRole="button">
                  <Text style={s.moreTxt}>{showAll ? 'Show fewer' : `Show all ${matching.length}`}</Text>
                </AnimatedPressable>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Section({ title, info, children }: { title: string; info: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        <InfoTip title={title} text={info} size={15} />
      </View>
      {children}
    </View>
  );
}

function Figure({ value, unit, label, delta, accent }: { value: string; unit?: string; label: string; delta?: string | null; accent?: boolean }) {
  const up = !!delta && delta.startsWith('+');
  return (
    <View style={s.figure}>
      <Text style={[s.figVal, accent && { color: COLORS.accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit ? <Text style={s.figUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.figLbl}>{label}</Text>
      {delta ? <Text style={[s.figDelta, up && { color: COLORS.success }]}>{delta.replace(' vs before', '')}</Text> : null}
    </View>
  );
}

/**
 * Before the first workout, Progress has nothing to chart. Rather than a
 * screen of zeros, say what will appear here and point to where to start.
 */
function FirstRun({ bottom, onStart }: { bottom: number; onStart?: () => void }) {
  const items: [React.ComponentProps<typeof Ionicons>['name'], string][] = [
    ['stats-chart-outline', 'How often you train, week by week'],
    ['trending-up-outline', 'A trend line for every lift'],
    ['trophy-outline', 'Your records, as you set them'],
  ];
  return (
    <ScrollView contentContainerStyle={[fr.wrap, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
      <Animated.View entering={enterRise(0)}>
        <Text style={fr.title}>Your progress starts with your first workout</Text>
      </Animated.View>
      {items.map(([icon, title], i) => (
        <Animated.View key={title} entering={enterRise(i + 1)} style={fr.item}>
          <Ionicons name={icon} size={20} color={COLORS.accent} />
          <Text style={fr.itemTitle}>{title}</Text>
        </Animated.View>
      ))}
      {onStart && (
        <Animated.View entering={enterRise(4)}>
          <AnimatedPressable haptic="light" style={fr.cta} onPress={onStart} accessibilityRole="button" accessibilityLabel="Go to Today to start your first workout">
            <Text style={fr.ctaTxt}>Start your first workout</Text>
          </AnimatedPressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const fr = themed(() => StyleSheet.create({
  wrap:      { paddingHorizontal: 20, paddingTop: 16 },
  title:     { fontSize: 22, lineHeight: 28, fontFamily: FONTS.display, color: COLORS.text, marginBottom: 12 },
  item:      {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  itemTitle: { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  cta:       { marginTop: 20, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  ctaTxt:    { fontSize: 17, fontFamily: FONTS.display, color: COLORS.onAccent },
}));

const s = themed(() => StyleSheet.create({
  scroll:       { paddingHorizontal: 20 },
  title:        { fontSize: 36, lineHeight: 40, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.2, marginTop: 4 },
  periods:      { marginTop: 16 },

  figures:      { flexDirection: 'row', gap: 12, marginTop: 24 },
  figure:       { flex: 1, gap: 2 },
  figVal:       { fontSize: 30, lineHeight: 34, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  figUnit:      { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textMuted, letterSpacing: 0 },
  figLbl:       { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  figDelta:     { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  captionRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  caption:      { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textLabel },

  section:      { marginTop: 36, gap: 14 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.headline, color: COLORS.text },

  prRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  prName:       { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  prSub:        { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  prVal:        { fontSize: 20, fontFamily: FONTS.hero, color: COLORS.accent, fontVariant: ['tabular-nums'] },
  prUnit:       { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted },

  searchBtn:    { marginLeft: 'auto', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: ink(0.05) },
  search:       {
    height: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: ink(0.05),
    fontSize: 16, fontFamily: FONTS.body, color: COLORS.text,
  },
  empty:        { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted, paddingVertical: 8 },
  more:         { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 12, marginLeft: -12, borderRadius: 10 },
  moreTxt:      { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.accent },
}));
