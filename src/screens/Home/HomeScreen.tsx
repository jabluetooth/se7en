import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
import { CycleOrbitWidget } from './CycleOrbitWidget';
import { DaySlider } from './DaySlider';
import { MissionCard } from './MissionCard';
import { ContributionHeatmap } from './ContributionHeatmap';
import { HighlightSlideshow } from './HighlightSlideshow';
import { CoachWidget } from '../../components/CoachWidget/CoachWidget';
import { TabName } from '../../components/FloatingDock/FloatingDock';
import { computeDayPosition, localDateStr } from '../../utils/cycleUtils';
import { useDockClearance } from '../../hooks/useDockClearance';
import { scheduleWorkoutReminder, cancelWorkoutReminders } from '../../services/notificationService';

// HomeScreen is idle-only — active sessions are handled by ActiveSessionScreen
// (shown as a modal in AppNavigator whenever activeSession !== null).

interface Props {
  onNavigate:       (tab: TabName) => void;
  onOpenCoach?:     (initialMessage?: string) => void;
  onResumeSession?: () => void;
}

export function HomeScreen({ onNavigate, onOpenCoach, onResumeSession }: Props) {
  const { activePlan }                        = usePlanStore();
  const { sessions, startSession, activeSession, loadError, load: loadSessions } = useSessionStore();
  const { settings }               = useSettingsStore();
  const { loadError: prLoadError, load: loadPRs } = usePRStore();
  const dockClearance              = useDockClearance();
  const uid                        = useAuthStore(u => u.user?.uid);

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
               s.finishedAt?.slice(0, 10) === dateStr,
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

  // Today's workout = the card at slot (currentDayPos - 1) in the user's
  // visible cycle order. Looking it up by `dayPosition` would point at the
  // exercise that USED to live at that slot before any drag-reorder on the
  // Cycle screen, so the two screens would disagree on "today".
  // Used by CycleOrbitWidget for the orbit label; MissionCard receives
  // `nextMission` instead (computed below — skips today-if-done and rest days).
  const currentDay   = activePlan?.days[currentDayPos - 1];
  const planSessions = activePlan ? sessions.filter(s => s.planId === activePlan.id) : sessions;

  // "Today done" lookup — date-based (not slot-based) so it survives any
  // drag-reorder on Cycle. If a completed session exists for today's calendar
  // date, MissionCard flips to its done state and the start button targets
  // the NEXT mission instead of re-offering today's work.
  const todayStr        = new Date().toISOString().slice(0, 10);
  const todayDoneSess   = planSessions.find(s => s.status === 'completed' && s.finishedAt?.slice(0, 10) === todayStr);
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

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <AppBackground />
        <Ionicons name="barbell-outline" size={32} color={COLORS.textLabel} style={{ marginBottom: 12 }} />
        <Text style={s.emptyTitle}>No plan active</Text>
        <Text style={s.emptySub}>Set up a workout plan to start tracking your training.</Text>
        <TouchableOpacity
          style={s.emptyCta}
          onPress={() => onNavigate('Settings')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Go to Settings to set up a plan"
        >
          <Text style={s.emptyCtaTxt}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.planLabel}>{activePlan.name}</Text>
            <Text style={s.dateText}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </Text>
          </View>
          <Image source={require('../../../assets/icon.png')} style={s.logoBadge} />
        </View>

        {(loadError || prLoadError) && (
          <InlineBanner
            message="Couldn't sync your latest data — showing the last saved copy."
            onRetry={uid ? () => { loadSessions(uid); loadPRs(uid); } : undefined}
          />
        )}

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* ── Orbit + slider ── */}
          <CycleOrbitWidget
            currentDay={currentDayPos}
            sessions={planSessions}
            dayLabel={currentDay?.label ?? 'Workout'}
            activePlan={activePlan}
            cycleStartDate={settings.cycleStartDate}
          />

          <DaySlider
            days={activePlan.days}
            currentDay={currentDayPos}
            sessions={planSessions}
          />

          {/* ── Mission card ── */}
          <MissionCard
            currentDay={nextMission}
            currentDayNum={nextMissionNum}
            completedToday={completedToday}
            isInProgress={activeSession !== null}
            onStart={handleStart}
            onResume={onResumeSession}
          />

          {/* ── AI Coach widget ── */}
          <CoachWidget onAskMore={onOpenCoach} />

          {/* ── Divider ── */}
          <View style={s.sectionGap} />

          {/* ── Heatmap ── */}
          <ContributionHeatmap
            sessions={planSessions}
            activePlan={activePlan}
            cycleStartDate={effectiveCycleStartDate}
          />

          {/* ── Highlight slideshow ── */}
          <HighlightSlideshow
            sessions={planSessions}
            currentDay={currentDayPos}
            cycleStartDate={effectiveCycleStartDate}
            planLength={activePlan.days.length}
            onNavigate={onNavigate}
          />

          <View style={{ height: dockClearance }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  safe:       { flex: 1 },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', marginBottom: 8 },
  emptySub:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', letterSpacing: -0.14, marginBottom: 20 },
  emptyCta:   { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, backgroundColor: COLORS.accent },
  emptyCtaTxt:{ fontSize: 14, fontWeight: '800', fontFamily: FONTS.headline, color: '#000' },
  header:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  planLabel:  { fontSize: 11, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 2 },
  dateText:   { fontSize: 22, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.88 },
  logoBadge:  { width: 46, height: 46, borderRadius: 12 },
  scroll:      { flex: 1 },
  scrollContent: { paddingTop: 4, paddingBottom: 8 },
  sectionGap:  { height: 8 },
  bottomPad:   { height: 24 },
});
