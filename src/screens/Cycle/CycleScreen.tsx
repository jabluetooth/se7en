import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, TextInput,
  UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { InlineBanner } from '../../components/common/InlineBanner';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePresetStore } from '../../stores/presetStore';
import { useAuthStore } from '../../stores/authStore';
import { computeDayPosition } from '../../utils/cycleUtils';
import { GRAD, COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { WorkoutDay, PlanPreset } from '../../types';
import { generateId } from '../../utils/idGen';
import { DayEditScreen } from './DayEditScreen';
import { SplitTypeSheet } from './SplitTypeSheet';
import { DayListDragSort } from './components/DayListDragSort';
import { useDockClearance } from '../../hooks/useDockClearance';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CycleScreen() {
  const { activePlan, updateDay, updatePlan, loadError, load: loadPlans } = usePlanStore();
  const { sessions, quickCompleteDay }        = useSessionStore();
  const { settings, shiftCycle }              = useSettingsStore();
  const { presets, load: loadPresets, savePreset, deletePreset } = usePresetStore();
  const uid = useAuthStore(u => u.user?.uid);

  const currentDayPos = computeDayPosition(settings.cycleStartDate, settings.currentDayPosition, activePlan?.days.length ?? 7);
  const dockClearance = useDockClearance();

  useEffect(() => { loadPresets(); }, []);

  const [editingDay,    setEditingDay   ] = useState<WorkoutDay | null>(null);
  const [planExpanded,  setPlanExpanded ] = useState(false);
  const [splitSheetOpen,setSplitSheetOpen] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [editName,      setEditName     ] = useState('');
  const [editSplit,     setEditSplit    ] = useState('');

  const openPlanEdit = () => {
    if (!activePlan) return;
    setEditName(activePlan.name);
    setEditSplit(activePlan.splitType);
    setPlanExpanded(e => !e);
  };

  const savePlan = () => {
    if (!activePlan || !editName.trim()) return;
    updatePlan(activePlan.id, { name: editName.trim(), splitType: editSplit });
    setPlanExpanded(false);
  };

  const handleSaveAsPreset = () => {
    if (!activePlan) return;
    savePreset(activePlan);
    Alert.alert('Preset Saved', `"${activePlan.name}" has been saved as a preset. You can load it from the Split Type sheet.`);
  };

  // Applies a saved preset to the active plan — keeps day IDs stable so
  // session history stays linked, but replaces labels, rest flags, and exercises.
  const handleSelectPreset = (preset: PlanPreset) => {
    if (!activePlan) return;
    const newDays = activePlan.days.map((activeDay, idx) => {
      const presetDay = preset.days[idx];
      if (!presetDay) return activeDay;
      return {
        ...activeDay,
        label:     presetDay.label,
        isRestDay: presetDay.isRestDay,
        exercises: presetDay.exercises.map(ex => ({
          ...ex,
          id:        generateId(),
          createdAt: new Date().toISOString(),
        })),
      };
    });
    updatePlan(activePlan.id, {
      name:      preset.name,
      splitType: preset.splitType,
      days:      newDays,
    });
    setEditName(preset.name);
    setEditSplit(preset.splitType);
  };

  const handleSplitSelect = (sp: string) => {
    if (sp === 'Custom') {
      Alert.alert(
        'Use Custom Split?',
        'This will clear all exercises from every day.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Use Custom',
            style: 'destructive',
            onPress: () => {
              setEditSplit('Custom');
              activePlan?.days.forEach(d =>
                updateDay(activePlan.id, d.id, { exercises: [], isRestDay: false }),
              );
            },
          },
        ],
      );
    } else {
      setEditSplit(sp);
    }
  };

  if (editingDay && activePlan) {
    const freshDay = activePlan.days.find(d => d.id === editingDay.id) ?? editingDay;
    return (
      <DayEditScreen
        day={freshDay}
        planId={activePlan.id}
        onBack={() => setEditingDay(null)}
      />
    );
  }

  if (!activePlan) {
    return (
      <View style={s.emptyWrap}>
        <AppBackground />
        <Ionicons name="calendar-outline" size={32} color={COLORS.textLabel} style={{ marginBottom: 12 }} />
        <Text style={s.emptyTitle}>No active plan</Text>
        <Text style={s.emptySub}>Set up a plan in Settings to see your training cycle here.</Text>
      </View>
    );
  }

  // Use the plan's own array order — drag-and-drop reorders happen by moving
  // whole day objects in `activePlan.days`, so the visual list must follow
  // that order directly. Re-sorting by `dayPosition` here would silently undo
  // every reorder because dayPosition is stable per card (sessions key off it).
  const days   = activePlan.days;

  // Last-14 completion is per CALENDAR DAY, not per session record.
  // A day counts as "done" when EITHER:
  //   • any completed session exists on that date (workout was logged), OR
  //   • the current slot at that date is a rest day (auto-completed).
  //
  // The session check intentionally does NOT match by dayPosition — only by
  // date. Otherwise dragging "Push" from slot 1 to slot 2 would retroactively
  // un-do every past Monday-completed Push session, because the session's
  // dayPosition (1) no longer matches what's parked at slot 1 today.
  // History is what HAPPENED on a date, not what's scheduled there now.
  // Convert any Date (or ISO string) to a YYYY-MM-DD string in LOCAL time so
  // that bar and heatmap comparisons survive UTC± offsets.
  // Using toISOString() on local-midnight dates gives the previous UTC day in
  // UTC+ zones (e.g. Philippines UTC+8), causing session lookups to silently fail.
  const toLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  type BarState = 'done' | 'rest' | 'missed' | 'pending';
  const { rate, bars } = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const anchor = settings.cycleStartDate
      ? (() => { const d = new Date(settings.cycleStartDate + 'T00:00:00'); d.setHours(0,0,0,0); return d; })()
      : null;

    const points: BarState[] = [];
    for (let back = 13; back >= 0; back--) {
      const d = new Date(today);
      d.setDate(d.getDate() - back);
      if (anchor && d < anchor) continue;
      const dateStr = toLocalDate(d);   // local date — no UTC-offset drift
      const isToday = back === 0;

      // 1. Completed session — compare local dates on both sides so UTC± zones
      //    don't shift the session onto the wrong calendar day.
      const hit = sessions.some(ss =>
        ss.status === 'completed' &&
        ss.finishedAt &&
        toLocalDate(new Date(ss.finishedAt)) === dateStr,
      );
      if (hit) { points.push('done'); continue; }

      // 2. Rest day — auto-complete, no session record needed.
      // Mirror dayIsRest: flag OR label='rest' with no exercises.
      const diff    = anchor ? Math.floor((d.getTime() - anchor.getTime()) / 86_400_000) : 0;
      const slotIdx = anchor ? diff % days.length : 0;
      const planDay = days[slotIdx];
      const isRestSlot = planDay?.isRestDay ||
        (planDay?.label?.toLowerCase().trim() === 'rest' && (planDay?.exercises?.length ?? 0) === 0);
      if (isRestSlot) { points.push('rest'); continue; }

      // 3. Today with no session yet — not missed, just pending.
      if (isToday) { points.push('pending'); continue; }

      // 4. Past workout slot with no session = missed.
      points.push('missed');
    }
    // pending (today) is excluded from the rate denominator so it doesn't
    // penalise completion before the day is over.
    const counted = points.filter(v => v !== 'pending');
    const done    = counted.filter(v => v === 'done' || v === 'rest').length;
    return {
      rate: counted.length === 0 ? 0 : Math.round((done / counted.length) * 100),
      bars: points,
    };
  })();

  const handleClear = (day: WorkoutDay) => {
    Alert.alert(
      `Clear ${day.label}?`,
      'This will remove all exercises and mark it as a rest day.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => updateDay(activePlan.id, day.id, { isRestDay: true, exercises: [] }) },
      ],
    );
  };

  const handleQuickDone = (day: WorkoutDay) => {
    Alert.alert(
      `Mark ${day.label} as done?`,
      'This will log a completed session for this day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Done',
          onPress: () => {
            // Use SLOT INDEX (position in the days array) not day.dayPosition.
            // After drag-and-drop reordering, dayPosition is a stable content-id that
            // no longer matches the calendar offset from cycleStartDate. The slot index
            // is the correct offset: cycleStartDate + slotIdx = the calendar date for
            // that slot's workout.
            const dayIdx       = days.findIndex(d => d.id === day.id);
            const todaySlotIdx = currentDayPos - 1;

            quickCompleteDay(activePlan.id, day, settings.cycleStartDate, dayIdx)
              .then(() => {
                if (dayIdx === todaySlotIdx) shiftCycle(-1);
              })
              .catch(() => Alert.alert('Error', 'Could not log the session. Please try again.'));
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.planLabel}>{activePlan.splitType}</Text>
            <Text style={s.title}>{activePlan.name}</Text>
          </View>
          <TouchableOpacity
            onPress={openPlanEdit}
            style={[s.editBtn, planExpanded && s.editBtnActive]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={planExpanded ? 'Close plan editor' : 'Edit plan'}
            accessibilityState={{ expanded: planExpanded }}
          >
            <Ionicons
              name={planExpanded ? 'chevron-up' : 'pencil-outline'}
              size={17}
              color={planExpanded ? COLORS.accent : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {loadError && (
          <InlineBanner
            message="Couldn't sync your plan — showing the last saved copy."
            onRetry={uid ? () => loadPlans(uid) : undefined}
          />
        )}

        {/* ── Plan edit cabinet ── */}
        {planExpanded && (
          <GlassView radius={16} style={s.planCabinet} borderColor="rgba(255,140,0,0.22)">

            {/* Plan name */}
            <Text style={s.cabinetLabel}>PLAN NAME</Text>
            <View style={s.nameField}>
              <TextInput
                style={s.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Plan name"
                placeholderTextColor="rgba(255,240,220,0.25)"
                returnKeyType="done"
                autoCorrect={false}
              />
            </View>

            {/* Split type */}
            <Text style={[s.cabinetLabel, { marginTop: 14 }]}>SPLIT TYPE</Text>
            <TouchableOpacity
              style={s.splitBtn}
              onPress={() => setSplitSheetOpen(true)}
              activeOpacity={0.8}
            >
              <View style={s.splitBtnLeft}>
                <View style={s.splitDot} />
                <Text style={s.splitBtnTxt}>{editSplit || 'Select split…'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Actions row */}
            <View style={s.cabinetActions}>
              <TouchableOpacity onPress={handleSaveAsPreset} style={s.presetBtn} activeOpacity={0.8}>
                <Ionicons name="bookmark-outline" size={14} color={COLORS.accent} />
                <Text style={s.presetBtnTxt}>Save as Preset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePlan} style={[s.saveBtn, { backgroundColor: COLORS.accent }]} activeOpacity={0.85} disabled={!editName.trim()}>
                <Text style={s.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        )}

        {/* ── Completion card ── */}
        <GlassView radius={16} style={s.rateCard}>
          <View style={s.rateRow}>
            <View>
              <Text style={s.rateLabel}>Last 14 days</Text>
              <View style={s.rateNumRow}>
                <Text style={s.rateVal}>{rate}%</Text>
                <Text style={s.rateSub}> completion</Text>
              </View>
            </View>
            <View style={s.bars}>
              {(bars.length === 0 ? Array(7).fill('pending') : bars).map((v, i) => (
                <View key={i} style={[s.barBg, {
                  height: v === 'done' ? 22 : v === 'rest' ? 14 : 8,
                }]}>
                  {v === 'done' && (
                    <LinearGradient
                      colors={GRAD.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ flex: 1, borderRadius: 3 }}
                    />
                  )}
                  {v === 'rest'    && <View style={[s.barFill, { backgroundColor: '#A8A29E' }]} />}
                  {v === 'missed'  && <View style={[s.barFill, { backgroundColor: '#EF4444' }]} />}
                </View>
              ))}
            </View>
          </View>
        </GlassView>

        <Text style={s.hint}>Swipe right → Done · Swipe left → Edit / Clear · Drag ≡ to reorder</Text>

        {/* ── Day list ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          scrollEnabled={scrollEnabled}
        >
          <DayListDragSort
            days={days}
            planId={activePlan.id}
            sessions={sessions}
            currentPos={currentDayPos}
            cycleStartDate={settings.cycleStartDate}
            onEdit={setEditingDay}
            onClear={handleClear}
            onDone={handleQuickDone}
            onScrollEnabledChange={setScrollEnabled}
          />
          <View style={{ height: dockClearance }} />
        </ScrollView>
      </SafeAreaView>

      {/* Split type picker */}
      <SplitTypeSheet
        visible={splitSheetOpen}
        current={editSplit}
        presets={presets}
        onSelect={sp => handleSplitSelect(sp)}
        onSelectPreset={handleSelectPreset}
        onDeletePreset={deletePreset}
        onClose={() => setSplitSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.88, marginBottom: 8 },
  emptySub:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center' },

  // Header
  header:         { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 },
  planLabel:      { fontSize: 11, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.88, textTransform: 'uppercase', marginBottom: 2 },
  title:          { fontSize: 28, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -1.12 },
  editBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,240,220,0.07)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  editBtnActive:  { borderColor: 'rgba(255,140,0,0.50)', backgroundColor: 'rgba(255,140,0,0.12)' },

  // Plan edit cabinet
  planCabinet:    { marginHorizontal: 16, marginBottom: 10, padding: 14 },
  cabinetLabel:   { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.80, marginBottom: 8 },
  nameField:      { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderFaint },
  nameInput:      { fontSize: 16, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff', padding: 0 },
  splitBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.07)' },
  splitBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  splitBtnTxt:    { fontSize: 15, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff' },
  cabinetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  presetBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,140,0,0.40)', backgroundColor: 'rgba(255,140,0,0.08)' },
  presetBtnTxt:   { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent },
  saveBtn:        { borderRadius: 10, paddingHorizontal: 22, paddingVertical: 9 },
  saveTxt:        { fontSize: 14, fontWeight: '700', fontFamily: FONTS.headline, color: '#000' },

  // Completion card
  rateCard:   { marginHorizontal: 16, padding: 16, marginBottom: 8 },
  rateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rateLabel:  { fontSize: 11, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.88, marginBottom: 4 },
  rateNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  rateVal:    { fontSize: 30, fontWeight: '800', fontFamily: FONTS.data, color: '#34D399', letterSpacing: -1.20 },
  rateSub:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary },
  bars:       { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barBg:      { width: 8, borderRadius: 3, backgroundColor: 'rgba(255,240,220,0.10)' },
  barFill:    { flex: 1, borderRadius: 3 },

  hint:       { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLabel, textAlign: 'center', marginBottom: 8 },
  list:       { paddingHorizontal: 16 },
});
