import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { WorkoutDay } from '../../types';
import { COLORS, GRAD, FONTS } from '../../constants';

// "Ready" indicator dot — was green, switched to the accent orange so the
// home cycle palette stays warm.
const GREEN = COLORS.accent;

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

  // Pulsing dot animation — disabled in the done state (no longer "ready").
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRest || (isDone && !isInProgress)) { pulse.setValue(0); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(pulse, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isRest, isDone]);

  const ringScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.25, 0] });

  // Badge label adapts to state: in-progress takes priority, then done/rest/mission.
  const badgeLabel = isInProgress
    ? 'WORKOUT IN PROGRESS'
    : isDone
    ? `TODAY · ${completedToday!.dayLabel.toUpperCase()} COMPLETE`
    : isRest
    ? 'REST DAY'
    : 'NEXT MISSION';

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
            <Animated.View style={[
              s.dotRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]} />
          )}
          <View style={[
            s.dot,
            { backgroundColor: isDone ? COLORS.accent : isRest ? COLORS.rest : GREEN },
          ]} />
        </View>
        <Text style={s.badgeTxt}>{badgeLabel}</Text>
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>

      {isInProgress && (
        <TouchableOpacity style={s.ctaWrap} onPress={onResume} activeOpacity={0.85}>
          <LinearGradient
            colors={GRAD.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGrad}
          >
            <Text style={s.ctaTxt}>RESUME</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {showStart && (
        <TouchableOpacity style={s.ctaWrap} onPress={onStart} activeOpacity={0.85}>
          <LinearGradient
            colors={GRAD.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGrad}
          >
            <Text style={s.ctaTxt}>START SESSION</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {isDone && !isInProgress && (
        <View style={s.doneFooter}>
          <Text style={s.doneFooterTxt}>Come back tomorrow to start the next mission.</Text>
        </View>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 8, padding: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },

  dotWrap:  { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotRing:  { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  dot:      { width: 8, height: 8, borderRadius: 4 },

  badgeTxt: { fontSize: 10, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0.80, textTransform: 'uppercase' },
  title:    { fontSize: 22, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.88, marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 14 },
  ctaWrap:  { borderRadius: 14, overflow: 'hidden' },
  ctaGrad:  { height: 50, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:   { fontSize: 14, fontWeight: '800', fontFamily: FONTS.label, color: '#000', letterSpacing: 1.12, textTransform: 'uppercase' },

  doneFooter:    { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  doneFooterTxt: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' },
});
