import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { TrophyIcon } from '../../components/common/TrophyIcon';
import { COLORS, GRAD } from '../../constants';
import { WorkoutSession, WorkoutDay, SessionExercise } from '../../types';
import { AppBackground } from '../../components/ui/AppBackground';

// ─── Constants ────────────────────────────────────────────────────────────────

const EX_COLORS  = [COLORS.accent, COLORS.rest, COLORS.warning, '#A78BFA'];
const PAGE_NAMES = ['Summary', 'Exercises', 'Next Up'];

// ─── Shared icons ─────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={COLORS.textSecondary} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDown({ flipped = false }: { flipped?: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      style={{ transform: [{ rotate: flipped ? '180deg' : '0deg' }] } as any}>
      <Path d="M6 9l6 6 6-6" stroke={COLORS.accent} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Completion Ring ──────────────────────────────────────────────────────────

function CompletionRing({ pct }: { pct: number }) {
  const R    = 54;
  const sw   = 7;
  const circ = 2 * Math.PI * R;
  const off  = circ * (1 - pct);
  return (
    <Svg width={124} height={124} viewBox="0 0 124 124">
      <Circle cx={62} cy={62} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
      <Circle cx={62} cy={62} r={R} fill="none" stroke={COLORS.accent}
        strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={off}
        strokeLinecap="round" rotation={-90} origin="62,62" />
    </Svg>
  );
}

// ─── Volume Bar Chart ─────────────────────────────────────────────────────────

