import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { Badge, BadgeVariant } from '../../components/common/Badge';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, MUSCLE_TAG_COLOR } from '../../constants';
import { WorkoutDay, WorkoutSession } from '../../types';
import { DayEditScreen } from './DayEditScreen';
import { PlanEditSheet } from './PlanEditSheet';

// ─── helpers ─────────────────────────────────────────────────────────────────

type DayStatus = 'completed' | 'missed' | 'rest' | 'current' | 'upcoming';

function getStatus(
  day: WorkoutDay,
  currentPos: number,
  sessions: WorkoutSession[],
): DayStatus {
  if (day.isRestDay) return 'rest';
  if (day.dayPosition === currentPos) return 'current';
  const last = sessions
    .filter(s => s.dayPosition === day.dayPosition)
    .sort((a, b) =>
      new Date(b.startedAt ?? b.finishedAt!).getTime() -
      new Date(a.startedAt ?? a.finishedAt!).getTime(),
    )[0];
  if (!last) return 'upcoming';
  return last.status === 'completed' ? 'completed' : last.status === 'missed' ? 'missed' : 'upcoming';
}

const STATUS_BADGE: Record<DayStatus, { label: string; variant: BadgeVariant }> = {
  completed: { label: 'Done',     variant: 'completed' },
  missed:    { label: 'Missed',   variant: 'missed'    },
  current:   { label: 'Today',    variant: 'current'   },
  upcoming:  { label: 'Upcoming', variant: 'upcoming'  },
  rest:      { label: 'Rest',     variant: 'rest'      },
};

