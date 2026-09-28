import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import * as Haptics from 'expo-haptics';
import { GlassView } from '../../components/common/GlassView';
import { WorkoutDay } from '../../types';
import { COLORS, FONTS } from '../../constants';
import { ink, themed } from '../../theme/runtime';


interface Props {
  currentDay:    WorkoutDay | undefined;
  currentDayNum: number;
  /** The day completed today, if any (looked up from session date in HomeScreen).
   *  When set, the card flips into a "today done · next up" state and the start
   *  button targets the NEXT mission rather than offering to redo today's work. */
  completedToday?: { dayLabel: string } | null;
  /** True when a workout session is actively in progress. Overrides all other states. */
  isInProgress?: boolean;
  onStart:       () => void;
  onResume?:     () => void;
}

export function MissionCard({ currentDay, currentDayNum, completedToday, isInProgress, onStart, onResume }: Props) {
  const isRest      = currentDay?.isRestDay === true || currentDay?.label?.toLowerCase() === 'rest';
  const primaryLift = currentDay?.exercises[0]?.name ?? null;
  const isDone      = !!completedToday;

  const title    = isInProgress
    ? `Day ${currentDayNum}: ${currentDay?.label ?? 'Workout'}`
    : isDone
    ? 'Today complete'
    : isRest
    ? 'Recovery Day'
    : `Day ${currentDayNum}: ${currentDay?.label ?? 'Workout'}`;

  const subtitle = isInProgress
    ? 'You have an active session running.'
    : isDone
    ? (isRest
        ? `Next: Day ${currentDayNum} — Recovery`
        : `Next: Day ${currentDayNum} — ${currentDay?.label ?? 'Workout'}`)
    : isRest
    ? 'Your muscles grow during rest — come back strong.'
    : primaryLift
    ? `Starting with ${primaryLift}`
    : `${currentDay?.exercises.length ?? 0} exercises planned`;

  // A slow, soft ripple around the status dot while a workout is ready to go;
  // still in the done state and when the OS asks for reduced motion.
  const pulse = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (isRest || (isDone && !isInProgress) || reducedMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false);
  }, [isRest, isDone, isInProgress, reducedMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 1.6 }],
    opacity: 0.4 * (1 - pulse.value),
  }));

  // Badge label adapts to state: in-progress takes priority, then done/rest/mission.
  const badgeLabel = isInProgress
    ? 'Workout in progress'
    : isDone
    ? `${completedToday!.dayLabel} done today`
    : isRest
    ? 'Rest day'
    : 'Up next';

  // Show the start button only when there's a real next workout to start AND
  // today wasn't already done (avoids tempting the user into a second session).
  const showStart = !isRest && !isDone && !isInProgress;

  return (
    <GlassView opacity="high" radius={20} style={s.card}>
      {/* Status badge */}
      <View style={s.badgeRow}>
        {/* Dot container — pulse ring behind, solid dot in front */}
        <View style={s.dotWrap}>
          {!isRest && !isDone && (
            <Animated.View style={[s.dotRing, ringStyle]} />
          )}
          <View style={[
            s.dot,
            { backgroundColor: isDone ? COLORS.accent : isRest ? COLORS.rest : COLORS.accent },
          ]} />
        </View>
        <Text style={s.badgeTxt}>{badgeLabel}</Text>
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>

      {isInProgress && (
        <AnimatedPressable
          style={s.ctaWrap}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel="Resume workout"
        >
          <Text style={s.ctaTxt}>Resume workout</Text>
        </AnimatedPressable>
      )}

      {showStart && (
        <AnimatedPressable
          style={s.ctaWrap}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onStart(); }}
          accessibilityRole="button"
          accessibilityLabel="Start session"
        >
          <Text style={s.ctaTxt}>Start workout</Text>
        </AnimatedPressable>
      )}

      {isDone && !isInProgress && (
        <View style={s.doneFooter}>
          <Text style={s.doneFooterTxt}>Come back tomorrow to start the next mission.</Text>
        </View>
      )}
    </GlassView>
  );
}

const s = themed(() => StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 8, padding: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },

  dotWrap:  { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotRing:  { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  dot:      { width: 8, height: 8, borderRadius: 4 },

  badgeTxt: { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0 },
  title:    { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.88, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 14 },
  ctaWrap:  { borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  ctaTxt:   { fontSize: 14, fontFamily: FONTS.label, color: COLORS.onAccent, letterSpacing: 0 },

  doneFooter:    { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: ink(0.08) },
  doneFooterTxt: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' },
}));
