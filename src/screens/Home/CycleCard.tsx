import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { COLORS, FONTS, GRAD } from '../../constants';
import type { CycleSlot, CycleView } from '../../utils/cycleView';
import { accentA, ink, themed } from '../../theme/runtime';

interface Props {
  view:       CycleView;
  planName:   string;
  onPressDay: (slot: CycleSlot) => void;
}

// ─── Ring geometry ────────────────────────────────────────────────────────────

const SZ = 96, C = SZ / 2, R = 45, RI = 34, GAP_DEG = 4;

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function arcPath(a0: number, a1: number) {
  const p1 = polar(R, a0), p2 = polar(R, a1), p3 = polar(RI, a1), p4 = polar(RI, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${p1.x},${p1.y} A${R},${R} 0 ${big} 1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${RI},${RI} 0 ${big} 0 ${p4.x},${p4.y} Z`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One segment of the ring; segments fade in one after another. */
function Arc({ d, fill, index, reveal }: { d: string; fill: string; index: number; reveal: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({
    fillOpacity: Math.min(1, Math.max(0, reveal.value * 1.6 - index * 0.12)),
  }));
  return <AnimatedPath d={d} fill={fill} animatedProps={props} />;
}

function arcFill(s: CycleSlot): string {
  if (s.isToday) return COLORS.accent;
  if (s.status === 'done') return accentA(0.42);
  if (s.status === 'rest' && s.isPast) return accentA(0.22);
  return ink(0.1);
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * The current cycle in one place: a ring showing how far through it you are,
 * and a row of tappable days (today highlighted, done days marked). Replaces
 * the separate orbit widget and day slider, which showed the same week twice.
 */
export function CycleCard({ view, planName, onPressDay }: Props) {
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withDelay(120, withTiming(1, { ...TIMING.emphasis, duration: 700 }));
  }, []);

  const len = view.slots.length;
  const seg = 360 / Math.max(len, 1);
  const today = view.slots.find(s => s.isToday);
  const pct = Math.round(view.progress * 100);

  return (
    <GlassView radius={22} style={s.card}>
      <View style={s.top}>
        <View
          style={s.ring}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Cycle ${view.cycleNum}, ${pct}% through. ${view.doneCount} of ${view.workoutCount} workouts done.`}
        >
          <Svg width={SZ} height={SZ}>
            <Circle cx={C} cy={C} r={RI - 1} fill={COLORS.surface} />
            {view.slots.map((sl, i) => (
              <Arc
                key={sl.slot}
                index={i}
                reveal={reveal}
                fill={arcFill(sl)}
                d={arcPath(i * seg + GAP_DEG / 2, (i + 1) * seg - GAP_DEG / 2)}
              />
            ))}
          </Svg>
          <View style={s.ringCenter} pointerEvents="none">
            <Text style={s.ringPct}>{pct}%</Text>
          </View>
        </View>

        <View style={s.info}>
          <Text style={s.plan} numberOfLines={1}>{planName}</Text>
          <Text style={s.title}>Cycle {view.cycleNum}</Text>
          <Text style={s.sub}>
            {view.doneCount} of {view.workoutCount} workout{view.workoutCount === 1 ? '' : 's'} done
            {today ? ` · day ${today.slot} of ${len}` : ''}
          </Text>
        </View>
      </View>

      <View style={s.days} accessibilityRole="tablist">
        {view.slots.map(sl => (
          <DayPill key={sl.slot} slot={sl} onPress={() => onPressDay(sl)} />
        ))}
      </View>
    </GlassView>
  );
}

function shortLabel(sl: CycleSlot): string {
  if (sl.day.isRestDay) return 'Rest';
  return sl.day.label.split(/\s+/)[0] ?? `D${sl.slot}`;
}

function DayPill({ slot: sl, onPress }: { slot: CycleSlot; onPress: () => void }) {
  const statusWord =
    sl.status === 'done' ? 'done' :
    sl.status === 'rest' ? 'rest day' :
    sl.status === 'missed' ? 'missed' : 'coming up';
  const a11y = `Day ${sl.slot}, ${sl.day.label}, ${sl.isToday ? 'today, ' : ''}${statusWord}. `
    + sl.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const content = (
    <>
      <Text style={[p.num, sl.isToday && p.numToday, sl.status === 'missed' && p.dim]}>{sl.slot}</Text>
      {sl.day.isRestDay
        ? <Ionicons name="moon-outline" size={12} color={sl.isToday ? 'rgba(0,0,0,0.6)' : COLORS.textLabel} />
        : <Text style={[p.lbl, sl.isToday && p.lblToday, sl.status === 'missed' && p.dim]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {shortLabel(sl)}
          </Text>}
      {sl.status === 'done' && !sl.isToday && <View style={p.doneDot} />}
    </>
  );

  return (
    <AnimatedPressable
      scale="strong"
      haptic="selection"
      onPress={onPress}
      style={[p.pill, sl.status === 'done' && !sl.isToday && p.pillDone]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Shows this day's workout"
    >
      {sl.isToday ? (
        <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={p.todayFill}>
          {content}
        </LinearGradient>
      ) : content}
    </AnimatedPressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = themed(() => StyleSheet.create({
  card:       { marginHorizontal: 16, padding: 16, gap: 16 },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring:       { width: SZ, height: SZ },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringPct:    { fontSize: 18, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -0.6 },
  info:       { flex: 1, minWidth: 0, gap: 3 },
  plan:       { fontSize: 11, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0 },
  title:      { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.8 },
  sub:        { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  days:       { flexDirection: 'row', gap: 6 },
}));

const p = themed(() => StyleSheet.create({
  pill:      {
    flex: 1, height: 58, borderRadius: 14, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: ink(0.04), borderWidth: 1, borderColor: ink(0.08),
  },
  pillDone:  { backgroundColor: accentA(0.1), borderColor: accentA(0.28) },
  todayFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 3 },
  num:       { fontSize: 17, fontFamily: FONTS.display, color: COLORS.textSecondary },
  numToday:  { color: COLORS.onAccent },
  lbl:       { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textLabel, letterSpacing: 0, maxWidth: '90%' },
  lblToday:  { color: 'rgba(0,0,0,0.6)' },
  dim:       { opacity: 0.45 },
  doneDot:   { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
}));
