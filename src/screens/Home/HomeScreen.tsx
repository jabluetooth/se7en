import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterRise } from '../../motion/presets';
import { useCountUp } from '../../motion/useCountUp';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { InlineBanner } from '../../components/common/InlineBanner';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePRStore } from '../../stores/prStore';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { CoachTip } from '../../components/CoachWidget/CoachTip';
import { InfoTip } from '../../components/common/InfoTip';
import { DayPreviewSheet } from './DayPreviewSheet';
import { WeekStrip } from './WeekStrip';
import { TodayCard } from './TodayCard';
import { TabName } from '../../components/FloatingDock/FloatingDock';
import { computeDayPosition, localDateStr, localDateOf } from '../../utils/cycleUtils';
import { buildCycleView, relativeDay, type CycleSlot } from '../../utils/cycleView';
import { sessionLoad } from '../../utils/volume';
import { fmtVol } from '../../utils/format';
import { useDockClearance } from '../../hooks/useDockClearance';
import { scheduleWorkoutReminder, cancelWorkoutReminders } from '../../services/notificationService';
import { themed } from '../../theme/runtime';

// Home answers one question: what am I training today? The workout gets the
// headline and the big button; the week sits on one line above it, a few
// numbers for this cycle and one coaching tip sit below. History and charts
// live in Progress. Active sessions are handled by ActiveSessionScreen (a
// modal in AppNavigator shown whenever activeSession !== null).

interface Props {
  onNavigate:       (tab: TabName) => void;
  onOpenCoach?:     (initialMessage?: string) => void;
  onResumeSession?: () => void;
}

