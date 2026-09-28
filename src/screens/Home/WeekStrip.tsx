import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterSettle } from '../../motion/presets';
import { COLORS, FONTS } from '../../constants';
import type { CycleSlot } from '../../utils/cycleView';
import { accentA, themed } from '../../theme/runtime';

interface Props {
  slots:      CycleSlot[];
  onPressDay: (slot: CycleSlot) => void;
}

function shortLabel(sl: CycleSlot): string {
  if (sl.day.isRestDay) return 'Rest';
  return sl.day.label.split(/\s+/)[0] || `Day ${sl.slot}`;
}

/**
 * The current cycle on one line: each day's name over a small marker.
 * Done days are filled, rest days dashed, today tinted in the accent.
 * Tapping a day opens its preview.
 */
export function WeekStrip({ slots, onPressDay }: Props) {
  return (
    <View style={s.row}>
      {slots.map(sl => {
        const done = sl.status === 'done';
        const missed = sl.status === 'missed';
        const rest = sl.day.isRestDay;
        const status = done ? 'done' : rest ? 'rest day' : missed ? 'not logged' : 'coming up';
        return (
          <AnimatedPressable
            key={sl.slot}
            scale="strong"
            haptic="selection"
            onPress={() => onPressDay(sl)}
            style={[s.cell, sl.isToday && s.cellToday]}
            accessibilityRole="button"
            accessibilityLabel={`Day ${sl.slot}, ${sl.day.label}, ${sl.isToday ? 'today, ' : ''}${status}`}
            accessibilityHint="Shows this day's workout"
          >
            <Text
              style={[s.label, sl.isToday && s.labelToday, missed && s.dim]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {shortLabel(sl)}
            </Text>
            <View style={[
              s.mark,
              rest && s.markRest,
              done && s.markDone,
              sl.isToday && !done && s.markToday,
            ]}>
              {done
                ? <Animated.View entering={enterSettle}><Ionicons name="checkmark" size={14} color={COLORS.background} /></Animated.View>
                : <Text style={[s.num, sl.isToday && s.numToday, missed && s.dim]}>{sl.slot}</Text>}
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  row:        { flexDirection: 'row', gap: 4 },
  cell:       { flex: 1, alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 9, borderRadius: 14 },
  cellToday:  { backgroundColor: accentA(0.12) },
  label:      { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  labelToday: { color: COLORS.accent },
  mark:       {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  markRest:   { borderStyle: 'dashed' },
  markDone:   { backgroundColor: COLORS.text, borderColor: COLORS.text },
  markToday:  { borderColor: COLORS.accent },
  num:        { fontSize: 13, fontFamily: FONTS.display, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  numToday:   { color: COLORS.accent },
  dim:        { opacity: 0.45 },
}));
