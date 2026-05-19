import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, TextInput,
  UIManager, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { computeDayPosition } from '../../utils/cycleUtils';
import { GRAD, COLORS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { WorkoutDay } from '../../types';
import { DayEditScreen } from './DayEditScreen';
import { SplitTypeSheet } from './SplitTypeSheet';
import { DayListDragSort } from './components/DayListDragSort';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CycleScreen() {
  const { activePlan, updateDay, updatePlan } = usePlanStore();
  const { sessions, quickCompleteDay }        = useSessionStore();
  const { settings, shiftCycle }              = useSettingsStore();

  const currentDayPos = computeDayPosition(settings.cycleStartDate, settings.currentDayPosition);

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
        <Text style={s.emptyTitle}>No active plan</Text>
        <Text style={s.emptySub}>Set up a plan in Settings.</Text>
      </View>
    );
  }

  // Use the plan's own array order — drag-and-drop reorders happen by moving
  // whole day objects in `activePlan.days`, so the visual list must follow
  // that order directly. Re-sorting by `dayPosition` here would silently undo
  // every reorder because dayPosition is stable per card (sessions key off it).
  const days   = activePlan.days;

  // Last-14 completion is per CALENDAR DAY, not per session record.
  // A day counts as "done" when either:
  //   • the scheduled workout has a completed session on that date, OR
  //   • the scheduled day is a rest day (auto-completed once it passes).
  // Pure session-based counting would silently drop rest days out of the
  // graph even though the user satisfied the plan that day.
  const { rate, bars } = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const anchor = settings.cycleStartDate
      ? (() => { const d = new Date(settings.cycleStartDate + 'T00:00:00'); d.setHours(0,0,0,0); return d; })()
      : null;

    const points: number[] = [];
    for (let back = 13; back >= 0; back--) {
      const d = new Date(today);
      d.setDate(d.getDate() - back);
      if (anchor && d < anchor) continue; // skip pre-cycle days entirely
      const diff = anchor ? Math.floor((d.getTime() - anchor.getTime()) / 86_400_000) : 0;
      const slotIdx = anchor ? diff % days.length : 0;
      const planDay = days[slotIdx];
      if (!planDay) continue;
      if (planDay.isRestDay) { points.push(1); continue; }
      const dateStr = d.toISOString().slice(0, 10);
      const hit = sessions.some(ss =>
        ss.status === 'completed' &&
        ss.dayPosition === planDay.dayPosition &&
        ss.finishedAt?.slice(0, 10) === dateStr,
      );
      points.push(hit ? 1 : 0);
    }
    const done = points.filter(v => v === 1).length;
    return {
      rate: points.length === 0 ? 0 : Math.round((done / points.length) * 100),
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
    quickCompleteDay(activePlan.id, day, settings.cycleStartDate)
      .then(() => {
        // Completing today's day advances the cycle so the next day becomes "Today"
        if (day.dayPosition === currentDayPos) shiftCycle(-1);
      })
      .catch(() => Alert.alert('Error', 'Could not log the session. Please try again.'));
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
          <TouchableOpacity onPress={openPlanEdit} style={[s.editBtn, planExpanded && s.editBtnActive]} activeOpacity={0.7}>
            <Ionicons
              name={planExpanded ? 'chevron-up' : 'pencil-outline'}
              size={17}
              color={planExpanded ? COLORS.accent : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* ── Plan edit cabinet ── */}
        {planExpanded && (
          <GlassView radius={16} style={s.planCabinet} borderColor="rgba(255,140,0,0.22)">

            {/* Plan name */}
            <Text style={s.cabinetLabel}>PLAN NAME</Text>
            <GlassView opacity="low" radius={10} style={s.nameField}>
              <TextInput
                style={s.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Plan name"
                placeholderTextColor="rgba(255,240,220,0.25)"
                returnKeyType="done"
                autoCorrect={false}
              />
            </GlassView>

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
              <TouchableOpacity onPress={savePlan} style={s.saveBtn} activeOpacity={0.85} disabled={!editName.trim()}>
                <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveGrad}>
                  <Text style={s.saveTxt}>Save</Text>
                </LinearGradient>
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
              {(bars.length === 0 ? Array(7).fill(0) : bars).map((v, i) => (
                <View key={i} style={[s.barBg, { height: v ? 22 : 8 }]}>
                  {!!v && (
                    <LinearGradient
                      colors={GRAD.accent}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ flex: 1, borderRadius: 3 }}
                    />
                  )}
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
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Split type picker */}
      <SplitTypeSheet
        visible={splitSheetOpen}
        current={editSplit}
        onSelect={sp => handleSplitSelect(sp)}
        onClose={() => setSplitSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },

  // Header
  header:         { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planLabel:      { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  title:          { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  editBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,240,220,0.07)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  editBtnActive:  { borderColor: 'rgba(255,140,0,0.50)', backgroundColor: 'rgba(255,140,0,0.12)' },

  // Plan edit cabinet
  planCabinet:    { marginHorizontal: 16, marginBottom: 10, padding: 14 },
  cabinetLabel:   { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  nameField:      { paddingHorizontal: 12, paddingVertical: 11 },
  nameInput:      { fontSize: 16, fontWeight: '600', color: '#fff', padding: 0 },
  splitBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.07)' },
  splitBtnLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  splitBtnTxt:    { fontSize: 15, fontWeight: '600', color: '#fff' },
  cabinetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 14 },
  saveBtn:        { borderRadius: 10, overflow: 'hidden' },
  saveGrad:       { paddingHorizontal: 22, paddingVertical: 9 },
  saveTxt:        { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Completion card
  rateCard:   { marginHorizontal: 16, padding: 16, marginBottom: 8 },
  rateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rateLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rateNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  rateVal:    { fontSize: 30, fontWeight: '800', color: '#34D399', letterSpacing: -0.5 },
  rateSub:    { fontSize: 13, color: COLORS.textSecondary },
  bars:       { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barBg:      { width: 8, borderRadius: 3, backgroundColor: 'rgba(255,240,220,0.10)' },

  hint:       { fontSize: 11, color: COLORS.textLabel, textAlign: 'center', marginBottom: 8, letterSpacing: 0.2 },
  list:       { paddingHorizontal: 16 },
});
