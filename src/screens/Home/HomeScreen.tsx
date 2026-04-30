import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import { usePRStore } from '../../stores/prStore';
import { ExerciseCard } from '../../components/ExerciseCard/ExerciseCard';
import { PlateCalculator } from '../../components/PlateCalculator/PlateCalculator';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal as CustomModal } from '../../components/common/Modal';
import { detectPRs } from '../../utils/prDetection';
import { SetLog, SessionExercise, SkipReason, WorkoutDay } from '../../types';
import { SKIP_REASONS, SPACING, BORDER_RADIUS } from '../../constants';

interface Props {
  onFinishWorkout?: (sessionId: string) => void;
}

export function HomeScreen({ onFinishWorkout }: Props) {
  const { colors } = useTheme();
  const { activePlan } = usePlanStore();
  const { settings, advanceDay } = useSettingsStore();
  const {
    activeSession,
    sessions,
    sessionTimer,
    startSession,
    finishSession,
    skipDay,
    clearActiveSession,
  } = useSessionStore();
  const { records, upsertPR } = usePRStore();

  const [plateCalcVisible, setPlateCalcVisible] = useState(false);
  const [selectedSet, setSelectedSet] = useState<SetLog | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<SessionExercise | null>(null);
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [postWorkoutSessionId, setPostWorkoutSessionId] = useState<string | null>(null);

  const dayPosition = settings.currentDayPosition;
  const currentDay: WorkoutDay | undefined = activePlan?.days.find(
    (d) => d.dayPosition === dayPosition,
  );

  const iterationCount = () => {
    const completed = sessions.filter(
      (s) => s.dayPosition === dayPosition && s.status === 'completed',
    ).length;
    return completed + 1;
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const allExercisesComplete = activeSession?.exercises.every((e) => e.isCompleted) ?? false;

  const handleStartWorkout = () => {
    if (!currentDay || !activePlan) return;
    startSession(activePlan.id, currentDay);
  };

  const handleFinishWorkout = async () => {
    if (!activeSession) return;
    setFinishing(true);
    try {
      const finished = await finishSession();
      const { updatedPRs, prsBreached } = detectPRs({ ...finished, prsBreached: [] }, records);
      await Promise.all(updatedPRs.map((pr) => upsertPR(pr)));
      setPostWorkoutSessionId(finished.id);
      await advanceDay();
      onFinishWorkout?.(finished.id);
    } finally {
      setFinishing(false);
    }
  };

  const handleSkip = async (reason?: SkipReason) => {
    if (!activePlan || !currentDay) return;
    setSkipModalVisible(false);
    await skipDay(activePlan.id, currentDay.dayPosition, currentDay.label, reason);
    await advanceDay();
  };

  if (!activePlan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Plan Active</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Go to Settings → Manage Plans to create or activate a workout plan.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentDay) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Day not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Rest day
  if (currentDay.isRestDay) {
    const nextDay = activePlan.days.find(
      (d) => d.dayPosition === (dayPosition >= 7 ? 1 : dayPosition + 1),
    );
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
              Day {dayPosition} · Cycle {iterationCount()}
            </Text>
            <Text style={[styles.dayTitle, { color: colors.text }]}>{currentDay.label}</Text>
          </View>

          <Card style={styles.restCard}>
            <Text style={styles.restEmoji}>💤</Text>
            <Text style={[styles.restTitle, { color: colors.text }]}>Rest Day</Text>
            <Text style={[styles.restDesc, { color: colors.textSecondary }]}>
              Recovery is as important as the work. Rest, stretch, and hydrate.
            </Text>
          </Card>

          {nextDay && !nextDay.isRestDay && (
            <Card style={styles.nextCard}>
              <Text style={[styles.nextTitle, { color: colors.textSecondary }]}>Next Up: Day {nextDay.dayPosition}</Text>
              <Text style={[styles.nextLabel, { color: colors.text }]}>{nextDay.label}</Text>
              {nextDay.exercises.slice(0, 4).map((ex) => (
                <Text key={ex.id} style={[styles.nextEx, { color: colors.textSecondary }]}>
                  · {ex.name} — {ex.targetSets}×{ex.targetRepsMin ?? '?'} @ {ex.targetWeight ?? '?'}{ex.weightUnit}
                </Text>
              ))}
              {nextDay.exercises.length > 4 && (
                <Text style={[styles.nextEx, { color: colors.textMuted }]}>
                  +{nextDay.exercises.length - 4} more
                </Text>
              )}
            </Card>
          )}

          <Button label="Continue to Next Day" onPress={() => advanceDay()} style={styles.cta} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
              Day {dayPosition} · Cycle {iterationCount()}
            </Text>
            <Text style={[styles.dayTitle, { color: colors.text }]}>{currentDay.label}</Text>
          </View>
          {activeSession && (
            <View style={[styles.timer, { backgroundColor: colors.accentDim }]}>
              <Ionicons name="time-outline" size={14} color={colors.accent} />
              <Text style={[styles.timerText, { color: colors.accent }]}>
                {formatTimer(sessionTimer)}
              </Text>
            </View>
          )}
        </View>

        {/* Exercises */}
        {currentDay.exercises.length === 0 ? (
          <Card>
            <Text style={[styles.emptyExText, { color: colors.textSecondary }]}>
              No exercises configured for this day. Edit in Settings → Manage Plans.
            </Text>
          </Card>
        ) : activeSession ? (
          activeSession.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onOpenPlateCalc={(set, exercise) => {
                setSelectedSet(set);
                setSelectedExercise(exercise);
                setPlateCalcVisible(true);
              }}
            />
          ))
        ) : (
          <Card>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Today's Workout</Text>
            {currentDay.exercises.map((ex) => (
              <View key={ex.id} style={[styles.previewEx, { borderColor: colors.border }]}>
                <Text style={[styles.previewExName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[styles.previewExDetail, { color: colors.textSecondary }]}>
                  {ex.targetSets} sets ·{' '}
                  {ex.toFailure
                    ? 'To Failure'
                    : ex.targetRepsMin === ex.targetRepsMax
                    ? `${ex.targetRepsMin} reps`
                    : `${ex.targetRepsMin}–${ex.targetRepsMax} reps`}
                  {ex.targetWeight ? ` @ ${ex.targetWeight}${ex.weightUnit}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Sticky Bottom Actions */}
        <View style={styles.actions}>
          {!activeSession ? (
            <>
              <Button
                label="Start Workout"
                onPress={handleStartWorkout}
                style={styles.mainBtn}
              />
              <Button
                label="Skip Today"
                variant="ghost"
                onPress={() => setSkipModalVisible(true)}
                style={styles.skipBtn}
              />
            </>
          ) : (
            <Button
              label={allExercisesComplete ? 'Finish Workout' : 'Finish Workout Early'}
              onPress={handleFinishWorkout}
              loading={finishing}
              style={styles.mainBtn}
            />
          )}
        </View>
      </ScrollView>

      {/* Plate Calculator */}
      <PlateCalculator
        visible={plateCalcVisible}
        onClose={() => setPlateCalcVisible(false)}
        initialWeight={selectedSet?.targetWeight ?? 60}
        initialBarType={selectedExercise?.barType ?? 'barbell'}
        onApply={(weight, plates) => {
          if (selectedSet && selectedExercise) {
            useSessionStore.getState().completeSet(selectedExercise.id, selectedSet.id, {
              actualWeight: weight,
              platesUsed: plates,
            });
          }
        }}
      />

      {/* Skip Modal */}
      <CustomModal visible={skipModalVisible} title="Skip Today?" onClose={() => setSkipModalVisible(false)}>
        <Text style={[styles.skipDesc, { color: colors.textSecondary }]}>
          Select a reason (optional):
        </Text>
        <View style={styles.skipOptions}>
          {SKIP_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.skipOption, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              onPress={() => handleSkip(r as SkipReason)}
            >
              <Text style={[styles.skipOptionText, { color: colors.text }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button label="Skip Without Reason" variant="ghost" onPress={() => handleSkip()} style={{ marginTop: SPACING.sm }} />
        <Button label="Cancel" variant="secondary" onPress={() => setSkipModalVisible(false)} style={{ marginTop: SPACING.sm }} />
      </CustomModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  dayLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  dayTitle: { fontSize: 24, fontWeight: '800' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full },
  timerText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyExText: { fontSize: 14, lineHeight: 20 },
  previewTitle: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.md },
  previewEx: { borderTopWidth: 1, paddingVertical: SPACING.sm },
  previewExName: { fontSize: 14, fontWeight: '600' },
  previewExDetail: { fontSize: 12, marginTop: 2 },
  actions: { marginTop: SPACING.lg, gap: SPACING.sm },
  mainBtn: {},
  skipBtn: {},
  restCard: { alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.md },
  restEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  restTitle: { fontSize: 22, fontWeight: '800', marginBottom: SPACING.sm },
  restDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  nextCard: { marginBottom: SPACING.md },
  nextTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  nextLabel: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.sm },
  nextEx: { fontSize: 13, lineHeight: 20 },
  cta: { marginTop: SPACING.md },
  skipDesc: { fontSize: 14, marginBottom: SPACING.md },
  skipOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  skipOption: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  skipOptionText: { fontSize: 14, fontWeight: '600' },
});
