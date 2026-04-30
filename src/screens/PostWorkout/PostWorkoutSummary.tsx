import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { WorkoutSession } from '../../types';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { SPACING, BORDER_RADIUS } from '../../constants';

type Tab = 'today' | 'progress' | 'next';

interface Props {
  session: WorkoutSession;
  visible: boolean;
  onDone: () => void;
}

export function PostWorkoutSummary({ session, visible, onDone }: Props) {
  const { colors } = useTheme();
  const { sessions } = useSessionStore();
  const { activePlan } = usePlanStore();
  const { settings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [sessionNote, setSessionNote] = useState('');

  const dayPosition = settings.currentDayPosition;
  const nextDay = activePlan?.days.find((d) => d.dayPosition === dayPosition);

  const lastSession = sessions
    .filter(
      (s) =>
        s.dayPosition === session.dayPosition &&
        s.status === 'completed' &&
        s.id !== session.id,
    )
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0];

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const allNotes = session.exercises.flatMap((ex) =>
    ex.sets
      .filter((s) => s.notes)
      .map((s) => ({ exercise: ex.exerciseName, note: s.notes, setNum: s.setNumber })),
  );

  const renderToday = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.statsGrid}>
        <StatCard label="Duration" value={formatDuration(session.duration)} icon="time-outline" colors={colors} />
        <StatCard label="Exercises" value={`${session.exercises.filter((e) => e.isCompleted).length}/${session.exercises.length}`} icon="barbell-outline" colors={colors} />
        <StatCard label="Sets Done" value={String(session.exercises.reduce((s, e) => s + e.sets.filter((st) => st.isCompleted).length, 0))} icon="checkmark-circle-outline" colors={colors} />
        <StatCard label="Volume" value={`${Math.round(session.totalVolume)}`} icon="trending-up-outline" colors={colors} />
      </View>

      {session.prsBreached.length > 0 && (
        <Card style={styles.prCard}>
          <Text style={[styles.prTitle, { color: colors.accent }]}>🏆 New PRs!</Text>
          {session.prsBreached.map((name) => (
            <View key={name} style={styles.prRow}>
              <Ionicons name="trophy" size={14} color={colors.accent} />
              <Text style={[styles.prName, { color: colors.text }]}>{name}</Text>
            </View>
          ))}
        </Card>
      )}

      {allNotes.length > 0 && (
        <Card style={styles.notesCard}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Set Notes</Text>
          {allNotes.map((n, i) => (
            <View key={i} style={[styles.noteRow, { borderColor: colors.border }]}>
              <Text style={[styles.noteExercise, { color: colors.accent }]}>{n.exercise} · Set {n.setNum}</Text>
              <Text style={[styles.noteText, { color: colors.text }]}>📝 {n.note}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );

  const renderProgress = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {session.exercises.map((ex) => {
        const lastEx = lastSession?.exercises.find((e) => e.exerciseName === ex.exerciseName);
        const lastMaxWeight = lastEx
          ? Math.max(...lastEx.sets.filter((s) => s.isCompleted).map((s) => s.actualWeight ?? 0))
          : null;
        const lastMaxReps = lastEx
          ? Math.max(...lastEx.sets.filter((s) => s.isCompleted).map((s) => s.actualRepsToFailure ?? s.actualReps))
          : null;
        const todayMaxWeight = Math.max(...ex.sets.filter((s) => s.isCompleted).map((s) => s.actualWeight ?? 0));
        const todayMaxReps = Math.max(...ex.sets.filter((s) => s.isCompleted).map((s) => s.actualRepsToFailure ?? s.actualReps));

        const weightDelta = lastMaxWeight !== null ? todayMaxWeight - lastMaxWeight : null;
        const repsDelta = lastMaxReps !== null ? todayMaxReps - lastMaxReps : null;

        return (
          <Card key={ex.id} style={styles.progressCard}>
            <Text style={[styles.progressExName, { color: colors.text }]}>{ex.exerciseName}</Text>
            <View style={styles.progressRow}>
              <DeltaCol label="Weight" today={todayMaxWeight > 0 ? `${todayMaxWeight}` : '—'} last={lastMaxWeight !== null ? `${lastMaxWeight}` : '—'} delta={weightDelta} colors={colors} />
              <DeltaCol label="Reps" today={todayMaxReps > 0 ? `${todayMaxReps}` : '—'} last={lastMaxReps !== null ? `${lastMaxReps}` : '—'} delta={repsDelta} colors={colors} />
            </View>
            {ex.sets.some((s) => s.notes) && (
              <View style={[styles.exNotes, { borderTopColor: colors.border }]}>
                {ex.sets.filter((s) => s.notes).map((s) => (
                  <Text key={s.id} style={[styles.exNoteText, { color: colors.textSecondary }]}>
                    Set {s.setNumber}: {s.notes}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {session.exercises.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No exercises logged.</Text>
      )}
    </ScrollView>
  );

  const renderNext = () => {
    const reminders = allNotes.filter((n) => n.note.toLowerCase().includes('next') || n.note.toLowerCase().includes('increase') || n.note.toLowerCase().includes('improve'));
    return (
      <ScrollView contentContainerStyle={styles.tabContent}>
        {nextDay ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Next: Day {nextDay.dayPosition} · {nextDay.label}
            </Text>
            {nextDay.isRestDay ? (
              <Card style={styles.restPreview}>
                <Text style={styles.restEmoji}>💤</Text>
                <Text style={[styles.restText, { color: colors.text }]}>Rest Day</Text>
              </Card>
            ) : (
              nextDay.exercises.map((ex) => (
                <Card key={ex.id} style={styles.nextExCard}>
                  <Text style={[styles.nextExName, { color: colors.text }]}>{ex.name}</Text>
                  <Text style={[styles.nextExDetail, { color: colors.textSecondary }]}>
                    {ex.targetSets} sets ·{' '}
                    {ex.toFailure
                      ? 'To Failure'
                      : ex.targetRepsMin === ex.targetRepsMax
                      ? `${ex.targetRepsMin} reps`
                      : `${ex.targetRepsMin}–${ex.targetRepsMax} reps`}
                    {ex.targetWeight ? ` @ ${ex.targetWeight}${ex.weightUnit}` : ''}
                  </Text>
                </Card>
              ))
            )}
          </>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Plan not available.</Text>
        )}

        {reminders.length > 0 && (
          <Card style={styles.remindersCard}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Improvement Reminders</Text>
            {reminders.map((r, i) => (
              <Text key={i} style={[styles.reminderText, { color: colors.text }]}>
                📝 {r.exercise}: {r.note}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDone}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Workout Complete 🎉</Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(['today', 'progress', 'next'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && [styles.activeTab, { borderBottomColor: colors.accent }]]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.accent : colors.textSecondary }]}>
                {tab === 'today' ? 'Today' : tab === 'progress' ? 'Progress' : 'Next Workout'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'today' && renderToday()}
          {activeTab === 'progress' && renderProgress()}
          {activeTab === 'next' && renderNext()}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.sessionNote, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={sessionNote}
            onChangeText={setSessionNote}
            placeholder="Add a session note..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Button label="Done" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

function StatCard({ label, value, icon, colors }: { label: string; value: string; icon: any; colors: any }) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={[statStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function DeltaCol({ label, today, last, delta, colors }: { label: string; today: string; last: string; delta: number | null; colors: any }) {
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  return (
    <View style={deltaStyles.col}>
      <Text style={[deltaStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[deltaStyles.today, { color: colors.text }]}>{today}</Text>
      <Text style={[deltaStyles.last, { color: colors.textSecondary }]}>Last: {last}</Text>
      {delta !== null && delta !== 0 && (
        <Text style={[deltaStyles.delta, { color: up ? colors.success : colors.danger }]}>
          {up ? '+' : ''}{delta}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: {},
  tabText: { fontSize: 13, fontWeight: '700' },
  tabContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  prCard: { marginBottom: SPACING.md },
  prTitle: { fontSize: 16, fontWeight: '800', marginBottom: SPACING.sm },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 4 },
  prName: { fontSize: 14, fontWeight: '600' },
  notesCard: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  noteRow: { borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  noteExercise: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  noteText: { fontSize: 13 },
  progressCard: { marginBottom: SPACING.sm },
  progressExName: { fontSize: 15, fontWeight: '700', marginBottom: SPACING.sm },
  progressRow: { flexDirection: 'row', gap: SPACING.lg },
  exNotes: { borderTopWidth: 1, marginTop: SPACING.sm, paddingTop: SPACING.sm },
  exNoteText: { fontSize: 12, marginBottom: 2 },
  emptyText: { textAlign: 'center', marginTop: SPACING.xl, fontSize: 14 },
  restPreview: { alignItems: 'center', padding: SPACING.xl },
  restEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  restText: { fontSize: 18, fontWeight: '700' },
  nextExCard: { marginBottom: SPACING.sm },
  nextExName: { fontSize: 14, fontWeight: '700' },
  nextExDetail: { fontSize: 12, marginTop: 2 },
  remindersCard: { marginTop: SPACING.md },
  reminderText: { fontSize: 13, marginBottom: SPACING.sm },
  footer: { borderTopWidth: 1, padding: SPACING.md, gap: SPACING.sm },
  sessionNote: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, fontSize: 14, minHeight: 64 },
});

const statStyles = StyleSheet.create({
  card: { width: '47%', borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', gap: 4 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
});

const deltaStyles = StyleSheet.create({
  col: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  today: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  last: { fontSize: 12, marginBottom: 2 },
  delta: { fontSize: 13, fontWeight: '700' },
});
