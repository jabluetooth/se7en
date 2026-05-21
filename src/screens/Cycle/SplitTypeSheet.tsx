import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBackground } from '../../components/ui/AppBackground';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, GRAD, DAY_COLOR } from '../../constants';
import { PlanPreset } from '../../types';

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
    <TouchableOpacity onPress={onSelect} activeOpacity={0.85} style={c.cardWrap}>
      <GlassView
        radius={18}
        style={[c.card, active && c.cardActive]}
        borderColor={active ? `${BLUE}60` : 'rgba(255,240,220,0.10)'}
      >
        <View style={c.cardHeader}>
          <View style={c.cardTitles}>
            <Text style={[c.cardType, active && { color: BLUE }]}>{split.type}</Text>
            <Text style={c.cardFreq}>{split.frequency}</Text>
          </View>
          {active && (
            <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={c.checkBadge}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </LinearGradient>
          )}
        </View>

        <View style={c.grid}>
          {DAY_LABELS.map((d, i) => (
            <View key={i} style={c.gridCol}>
              <Text style={c.dayLetter}>{d}</Text>
              <View style={[c.dayBlock, { backgroundColor: split.days[i].color + (split.days[i].isRest ? '28' : '33') }]}>
                <View style={[c.dayDot, { backgroundColor: split.days[i].color + (split.days[i].isRest ? '60' : 'CC') }]} />
              </View>
              <Text style={[c.dayLabel, split.days[i].isRest && c.dayLabelRest]} numberOfLines={1}>
                {split.days[i].label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={c.desc}>{split.description}</Text>
      </GlassView>
    </TouchableOpacity>
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
    <TouchableOpacity onPress={onSelect} activeOpacity={0.85} style={c.cardWrap}>
      <GlassView
        radius={18}
        style={[c.card, active && c.cardActive]}
        borderColor={active ? 'rgba(255,140,0,0.55)' : 'rgba(255,140,0,0.22)'}
      >
        <View style={c.cardHeader}>
          <View style={c.cardTitles}>
            <View style={c.presetNameRow}>
              <View style={c.presetBadge}>
                <Text style={c.presetBadgeTxt}>PRESET</Text>
              </View>
              <Text style={[c.cardType, active && { color: COLORS.accent }]} numberOfLines={1}>
                {preset.name}
              </Text>
            </View>
            <Text style={c.cardFreq}>{preset.splitType} · {workoutDays} workout day{workoutDays !== 1 ? 's' : ''}</Text>
          </View>
          <View style={c.presetActions}>
            {active && (
              <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={c.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </LinearGradient>
            )}
            <TouchableOpacity onPress={onDelete} hitSlop={8} style={c.deleteBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger ?? '#FF6B6B'} />
            </TouchableOpacity>
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
    </TouchableOpacity>
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
  const handleDeletePreset = (preset: PlanPreset) => {
    Alert.alert(
      `Delete "${preset.name}"?`,
      'This removes the preset permanently. Your active plan is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeletePreset?.(preset.id) },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>

          <View style={c.handle} />

          <View style={c.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={c.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={c.title}>Split Type</Text>
            <View style={{ width: 60 }} />
          </View>

          <Text style={c.subtitle}>Tap a split to preview and select it</Text>

          <ScrollView contentContainerStyle={c.scroll} showsVerticalScrollIndicator={false}>

            {/* ── My Presets ── */}
            {presets.length > 0 && (
              <>
                <Text style={c.sectionLabel}>MY PRESETS</Text>
                {presets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={current === preset.name}
                    onSelect={() => { onSelectPreset?.(preset); onClose(); }}
                    onDelete={() => handleDeletePreset(preset)}
                  />
                ))}
                <Text style={c.sectionLabel}>BUILT-IN SPLITS</Text>
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
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,220,0.20)', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 4 },
  cancel:      { fontSize: 16, color: COLORS.accent, width: 60 },
  title:       { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  subtitle:    { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 16, marginTop: 6 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, paddingHorizontal: 4 },

  scroll:      { paddingHorizontal: 16 },

  cardWrap:    { marginBottom: 12 },
  card:        { padding: 16 },
  cardActive:  {},

  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  cardTitles:  { flex: 1, marginRight: 8 },
  cardType:    { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginBottom: 2 },
  cardFreq:    { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  checkBadge:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  // Preset-specific
  presetNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  presetBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,140,0,0.20)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.40)' },
  presetBadgeTxt: { fontSize: 8, fontWeight: '900', color: COLORS.accent, letterSpacing: 0.8 },
  presetActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn:      { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,107,107,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.30)' },
  presetSaved:    { fontSize: 10, color: COLORS.textLabel, marginTop: 6, fontStyle: 'italic' },

  grid:        { flexDirection: 'row', gap: 4, marginBottom: 14 },
  gridCol:     { flex: 1, alignItems: 'center', gap: 5 },
  dayLetter:   { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },
  dayBlock:    { width: '100%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayDot:      { width: 6, height: 6, borderRadius: 3 },
  dayLabel:    { fontSize: 8, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.2, textAlign: 'center' },
  dayLabelRest:{ color: COLORS.textLabel },

  desc:        { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
});