function VolumeChart({ exercises }: { exercises: SessionExercise[] }) {
  const allSets = exercises.flatMap((ex, ei) =>
    ex.sets.filter(s => s.isCompleted).map(s => ({
      vol: Math.max((s.actualRepsToFailure ?? s.actualReps) * (s.actualWeight ?? 1), 1),
      ei,
    }))
  );
  const maxVol = Math.max(...allSets.map(s => s.vol), 1);

  return (
    <View>
      <View style={ch.bars}>
        {allSets.map((set, i) => {
          const h   = Math.max((set.vol / maxVol) * 52, 5);
          const col = EX_COLORS[set.ei % EX_COLORS.length];
          return (
            <View key={i} style={ch.barWrap}>
              <View style={[ch.bar, { height: h, backgroundColor: col + 'BB' }]} />
            </View>
          );
        })}
      </View>
      <View style={ch.legend}>
        {exercises.map((ex, ei) => {
          const cnt = ex.sets.filter(s => s.isCompleted).length || 1;
          return (
            <View key={ei} style={[ch.legendItem, { flex: cnt }]}>
              <View style={[ch.legendLine, { backgroundColor: EX_COLORS[ei % EX_COLORS.length] }]} />
              <Text style={ch.legendLbl} numberOfLines={1}>
                {ex.exerciseName.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  bars:       { flexDirection: 'row', alignItems: 'flex-end', height: 52, gap: 3, marginBottom: 8 },
  barWrap:    { flex: 1, justifyContent: 'flex-end' },
  bar:        { borderRadius: 3 },
  legend:     { flexDirection: 'row', gap: 3 },
  legendItem: { overflow: 'hidden', gap: 3 },
  legendLine: { height: 2, borderRadius: 1 },
  legendLbl:  { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ─── Page 1: Summary ──────────────────────────────────────────────────────────

function SummaryPage({ session, width }: { session: WorkoutSession; width: number }) {
  const completedSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s.isCompleted).length, 0);
  const totalSets     = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const pct           = totalSets > 0 ? completedSets / totalSets : 0;
  const prCount       = session.prsBreached.length;
  const volDisplay    = session.totalVolume >= 1000
    ? (session.totalVolume / 1000).toFixed(1) + 'k'
    : String(Math.round(session.totalVolume));
  const finishedDate  = session.finishedAt
    ? new Date(session.finishedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  return (
    <View style={[pg.page, { width }]}>

      {/* ── Workout identity ─────────────────────────────── */}
      <View style={pg.top}>
        <View style={pg.chip}>
          <TrophyIcon size={12} color={COLORS.accent} />
          <Text style={pg.chipText}>Workout Complete</Text>
          <Text style={pg.chipDate}>{finishedDate}</Text>
        </View>
        <Text style={pg.name}>{session.dayLabel}</Text>
        <Text style={pg.nameSub}>Day {session.dayPosition}</Text>
      </View>

      {/* ── Duration (Strava hero number) + completion ring ─ */}
      <View style={pg.hero}>
        <View style={pg.ringWrap}>
          <CompletionRing pct={pct} />
          <View style={pg.ringCenter}>
            <Text style={pg.durVal}>{session.duration}</Text>
            <Text style={pg.durUnit}>min</Text>
          </View>
        </View>
        <Text style={pg.durLabel}>Duration · {Math.round(pct * 100)}% complete</Text>
      </View>

      {/* ── Stats strip ──────────────────────────────────── */}
      <GlassView radius={14} style={pg.statsStrip}>
        {[
          { label: 'Volume',    val: volDisplay,            unit: 'kg'           },
          { label: 'Sets Done', val: String(completedSets), unit: `/ ${totalSets}` },
          { label: 'New PRs',   val: String(prCount),        unit: 'today'        },
        ].map((item, i) => (
          <View key={i} style={[pg.statCell, i < 2 && pg.statCellBorder]}>
            <Text style={pg.statVal}>{item.val}</Text>
            <Text style={pg.statLabel}>{item.label}</Text>
            <Text style={pg.statUnit}>{item.unit}</Text>
          </View>
        ))}
      </GlassView>

      {/* ── Volume chart ──────────────────────────────────── */}
      {session.exercises.length > 0 && (
        <GlassView radius={12} style={pg.chartCard}>
          <Text style={pg.chartTitle}>Set Volume</Text>
          <VolumeChart exercises={session.exercises} />
        </GlassView>
      )}

    </View>
  );
}

// ─── Page 2: Exercises ────────────────────────────────────────────────────────

function ExercisesPage({ session, width }: { session: WorkoutSession; width: number }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {session.exercises.map((ex, i) => {
        const color     = EX_COLORS[i % EX_COLORS.length];
        const completed = ex.sets.filter(s => s.isCompleted);
        const bestSet   = completed.reduce<typeof completed[0] | null>(
          (b, s) => (s.actualWeight ?? 0) > (b?.actualWeight ?? 0) ? s : b, null
        );
        const open      = openId === ex.id;
        const isFirst   = i === 0;
        const isLast    = i === session.exercises.length - 1;

        return (
          <GlassView key={ex.id} radius={0} style={[
            ex2.card,
            { borderTopLeftRadius: isFirst ? 12 : 3, borderTopRightRadius: isFirst ? 12 : 3,
              borderBottomLeftRadius: isLast ? 12 : 3, borderBottomRightRadius: isLast ? 12 : 3 },
            !isLast && ex2.gap,
          ]}>
            <TouchableOpacity style={ex2.row} onPress={() => setOpenId(open ? null : ex.id)} activeOpacity={0.75}>
              <View style={[ex2.orb, { backgroundColor: color + '22' }]}>
                <Text style={[ex2.orbNum, { color }]}>{i + 1}</Text>
              </View>
              <View style={ex2.info}>
                <View style={ex2.nameRow}>
                  <Text style={ex2.name} numberOfLines={1}>{ex.exerciseName}</Text>
                  {ex.isCompleted && <Badge label="Done" variant="completed" size="xs" />}
                </View>
                <Text style={ex2.meta}>
                  {completed.length}/{ex.sets.length} sets
                  {bestSet ? ` · best ${bestSet.actualWeight ?? '-'}${ex.weightUnit} × ${bestSet.actualRepsToFailure ?? bestSet.actualReps}` : ''}
                </Text>
              </View>
              <View style={[ex2.chevron, open && ex2.chevronOpen]}>
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] } as any}>
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {open && (
              <View style={ex2.table}>
                <View style={ex2.tableHead}>
                  {['Set', 'Weight', 'Reps', 'Vol'].map((h, hi) => (
                    <Text key={hi} style={[ex2.th, hi > 0 && ex2.thRight]}>{h}</Text>
                  ))}
                </View>
                {completed.map((set, si) => {
                  const reps = set.actualRepsToFailure ?? set.actualReps;
                  const vol  = Math.round(reps * (set.actualWeight ?? 1));
                  return (
                    <View key={si} style={ex2.tableRow}>
                      <Text style={ex2.td}>S{set.setNumber}</Text>
                      <Text style={[ex2.td, ex2.tdRight]}>
                        {set.actualWeight != null ? `${set.actualWeight}${ex.weightUnit}` : '—'}
                      </Text>
                      <Text style={[ex2.td, ex2.tdRight]}>{reps}</Text>
                      <Text style={[ex2.td, ex2.tdRight, { color: COLORS.textMuted }]}>{vol}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassView>
        );
      })}
    </ScrollView>
  );
}

// ─── Page 3: Next Up ──────────────────────────────────────────────────────────

function NextUpPage({ nextDay, width }: { nextDay?: WorkoutDay; width: number }) {
  const [showAll, setShowAll] = useState(false);

  if (!nextDay) {
    return (
      <View style={[pg.page, { width, alignItems: 'center', justifyContent: 'center' }]}>
        <TrophyIcon size={40} color={COLORS.textLabel} />
        <Text style={nu.empty}>No next workout scheduled</Text>
        <Text style={nu.emptySub}>Rest and recover — you've earned it.</Text>
      </View>
    );
  }

  const exercises = showAll ? nextDay.exercises : nextDay.exercises.slice(0, 5);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Day header */}
      <GlassView radius={14} style={nu.header}>
        <LinearGradient
          colors={['rgba(100,210,255,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={nu.headerGrad}
        >
          <View>
            <Text style={nu.dayName}>{nextDay.label}</Text>
            <Text style={nu.daySub}>Day {nextDay.dayPosition} · {nextDay.exercises.length} exercises</Text>
          </View>
          <Badge label={`Day ${nextDay.dayPosition}`} variant="rest" size="xs" />
        </LinearGradient>
      </GlassView>

      {/* Exercise rows */}
      <GlassView radius={12} style={nu.listCard}>
        {exercises.map((ex, i) => (
          <View key={ex.id} style={[nu.exRow, i < exercises.length - 1 && nu.exRowBorder]}>
            <SetTypeBadge type={ex.setType} />
            <Text style={nu.exName} numberOfLines={1}>{ex.name}</Text>
            <Text style={nu.exTarget}>
              {ex.targetSets} × {ex.toFailure ? 'fail' : (ex.targetRepsMin ?? '—')}
            </Text>
            {ex.targetWeight != null && (
              <Text style={nu.exWeight}>{ex.targetWeight}{ex.weightUnit}</Text>
            )}
          </View>
        ))}

        {nextDay.exercises.length > 5 && (
          <TouchableOpacity onPress={() => setShowAll(v => !v)} style={nu.showMore} activeOpacity={0.7}>
            <Text style={nu.showMoreText}>
              {showAll ? 'Show less' : `+${nextDay.exercises.length - 5} more exercises`}
            </Text>
            <ChevronDown flipped={showAll} />
          </TouchableOpacity>
        )}
      </GlassView>
    </ScrollView>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

interface Props {
  session: WorkoutSession;
  nextDay?: WorkoutDay;
  onDone:  () => void;
}

export function PostWorkoutSummary({ session, nextDay, onDone }: Props) {
  const { width }  = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef  = useRef<ScrollView>(null);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(newPage);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* ── Persistent header ─────────────────────────── */}
        <View style={hd.bar}>
          <TouchableOpacity onPress={onDone} style={hd.backBtn} activeOpacity={0.7}>
            <ChevronLeft />
          </TouchableOpacity>

          <Text style={hd.title}>{PAGE_NAMES[page]}</Text>

          {/* Page dot indicator */}
          <View style={hd.dots}>
            {PAGE_NAMES.map((_, i) => (
              <View key={i} style={[hd.dot, i === page && hd.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Horizontal pager ──────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          decelerationRate="fast"
        >
          <SummaryPage   session={session}  width={width} />
          <ExercisesPage session={session}  width={width} />
          <NextUpPage    nextDay={nextDay}  width={width} />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Header
const hd = StyleSheet.create({
  bar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44 },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flex: 1, textAlign: 'center' },
  dots:     { flexDirection: 'row', gap: 5, width: 36, justifyContent: 'flex-end' },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActive:{ backgroundColor: COLORS.accent, width: 16, borderRadius: 3 },
});

// Shared page
const pg = StyleSheet.create({
  page:          { flex: 1, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'space-between' },

  // Summary — top
  top:           { gap: 4 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(10,132,255,0.16)', borderWidth: 1, borderColor: 'rgba(10,132,255,0.32)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  chipText:      { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipDate:      { fontSize: 11, color: COLORS.textMuted },
  name:          { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 34 },
  nameSub:       { fontSize: 13, color: COLORS.textSecondary },

  // Summary — hero ring
  hero:          { alignItems: 'center', gap: 6 },
  ringWrap:      { width: 124, height: 124, alignItems: 'center', justifyContent: 'center' },
  ringCenter:    { position: 'absolute', alignItems: 'center' },
  durVal:        { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -2, lineHeight: 40 },
  durUnit:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  durLabel:      { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.3 },

  // Stats strip
  statsStrip:    { flexDirection: 'row' },
  statCell:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statCellBorder:{ borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  statVal:       { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  statUnit:      { fontSize: 10, color: COLORS.textLabel, marginTop: 1 },

  // Chart
  chartCard:     { padding: 14, paddingBottom: 10 },
  chartTitle:    { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
});

// Exercises page
const ex2 = StyleSheet.create({
  card:     { overflow: 'hidden' },
  gap:      { marginBottom: 2 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  orb:      { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  orbNum:   { fontSize: 14, fontWeight: '800', lineHeight: 16 },
  info:     { flex: 1, minWidth: 0 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  name:     { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  meta:     { fontSize: 11, color: COLORS.textMuted },
  chevron:  {},
  chevronOpen: {},
  table:    { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(0,0,0,0.18)' },
  tableHead:{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 },
  th:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  thRight:  { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  td:       { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  tdRight:  { textAlign: 'right' },
});

// Next Up page
const nu = StyleSheet.create({
  empty:        { fontSize: 16, fontWeight: '600', color: COLORS.textMuted, marginTop: 16 },
  emptySub:     { fontSize: 13, color: COLORS.textLabel, marginTop: 6 },
  header:       { marginBottom: 12, overflow: 'hidden' },
  headerGrad:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  dayName:      { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  daySub:       { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  listCard:     { overflow: 'hidden' },
  exRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  exRowBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  exName:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  exTarget:     { fontSize: 11, color: COLORS.textMuted },
  exWeight:     { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, minWidth: 52, textAlign: 'right' },
  showMore:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingVertical: 11 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: COLORS.accent },
});
