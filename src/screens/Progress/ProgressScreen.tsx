import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { usePRStore } from '../../stores/prStore';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { SPACING, BORDER_RADIUS, ANALYTICS_DEFAULT_DAYS } from '../../constants';
import { subDays, format } from 'date-fns';
import { WorkoutSession } from '../../types';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.md * 4;
const CHART_HEIGHT = 120;

interface DataPoint { x: number; y: number; label: string; value: number }

function LineChart({ data, color, unit }: { data: DataPoint[]; color: string; unit: string }) {
  if (data.length < 2) {
    return (
      <View style={{ height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#555', fontSize: 13 }}>Not enough data (need 2+ sessions)</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const padH = 16;
  const padV = 16;
  const chartW = CHART_WIDTH - padH * 2;
  const chartH = CHART_HEIGHT - padV * 2;

  const pts = data.map((d, i) => {
    const cx = padH + (i / (data.length - 1)) * chartW;
    const cy = padV + chartH - ((d.value - minV) / range) * chartH;
    return { ...d, cx, cy };
  });

  const polyPoints = pts.map((p) => `${p.cx},${p.cy}`).join(' ');

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((t) => (
        <Line
          key={t}
          x1={padH}
          y1={padV + chartH * (1 - t)}
          x2={CHART_WIDTH - padH}
          y2={padV + chartH * (1 - t)}
          stroke="#2a2a32"
          strokeWidth={1}
        />
      ))}
      <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={4} fill={color} />
      ))}
      {/* Min/max labels */}
      <SvgText x={padH} y={padV - 4} fill="#555" fontSize={10}>{maxV}{unit}</SvgText>
      <SvgText x={padH} y={CHART_HEIGHT - 4} fill="#555" fontSize={10}>{minV}{unit}</SvgText>
    </Svg>
  );
}

function buildExerciseData(sessions: WorkoutSession[], exerciseName: string, allTime: boolean) {
  const cutoff = allTime ? new Date(0) : subDays(new Date(), ANALYTICS_DEFAULT_DAYS);
  return sessions
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.finishedAt &&
        new Date(s.finishedAt) >= cutoff &&
        s.exercises.some((e) => e.exerciseName === exerciseName),
    )
    .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime())
    .map((s) => {
      const ex = s.exercises.find((e) => e.exerciseName === exerciseName)!;
      const completedSets = ex.sets.filter((st) => st.isCompleted);
      const maxWeight = completedSets.length
        ? Math.max(...completedSets.map((st) => st.actualWeight ?? 0))
        : 0;
      const maxReps = completedSets.length
        ? Math.max(...completedSets.map((st) => st.actualRepsToFailure ?? st.actualReps))
        : 0;
      const volume = completedSets.reduce((sum, st) => {
        const w = st.actualWeight ?? 1;
        const r = st.actualRepsToFailure ?? st.actualReps;
        return sum + r * w;
      }, 0);
      const dateLabel = format(new Date(s.finishedAt!), 'MM/dd');
      return { dateLabel, maxWeight, maxReps, volume };
    });
}

