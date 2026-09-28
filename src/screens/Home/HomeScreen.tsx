import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterRise } from '../../motion/presets';
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
import { CycleCard } from './CycleCard';
import { DayPreviewSheet } from './DayPreviewSheet';
import { MissionCard } from './MissionCard';
import { ContributionHeatmap } from './ContributionHeatmap';
import { HighlightSlideshow } from './HighlightSlideshow';
import { CoachWidget } from '../../components/CoachWidget/CoachWidget';
import { TabName } from '../../components/FloatingDock/FloatingDock';
import { computeDayPosition, localDateStr, localDateOf } from '../../utils/cycleUtils';
import { buildCycleView, type CycleSlot } from '../../utils/cycleView';
import { useDockClearance } from '../../hooks/useDockClearance';
import { scheduleWorkoutReminder, cancelWorkoutReminders } from '../../services/notificationService';
import { themed } from '../../theme/runtime';

// HomeScreen is idle-only — active sessions are handled by ActiveSessionScreen
// (shown as a modal in AppNavigator whenever activeSession !== null).

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

  // Effective cycle anchor — synthesizes one from today + currentDayPosition when
  // cycleStartDate is null (older accounts / imported plans). Without this the
  // ContributionHeatmap can't compute cycle indices and renders nothing cycle-
  // related, even when an active plan is set.
  const effectiveCycleStartDate = settings.cycleStartDate ?? (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (settings.currentDayPosition - 1));
    return localDateStr(d);
  })();

  // "Today" is always the slot at (currentDayPos - 1) in the user's visible
  // cycle order, never looked up by `dayPosition`: after a drag-reorder on
  // the Cycle screen that would point at whatever USED to live in that slot.
  // CycleCard and MissionCard (via `nextMission` below) both follow slots.
  const planSessions = activePlan ? sessions.filter(s => s.planId === activePlan.id) : sessions;

  // "Today done" lookup — date-based (not slot-based) so it survives any
  // drag-reorder on Cycle. If a completed session exists for today's calendar
  // date, MissionCard flips to its done state and the start button targets
  // the NEXT mission instead of re-offering today's work.
  const todayStr        = localDateStr(new Date());
  const todayDoneSess   = planSessions.find(s => s.status === 'completed' && localDateOf(s.finishedAt) === todayStr);
  const completedToday  = todayDoneSess ? { dayLabel: todayDoneSess.dayLabel } : null;

  // Next mission resolution — finds the next non-rest workout, walking forward
  // from today's slot (or the slot AFTER today if today's session is done).
  // This avoids two redundancies the user reported:
  //   1. After completing today, MissionCard pointing back at the same workout
  //      because the cycle hadn't shifted yet.
  //   2. MissionCard showing "Recovery Day" when today's slot happens to be
  //      rest — the user wants to see the next actual WORKOUT to plan ahead.
  const { nextMission, nextMissionNum } = (() => {
    if (!activePlan) return { nextMission: undefined, nextMissionNum: currentDayPos };
    const days = activePlan.days;
    const startOffset = completedToday ? 1 : 0;  // skip today if already done
    for (let offset = startOffset; offset < days.length; offset++) {
      const slot = ((currentDayPos - 1) + offset) % days.length;
      const candidate = days[slot];
      if (candidate && !candidate.isRestDay) {
        return { nextMission: candidate, nextMissionNum: slot + 1 };
      }
    }
    // All rest days — fall back to whatever's at today's slot so MissionCard
    // still has something to display (will render as Recovery Day).
    return { nextMission: days[currentDayPos - 1], nextMissionNum: currentDayPos };
  })();

  const handleStart = () => {
    if (!activePlan || !nextMission) return;
    startSession(activePlan.id, nextMission);
    // AppNavigator detects activeSession !== null and opens ActiveSessionScreen
  };

  const cycle = useMemo(
    () => (activePlan ? buildCycleView(activePlan, planSessions, currentDayPos, settings.cycleStartDate) : null),
    [activePlan, planSessions, currentDayPos, settings.cycleStartDate],
  );

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
    && !preview.day.isRestDay && !completedToday && activeSession === null;

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

  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.greeting} numberOfLines={1}>
              {greeting}{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={s.dateText}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Image source={require('../../../assets/icon.png')} style={s.logoBadge} accessibilityIgnoresInvertColors />
        </View>

        {(loadError || prLoadError) && (
          <InlineBanner
            message="Couldn't sync your latest data. Showing the last saved copy."
            onRetry={uid ? () => { loadSessions(uid); loadPRs(uid); } : undefined}
          />
        )}

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />
          }
        >
          {/* ── What to do now ── */}
          <Animated.View entering={enterRise(0)}>
            <MissionCard
              currentDay={nextMission}
              currentDayNum={nextMissionNum}
              completedToday={completedToday}
              isInProgress={activeSession !== null}
              onStart={handleStart}
              onResume={onResumeSession}
            />
          </Animated.View>

          {/* ── This cycle: ring + tappable days ── */}
          <Animated.View entering={enterRise(1)} style={s.section}>
            <CycleCard view={cycle} planName={activePlan.name} onPressDay={setPreview} />
          </Animated.View>

          {/* ── AI Coach ── */}
          <Animated.View entering={enterRise(2)} style={s.section}>
            <CoachWidget onAskMore={onOpenCoach} />
          </Animated.View>

          {/* ── History ── */}
          <Animated.View entering={enterRise(3)} style={s.section}>
            <ContributionHeatmap
              sessions={planSessions}
              activePlan={activePlan}
              cycleStartDate={effectiveCycleStartDate}
            />
          </Animated.View>

          <Animated.View entering={enterRise(4)}>
            <HighlightSlideshow
              sessions={planSessions}
              currentDay={currentDayPos}
              cycleStartDate={effectiveCycleStartDate}
              planLength={activePlan.days.length}
              onNavigate={onNavigate}
            />
          </Animated.View>

          <View style={{ height: dockClearance }} />
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

const s = themed(() => StyleSheet.create({
  root:       { flex: 1 },
  safe:       { flex: 1 },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, marginBottom: 8 },
  emptySub:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', letterSpacing: -0.14, marginBottom: 20 },
  emptyCta:   { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.accent },
  emptyCtaTxt:{ fontSize: 14, fontFamily: FONTS.headline, color: COLORS.onAccent },
  emptyLink:  { marginTop: 10, paddingHorizontal: 16, paddingVertical: 10 },
  emptyLinkTxt: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  header:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  greeting:   { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginBottom: 2 },
  dateText:   { fontSize: 24, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.9 },
  logoBadge:  { width: 46, height: 46, borderRadius: 12 },
  scroll:      { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 8 },
  section:     { marginTop: 12 },
}));
