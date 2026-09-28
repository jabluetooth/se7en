import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { enterFade } from '../../motion/presets';
import { COLORS, FONTS } from '../../constants';
import { widgetService } from '../../services/widgetService';
import {
  scheduleRestOverNotification,
  cancelRestOverNotification,
} from '../../services/notificationService';
import { themed } from '../../theme/runtime';

export interface RestContext {
  /** Changes for every new rest period, so the timer restarts cleanly. */
  id:            number;
  exerciseName:  string;
  /** Set number the user rests before, for the notification. */
  nextSetNumber: number;
  /** "Set 3 of 4", "Next: Overhead press", or a finish nudge. */
  nextLabel:     string;
  seconds:       number;
}

interface Props {
  ctx:       RestContext;
  onDismiss: () => void;
}

const ADJUST_S = 15;
const DONE_LINGER_MS = 2400;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The rest countdown, shown in the workout's bottom panel in place of the
 * Log button. Your sets stay visible above it; nothing floats over them.
 *
 * Time is kept as an absolute end timestamp, so backgrounding the app never
 * loses seconds; the bar drains on the UI thread and is re-synced from that
 * timestamp whenever the app returns to the foreground.
 */
export function RestPanel({ ctx, onDismiss }: Props) {
  const endAt = useRef(Date.now() + ctx.seconds * 1000);
  const total = useRef(ctx.seconds);
  const notifId = useRef('');
  const [remaining, setRemaining] = useState(ctx.seconds);
  const [totalShown, setTotalShown] = useState(ctx.seconds);
  const [done, setDone] = useState(false);

  // 1 = full bar, 0 = empty.
  const progress = useSharedValue(1);

  const runBar = useCallback(() => {
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
    setTotalShown(ctx.seconds);
    setDone(false);
    runBar();
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

  // The UI-thread bar pauses while the app is in the background; re-sync it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !done) runBar();
    });
    return () => sub.remove();
  }, [done, runBar]);

  // After the countdown ends, linger briefly so it registers, then hand back.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onDismiss, DONE_LINGER_MS);
    return () => clearTimeout(t);
  }, [done]);

  const adjust = (delta: number) => {
    const left = Math.max(1000, endAt.current - Date.now() + delta * 1000);
    endAt.current = Date.now() + left;
    total.current = Math.max(total.current + delta, Math.ceil(left / 1000));
    setTotalShown(total.current);
    setRemaining(Math.ceil(left / 1000));
    runBar();
    schedule(Math.ceil(left / 1000));
  };

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View entering={enterFade} style={s.wrap} accessibilityLiveRegion="polite">
      <View style={s.top}>
        <Text style={s.label} numberOfLines={1}>{done ? 'Rest over' : `Rest · then ${ctx.nextLabel}`}</Text>
        {!done && <Text style={s.of}>of {mmss(totalShown)}</Text>}
      </View>

      <Text
        style={s.time}
        accessibilityLabel={done ? 'Rest over. Go.' : `${remaining} seconds of rest left`}
      >
        {done ? 'Go' : mmss(remaining)}
      </Text>

      <View style={s.track}>
        <Animated.View style={[s.fill, barStyle]} />
      </View>

      {done ? (
        <AnimatedPressable haptic="light" style={s.go} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Continue">
          <Text style={s.goTxt}>Continue</Text>
        </AnimatedPressable>
      ) : (
        <View style={s.btns}>
          <AnimatedPressable scale="strong" haptic="selection" style={s.adj} onPress={() => adjust(-ADJUST_S)}
            accessibilityRole="button" accessibilityLabel="15 seconds less rest">
            <Text style={s.adjTxt}>−15s</Text>
          </AnimatedPressable>
          <AnimatedPressable scale="strong" haptic="selection" style={s.adj} onPress={() => adjust(ADJUST_S)}
            accessibilityRole="button" accessibilityLabel="15 seconds more rest">
            <Text style={s.adjTxt}>+15s</Text>
          </AnimatedPressable>
          <AnimatedPressable scale="strong" haptic="light" style={s.skip} onPress={onDismiss}
            accessibilityRole="button" accessibilityLabel="Skip rest">
            <Text style={s.skipTxt}>Skip rest</Text>
          </AnimatedPressable>
        </View>
      )}
    </Animated.View>
  );
}

const s = themed(() => StyleSheet.create({
  wrap:   { gap: 10 },
  top:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  label:  { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
  of:     { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  time:   { fontSize: 56, lineHeight: 60, fontFamily: FONTS.hero, color: COLORS.accent, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  track:  { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: 3, backgroundColor: COLORS.accent },
  btns:   { flexDirection: 'row', gap: 8 },
  adj:    { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated },
  adjTxt: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  skip:   { flex: 1.4, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.text },
  skipTxt:{ fontSize: 15, fontFamily: FONTS.headline, color: COLORS.background },
  go:     { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  goTxt:  { fontSize: 16, fontFamily: FONTS.display, color: COLORS.onAccent },
}));
