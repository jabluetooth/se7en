import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import { WorkoutDay, WorkoutSession } from '../../types';
import { Card } from '../../components/common/Card';
import { SPACING, BORDER_RADIUS, ANALYTICS_DEFAULT_DAYS, DAY_STATUS_ICONS } from '../../constants';
import { subDays } from 'date-fns';

type DayStatus = 'completed' | 'missed' | 'rest' | 'current' | 'upcoming';

function getDayStatus(
  day: WorkoutDay,
  currentPos: number,
  sessions: WorkoutSession[],
): DayStatus {
  if (day.isRestDay) return 'rest';
  if (day.dayPosition === currentPos) return 'current';

  const daySession = sessions
    .filter((s) => s.dayPosition === day.dayPosition)
    .sort((a, b) => new Date(b.startedAt ?? b.finishedAt!).getTime() - new Date(a.startedAt ?? a.finishedAt!).getTime())[0];

  if (!daySession) return 'upcoming';
  if (daySession.status === 'completed') return 'completed';
  if (daySession.status === 'missed') return 'missed';
  return 'upcoming';
}

const STATUS_COLORS: Record<DayStatus, string> = {
  completed: '#39ff8c',
  missed: '#ff4d4d',
  rest: '#4a90e2',
  current: '#3daeff',
  upcoming: '#555',
};

export function CycleScreen() {
  const { colors } = useTheme();
  const { activePlan } = usePlanStore();
  const { settings } = useSettingsStore();
  const { sessions } = useSessionStore();

  const currentPos = settings.currentDayPosition;

  const cutoff = subDays(new Date(), ANALYTICS_DEFAULT_DAYS);
  const recentSessions = sessions.filter(
    (s) => s.startedAt && new Date(s.startedAt) >= cutoff,
  );
  const completionRate =
    recentSessions.length === 0
      ? 0
      : Math.round(
          (recentSessions.filter((s) => s.status === 'completed').length / recentSessions.length) *
            100,
        );

  if (!activePlan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No active plan. Set one up in Settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const days = [...activePlan.days].sort((a, b) => a.dayPosition - b.dayPosition);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>7-Day Cycle</Text>
        <Text style={[styles.planName, { color: colors.textSecondary }]}>{activePlan.name}</Text>

        {/* Completion Rate */}
        <Card style={styles.rateCard}>
          <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Last 2 Weeks Completion</Text>
          <View style={styles.rateRow}>
            <Text style={[styles.rateValue, { color: colors.accent }]}>{completionRate}%</Text>
            <Text style={[styles.rateSub, { color: colors.textMuted }]}>
              {recentSessions.filter((s) => s.status === 'completed').length} of {recentSessions.length} sessions
            </Text>
          </View>
          {/* Progress bar */}
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${completionRate}%` }]} />
          </View>
        </Card>

        {/* Day Cards */}
        {days.map((day) => {
          const status = getDayStatus(day, currentPos, sessions);
          const statusColor = STATUS_COLORS[status];
          const isCurrent = status === 'current';

          return (
            <TouchableOpacity
              key={day.id}
              activeOpacity={0.8}
              style={[
                styles.dayCard,
                {
                  backgroundColor: isCurrent ? colors.accentDim : colors.surface,
                  borderColor: isCurrent ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.dayLeft}>
                <View style={[styles.dayNum, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                  <Text style={[styles.dayNumText, { color: statusColor }]}>{day.dayPosition}</Text>
                </View>
                <View>
                  <Text style={[styles.dayTitle, { color: colors.text }]}>{day.label}</Text>
                  <Text style={[styles.daySub, { color: colors.textSecondary }]}>
                    {day.isRestDay ? 'Rest Day' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
              <View style={styles.dayRight}>
                <Text style={styles.statusEmoji}>
                  {status === 'completed' ? DAY_STATUS_ICONS.completed
                    : status === 'missed' ? DAY_STATUS_ICONS.missed
                    : status === 'rest' ? DAY_STATUS_ICONS.rest
                    : status === 'current' ? DAY_STATUS_ICONS.current
                    : DAY_STATUS_ICONS.upcoming}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Missed Log */}
        {sessions.filter((s) => s.status === 'missed').length > 0 && (
          <Card style={styles.missedCard}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Missed Sessions</Text>
            {sessions
              .filter((s) => s.status === 'missed')
              .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())
              .slice(0, 5)
              .map((s) => (
                <View key={s.id} style={[styles.missedRow, { borderColor: colors.border }]}>
                  <Text style={[styles.missedDay, { color: colors.text }]}>
                    Day {s.dayPosition} · {s.dayLabel}
                  </Text>
                  <Text style={[styles.missedDate, { color: colors.textMuted }]}>
                    {new Date(s.finishedAt!).toLocaleDateString()}
                    {s.skipReason ? ` · ${s.skipReason}` : ''}
                  </Text>
                </View>
              ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyText: { fontSize: 16, textAlign: 'center' },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  planName: { fontSize: 14, marginBottom: SPACING.md },
  rateCard: { marginBottom: SPACING.md },
  rateLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  rateRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: SPACING.sm },
  rateValue: { fontSize: 36, fontWeight: '900' },
  rateSub: { fontSize: 13 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  dayNum: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  dayNumText: { fontSize: 16, fontWeight: '800' },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  daySub: { fontSize: 12, marginTop: 2 },
  dayRight: {},
  statusEmoji: { fontSize: 20 },
  missedCard: { marginTop: SPACING.md },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  missedRow: { borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  missedDay: { fontSize: 14, fontWeight: '600' },
  missedDate: { fontSize: 12 },
});