// Top-3 muscle tags for a day
function topTags(day: WorkoutDay): string[] {
  const counts: Record<string, number> = {};
  day.exercises.forEach(ex =>
    (ex.muscleTags ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }),
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

// ─── Swipe action buttons ─────────────────────────────────────────────────────

function SwipeActions({
  onEdit,
  onClear,
}: { onEdit: () => void; onClear: () => void }) {
  return (
    <View style={sw.row}>
      <TouchableOpacity style={sw.editBtn} onPress={onEdit} activeOpacity={0.8}>
        <Ionicons name="pencil" size={16} color="#fff" />
        <Text style={sw.editTxt}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sw.clearBtn} onPress={onClear} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={sw.clearTxt}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
}

const sw = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingRight: 16 },
  editBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginRight: 6 },
  editTxt:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  clearTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  status,
  onEdit,
  onClear,
}: {
  day: WorkoutDay;
  status: DayStatus;
  onEdit: () => void;
  onClear: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const isCurrent = status === 'current';
  const isDone    = status === 'completed';
  const tags      = topTags(day);

  const handleEdit = () => { swipeRef.current?.close(); onEdit(); };
  const handleClear = () => { swipeRef.current?.close(); onClear(); };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <SwipeActions onEdit={handleEdit} onClear={handleClear} />
      )}
      overshootRight={false}
      friction={2}
    >
      <GlassView
        radius={16}
        style={[dc.card, isCurrent && dc.cardCurrent]}
        borderColor={
          isCurrent ? 'rgba(10,132,255,0.45)' :
          isDone    ? 'rgba(10,132,255,0.20)' :
          'rgba(255,255,255,0.08)'
        }
        glow={isCurrent}
      >
        {/* Day number badge */}
        {isCurrent ? (
          <LinearGradient
            colors={GRAD.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dc.numBadge}
          >
            <Text style={dc.numActive}>{day.dayPosition}</Text>
          </LinearGradient>
        ) : (
          <View style={[dc.numBadge, dc.numBadgeMuted]}>
            <Text style={[dc.num, isDone && { color: COLORS.accent }]}>
              {isDone ? '✓' : day.dayPosition}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={dc.content}>
          <View style={dc.nameRow}>
            <Text style={[dc.label, isCurrent && { color: COLORS.accent }]} numberOfLines={1}>
              {day.label}
            </Text>
            {isCurrent && (
              <View style={dc.todayDot} />
            )}
          </View>

          <Text style={dc.sub}>
            {day.isRestDay ? 'Recovery day' : `${day.exercises.length} exercise${day.exercises.length !== 1 ? 's' : ''}`}
          </Text>

          {/* Muscle tags */}
          {tags.length > 0 && (
            <View style={dc.tagsRow}>
              {tags.map(tag => (
                <View
                  key={tag}
                  style={[
                    dc.tag,
                    {
                      backgroundColor: (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '1A',
                      borderColor:     (MUSCLE_TAG_COLOR[tag] ?? '#fff') + '44',
                    },
                  ]}
                >
                  <Text style={[dc.tagTxt, { color: MUSCLE_TAG_COLOR[tag] ?? COLORS.textSecondary }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Status badge */}
        <Badge label={STATUS_BADGE[status].label} variant={STATUS_BADGE[status].variant} size="xs" />
      </GlassView>
    </Swipeable>
  );
}

const dc = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 12 },
  cardCurrent: {},
  numBadge:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numBadgeMuted: { backgroundColor: 'rgba(255,255,255,0.07)' },
  num:         { fontSize: 17, fontWeight: '700', color: COLORS.textSecondary },
  numActive:   { fontSize: 17, fontWeight: '700', color: '#fff' },
  content:     { flex: 1, minWidth: 0 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label:       { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flexShrink: 1 },
  todayDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  sub:         { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  tagTxt:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CycleScreen() {
  const { activePlan, updateDay } = usePlanStore();
  const { sessions }             = useSessionStore();
  const { settings }             = useSettingsStore();
  const [editingDay,   setEditingDay  ] = useState<WorkoutDay | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  // Show DayEditScreen when a day is selected for editing
  if (editingDay && activePlan) {
    // Always pass the latest version of the day from the store
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
        <LinearGradient
          colors={GRAD.bg}
          locations={GRAD.bgLocations}
          start={GRAD.bgStart}
          end={GRAD.bgEnd}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.emptyTitle}>No active plan</Text>
        <Text style={s.emptySub}>Set up a plan in Settings.</Text>
      </View>
    );
  }

  const days = [...activePlan.days].sort((a, b) => a.dayPosition - b.dayPosition);

  // Completion rate from last 14 sessions
  const recent     = sessions.slice(-14);
  const done       = recent.filter(s => s.status === 'completed').length;
  const rate       = recent.length === 0 ? 0 : Math.round((done / recent.length) * 100);
  const bars       = recent.map(s => s.status === 'completed' ? 1 : 0);

  const handleClear = (day: WorkoutDay) => {
    Alert.alert(
      `Clear ${day.label}?`,
      'This will remove all exercises and mark it as a rest day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () =>
            updateDay(activePlan.id, day.id, { isRestDay: true, exercises: [] }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={GRAD.bg}
        locations={GRAD.bgLocations}
        start={GRAD.bgStart}
        end={GRAD.bgEnd}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[s.orb, { top: -70, left: -50, width: 260, height: 260, backgroundColor: 'rgba(10,132,255,0.08)' }]} />
        <View style={[s.orb, { bottom: 80, right: -70, width: 220, height: 220, backgroundColor: 'rgba(64,156,255,0.05)' }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.planLabel}>{activePlan.splitType}</Text>
            <Text style={s.title}>{activePlan.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setPlanSheetOpen(true)}
            style={s.settingsBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <GlassView radius={12} style={s.logoBadge} glow>
            <Text style={s.logoNum}>7</Text>
          </GlassView>
        </View>

        {/* Completion card */}
        <GlassView radius={16} style={s.rateCard}>
          <View style={s.rateRow}>
            <View>
              <Text style={s.rateLabel}>Last 14 sessions</Text>
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

        {/* Hint */}
        <Text style={s.hint}>Swipe left to edit or clear a day</Text>

        {/* Day list */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {days.map(day => (
            <DayCard
              key={day.id}
              day={day}
              status={getStatus(day, settings.currentDayPosition, sessions)}
              onEdit={() => setEditingDay(day)}
              onClear={() => handleClear(day)}
            />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Plan-level settings sheet */}
      <PlanEditSheet
        visible={planSheetOpen}
        plan={activePlan}
        onClose={() => setPlanSheetOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  orb:        { position: 'absolute', borderRadius: 999 },

  header:     { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsBtn:{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  planLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  logoBadge:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logoNum:    { fontSize: 20, fontWeight: '900', color: COLORS.accent },

  rateCard:   { marginHorizontal: 16, padding: 16, marginBottom: 8 },
  rateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  rateLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  rateNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  rateVal:    { fontSize: 30, fontWeight: '800', color: COLORS.accent, letterSpacing: -0.5 },
  rateSub:    { fontSize: 13, color: COLORS.textSecondary },
  bars:       { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barBg:      { width: 8, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)' },

  hint:       { fontSize: 11, color: COLORS.textLabel, textAlign: 'center', marginBottom: 8, letterSpacing: 0.2 },
  list:       { paddingHorizontal: 16 },
});
