import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Modal,
} from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { useFeedback } from '../../components/feedback/Feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppBackground } from '../../components/ui/AppBackground';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, DAY_COLOR, FONTS } from '../../constants';
import { PlanPreset } from '../../types';
import { FeedbackHost } from '../../components/feedback/Feedback';
import { accentA, dangerA, ink, themed } from '../../theme/runtime';

// ─── Split preview data ───────────────────────────────────────────────────────

interface DaySlot {
  label:  string;
  color:  string;
  isRest: boolean;
}

interface SplitDef {
  type:        string;
  description: string;
  frequency:   string;
  days:        DaySlot[];
}

const BLUE   = '#FF8C00';
const GREEN  = '#30D158';
const ORANGE = '#FF9F0A';
const RED    = '#FF6B6B';
const TEAL   = '#4ECDC4';
const PURPLE = '#C084FC';
const YELLOW = '#FFD60A';
const MUTED  = '#48484A';

const SPLITS: SplitDef[] = [
  {
    type: 'PPL',
    description: 'Push, Pull, Legs repeated twice per week for maximum frequency and volume.',
    frequency: '6 days / week',
    days: [
      { label: 'Push',  color: BLUE,   isRest: false },
      { label: 'Pull',  color: GREEN,  isRest: false },
      { label: 'Legs',  color: ORANGE, isRest: false },
      { label: 'Rest',  color: MUTED,  isRest: true  },
      { label: 'Push',  color: BLUE,   isRest: false },
      { label: 'Pull',  color: GREEN,  isRest: false },
      { label: 'Legs',  color: ORANGE, isRest: false },
    ],
  },
  {
    type: 'Arnold',
    description: 'Arnold\'s classic 6-day split — chest/back, shoulders/arms, legs, repeated.',
    frequency: '6 days / week',
    days: [
      { label: 'Ch/Bk',  color: RED,    isRest: false },
      { label: 'Sh/Arm', color: BLUE,   isRest: false },
      { label: 'Legs',   color: ORANGE, isRest: false },
      { label: 'Ch/Bk',  color: RED,    isRest: false },
      { label: 'Sh/Arm', color: BLUE,   isRest: false },
      { label: 'Legs',   color: ORANGE, isRest: false },
      { label: 'Rest',   color: MUTED,  isRest: true  },
    ],
  },
  {
    type: 'Upper/Lower',
    description: 'Upper and lower body days alternate — great for strength and hypertrophy balance.',
    frequency: '4 days / week',
    days: [
      { label: 'Upper', color: BLUE,   isRest: false },
      { label: 'Lower', color: ORANGE, isRest: false },
      { label: 'Rest',  color: MUTED,  isRest: true  },
      { label: 'Upper', color: BLUE,   isRest: false },
      { label: 'Lower', color: ORANGE, isRest: false },
      { label: 'Rest',  color: MUTED,  isRest: true  },
      { label: 'Rest',  color: MUTED,  isRest: true  },
    ],
  },
  {
    type: 'Bro Split',
    description: 'One muscle group per day. High volume per session, full week of recovery per muscle.',
    frequency: '5 days / week',
    days: [
      { label: 'Chest', color: RED,    isRest: false },
      { label: 'Back',  color: TEAL,   isRest: false },
      { label: 'Sh',    color: YELLOW, isRest: false },
      { label: 'Arms',  color: PURPLE, isRest: false },
      { label: 'Legs',  color: ORANGE, isRest: false },
      { label: 'Rest',  color: MUTED,  isRest: true  },
      { label: 'Rest',  color: MUTED,  isRest: true  },
    ],
  },
  {
    type: 'Full Body',
    description: 'Every session trains all major muscle groups. Best for beginners or busy schedules.',
    frequency: '3 days / week',
    days: [
      { label: 'Full', color: GREEN, isRest: false },
      { label: 'Rest', color: MUTED, isRest: true  },
      { label: 'Full', color: GREEN, isRest: false },
      { label: 'Rest', color: MUTED, isRest: true  },
      { label: 'Full', color: GREEN, isRest: false },
      { label: 'Rest', color: MUTED, isRest: true  },
      { label: 'Rest', color: MUTED, isRest: true  },
    ],
  },
  {
    type: 'Custom',
    description: 'Design your own split. Exercises on each day can be configured freely.',
    frequency: 'Your schedule',
    days: [
      { label: 'Day 1', color: BLUE,   isRest: false },
      { label: 'Day 2', color: GREEN,  isRest: false },
      { label: 'Day 3', color: ORANGE, isRest: false },
      { label: 'Day 4', color: PURPLE, isRest: false },
      { label: 'Day 5', color: TEAL,   isRest: false },
      { label: 'Rest',  color: MUTED,  isRest: true  },
      { label: 'Rest',  color: MUTED,  isRest: true  },
    ],
  },
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ─── Built-in split card ──────────────────────────────────────────────────────

function SplitCard({ split, active, onSelect }: {
  split:    SplitDef;
  active:   boolean;
  onSelect: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onSelect}
      style={c.cardWrap}
      accessibilityRole="button"
      accessibilityLabel={`${split.type} split, ${split.frequency}`}
      accessibilityState={{ selected: active }}
    >
      <GlassView
        radius={18}
        style={[c.card, active && c.cardActive]}
        borderColor={active ? `${BLUE}60` : ink(0.1)}
      >
        <View style={c.cardHeader}>
          <View style={c.cardTitles}>
            <Text style={[c.cardType, active && { color: COLORS.accent }]}>{split.type}</Text>
            <Text style={c.cardFreq}>{split.frequency}</Text>
          </View>
          {active && (
            <View style={[c.checkBadge, { backgroundColor: COLORS.accent }]}>
              <Ionicons name="checkmark" size={14} color={COLORS.onAccent} />
            </View>
          )}
        </View>

        <View style={c.grid}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={c.gridCol}>
              <Text style={c.dayLetter}>{d}</Text>
              <View style={[c.dayBlock, { backgroundColor: (split.days[i].isRest ? COLORS.textLabel : COLORS.accent) + (split.days[i].isRest ? '28' : '33') }]}>
                <View style={[c.dayDot, { backgroundColor: (split.days[i].isRest ? COLORS.textLabel : COLORS.accent) + (split.days[i].isRest ? '60' : 'CC') }]} />
              </View>
              <Text style={[c.dayLabel, split.days[i].isRest && c.dayLabelRest]} numberOfLines={1}>
                {split.days[i].label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={c.desc}>{split.description}</Text>
      </GlassView>
    </AnimatedPressable>
  );
}

// ─── Preset card ──────────────────────────────────────────────────────────────

function PresetCard({ preset, active, onSelect, onDelete }: {
  preset:   PlanPreset;
  active:   boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const workoutDays = preset.days.filter(d => !d.isRestDay).length;
  const savedDate   = new Date(preset.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <AnimatedPressable onPress={onSelect} style={c.cardWrap}>
      <GlassView
        radius={18}
        style={[c.card, active && c.cardActive]}
        borderColor={active ? accentA(0.55) : accentA(0.22)}
      >
        <View style={c.cardHeader}>
          <View style={c.cardTitles}>
            <View style={c.presetNameRow}>
              <View style={c.presetBadge}>
                <Text style={c.presetBadgeTxt}>Preset</Text>
              </View>
              <Text style={[c.cardType, active && { color: COLORS.accent }]} numberOfLines={1}>
                {preset.name}
              </Text>
            </View>
            <Text style={c.cardFreq}>{preset.splitType} · {workoutDays} workout day{workoutDays !== 1 ? 's' : ''}</Text>
          </View>
          <View style={c.presetActions}>
            {active && (
              <View style={[c.checkBadge, { backgroundColor: COLORS.accent }]}>
                <Ionicons name="checkmark" size={14} color={COLORS.onAccent} />
              </View>
            )}
            <AnimatedPressable
              onPress={onDelete}
              hitSlop={8}
              style={c.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel={`Delete preset ${preset.name}`}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            </AnimatedPressable>
          </View>
        </View>

        {/* Day grid from actual plan days */}
        <View style={c.grid}>
          {preset.days.map((day, i) => {
            const color = day.isRestDay ? MUTED : (DAY_COLOR[day.dayPosition] ?? BLUE);
            return (
              <View key={i} style={c.gridCol}>
                <Text style={c.dayLetter}>{DAY_LABELS[i]}</Text>
                <View style={[c.dayBlock, { backgroundColor: color + (day.isRestDay ? '28' : '33') }]}>
                  <View style={[c.dayDot, { backgroundColor: color + (day.isRestDay ? '60' : 'CC') }]} />
                </View>
                <Text style={[c.dayLabel, day.isRestDay && c.dayLabelRest]} numberOfLines={1}>
                  {day.isRestDay ? 'Rest' : day.label}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={c.desc}>
          {preset.days.filter(d => !d.isRestDay).map(d => d.label).join(' · ')}
        </Text>
        <Text style={c.presetSaved}>Saved {savedDate}</Text>
      </GlassView>
    </AnimatedPressable>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

interface Props {
  visible:          boolean;
  current:          string;
  presets?:         PlanPreset[];
  onSelect:         (splitType: string) => void;
  onSelectPreset?:  (preset: PlanPreset) => void;
  onDeletePreset?:  (id: string) => void;
  onClose:          () => void;
}

export function SplitTypeSheet({ visible, current, presets = [], onSelect, onSelectPreset, onDeletePreset, onClose }: Props) {
  const { confirm } = useFeedback();
  const handleDeletePreset = async (preset: PlanPreset) => {
    const ok = await confirm({
      title: `Delete ${preset.name}?`,
      message: 'The preset is removed. Your active plan is not affected.',
      confirmLabel: 'Delete preset',
      destructive: true,
    });
    if (ok) onDeletePreset?.(preset.id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>

          <View style={c.handle} />

          <View style={c.header}>
            <AnimatedPressable onPress={onClose}>
              <Text style={c.cancel}>Cancel</Text>
            </AnimatedPressable>
            <Text style={c.title}>Split type</Text>
            <View style={{ width: 60 }} />
          </View>


          <ScrollView contentContainerStyle={c.scroll} showsVerticalScrollIndicator={false}>

            {/* ── My Presets ── */}
            {presets.length > 0 && (
              <>
                <Text style={c.sectionLabel}>My presets</Text>
                {presets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={current === preset.name}
                    onSelect={() => { onSelectPreset?.(preset); onClose(); }}
                    onDelete={() => handleDeletePreset(preset)}
                  />
                ))}
                <Text style={c.sectionLabel}>Built-in splits</Text>
              </>
            )}

            {/* ── Built-in splits ── */}
            {SPLITS.map(split => (
              <SplitCard
                key={split.type}
                split={split}
                active={current === split.type}
                onSelect={() => { onSelect(split.type); onClose(); }}
              />
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
        <FeedbackHost />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const c = themed(() => StyleSheet.create({
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: ink(0.2), alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 },
  cancel:      { fontSize: 16, fontFamily: FONTS.body, color: COLORS.accent, width: 60 },
  title:       { fontSize: 17, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.51 },
  subtitle:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16, marginTop: 6 },

  sectionLabel: { fontSize: 12, fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0, marginBottom: 10, marginTop: 4, paddingHorizontal: 4 },

  scroll:      { paddingHorizontal: 16 },

  cardWrap:    { marginBottom: 12 },
  card:        { padding: 16 },
  cardActive:  {},

  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  cardTitles:  { flex: 1, marginRight: 8 },
  cardType:    { fontSize: 18, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.72, marginBottom: 2 },
  cardFreq:    { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  checkBadge:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  // Preset-specific
  presetNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  presetBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: accentA(0.2), borderWidth: 1, borderColor: accentA(0.4) },
  presetBadgeTxt: { fontSize: 12, fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0 },
  presetActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn:      { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: dangerA(0.12), borderWidth: 1, borderColor: dangerA(0.3) },
  presetSaved:    { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLabel, marginTop: 6, fontStyle: 'italic' },

  grid:        { flexDirection: 'row', gap: 4, marginBottom: 14 },
  gridCol:     { flex: 1, alignItems: 'center', gap: 5 },
  dayLetter:   { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  dayBlock:    { width: '100%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayDot:      { width: 6, height: 6, borderRadius: 3 },
  dayLabel:    { fontSize: 11, fontFamily: FONTS.headline, color: COLORS.textSecondary, textAlign: 'center' },
  dayLabelRest:{ color: COLORS.textLabel },

  desc:        { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 18 },
}));
