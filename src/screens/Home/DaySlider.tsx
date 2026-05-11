import React, { useRef, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkoutDay, WorkoutSession } from '../../types';
import { COLORS, GRAD } from '../../constants';

interface Props {
  days:       WorkoutDay[];
  currentDay: number; // 1–7
  sessions:   WorkoutSession[];
}

const ITEM_W    = 50;
const ITEM_H    = 64;
const ITEM_GAP  = 8;
const PAD_H     = 20;
const SCREEN_W  = Dimensions.get('window').width;

export function DaySlider({ days, currentDay, sessions }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Index 0 = "O" (off/rest anchor), indices 1-7 = workout days
  const items = [
    { label: 'O', dayNum: 0, sub: 'OFF' },
    ...Array.from({ length: 7 }, (_, i) => {
      const dp  = i + 1;
      const day = days.find(d => d.dayPosition === dp);
      // Show first word of the day label (e.g. "Push" from "Push Day")
      const sub = day?.label?.split(' ')[0]?.toUpperCase() ?? `D${dp}`;
      return { label: String(dp), dayNum: dp, sub };
    }),
  ];

  // Auto-scroll to center current day on mount / change
  useEffect(() => {
    const idx        = currentDay; // O is index 0; day 1 is index 1 etc.
    const itemTotal  = ITEM_W + ITEM_GAP;
    const itemCenter = PAD_H + idx * itemTotal + ITEM_W / 2;
    const offset     = itemCenter - SCREEN_W / 2;
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
        {items.map((item, idx) => {
          const isCurrent = item.dayNum === currentDay;
          const isPast    = item.dayNum > 0 && item.dayNum < currentDay;
          const hasDone   = sessions.some(
            se => se.dayPosition === item.dayNum && se.status === 'completed',
          );

          if (isCurrent) {
            return (
              <LinearGradient
                key={idx}
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
              key={idx}
              style={[s.item, isPast ? s.itemPast : s.itemFuture]}
            >
              {isPast && hasDone && <View style={s.doneDot} />}
              <Text style={[s.num, isPast && s.numPast]}>{item.label}</Text>
              <Text style={[s.sub, isPast && s.subPast]}>{item.sub}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:    { paddingVertical: 6 },
  content:    { paddingHorizontal: PAD_H, gap: ITEM_GAP, alignItems: 'center' },

  activeItem: {
    width: ITEM_W, height: ITEM_H + 8,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    gap: 3,
  },
  activeNum:  { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  activeSub:  { fontSize: 8,  fontWeight: '800', color: 'rgba(0,0,0,0.55)', letterSpacing: 0.5 },

  item:       {
    width: ITEM_W, height: ITEM_H,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
  },
  itemPast:   { backgroundColor: 'rgba(123,94,250,0.10)', borderColor: 'rgba(123,94,250,0.22)' },
  itemFuture: { backgroundColor: 'rgba(255,240,220,0.04)', borderColor: 'rgba(255,240,220,0.08)' },

  doneDot:    {
    position: 'absolute', top: 6, right: 7,
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  num:        { fontSize: 18, fontWeight: '800', color: COLORS.textMuted },
  numPast:    { color: COLORS.accent },
  sub:        { fontSize: 8, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase' },
  subPast:    { color: 'rgba(123,94,250,0.65)' },
});
