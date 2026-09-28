import React, { useEffect } from 'react';
import { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterFade, enterRise } from '../../motion/presets';
import { COLORS, FONTS } from '../../constants';
import type { WorkoutDay, WorkoutSession } from '../../types';
import { fmtVol } from '../../utils/format';
import { InfoTip } from '../../components/common/InfoTip';
import { sessionLoad } from '../../utils/volume';
import { accentA, themed } from '../../theme/runtime';

type Mode =
  | { kind: 'inProgress' }
  | { kind: 'rest' }
  | { kind: 'done'; session: WorkoutSession; next?: WorkoutDay; nextWhen?: string }
  | { kind: 'train'; day: WorkoutDay; early?: string };

interface Props {
  mode:      Mode;
  unit:      'kg' | 'lb';
  onStart:   () => void;
  onResume?: () => void;
}

const PREVIEW_ROWS = 4;

/** Rough session length: ~2.5 min per set (work + rest), to the nearest 5. */
export function estMinutes(day: WorkoutDay): number {
  const sets = day.exercises.reduce((a, e) => a + e.targetSets, 0);
  return Math.max(10, Math.round((sets * 2.5) / 5) * 5);
}

function exerciseMeta(ex: WorkoutDay['exercises'][number]): string {
  const reps = ex.toFailure
    ? 'to failure'
    : ex.targetRepsMax && ex.targetRepsMax !== ex.targetRepsMin
      ? `${ex.targetRepsMin}–${ex.targetRepsMax}`
      : ex.targetRepsMin ? String(ex.targetRepsMin) : '';
  const base = reps ? `${ex.targetSets} × ${reps}` : `${ex.targetSets} sets`;
  const w = ex.targetWeight && ex.targetWeight > 0 && ex.weightUnit !== 'bodyweight'
    ? ` · ${ex.targetWeight} ${ex.weightUnit}` : '';
  return base + w;
}

/**
 * The one thing Home is for: what you're training and a button to start it.
 * Three states: a workout to start (today's, or the next one on a rest day),
 * a workout already running, or today's workout done with a short recap.
 */
export function TodayCard({ mode, unit, onStart, onResume }: Props) {
  if (mode.kind === 'inProgress') {
    return (
      <View style={s.card}>
        <View style={s.liveRow}>
          <LiveDot />
          <Text style={s.liveTxt}>Workout in progress</Text>
        </View>
        <Text style={s.body}>Your sets and timer are saved. Pick up where you left off.</Text>
        <AnimatedPressable haptic="medium" style={s.cta} onPress={onResume} accessibilityRole="button" accessibilityLabel="Resume workout">
          <Text style={s.ctaTxt}>Resume workout</Text>
        </AnimatedPressable>
      </View>
    );
  }

  if (mode.kind === 'rest') {
    return (
      <View style={s.card}>
        <Text style={s.cardTitle}>Nothing to train</Text>
        <Text style={s.body}>Every day in this plan is a rest day. Add a workout in Plan to get started.</Text>
      </View>
    );
  }

  if (mode.kind === 'done') {
    const { session, next, nextWhen } = mode;
    const sets = session.exercises.reduce((a, e) => a + e.sets.filter(st => st.isCompleted).length, 0);
    const load = sessionLoad(session.exercises, unit);
    const prs = session.prsBreached?.length ?? 0;
    return (
      <View style={s.card}>
        <View style={s.doneHead}>
          <View style={s.doneIcon}><Ionicons name="checkmark" size={18} color={COLORS.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{session.dayLabel} done</Text>
            <Text style={s.meta}>Nice work. Recover well.</Text>
          </View>
        </View>
        <Animated.View entering={enterFade.delay(120)} style={s.recap}>
          <Recap value={String(sets)} label="Sets" />
          <Recap value={load > 0 ? fmtVol(load) : '–'} unit={load > 0 ? unit : undefined} label="Volume" />
          <Recap value={session.duration > 0 ? String(session.duration) : '–'} unit={session.duration > 0 ? 'min' : undefined} label="Time" />
          {prs > 0 && <Recap value={String(prs)} label={prs === 1 ? 'Record' : 'Records'} accent />}
        </Animated.View>
        {next && (
          <View style={s.nextRow}>
            <Text style={s.meta}>Next up</Text>
            <Text style={s.nextTxt} numberOfLines={1}>{next.label}{nextWhen ? ` · ${nextWhen}` : ''}</Text>
          </View>
        )}
      </View>
    );
  }

  const { day, early } = mode;
  const totalSets = day.exercises.reduce((a, e) => a + e.targetSets, 0);
  const shown = day.exercises.slice(0, PREVIEW_ROWS);
  const more = day.exercises.length - shown.length;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.cardTitle}>{early ? `Up next · ${early}` : "Today's workout"}</Text>
        <View style={s.metaRow}>
          <Text style={s.meta}>{totalSets} sets · ~{estMinutes(day)} min</Text>
          <InfoTip
            title="Time estimate"
            text={early
              ? `Today is a rest day in your plan. You can start ${day.label} early; the time assumes about 2½ minutes per set, rest included.`
              : 'About 2½ minutes per set, rest included. Your real time depends on how long you rest.'}
            size={15}
          />
        </View>
      </View>

      {day.exercises.length === 0 ? (
        <Text style={s.body}>No exercises yet. Add some in Plan.</Text>
      ) : (
        <View>
          {shown.map((ex, i) => (
            <Animated.View key={ex.id} entering={enterRise(i + 2)} style={s.exRow}>
              <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
              <Text style={s.exMeta} numberOfLines={1}>{exerciseMeta(ex)}</Text>
            </Animated.View>
          ))}
          {more > 0 && (
            <View style={s.exRow}>
              <Text style={s.exMore}>+ {more} more</Text>
            </View>
          )}
        </View>
      )}

      <AnimatedPressable
        haptic="medium"
        style={[s.cta, day.exercises.length === 0 && { opacity: 0.4 }]}
        disabled={day.exercises.length === 0}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={`Start ${day.label}`}
      >
        <Text style={s.ctaTxt}>{early ? `Start ${day.label} early` : 'Start workout'}</Text>
      </AnimatedPressable>
    </View>
  );
}

/** A slow, faint breathing dot for "in progress": felt, not watched. */
function LiveDot() {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(o);
  }, [reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[s.liveDot, style]} />;
}

function Recap({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: boolean }) {
  return (
    <View style={s.recapItem}>
      <Text style={[s.recapVal, accent && { color: COLORS.accent }]}>
        {value}{unit ? <Text style={s.recapUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.recapLbl}>{label}</Text>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  card:      {
    marginHorizontal: 16, padding: 16, gap: 14, borderRadius: 22,
    backgroundColor: COLORS.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: COLORS.border,
  },
  head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  cardTitle: { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.text, flexShrink: 1 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta:      { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  body:      { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 21 },

  exRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  exName:    { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  exMeta:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  exMore:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },

  cta:       { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  ctaTxt:    { fontSize: 17, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: -0.2 },

  liveRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  liveTxt:   { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.accent },

  doneHead:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  recap:     { flexDirection: 'row', gap: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  recapItem: { flex: 1, gap: 3 },
  recapVal:  { fontSize: 22, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  recapUnit: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textMuted, letterSpacing: 0 },
  recapLbl:  { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  nextRow:   {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: accentA(0.08),
  },
  nextTxt:   { flexShrink: 1, fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
}));
