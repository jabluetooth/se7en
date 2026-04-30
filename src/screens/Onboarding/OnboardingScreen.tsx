import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../hooks/useTheme';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { validateImportJSON } from '../../utils/importValidator';
import { BORDER_RADIUS, SPACING, SPLIT_TYPES, DEFAULT_METRIC_PLATES, DEFAULT_IMPERIAL_PLATES } from '../../constants';

type Step = 'welcome' | 'weightSystem' | 'planSetup' | 'daySetup';

interface Props {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const { save } = useSettingsStore();
  const { createPlan, importPlan, setActivePlan } = usePlanStore();

  const [step, setStep] = useState<Step>('welcome');
  const [importMode, setImportMode] = useState(false);
  const [planName, setPlanName] = useState('My Workout Plan');
  const [splitType, setSplitType] = useState('PPL');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [plateSystem, setPlateSystem] = useState<'metric' | 'imperial'>('metric');
  const [loading, setLoading] = useState(false);

  const handleImportJSON = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const raw = JSON.parse(content);
      const validation = validateImportJSON(raw);
      if (!validation.valid) {
        Alert.alert('Import Error', validation.errors.join('\n'));
        return;
      }
      if (validation.warnings.length > 0) {
        Alert.alert('Import Warnings', validation.warnings.join('\n') + '\n\nImport anyway?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: async () => {
              const plan = importPlan(validation.plan!);
              setActivePlan(plan.id);
              await save({
                activePlanId: plan.id,
                weightUnit,
                plateSystem,
                availablePlates: plateSystem === 'metric' ? DEFAULT_METRIC_PLATES : DEFAULT_IMPERIAL_PLATES,
              });
              onComplete();
            },
          },
        ]);
        return;
      }
      const plan = importPlan(validation.plan!);
      setActivePlan(plan.id);
      await save({
        activePlanId: plan.id,
        weightUnit,
        plateSystem,
        availablePlates: plateSystem === 'metric' ? DEFAULT_METRIC_PLATES : DEFAULT_IMPERIAL_PLATES,
      });
      onComplete();
    } catch (e) {
      Alert.alert('Error', 'Failed to read file. Make sure it is a valid JSON file.');
    }
  };

  const handleStartFresh = async () => {
    setLoading(true);
    try {
      const plan = createPlan(planName || 'My Workout Plan', splitType);
      setActivePlan(plan.id);
      await save({
        activePlanId: plan.id,
        weightUnit,
        plateSystem,
        availablePlates: plateSystem === 'metric' ? DEFAULT_METRIC_PLATES : DEFAULT_IMPERIAL_PLATES,
      });
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.logo, { color: colors.accent }]}>Se7en</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your personal gym companion
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            7-day rotating workout cycles · Complete tracking · Built for progress
          </Text>
          <View style={styles.btnGroup}>
            <Button label="Start Fresh" onPress={() => { setImportMode(false); setStep('weightSystem'); }} />
            <Button
              label="Import from JSON"
              variant="secondary"
              onPress={() => { setImportMode(true); setStep('weightSystem'); }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'weightSystem') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Weight System</Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            Choose your preferred weight unit and plate system.
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Weight Unit</Text>
          <View style={styles.row}>
            {(['kg', 'lb'] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.option,
                  { borderColor: weightUnit === u ? colors.accent : colors.border, backgroundColor: weightUnit === u ? colors.accentDim : colors.surface },
                ]}
                onPress={() => setWeightUnit(u)}
              >
                <Text style={[styles.optionText, { color: weightUnit === u ? colors.accent : colors.text }]}>
                  {u.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Plate System</Text>
          <View style={styles.row}>
            {(['metric', 'imperial'] as const).map((ps) => (
              <TouchableOpacity
                key={ps}
                style={[
                  styles.option,
                  { borderColor: plateSystem === ps ? colors.accent : colors.border, backgroundColor: plateSystem === ps ? colors.accentDim : colors.surface },
                ]}
                onPress={() => setPlateSystem(ps)}
              >
                <Text style={[styles.optionText, { color: plateSystem === ps ? colors.accent : colors.text }]}>
                  {ps === 'metric' ? 'Metric (kg)' : 'Imperial (lb)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card style={styles.platePreview}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Available Plates</Text>
            <Text style={[styles.plates, { color: colors.text }]}>
              {(plateSystem === 'metric' ? DEFAULT_METRIC_PLATES : DEFAULT_IMPERIAL_PLATES)
                .map((p) => `${p}${weightUnit}`)
                .join(' · ')}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Customize plates anytime in Settings
            </Text>
          </Card>

          <Button
            label={importMode ? 'Continue to Import' : 'Continue to Plan Setup'}
            onPress={() => setStep(importMode ? 'planSetup' : 'planSetup')}
            style={styles.cta}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // planSetup
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {importMode ? (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Import Your Plan</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              Select a JSON file with your workout plan.
            </Text>
            <Button label="Choose JSON File" onPress={handleImportJSON} style={styles.cta} />
            <Button
              label="Back"
              variant="ghost"
              onPress={() => setStep('weightSystem')}
              style={styles.back}
            />
          </>
        ) : (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Name Your Plan</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
              You can configure each day's exercises from the app.
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Plan Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={planName}
              onChangeText={setPlanName}
              placeholder="e.g. Push Pull Legs"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Split Type</Text>
            <View style={styles.splitGrid}>
              {SPLIT_TYPES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.splitOption,
                    { borderColor: splitType === s ? colors.accent : colors.border, backgroundColor: splitType === s ? colors.accentDim : colors.surface },
                  ]}
                  onPress={() => setSplitType(s)}
                >
                  <Text style={[styles.optionText, { color: splitType === s ? colors.accent : colors.text }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              label="Create Plan & Start"
              onPress={handleStartFresh}
              loading={loading}
              style={styles.cta}
            />
            <Button label="Back" variant="ghost" onPress={() => setStep('weightSystem')} style={styles.back} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  logo: { fontSize: 64, fontWeight: '900', letterSpacing: -2, marginBottom: SPACING.sm },
  subtitle: { fontSize: 20, fontWeight: '600', marginBottom: SPACING.sm },
  tagline: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.xxl },
  btnGroup: { width: '100%', gap: SPACING.md },
  stepTitle: { fontSize: 26, fontWeight: '800', marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, marginBottom: SPACING.lg },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm, marginTop: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.sm },
  option: { flex: 1, borderWidth: 1.5, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center' },
  optionText: { fontSize: 14, fontWeight: '700' },
  splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  splitOption: { borderWidth: 1.5, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  platePreview: { marginTop: SPACING.md },
  plates: { fontSize: 14, fontWeight: '600', marginBottom: SPACING.xs },
  hint: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 15, marginBottom: SPACING.sm },
  cta: { marginTop: SPACING.xl },
  back: { marginTop: SPACING.sm },
});
