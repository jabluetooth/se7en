import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkoutDay, WorkoutSession } from '../../types';
import { COLORS, GRAD } from '../../constants';

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

    // Rest days never show the "done" dot — even if an old completed session
    // happens to share the dayPosition currently parked at this slot.
    const hasDone = !!day && !isRest && sessions.some(
      se => se.dayPosition === day.dayPosition && se.status === 'completed',
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

          return (
            <View
              key={item.dayNum}
              style={[
                s.item,
                item.isRest ? s.itemRest :
                isPast      ? s.itemPast :
                              s.itemFuture,
              ]}
            >
              {!item.isRest && isPast && hasDone && <View style={s.doneDot} />}
              <Text style={[
                s.num,
                item.isRest ? s.numRest :
                isPast      ? s.numPast  : undefined,
              ]}>
                {item.label}
              </Text>
              <Text style={[
                s.sub,
                item.isRest ? s.subRest :
                isPast      ? s.subPast  : undefined,
              ]}>
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
  activeNum: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  activeSub: { fontSize: 8,  fontWeight: '800', color: 'rgba(0,0,0,0.55)', letterSpacing: 0.5 },

  item: {
    width: ITEM_W, height: ITEM_H,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
  },
  // Past = dim orange (inverse-opacity of the bright accent today uses).
  itemPast:   { backgroundColor: 'rgba(255,140,0,0.10)',  borderColor: 'rgba(255,140,0,0.28)'  },
  itemFuture: { backgroundColor: 'rgba(255,240,220,0.04)', borderColor: 'rgba(255,240,220,0.08)' },
  // Rest = same orange treatment as past workout days. The label content
  // ("REST") is what differentiates them, not the palette.
  itemRest:   { backgroundColor: 'rgba(255,140,0,0.10)',  borderColor: 'rgba(255,140,0,0.28)' },

  doneDot: {
    position: 'absolute', top: 6, right: 7,
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  num:     { fontSize: 18, fontWeight: '800', color: COLORS.textMuted },
  numPast: { color: COLORS.accent },
  numRest: { color: COLORS.accent },
  sub:     { fontSize: 8, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase' },
  subPast: { color: 'rgba(255,140,0,0.70)' },
  subRest: { color: 'rgba(255,140,0,0.70)' },
});
