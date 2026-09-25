import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, ReduceMotion, SlideInDown, SlideOutDown, cancelAnimation,
  useAnimatedProps, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { SPRING } from '../../motion/tokens';
import { COLORS, FONTS } from '../../constants';
import { widgetService } from '../../services/widgetService';
import {
  scheduleRestOverNotification,
  cancelRestOverNotification,
} from '../../services/notificationService';

export interface RestContext {
  /** Changes for every new rest period, so the bar restarts cleanly. */
  id:            number;
  exerciseName:  string;
  /** Set number the user rests before, for the notification. */
  nextSetNumber: number;
  /** "Set 3 · Bench Press", "Next up: Rows", or a finish nudge. */
  nextLabel:     string;
  seconds:       number;
}

interface Props {
  ctx:       RestContext;
  bottom:    number;
  onDismiss: () => void;
}

const RING = 58;
const STROKE = 5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const ADJUST_S = 15;
const DONE_LINGER_MS = 2400;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Rest countdown docked above the workout footer — replaces the full-screen
 * rest modal, so the next set stays visible and the list stays scrollable.
 *
 * Time is kept as an absolute end timestamp, so backgrounding the app never
 * loses seconds; the ring drains on the UI thread and is re-synced from that
 * timestamp whenever the app returns to the foreground.
 */
export function RestTimerBar({ ctx, bottom, onDismiss }: Props) {
  const endAt = useRef(Date.now() + ctx.seconds * 1000);
  const total = useRef(ctx.seconds);
  const notifId = useRef('');
  const [remaining, setRemaining] = useState(ctx.seconds);
  const [done, setDone] = useState(false);

  // 1 = full ring, 0 = empty.
  const progress = useSharedValue(1);

  const runRing = useCallback(() => {
    const leftMs = Math.max(0, endAt.current - Date.now());
    cancelAnimation(progress);
    progress.value = leftMs / (total.current * 1000);
    progress.value = withTiming(0, { duration: leftMs, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [progress]);

  const schedule = useCallback((secs: number) => {
    cancelRestOverNotification(notifId.current).catch(() => {});
    notifId.current = '';
    if (secs <= 0) return;
    scheduleRestOverNotification(ctx.exerciseName, ctx.nextSetNumber, secs)
      .then(id => { notifId.current = id; })
      .catch(() => {});
  }, [ctx.exerciseName, ctx.nextSetNumber]);

  // Start (and restart for every new rest period).
  useEffect(() => {
    endAt.current = Date.now() + ctx.seconds * 1000;
    total.current = ctx.seconds;
    setRemaining(ctx.seconds);
    setDone(false);
    runRing();
    schedule(ctx.seconds);
    return () => {
      cancelRestOverNotification(notifId.current).catch(() => {});
      widgetService.clearRestTimer();
    };
  }, [ctx.id]);

  // Tick from the wall clock, not by counting intervals.
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(prev => {
        if (prev !== left && left > 0) widgetService.setRestTimer(left, total.current, ctx.exerciseName);
        return left;
      });
      if (left === 0) {
        setDone(true);
        widgetService.clearRestTimer();
        fireHaptic('success');
      }
    }, 250);
    return () => clearInterval(t);
  }, [done, ctx.id]);

  // The UI-thread ring pauses while the app is in the background; re-sync it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !done) runRing();
    });
    return () => sub.remove();
  }, [done, runRing]);

  // After "go", linger briefly so the user sees it, then slide away.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onDismiss, DONE_LINGER_MS);
    return () => clearTimeout(t);
  }, [done]);

  const adjust = (delta: number) => {
    const left = Math.max(1000, endAt.current - Date.now() + delta * 1000);
    endAt.current = Date.now() + left;
    total.current = Math.max(total.current + delta, Math.ceil(left / 1000));
    setRemaining(Math.ceil(left / 1000));
    runRing();
    schedule(Math.ceil(left / 1000));
  };

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - progress.value) }));

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(SPRING.gentle.damping).stiffness(SPRING.gentle.stiffness)}
      exiting={SlideOutDown.duration(220)}
      style={[s.bar, done && s.barDone, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      <View style={s.ringWrap}>
        <Svg width={RING} height={RING} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,240,220,0.10)" strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={RING / 2} cy={RING / 2} r={R}
            stroke={done ? COLORS.accent : COLORS.rest}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRC}
            animatedProps={ringProps}
          />
        </Svg>
        <View style={s.ringCenter} pointerEvents="none">
          {done
            ? <Ionicons name="flash" size={22} color={COLORS.accent} />
            : <Ionicons name="hourglass-outline" size={18} color={COLORS.rest} />}
        </View>
      </View>

      <View style={s.textCol}>
        <Text style={[s.label, done && { color: COLORS.accent }]}>{done ? 'Rest over' : 'Resting'}</Text>
        <Text
          style={[s.time, done && { color: COLORS.accent }]}
          accessibilityLabel={done ? 'Rest over, go' : `${remaining} seconds of rest left`}
        >
          {done ? 'Go!' : mmss(remaining)}
        </Text>
        <Text style={s.next} numberOfLines={1}>{ctx.nextLabel}</Text>
      </View>

      {done ? (
        <AnimatedPressable
          scale="strong"
          style={s.goBtn}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss rest timer"
        >
          <Text style={s.goTxt}>OK</Text>
        </AnimatedPressable>
      ) : (
        <View style={s.actions}>
          <AnimatedPressable scale="strong" haptic="selection" style={s.adj} onPress={() => adjust(-ADJUST_S)}
            accessibilityRole="button" accessibilityLabel="15 seconds less rest">
            <Text style={s.adjTxt}>−15</Text>
          </AnimatedPressable>
          <AnimatedPressable scale="strong" haptic="selection" style={s.adj} onPress={() => adjust(ADJUST_S)}
            accessibilityRole="button" accessibilityLabel="15 seconds more rest">
            <Text style={s.adjTxt}>+15</Text>
          </AnimatedPressable>
          <AnimatedPressable scale="strong" haptic="light" style={s.skip} onPress={onDismiss}
            accessibilityRole="button" accessibilityLabel="Skip rest">
            <Ionicons name="play-skip-forward" size={18} color={COLORS.text} />
          </AnimatedPressable>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingLeft: 12, paddingRight: 10,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(100,210,255,0.28)',
    backgroundColor: '#12161B',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  barDone:    { borderColor: 'rgba(255,140,0,0.45)', backgroundColor: '#1C140B' },
  ringWrap:   { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  textCol:    { flex: 1, minWidth: 0 },
  label:      { fontSize: 11, fontFamily: FONTS.label, color: COLORS.rest, textTransform: 'uppercase', letterSpacing: 0.8 },
  time:       { fontSize: 26, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -1, fontVariant: ['tabular-nums'], marginVertical: 1 },
  next:       { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  actions:    { flexDirection: 'row', gap: 6 },
  adj:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,240,220,0.06)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  adjTxt:     { fontSize: 13, fontFamily: FONTS.dataBold, color: COLORS.textSecondary },
  skip:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,210,255,0.14)' },
  goBtn:      { height: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  goTxt:      { fontSize: 15, fontFamily: FONTS.headline, color: '#000' },
});
