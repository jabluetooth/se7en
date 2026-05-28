import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkoutDay, WorkoutSession } from '../../types';
import { COLORS, GRAD, FONTS } from '../../constants';

interface Props {
  days:       WorkoutDay[];
  currentDay: number;        // 1–7
  sessions:   WorkoutSession[];
}

const ITEM_W    = 50;
const ITEM_H    = 64;
const ITEM_GAP  = 8;
const PAD_H     = 20;
const SCREEN_W  = Dimensions.get('window').width;

export function DaySlider({ days, currentDay, sessions }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Build 7 items by SLOT (array index + 1), not dayPosition.
  // After a Cycle-screen drag-reorder a workout may live at a different slot
  // than its stable dayPosition — slider numbers must follow the visible
  // order so "1" always means "first card in the user's cycle".
  // Sub-label shows the workout name (PUSH / PULL / LEGS / REST).
  const items = Array.from({ length: 7 }, (_, i) => {
    const slot   = i + 1;
    const day    = days[i];
    const isRest = day?.isRestDay ?? false;
    const sub    = isRest
      ? 'REST'
      : (day?.label?.split(/\s+/)[0]?.toUpperCase() ?? `D${slot}`);

    // hasDone drives the small accent dot on past pills.
    // Workout days  → real completed session (matched by stable dayPosition).
    // Rest days     → auto-done once the slot has passed (can't be marked manually).
    const isPast  = slot < currentDay;
    const hasDone = !!day && (
      (isRest && isPast) ||
      (!isRest && sessions.some(
        se => se.dayPosition === day.dayPosition && se.status === 'completed',
      ))
    );

    return { dayNum: slot, label: String(slot), sub, isRest, hasDone };
  });

  // Auto-scroll to centre current day on mount / change
  useEffect(() => {
    const idx       = items.findIndex(it => it.dayNum === currentDay);
    if (idx < 0) return;
    const itemTotal = ITEM_W + ITEM_GAP;
    const offset    = PAD_H + idx * itemTotal + ITEM_W / 2 - SCREEN_W / 2;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
    }, 80);
  }, [currentDay]);

  return (
    <View style={s.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}
        decelerationRate="fast"
      >
        {items.map(item => {
          const isCurrent = item.dayNum === currentDay;
          const isPast    = item.dayNum < currentDay;
          const hasDone   = item.hasDone;

          if (isCurrent) {
            return (
              <LinearGradient
                key={item.dayNum}
                // Rest and workout active pills share the accent gradient — same UI.
                colors={GRAD.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.activeItem}
              >
                <Text style={s.activeNum}>{item.label}</Text>
                <Text style={s.activeSub}>{item.sub}</Text>
              </LinearGradient>
            );
          }

          // Styling follows past/today/future regardless of rest-vs-workout.
          // The "REST" sub-label is what differentiates them visually — a
          // FUTURE rest day must not look identical to a past/done one, and a
          // PAST rest day shares the same "done" treatment as a finished workout.
          return (
            <View
              key={item.dayNum}
              style={[
                s.item,
                isPast ? s.itemPast : s.itemFuture,
              ]}
            >
              {isPast && hasDone && <View style={s.doneDot} />}
              <Text style={[s.num, isPast && s.numPast]}>
                {item.label}
              </Text>
              <Text style={[s.sub, isPast && s.subPast]}>
                {item.sub}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:  { paddingVertical: 6 },
  content:  { paddingHorizontal: PAD_H, gap: ITEM_GAP, alignItems: 'center' },

  activeItem: {
    width: ITEM_W, height: ITEM_H + 8,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    gap: 3,
  },
  activeNum: { fontSize: 20, fontWeight: '800', fontFamily: FONTS.display, color: '#000', letterSpacing: -0.80 },
  activeSub: { fontSize: 8,  fontWeight: '800', fontFamily: FONTS.label, color: 'rgba(0,0,0,0.55)', letterSpacing: 0.64, textTransform: 'uppercase' },

  item: {
    width: ITEM_W, height: ITEM_H,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
  },
  // Past = dim orange (inverse-opacity of the bright accent today uses).
  // Future = neutral cream — used for both upcoming workouts AND upcoming
  // rest days so a future rest never looks "done".
  itemPast:   { backgroundColor: 'rgba(255,140,0,0.10)',  borderColor: 'rgba(255,140,0,0.28)'  },
  itemFuture: { backgroundColor: 'rgba(255,240,220,0.04)', borderColor: 'rgba(255,240,220,0.08)' },

  doneDot: {
    position: 'absolute', top: 6, right: 7,
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  num:     { fontSize: 18, fontWeight: '800', fontFamily: FONTS.display, color: COLORS.textMuted },
  numPast: { color: COLORS.accent },
  sub:     { fontSize: 8, fontWeight: '600', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase' },
  subPast: { color: 'rgba(255,140,0,0.70)' },
});