export function HomeScreen({ onNavigate, onOpenCoach, onResumeSession }: Props) {
  const { activePlan, load: loadPlans }       = usePlanStore();
  const { sessions, startSession, activeSession, loadError, load: loadSessions } = useSessionStore();
  const { settings, save: saveSettings } = useSettingsStore();
  const { loadError: prLoadError, load: loadPRs } = usePRStore();
  const dockClearance              = useDockClearance();
  const uid                        = useAuthStore(u => u.user?.uid);
  const displayName                = useAuthStore(u => u.user?.displayName);
  const unit                       = settings.defaultWeightUnit ?? 'kg';
  const [refreshing, setRefreshing] = useState(false);
  const [preview,    setPreview]    = useState<CycleSlot | null>(null);

  // Keep the home-screen widget in sync with the latest plan/session data.
  useEffect(() => {
    import('../../services/widgetService').then(({ widgetService }) => {
      widgetService.updateIdle(activePlan, sessions, settings.cycleStartDate);
    }).catch(() => {});
  }, [activePlan, sessions, settings.cycleStartDate]);

  // Schedule workout reminders for each upcoming non-rest day in the current cycle.
  // Old reminders are wiped first so stale ones don't accumulate after plan changes.
  useEffect(() => {
    if (!activePlan || !settings.cycleStartDate) return;
    const cycleStart = new Date(settings.cycleStartDate + 'T00:00:00');

    cancelWorkoutReminders().then(() => {
      activePlan.days.forEach((day, slotIndex) => {
        if (day.isRestDay) return;

        const dayDate = new Date(cycleStart);
        dayDate.setDate(cycleStart.getDate() + slotIndex);

        // Skip days that already have a completed session this cycle
        const dateStr = localDateStr(dayDate);
        const done = sessions.some(
          s => s.status === 'completed' &&
               s.dayPosition === day.dayPosition &&
               localDateOf(s.finishedAt) === dateStr,
        );
        if (done) return;

        scheduleWorkoutReminder(
          `${activePlan.id}-${slotIndex}`,
          day.label,
          dayDate,
          7,
          0,
        ).catch(() => {});
      });
    }).catch(() => {});
  }, [activePlan?.id, settings.cycleStartDate, sessions.length]);

  // Derive the current day position from the cycle anchor date.
  // Falls back to the stored position for users who haven't set cycleStartDate yet.
  const currentDayPos = computeDayPosition(
    settings.cycleStartDate,
    settings.currentDayPosition,
    activePlan?.days.length ?? 7,
  );

  // "Today" is always the slot at (currentDayPos - 1) in the user's visible
  // cycle order, never looked up by `dayPosition`: after a drag-reorder on
  // the Plan screen that would point at whatever USED to live in that slot.
  const planSessions = activePlan ? sessions.filter(s => s.planId === activePlan.id) : sessions;

  // "Today done" lookup is date-based (not slot-based) so it survives any
  // drag-reorder. If a completed session exists for today's calendar date,
  // the card shows a recap and points at the NEXT workout instead of
  // re-offering today's.
  const todayStr      = localDateStr(new Date());
  const todayDoneSess = planSessions.find(s => s.status === 'completed' && localDateOf(s.finishedAt) === todayStr);

  // The next non-rest workout, walking forward from today's slot (or the slot
  // after today once today is done). On a rest day this is the next workout,
  // so it can be started early.
  const { nextMission, nextMissionNum } = (() => {
    if (!activePlan) return { nextMission: undefined, nextMissionNum: currentDayPos };
    const days = activePlan.days;
    const startOffset = todayDoneSess ? 1 : 0;
    for (let offset = startOffset; offset < days.length; offset++) {
      const slot = ((currentDayPos - 1) + offset) % days.length;
      const candidate = days[slot];
      if (candidate && !candidate.isRestDay) {
        return { nextMission: candidate, nextMissionNum: slot + 1 };
      }
    }
    return { nextMission: days[currentDayPos - 1], nextMissionNum: currentDayPos };
  })();

  const handleStart = () => {
    if (!activePlan || !nextMission || nextMission.isRestDay) return;
    startSession(activePlan.id, nextMission);
    // AppNavigator detects activeSession !== null and opens ActiveSessionScreen
  };

  const cycle = useMemo(
    () => (activePlan ? buildCycleView(activePlan, planSessions, currentDayPos, settings.cycleStartDate) : null),
    [activePlan, planSessions, currentDayPos, settings.cycleStartDate],
  );

  // This cycle's numbers, from the sessions matched to its slots.
  const cycleStats = useMemo(() => {
    if (!cycle) return { volume: 0, records: 0 };
    let volume = 0, records = 0;
    for (const sl of cycle.slots) {
      if (!sl.session) continue;
      volume += sessionLoad(sl.session.exercises, unit);
      records += sl.session.prsBreached?.length ?? 0;
    }
    return { volume, records };
  }, [cycle, unit]);

  // Pull to refresh re-reads everything the screen shows from Firestore.
  const refresh = async () => {
    if (!uid) return;
    setRefreshing(true);
    try {
      await Promise.all([loadSessions(uid), loadPRs(uid), loadPlans(uid)]);
    } catch {
      // Each store surfaces its own loadError, which drives the banner below.
    } finally {
      setRefreshing(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName?.trim().split(/\s+/)[0];

  // Starting from the preview sheet is offered only for the workout Home's
  // own Start button would start, so the two can never disagree.
  const canStartPreview = !!preview && !!nextMission && preview.day.id === nextMission.id
    && !preview.day.isRestDay && !todayDoneSess && activeSession === null;

  if (!activePlan || !cycle) {
    return (
      <View style={s.emptyWrap}>
        <AppBackground />
        {/* Reached only when the saved active plan can't be found (plans
            failed to sync, or it was removed on another device): with no
            active plan at all, App shows onboarding instead. */}
        <Ionicons name="cloud-offline-outline" size={32} color={COLORS.textLabel} style={{ marginBottom: 12 }} />
        <Text style={s.emptyTitle}>Your plan didn't load</Text>
        <Text style={s.emptySub}>
          Check your connection and try again, or pick a new plan to keep training.
        </Text>
        <AnimatedPressable
          style={s.emptyCta}
          haptic="light"
          onPress={() => { if (uid) loadPlans(uid).catch(() => {}); }}
          accessibilityRole="button"
          accessibilityLabel="Try loading your plan again"
        >
          <Text style={s.emptyCtaTxt}>Try again</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={s.emptyLink}
          onPress={() => { saveSettings({ activePlanId: null }).catch(() => {}); }}
          accessibilityRole="button"
          accessibilityLabel="Choose a new plan"
        >
          <Text style={s.emptyLinkTxt}>Choose a new plan</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const len = activePlan.days.length;
  const todaySlot = cycle.slots.find(sl => sl.isToday);
  const restToday = !!todaySlot?.day.isRestDay && !todayDoneSess;
  // Days from today to the next workout, counted forward so a workout that
  // wraps into the next cycle reads "in 2 days", never "5 days ago".
  const nextOffset = (((nextMissionNum - currentDayPos) % len) + len) % len || (todayDoneSess ? len : 0);
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextOffset);
  const nextWhen = relativeDay(nextDate).toLowerCase();

  const headline = activeSession
    ? activeSession.dayLabel
    : todayDoneSess
    ? 'Done for today'
    : restToday
    ? 'Rest day'
    : nextMission?.label ?? 'Workout';

  const mode = activeSession
    ? { kind: 'inProgress' as const }
    : todayDoneSess
    ? { kind: 'done' as const, session: todayDoneSess, next: nextMission?.isRestDay ? undefined : nextMission, nextWhen }
    : !nextMission || nextMission.isRestDay
    ? { kind: 'rest' as const }
    : { kind: 'train' as const, day: nextMission, early: restToday ? nextWhen : undefined };

  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top']}>
        {(loadError || prLoadError) && (
          <InlineBanner
            message="Couldn't sync your latest data. Showing the last saved copy."
            onRetry={uid ? () => { loadSessions(uid); loadPRs(uid); } : undefined}
          />
        )}

        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: dockClearance }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
          }
        >
          {/* ── Headline ── */}
          <Animated.View entering={enterRise(0)} style={s.header}>
            <Text style={s.greeting} numberOfLines={1}>
              {greeting}{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={s.headline} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header">
              {headline}
            </Text>
            <Text style={s.dateLine}>
              {dateLine} · Day {currentDayPos} of {len} · Cycle {cycle.cycleNum}
            </Text>
          </Animated.View>

          {/* ── This cycle, one line ── */}
          <Animated.View entering={enterRise(1)} style={s.week}>
            <WeekStrip slots={cycle.slots} onPressDay={setPreview} />
          </Animated.View>

          {/* ── What to do now ── */}
          <Animated.View entering={enterRise(2)}>
            <TodayCard mode={mode} unit={unit} onStart={handleStart} onResume={onResumeSession} />
          </Animated.View>

          {/* ── Numbers for this cycle ── */}
          <Animated.View entering={enterRise(3)} style={s.stats}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>This cycle</Text>
              <InfoTip
                title="This cycle"
                text={`Your plan repeats every ${len} days. Workouts: done out of planned this cycle. Volume: weight × reps over every logged set, in ${unit}. Records: new bests set this cycle.`}
                size={15}
              />
            </View>
            <View style={s.statRow}>
              <Stat num={cycle.doneCount} unit={`/ ${cycle.workoutCount}`} label="Workouts" />
              <Stat num={cycleStats.volume} format={n => (n > 0 ? fmtVol(n) : '0')} unit={unit} label="Volume" />
              <Stat num={cycleStats.records} label={cycleStats.records === 1 ? 'New record' : 'New records'} accent={cycleStats.records > 0} />
            </View>
          </Animated.View>

          {/* ── One coaching tip ── */}
          <Animated.View entering={enterRise(4)}>
            <CoachTip onOpen={onOpenCoach} />
          </Animated.View>

          <AnimatedPressable
            style={s.historyLink}
            onPress={() => onNavigate('Progress')}
            accessibilityRole="button"
            accessibilityLabel="See your history in Progress"
          >
            <Text style={s.historyTxt}>See your history</Text>
            <Ionicons name="arrow-forward" size={15} color={COLORS.textSecondary} />
          </AnimatedPressable>
        </ScrollView>
      </SafeAreaView>

      <DayPreviewSheet
        slot={preview}
        canStart={canStartPreview}
        onStart={handleStart}
        onEdit={() => onNavigate('Cycle')}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}

function Stat({ num, format, unit, label, accent }: { num: number; format?: (n: number) => string; unit?: string; label: string; accent?: boolean }) {
  const shown = useCountUp(num, { duration: 650, delay: 120 });
  return (
    <View style={s.stat}>
      <Text style={[s.statVal, accent && { color: COLORS.accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {format ? format(shown) : String(Math.round(shown))}{unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  root:       { flex: 1 },
  safe:       { flex: 1 },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, marginBottom: 8 },
  emptySub:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  emptyCta:   { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.accent },
  emptyCtaTxt:{ fontSize: 14, fontFamily: FONTS.headline, color: COLORS.onAccent },
  emptyLink:  { marginTop: 10, paddingHorizontal: 16, paddingVertical: 10 },
  emptyLinkTxt: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSecondary },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 8, gap: 20 },

  header:     { paddingHorizontal: 20, paddingTop: 4 },
  greeting:   { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  headline:   { fontSize: 44, lineHeight: 48, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.4, marginTop: 2 },
  dateLine:   { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 6, fontVariant: ['tabular-nums'] },

  week:       { paddingHorizontal: 12, marginTop: -4 },

  stats:        { paddingHorizontal: 20, gap: 10 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
  statRow:      { flexDirection: 'row', gap: 12 },
  stat:         { flex: 1, gap: 3 },
  statVal:      { fontSize: 26, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  statUnit:     { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted, letterSpacing: 0 },
  statLbl:      { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },

  historyLink:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, alignSelf: 'center', paddingHorizontal: 16 },
  historyTxt:   { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
}));
