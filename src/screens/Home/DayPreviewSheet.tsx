import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterFade, enterSheet, exitFade, exitSheet } from '../../motion/presets';
import { COLORS, FONTS } from '../../constants';
import { useSettingsStore } from '../../stores/settingsStore';
import { sessionLoad } from '../../utils/volume';
import { planLabel } from '../../utils/format';
import { relativeDay, type CycleSlot } from '../../utils/cycleView';

interface Props {
  slot:      CycleSlot | null;
  /** Offered only for the workout that Home's Start button would start. */
  canStart:  boolean;
  onStart:   () => void;
  onEdit:    () => void;
  onClose:   () => void;
}

const CLOSE_MS = 240;

/**
 * Bottom sheet previewing one day of the cycle: what's planned, whether it's
 * done, and a way to start it (today's workout) or edit it (any other day).
 */
export function DayPreviewSheet({ slot, canStart, onStart, onEdit, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore(st => st.settings.defaultWeightUnit ?? 'kg');

  // Keep the last slot on screen while the sheet animates out.
  const [shown, setShown] = useState<CycleSlot | null>(slot);
  const [open, setOpen] = useState(!!slot);
  useEffect(() => {
    if (slot) { setShown(slot); setOpen(true); }
  }, [slot]);

  const close = (then?: () => void) => {
    setOpen(false);
    setTimeout(() => { setShown(null); onClose(); then?.(); }, CLOSE_MS);
  };

  if (!shown) return null;
  const { day, date, status, isToday, session } = shown;

  const statusChip = (() => {
    if (status === 'done' && session) {
      const load = sessionLoad(session.exercises, unit);
      const sets = session.exercises.reduce((a, e) => a + e.sets.filter(st => st.isCompleted).length, 0);
      return { icon: 'checkmark-circle' as const, color: COLORS.accent, text: load > 0 ? `Done · ${Math.round(load).toLocaleString()} ${unit} · ${sets} sets` : `Done · ${sets} sets` };
    }
    if (status === 'rest') return { icon: 'moon' as const, color: COLORS.rest, text: 'Rest day' };
    if (status === 'missed') return { icon: 'remove-circle-outline' as const, color: COLORS.textMuted, text: 'Not logged' };
    return isToday
      ? { icon: 'flash' as const, color: COLORS.accent, text: 'On the plan for today' }
      : { icon: 'calendar-outline' as const, color: COLORS.textSecondary, text: 'Coming up' };
  })();

  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      {open && (
        <Animated.View entering={enterFade} exiting={exitFade} style={StyleSheet.absoluteFill}>
          <Pressable style={sh.backdrop} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
      )}
      {open && (
        <Animated.View
          entering={enterSheet}
          exiting={exitSheet}
          style={[sh.sheet, { paddingBottom: insets.bottom + 16 }]}
          accessibilityViewIsModal
        >
          <View style={sh.grabber} />
          <Text style={sh.eyebrow}>Day {shown.slot} · {relativeDay(date)}</Text>
          <Text style={sh.title} accessibilityRole="header">{day.label}</Text>
          <Text style={sh.date}>{dateLabel}</Text>

          <View style={[sh.chip, { borderColor: statusChip.color + '55' }]}>
            <Ionicons name={statusChip.icon} size={15} color={statusChip.color} />
            <Text style={[sh.chipTxt, { color: statusChip.color }]}>{statusChip.text}</Text>
          </View>

          {day.isRestDay ? (
            <Text style={sh.restTxt}>Nothing planned. Recovery is part of the program.</Text>
          ) : day.exercises.length === 0 ? (
            <Text style={sh.restTxt}>No exercises yet. Add some in Cycle.</Text>
          ) : (
            <ScrollView style={sh.list} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
              {day.exercises.map((ex, i) => (
                <View key={ex.id} style={sh.row}>
                  <Text style={sh.idx}>{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={sh.exName} numberOfLines={1}>{ex.name}</Text>
                    <Text style={sh.exMeta}>{planLabel(ex)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={sh.actions}>
            {canStart && (
              <AnimatedPressable
                haptic="medium"
                style={sh.primary}
                onPress={() => close(onStart)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${day.label}`}
              >
                <Text style={sh.primaryTxt}>Start workout</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable
              style={canStart ? sh.secondary : sh.secondaryAlone}
              onPress={() => close(onEdit)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${day.label} in Cycle`}
            >
              <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
              <Text style={sh.secondaryTxt}>Edit in Cycle</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      )}
    </Modal>
  );
}

const sh = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:    {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%',
    paddingHorizontal: 20, paddingTop: 10,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: COLORS.surface, borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  grabber:  { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: 16 },
  eyebrow:  { fontSize: 11, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.88, textTransform: 'uppercase' },
  title:    { fontSize: 28, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1, marginTop: 4 },
  date:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 14, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  chipTxt:  { fontSize: 13, fontFamily: FONTS.semibold },
  restTxt:  { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 8 },
  list:     { flexGrow: 0, marginBottom: 4 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(255,240,220,0.04)' },
  idx:      { width: 20, fontSize: 14, fontFamily: FONTS.dataBold, color: COLORS.textLabel, textAlign: 'center' },
  exName:   { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
  exMeta:   { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },
  actions:  { gap: 8, marginTop: 16 },
  primary:  { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  primaryTxt: { fontSize: 16, fontFamily: FONTS.display, color: '#000' },
  secondary:  { height: 48, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryAlone: { height: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,240,220,0.14)' },
  secondaryTxt: { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
