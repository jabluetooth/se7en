import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, GRAD, SPACING, FONTS } from '../../constants';

// RPE color bands: 1-4 easy, 5-6 moderate, 7-8 hard, 9-10 max
function rpeColor(n: number): string {
  if (n <= 4) return '#30D158';
  if (n <= 6) return '#FFD60A';
  if (n <= 8) return '#FF8C00';
  return '#FF453A';
}

const RPE_LABELS: Record<number, string> = {
  1:  'Very easy',
  2:  'Easy',
  3:  'Moderate',
  4:  'Comfortable',
  5:  'Challenging',
  6:  'Hard',
  7:  'Very hard',
  8:  'Could do 2 more',
  9:  'Could do 1 more',
  10: 'Max effort',
};

interface Props {
  initialRpe?:  number;
  initialNote?: string;
  onSave:       (rpe: number, note: string) => void;
  onSkip?:      () => void;
}

export function RPEInput({ initialRpe, initialNote = '', onSave, onSkip }: Props) {
  const [selected, setSelected] = useState<number | null>(initialRpe ?? null);
  const [note, setNote]         = useState(initialNote);

  const handleSave = () => {
    if (selected === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSave(selected, note.trim());
  };

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>How did that feel?</Text>
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Skip RPE rating"
          >
            <Text style={s.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Number selector — two rows of 5 so every cell clears the 44pt touch
          target guideline even on narrow phones (a single row of 10 could not). */}
      <View accessibilityRole="radiogroup" accessibilityLabel="Rate of perceived exertion, 1 to 10">
        {[[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]].map((row, ri) => (
          <View key={ri} style={[s.grid, ri === 0 && { marginBottom: 6 }]}>
            {row.map(n => {
              const color    = rpeColor(n);
              const isActive = selected === n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => { setSelected(n); Haptics.selectionAsync().catch(() => {}); }}
                  activeOpacity={0.75}
                  style={[s.cell, isActive && { backgroundColor: color + '22', borderColor: color }]}
                  accessibilityRole="radio"
                  accessibilityLabel={`RPE ${n} — ${RPE_LABELS[n]}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[s.cellNum, { color: isActive ? color : COLORS.textMuted }]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Description label */}
      {selected !== null && (
        <Text style={[s.rpeLabel, { color: rpeColor(selected) }]}>
          RPE {selected} — {RPE_LABELS[selected]}
        </Text>
      )}

      {/* Note input */}
      <TextInput
        style={s.noteInput}
        placeholder="Add a note… (optional)"
        placeholderTextColor={COLORS.textLabel}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={200}
        accessibilityLabel="Exercise note (optional)"
      />

      {/* Save button */}
      <TouchableOpacity
        onPress={handleSave}
        activeOpacity={selected !== null ? 0.85 : 1}
        style={[s.saveWrap, selected === null && s.saveDisabled]}
        disabled={selected === null}
        accessibilityRole="button"
        accessibilityLabel="Log RPE"
        accessibilityState={{ disabled: selected === null }}
      >
        <LinearGradient colors={GRAD.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
          <Text style={s.saveTxt}>Log RPE</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { paddingTop: SPACING.md, paddingBottom: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)' },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  title:       { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textSecondary },
  skip:        { fontSize: 12, color: COLORS.textLabel, fontWeight: '600', fontFamily: FONTS.semibold },
  grid:        { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
  // Fixed 48pt height (not aspectRatio) clears the 44pt touch-target
  // guideline regardless of screen width — 5-per-row leaves plenty of
  // horizontal room even on the narrowest supported phones.
  cell:        { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.04)' },
  cellNum:     { fontSize: 14, fontWeight: '800', fontFamily: FONTS.data, letterSpacing: -0.56 },
  rpeLabel:    { fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline, marginBottom: SPACING.sm, textAlign: 'center' },
  noteInput:   { backgroundColor: 'rgba(255,240,220,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', borderRadius: 10, padding: 10, fontSize: 13, fontFamily: FONTS.body, color: COLORS.text, minHeight: 52, textAlignVertical: 'top', marginBottom: SPACING.sm },
  saveWrap:    { borderRadius: 10, overflow: 'hidden' },
  saveDisabled:{ opacity: 0.35 },
  saveBtn:     { height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  saveTxt:     { fontSize: 14, fontWeight: '800', fontFamily: FONTS.display, color: '#000', letterSpacing: -0.56 },
});
