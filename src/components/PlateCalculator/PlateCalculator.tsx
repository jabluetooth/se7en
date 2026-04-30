import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { calculatePlates } from '../../utils/plateCalculator';
import { BarType } from '../../types';
import { BAR_WEIGHTS, BORDER_RADIUS, SPACING } from '../../constants';
import { Button } from '../common/Button';

const BAR_OPTIONS: { label: string; value: BarType }[] = [
  { label: 'Barbell (20kg)', value: 'barbell' },
  { label: 'EZ Bar (10kg)', value: 'ezbar' },
  { label: 'Smith (~15kg)', value: 'smith' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'None', value: 'none' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  initialWeight?: number;
  initialBarType?: BarType;
  onApply?: (weight: number, platesPerSide: number[]) => void;
}

export function PlateCalculator({ visible, onClose, initialWeight = 60, initialBarType = 'barbell', onApply }: Props) {
  const { colors } = useTheme();
  const availablePlates = useSettingsStore((s) => s.settings.availablePlates);
  const weightUnit = useSettingsStore((s) => s.settings.weightUnit);

  const [targetWeight, setTargetWeight] = useState(String(initialWeight));
  const [barType, setBarType] = useState<BarType>(initialBarType);
  const [manualOverrides, setManualOverrides] = useState<Set<number>>(new Set());

  const barWeight = BAR_WEIGHTS[barType] ?? 0;
  const target = parseFloat(targetWeight) || 0;
  const result = calculatePlates(target, barWeight, availablePlates);

  // Apply manual overrides
  const finalPlates = result.platesPerSide.filter((_, i) => {
    const plateVal = result.platesPerSide[i];
    return !manualOverrides.has(i);
  });
  const finalTotal = barWeight + finalPlates.reduce((s, p) => s + p, 0) * 2;

  useEffect(() => {
    setTargetWeight(String(initialWeight));
    setBarType(initialBarType);
    setManualOverrides(new Set());
  }, [initialWeight, initialBarType, visible]);

  const toggleOverride = (idx: number) => {
    setManualOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const plateColors: Record<number, string> = {
    25: '#c0392b', 20: '#c0392b', 15: '#2980b9', 10: '#27ae60',
    5: '#f39c12', 2.5: '#8e44ad', 1.25: '#16a085', 45: '#c0392b',
    35: '#2980b9', 2: '#8e44ad', 1: '#16a085',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.text }]}>Plate Calculator</Text>

          {/* Target weight input */}
          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Target Weight</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              value={targetWeight}
              onChangeText={(v) => { setTargetWeight(v); setManualOverrides(new Set()); }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.unit, { color: colors.textSecondary }]}>{weightUnit === 'lb' ? 'lb' : 'kg'}</Text>
          </View>

          {/* Bar type selector */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Bar Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barScroll}>
            {BAR_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.barOption,
                  { borderColor: barType === opt.value ? colors.accent : colors.border, backgroundColor: barType === opt.value ? colors.accentDim : colors.surfaceElevated },
                ]}
                onPress={() => setBarType(opt.value)}
              >
                <Text style={[styles.barText, { color: barType === opt.value ? colors.accent : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Visual plate diagram */}
          <View style={[styles.diagram, { borderColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diagramContent}>
              {/* Left side (reversed) */}
              {[...result.platesPerSide].reverse().map((plate, idx) => {
                const realIdx = result.platesPerSide.length - 1 - idx;
                const suppressed = manualOverrides.has(realIdx);
                return (
                  <TouchableOpacity key={`L-${idx}`} onPress={() => toggleOverride(realIdx)}>
                    <View style={[styles.plate, { backgroundColor: suppressed ? colors.border : (plateColors[plate] ?? '#555'), opacity: suppressed ? 0.3 : 1 }]}>
                      <Text style={styles.plateText}>{plate}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Bar */}
              <View style={[styles.bar, { backgroundColor: colors.textMuted }]}>
                <Text style={[styles.barLabel, { color: colors.text }]}>BAR</Text>
                <Text style={[styles.barWeightLabel, { color: colors.textSecondary }]}>{barWeight}kg</Text>
              </View>

              {/* Right side */}
              {result.platesPerSide.map((plate, idx) => {
                const suppressed = manualOverrides.has(idx);
                return (
                  <TouchableOpacity key={`R-${idx}`} onPress={() => toggleOverride(idx)}>
                    <View style={[styles.plate, { backgroundColor: suppressed ? colors.border : (plateColors[plate] ?? '#555'), opacity: suppressed ? 0.3 : 1 }]}>
                      <Text style={styles.plateText}>{plate}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Weight breakdown */}
          <View style={[styles.breakdown, { backgroundColor: colors.surfaceElevated, borderRadius: BORDER_RADIUS.md }]}>
            <Text style={[styles.breakdownRow, { color: colors.textSecondary }]}>
              Bar: <Text style={{ color: colors.text }}>{barWeight}kg</Text>
              {'  '}+{'  '}
              Plates/side: <Text style={{ color: colors.text }}>{finalPlates.reduce((s, p) => s + p, 0)}kg × 2</Text>
              {'  '}={' '}
              <Text style={[styles.total, { color: colors.accent }]}>{finalTotal}kg</Text>
            </Text>
            {result.warning && Math.abs(finalTotal - target) > 0.01 && (
              <Text style={[styles.warning, { color: colors.warning }]}>
                ⚠ Closest achievable: {finalTotal}kg (target: {target}kg)
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={styles.btn} />
            <Button
              label="Apply"
              onPress={() => {
                onApply?.(finalTotal, finalPlates);
                onClose();
              }}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  handle: { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  title: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, width: 90, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  unit: { fontSize: 14 },
  barScroll: { marginBottom: SPACING.md },
  barOption: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginRight: SPACING.sm },
  barText: { fontSize: 12, fontWeight: '600' },
  diagram: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, marginVertical: SPACING.md, overflow: 'hidden' },
  diagramContent: { alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, flexDirection: 'row' },
  plate: { width: 32, height: 56, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  plateText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  bar: { width: 60, height: 24, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  barLabel: { fontSize: 10, fontWeight: '700' },
  barWeightLabel: { fontSize: 9 },
  breakdown: { padding: SPACING.md, marginBottom: SPACING.md },
  breakdownRow: { fontSize: 13 },
  total: { fontSize: 15, fontWeight: '800' },
  warning: { fontSize: 12, marginTop: SPACING.xs },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: { flex: 1 },
});