export function ProgressScreen() {
  const { colors } = useTheme();
  const { sessions } = useSessionStore();
  const { activePlan } = usePlanStore();
  const { records } = usePRStore();

  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [allTime, setAllTime] = useState(false);
  const [chartTab, setChartTab] = useState<'weight' | 'volume' | 'reps'>('weight');
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);

  const allExerciseNames = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach((s) => s.exercises.forEach((e) => names.add(e.exerciseName)));
    activePlan?.days.forEach((d) => d.exercises.forEach((e) => names.add(e.name)));
    return Array.from(names).sort();
  }, [sessions, activePlan]);

  const exerciseData = useMemo(() => {
    if (!selectedExercise) return [];
    return buildExerciseData(sessions, selectedExercise, allTime);
  }, [sessions, selectedExercise, allTime]);

  const cutoff = subDays(new Date(), ANALYTICS_DEFAULT_DAYS);
  const recentSessions = sessions.filter(
    (s) => s.finishedAt && new Date(s.finishedAt) >= cutoff,
  );
  const totalVolume = recentSessions.reduce((s, sess) => s + sess.totalVolume, 0);
  const missedCount = recentSessions.filter((s) => s.status === 'missed').length;
  const prsCount = recentSessions.reduce((s, sess) => s + sess.prsBreached.length, 0);

  const chartData: DataPoint[] = exerciseData.map((d, i) => ({
    x: i,
    y: 0,
    label: d.dateLabel,
    value: chartTab === 'weight' ? d.maxWeight : chartTab === 'reps' ? d.maxReps : d.volume,
  }));

  const pr = records.find((r) => r.exerciseName === selectedExercise);

  const allNotes = useMemo(() => {
    if (!selectedExercise) return [];
    return sessions
      .flatMap((s) =>
        s.exercises
          .filter((e) => e.exerciseName === selectedExercise)
          .flatMap((e) =>
            e.sets
              .filter((st) => st.notes)
              .map((st) => ({
                date: s.finishedAt ?? '',
                note: st.notes,
                setNum: st.setNumber,
              })),
          ),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedExercise]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Progress</Text>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <SummaryCard label="Workouts" value={String(recentSessions.filter((s) => s.status === 'completed').length)} sub="last 2 weeks" colors={colors} />
          <SummaryCard label="Total Volume" value={`${Math.round(totalVolume / 1000)}k`} sub="last 2 weeks" colors={colors} />
          <SummaryCard label="Days Missed" value={String(missedCount)} sub="last 2 weeks" colors={colors} />
          <SummaryCard label="PRs Broken" value={String(prsCount)} sub="last 2 weeks" colors={colors} />
        </View>

        {/* Exercise Selector */}
        <TouchableOpacity
          style={[styles.exercisePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setExercisePickerVisible(true)}
        >
          <Text style={[styles.exercisePickerText, { color: selectedExercise ? colors.text : colors.textMuted }]}>
            {selectedExercise || 'Select an exercise...'}
          </Text>
          <Text style={{ color: colors.textMuted }}>▼</Text>
        </TouchableOpacity>

        {/* Exercise list picker */}
        {exercisePickerVisible && (
          <Card style={styles.pickerList}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {allExerciseNames.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.pickerItem, { borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedExercise(name);
                    setExercisePickerVisible(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        {selectedExercise && (
          <>
            {/* All-time toggle */}
            <View style={styles.toggleRow}>
              {(['2 Weeks', 'All Time'] as const).map((label) => {
                const isAllTime = label === 'All Time';
                const active = isAllTime === allTime;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.toggleBtn, active && { backgroundColor: colors.accentDim }, { borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setAllTime(isAllTime)}
                  >
                    <Text style={[styles.toggleText, { color: active ? colors.accent : colors.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Chart Tabs */}
            <Card style={styles.chartCard}>
              <View style={styles.chartTabs}>
                {(['weight', 'reps', 'volume'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chartTab, chartTab === t && { borderBottomColor: colors.accent }]}
                    onPress={() => setChartTab(t)}
                  >
                    <Text style={[styles.chartTabText, { color: chartTab === t ? colors.accent : colors.textSecondary }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <LineChart
                data={chartData}
                color={colors.accent}
                unit={chartTab === 'weight' ? 'kg' : chartTab === 'reps' ? '' : ''}
              />
            </Card>

            {/* PR Cards */}
            {pr && (
              <Card style={styles.prSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>All-Time Personal Records</Text>
                <View style={styles.prGrid}>
                  <PRCard label="Heaviest Weight" value={`${pr.heaviestWeight}kg`} date={pr.heaviestWeightDate} colors={colors} />
                  <PRCard label="Most Reps" value={String(pr.mostReps)} date={pr.mostRepsDate} colors={colors} />
                  <PRCard label="Highest Volume" value={`${Math.round(pr.highestVolume)}`} date={pr.highestVolumeDate} colors={colors} />
                </View>
              </Card>
            )}

            {/* Notes Timeline */}
            {allNotes.length > 0 && (
              <Card style={styles.notesSection}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Set Notes Timeline</Text>
                {allNotes.map((n, i) => (
                  <View key={i} style={[styles.noteRow, { borderColor: colors.border }]}>
                    <Text style={[styles.noteDate, { color: colors.textMuted }]}>
                      {n.date ? format(new Date(n.date), 'MMM d, yyyy') : ''} · Set {n.setNum}
                    </Text>
                    <Text style={[styles.noteText, { color: colors.text }]}>📝 {n.note}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* All-exercise PR table */}
        {records.length > 0 && !selectedExercise && (
          <Card style={styles.allPRs}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>All-Time PRs</Text>
            {records.map((r) => (
              <View key={r.exerciseId} style={[styles.allPRRow, { borderColor: colors.border }]}>
                <Text style={[styles.allPRName, { color: colors.text }]}>{r.exerciseName}</Text>
                <View style={styles.allPRStats}>
                  <Text style={[styles.allPRStat, { color: colors.accent }]}>{r.heaviestWeight}kg</Text>
                  <Text style={[styles.allPRStat, { color: colors.textSecondary }]}>{r.mostReps} reps</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, sub, colors }: { label: string; value: string; sub: string; colors: any }) {
  return (
    <View style={[summaryStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[summaryStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[summaryStyles.label, { color: colors.accent }]}>{label}</Text>
      <Text style={[summaryStyles.sub, { color: colors.textMuted }]}>{sub}</Text>
    </View>
  );
}

function PRCard({ label, value, date, colors }: { label: string; value: string; date: string; colors: any }) {
  return (
    <View style={[prStyles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[prStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[prStyles.value, { color: colors.accent }]}>{value}</Text>
      <Text style={[prStyles.date, { color: colors.textMuted }]}>
        {date ? format(new Date(date), 'MMM d') : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: SPACING.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  exercisePicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  exercisePickerText: { fontSize: 15, fontWeight: '600' },
  pickerList: { marginBottom: SPACING.md },
  pickerItem: { paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14 },
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  toggleBtn: { flex: 1, borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  chartCard: { marginBottom: SPACING.md },
  chartTabs: { flexDirection: 'row', marginBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#2a2a32' },
  chartTab: { flex: 1, alignItems: 'center', paddingBottom: SPACING.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  chartTabText: { fontSize: 13, fontWeight: '700' },
  prSection: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  prGrid: { flexDirection: 'row', gap: SPACING.sm },
  notesSection: { marginBottom: SPACING.md },
  noteRow: { borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  noteDate: { fontSize: 11, marginBottom: 2 },
  noteText: { fontSize: 13 },
  allPRs: { marginBottom: SPACING.md },
  allPRRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  allPRName: { fontSize: 14, fontWeight: '600', flex: 1 },
  allPRStats: { flexDirection: 'row', gap: SPACING.md },
  allPRStat: { fontSize: 13, fontWeight: '700' },
});

const summaryStyles = StyleSheet.create({
  card: { width: '47%', borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', gap: 2 },
  value: { fontSize: 28, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700' },
  sub: { fontSize: 10 },
});

const prStyles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, alignItems: 'center', gap: 2 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  value: { fontSize: 18, fontWeight: '800' },
  date: { fontSize: 10 },
});
