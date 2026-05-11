import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { GRAD, COLORS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';

const PRESETS = [45, 60, 90, 120, 180, 300];

interface Props {
  exerciseName?:     string;
  setNumber?:        number;
  actualReps?:       number;
  actualWeight?:     number | null;
  weightUnit?:       string;
  nextExerciseName?: string | null;
  onClose: () => void;
}

export function RestTimerScreen({
  exerciseName     = 'Exercise',
  setNumber        = 1,
  actualReps,
  actualWeight,
  weightUnit       = 'kg',
  nextExerciseName = null,
  onClose,
}: Props) {
  const [total,   setTotal  ] = useState(90);
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(true);
  const [done,    setDone   ] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) { clearInterval(intervalRef.current!); setRunning(false); setDone(true); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, total]);

  // Auto-return to session screen 1.5 s after timer completes
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [done]);

  const startPreset = (val: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotal(val); setSeconds(val); setRunning(true); setDone(false);
  };

  const toggle = () => {
    if (done) { onClose(); return; }
    setRunning(r => !r);
  };

  const skip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(0); setRunning(false); setDone(true);
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
          <View>
            <Text style={s.headerSub}>After Set {setNumber}</Text>
            <Text style={s.headerTitle}>{exerciseName}</Text>
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
          <View style={s.ringWrap}>
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Svg width={260} height={260} viewBox="0 0 260 260">
                <Defs>
                  <SvgGrad id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%"   stopColor={urgent ? '#FF5A5A' : '#9035F0'} />
                    <Stop offset="50%"  stopColor={urgent ? '#EE4040' : '#7B5EFA'} />
                    <Stop offset="100%" stopColor={urgent ? '#E83535' : '#2ECAC4'} />
                  </SvgGrad>
                </Defs>
                <Circle cx={130} cy={130} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
                <Circle cx={130} cy={130} r={R} fill="none"
                  stroke={urgent ? 'rgba(240,80,80,0.20)' : 'rgba(123,94,250,0.16)'}
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
                  <Text style={s.timeSub}>{running ? 'resting...' : 'paused'}</Text>
                </>
              )}
            </View>
          </View>

          {/* Preset pills */}
          <View style={s.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity key={p} onPress={() => startPreset(p)} activeOpacity={0.8}
                style={[s.presetBtn, seconds === p && !done && s.presetBtnActive]}>
                {seconds === p && !done
                  ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.presetGrad}>
                      <Text style={s.presetTextActive}>{p < 60 ? p + 's' : Math.floor(p / 60) + 'min'}</Text>
                    </LinearGradient>
                  : <Text style={s.presetText}>{p < 60 ? p + 's' : Math.floor(p / 60) + 'min'}</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Adjust */}
          <View style={s.adjust}>
            <TouchableOpacity onPress={() => { setSeconds(s => Math.max(5, s - 15)); setTotal(t => Math.max(5, t - 15)); }}
              style={s.adjustBtn}><Text style={s.adjustText}>-15</Text></TouchableOpacity>
            <Text style={s.adjustLabel}>adjust</Text>
            <TouchableOpacity onPress={() => { setSeconds(s => s + 15); setTotal(t => t + 15); }}
              style={s.adjustBtn}><Text style={s.adjustText}>+15</Text></TouchableOpacity>
          </View>
        </View>

        {/* ── Next set / next exercise pill ───────────────── */}
        <GlassView radius={999} style={s.nextPill}>
          <Text style={s.nextText}>
            {nextExerciseName ? `Next: ${nextExerciseName}` : `Next: Set ${setNumber + 1}`}
          </Text>
        </GlassView>

        {/* ── Bottom controls ─────────────────────────────── */}
        <View style={s.controls}>
          <TouchableOpacity onPress={skip} style={s.skipBtn} activeOpacity={0.8}>
            <GlassView radius={14} style={s.skipInner}>
              <Text style={s.skipText}>Skip</Text>
            </GlassView>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle} style={s.mainBtn} activeOpacity={0.9}>
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
  header:           { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerSub:        { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 2 },
  headerTitle:      { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },

  summaryCard:      { marginHorizontal: 20, marginBottom: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  summaryItem:      { flex: 1, alignItems: 'center', gap: 3 },
  summaryLbl:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryVal:       { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  summaryValAccent: { color: COLORS.accent },
  summarySub:       { fontSize: 11, color: COLORS.textMuted },
  summaryLine:      { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.10)' },

  timerWrap:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: 8 },
  ringWrap:         { position: 'relative', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ringCenter:       { position: 'absolute', alignItems: 'center' },
  doneCheck:        { fontSize: 48, color: COLORS.accent, lineHeight: 56 },
  doneLbl:          { fontSize: 16, fontWeight: '700', color: COLORS.accent },
  time:             { fontSize: 54, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  timeUrgent:       { color: COLORS.danger },
  timeSub:          { fontSize: 13, color: COLORS.textSecondary },

  presets:          { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  presetBtn:        { borderRadius: 999, overflow: 'hidden' },
  presetBtnActive:  {},
  presetGrad:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  presetText:       { paddingHorizontal: 14, paddingVertical: 7, fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  presetTextActive: { fontSize: 13, fontWeight: '700', color: '#000' },

  adjust:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjustBtn:        { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  adjustText:       { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  adjustLabel:      { fontSize: 12, color: COLORS.textMuted },

  nextPill:         { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 8, marginBottom: 10 },
  nextText:         { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },

  controls:         { paddingHorizontal: 16, paddingBottom: 32, flexDirection: 'row', gap: 10 },
  skipBtn:          { borderRadius: 14 },
  skipInner:        { height: 54, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  skipText:         { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  mainBtn:          { flex: 1, borderRadius: 14, overflow: 'hidden' },
  mainGrad:         { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  mainGlass:        { height: 54, alignItems: 'center', justifyContent: 'center' },
  mainText:         { fontSize: 16, fontWeight: '900', color: '#000' },
  pauseText:        { fontSize: 16, fontWeight: '700', color: '#fff' },
});
