import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { GRAD, COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { widgetService } from '../../services/widgetService';
import {
  scheduleRestOverNotification,
  cancelRestOverNotification,
} from '../../services/notificationService';

interface Props {
  exerciseName?:     string;
  setNumber?:        number;
  actualReps?:       number;
  actualWeight?:     number | null;
  weightUnit?:       string;
  nextExerciseName?: string | null;
  initialSecs?:      number;
  onClose: () => void;
}

export function RestTimerScreen({
  exerciseName     = 'Exercise',
  setNumber        = 1,
  actualReps,
  actualWeight,
  weightUnit       = 'kg',
  nextExerciseName = null,
  initialSecs      = 90,
  onClose,
}: Props) {
  const [total,   setTotal  ] = useState(initialSecs);
  const [seconds, setSeconds] = useState(initialSecs);
  const [running, setRunning] = useState(true);
  const [done,    setDone   ] = useState(false);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifIdRef       = useRef<string>('');
  const skippedRef       = useRef(false);

  // Schedule a background notification for when rest ends; cancel it on skip.
  useEffect(() => {
    scheduleRestOverNotification(exerciseName, setNumber + 1, initialSecs)
      .then(id => { notifIdRef.current = id; })
      .catch(() => {});
    return () => {
      if (notifIdRef.current) cancelRestOverNotification(notifIdRef.current).catch(() => {});
    };
  }, []);

  // Absolute wall-clock time when the timer should reach zero.
  // Lets us correct for time lost while the app was backgrounded.
  const endTimeRef  = useRef<number | null>(null);
  const runningRef  = useRef(running);
  runningRef.current = running;

  // Helper: start a fresh 1-second interval from a known remaining count
  const startInterval = (secs: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (secs <= 0) return;
    endTimeRef.current = Date.now() + secs * 1000;
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          endTimeRef.current = null;
          setRunning(false);
          setDone(true);
          widgetService.clearRestTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return 0;
        }
        const next = s - 1;
        widgetService.setRestTimer(next, total, exerciseName);
        return next;
      });
    }, 1000);
  };

  useEffect(() => {
    if (running && seconds > 0) {
      startInterval(seconds);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!running) endTimeRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, total]);

  // When the app returns to the foreground, recalculate remaining time from
  // the stored wall-clock end timestamp so background time is never lost.
  useEffect(() => {
    const onStateChange = (next: AppStateStatus) => {
      if (next !== 'active' || !endTimeRef.current || !runningRef.current) return;

      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));

      if (remaining === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        endTimeRef.current = null;
        setSeconds(0);
        setRunning(false);
        setDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        // Restart cleanly with the corrected count
        setSeconds(remaining);
        startInterval(remaining);
      }
    };

    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub.remove();
  }, []);

  // Auto-return to session screen 1.5 s after timer completes
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => { widgetService.clearRestTimer(); onClose(); }, 1500);
    return () => clearTimeout(t);
  }, [done]);

  // Pulse animation for the "resting..." status text — runs only while
  // the timer is actively counting down.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!running || done) {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [running, done]);

  const toggle = () => {
    if (done) {
      if (notifIdRef.current) cancelRestOverNotification(notifIdRef.current).catch(() => {});
      widgetService.clearRestTimer();
      onClose();
      return;
    }
    setRunning(r => !r);
  };

  const skip = () => {
    skippedRef.current = true;
    if (notifIdRef.current) cancelRestOverNotification(notifIdRef.current).catch(() => {});
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(0); setRunning(false); setDone(true);
    widgetService.clearRestTimer();
  };

  const pct     = seconds / total;
  const mins    = Math.floor(seconds / 60);
  const secs    = seconds % 60;
  const timeStr = mins + ':' + String(secs).padStart(2, '0');
  const urgent  = seconds <= 10 && !done;

  const R    = 108, stroke = 9;
  const circ = 2 * Math.PI * R;
  const off  = circ * (1 - pct);

  const isBodyweight = weightUnit === 'bodyweight';
  const setVolume    = !isBodyweight && actualWeight && actualReps
    ? Math.round(actualReps * actualWeight) : (actualReps ?? 0);

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ─────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerTextWrap}>
            <Text style={s.headerSub} numberOfLines={1}>After Set {setNumber}</Text>
            <Text style={s.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {exerciseName}
            </Text>
          </View>
          <Badge label="Rest" variant="rest" size="xs" />
        </View>

        {/* ── Last set summary card ───────────────────────── */}
        <GlassView radius={14} style={s.summaryCard}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLbl}>Set {setNumber}</Text>
            <Text style={s.summaryVal}>{actualReps ?? '—'}</Text>
            <Text style={s.summarySub}>reps</Text>
          </View>

          {!isBodyweight && actualWeight != null && (
            <>
              <View style={s.summaryLine} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLbl}>Weight</Text>
                <Text style={s.summaryVal}>{actualWeight}</Text>
                <Text style={s.summarySub}>{weightUnit}</Text>
              </View>
            </>
          )}

          <View style={s.summaryLine} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLbl}>Volume</Text>
            <Text style={[s.summaryVal, s.summaryValAccent]}>{setVolume}</Text>
            <Text style={s.summarySub}>{isBodyweight ? 'reps' : weightUnit}</Text>
          </View>
        </GlassView>

        {/* ── Ring timer ─────────────────────────────────── */}
        <View style={s.timerWrap}>
          {/* Next set / next exercise pill — sits above the ring */}
          <GlassView radius={999} style={s.nextPill}>
            <Text style={s.nextText}>
              {nextExerciseName ? `Next: ${nextExerciseName}` : `Next: Set ${setNumber + 1}`}
            </Text>
          </GlassView>

          <View style={s.ringWrap}>
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Svg width={260} height={260} viewBox="0 0 260 260">
                <Defs>
                  {/* Rest state uses the app's established sky-blue "rest" semantic
                      (COLORS.rest — same hue as SetLogger's inline rest timer and the
                      Rest badge) instead of a one-off green/teal gradient. */}
                  <SvgGrad id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%"   stopColor={urgent ? '#FF5A5A' : '#64D2FF'} />
                    <Stop offset="50%"  stopColor={urgent ? '#EE4040' : '#38BDF8'} />
                    <Stop offset="100%" stopColor={urgent ? '#E83535' : '#22B8E8'} />
                  </SvgGrad>
                </Defs>
                <Circle cx={130} cy={130} r={R} fill="none" stroke="rgba(255,240,220,0.08)" strokeWidth={stroke} />
                <Circle cx={130} cy={130} r={R} fill="none"
                  stroke={urgent ? 'rgba(240,80,80,0.20)' : 'rgba(100,210,255,0.18)'}
                  strokeWidth={stroke + 10} strokeDasharray={circ} strokeDashoffset={off}
                  strokeLinecap="round" rotation={-90} origin="130,130" />
                <Circle cx={130} cy={130} r={R} fill="none" stroke="url(#rg)"
                  strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off}
                  strokeLinecap="round" rotation={-90} origin="130,130" />
              </Svg>
            </View>
            <View style={s.ringCenter}>
              {done ? (
                <>
                  <Text style={s.doneCheck}>✓</Text>
                  <Text style={s.doneLbl}>Rest complete</Text>
                </>
              ) : (
                <>
                  <Text style={[s.time, urgent && s.timeUrgent]}>{timeStr}</Text>
                  <Animated.Text style={[s.timeSub, { opacity: pulse }]}>
                    {running ? 'resting...' : 'paused'}
                  </Animated.Text>
                </>
              )}
            </View>
          </View>

          {/* Adjust */}
          <View style={s.adjust}>
            <TouchableOpacity
              onPress={() => { setSeconds(s => Math.max(5, s - 15)); setTotal(t => Math.max(5, t - 15)); }}
              style={s.adjustBtn}
              accessibilityRole="button"
              accessibilityLabel="Subtract 15 seconds"
            ><Text style={s.adjustText}>-15</Text></TouchableOpacity>
            <Text style={s.adjustLabel}>adjust</Text>
            <TouchableOpacity
              onPress={() => { setSeconds(s => s + 15); setTotal(t => t + 15); }}
              style={s.adjustBtn}
              accessibilityRole="button"
              accessibilityLabel="Add 15 seconds"
            ><Text style={s.adjustText}>+15</Text></TouchableOpacity>
          </View>
        </View>

        {/* ── Bottom controls ─────────────────────────────── */}
        <View style={s.controls}>
          <TouchableOpacity
            onPress={skip}
            style={s.skipBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Skip rest"
          >
            <GlassView radius={14} style={s.skipInner}>
              <Text style={s.skipText}>Skip</Text>
            </GlassView>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggle}
            style={s.mainBtn}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={done ? 'Back to Session' : running ? 'Pause rest timer' : 'Resume rest timer'}
          >
            {(!running || done)
              ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.mainGrad}>
                  <Text style={s.mainText}>{done ? 'Back to Session' : 'Resume'}</Text>
                </LinearGradient>
              : <GlassView opacity="high" radius={14} style={s.mainGlass}>
                  <Text style={s.pauseText}>Pause</Text>
                </GlassView>}
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header:           { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, zIndex: 10 },
  headerTextWrap:   { flex: 1, minWidth: 0 },
  headerSub:        { fontSize: 13, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textMuted, marginBottom: 2 },
  headerTitle:      { fontSize: 20, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.80 },

  summaryCard:      { marginHorizontal: 20, marginBottom: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  summaryItem:      { flex: 1, alignItems: 'center', gap: 3 },
  summaryLbl:       { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.80 },
  summaryVal:       { fontSize: 22, fontWeight: '800', fontFamily: FONTS.data, color: '#fff', letterSpacing: -0.88 },
  summaryValAccent: { color: COLORS.accent },
  summarySub:       { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  summaryLine:      { width: 1, height: 40, backgroundColor: 'rgba(255,240,220,0.10)' },

  timerWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 8 },
  ringWrap:         { position: 'relative', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ringCenter:       { position: 'absolute', alignItems: 'center' },
  doneCheck:        { fontSize: 48, color: COLORS.accent, lineHeight: 56 },
  doneLbl:          { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent },
  time:             { fontSize: 54, fontWeight: '800', fontFamily: FONTS.data, color: '#fff', letterSpacing: -2.16 },
  timeUrgent:       { color: COLORS.danger },
  timeSub:          { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary },

  adjust:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjustBtn:        { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,240,220,0.06)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', alignItems: 'center', justifyContent: 'center' },
  adjustText:       { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textSecondary },
  adjustLabel:      { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted },

  nextPill:         { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  nextText:         { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', fontFamily: FONTS.medium },

  controls:         { paddingHorizontal: 16, paddingBottom: 48, flexDirection: 'row', gap: 10 },
  skipBtn:          { borderRadius: 14 },
  skipInner:        { height: 54, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  skipText:         { fontSize: 15, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  mainBtn:          { flex: 1, borderRadius: 14, overflow: 'hidden' },
  mainGrad:         { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  mainGlass:        { height: 54, alignItems: 'center', justifyContent: 'center' },
  mainText:         { fontSize: 16, fontWeight: '800', fontFamily: FONTS.display, color: '#000' },
  pauseText:        { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },
});
