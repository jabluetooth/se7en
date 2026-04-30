import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  StyleSheet,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePlanStore } from '../../stores/planStore';
import { useSessionStore } from '../../stores/sessionStore';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { validateImportJSON } from '../../utils/importValidator';
import { WorkoutPlan, Exercise, WeightUnit, BarType, SetType } from '../../types';
import { SPACING, BORDER_RADIUS, BAR_WEIGHTS, SET_TYPE_LABELS, DEFAULT_METRIC_PLATES, DEFAULT_IMPERIAL_PLATES, SPLIT_TYPES } from '../../constants';
import { generateId } from '../../utils/idGen';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { settings, save } = useSettingsStore();
  const { plans, activePlan, createPlan, importPlan, deletePlan, setActivePlan, addExercise, updateExercise, deleteExercise, updateDay } = usePlanStore();
  const { sessions } = useSessionStore();

  const [managePlansVisible, setManagePlansVisible] = useState(false);
  const [addPlanVisible, setAddPlanVisible] = useState(false);
  const [editDayVisible, setEditDayVisible] = useState(false);
  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanSplit, setNewPlanSplit] = useState('PPL');
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [customPlate, setCustomPlate] = useState('');

  // New exercise form state
  const [exForm, setExForm] = useState<Partial<Exercise>>({
    name: '',
    setType: 'standard',
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    toFailure: false,
    targetWeight: 60,
    weightUnit: 'kg',
    barType: 'barbell',
    barWeight: 20,
    notes: '',
    order: 1,
  });

  const handleExportJSON = async () => {
    try {
      const data = {
        settings,
        plans,
        sessions: sessions.slice(-100),
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(data, null, 2);
      const path = FileSystem.documentDirectory + `se7en_export_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Se7en Data' });
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    }
  };

  const handleExportCSV = async () => {
    try {
      const rows = ['Session Date,Day,Exercise,Set,Reps,Weight,Volume,Notes'];
      for (const s of sessions) {
        for (const ex of s.exercises) {
          for (const st of ex.sets.filter((st) => st.isCompleted)) {
            const date = s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : '';
            const reps = st.actualRepsToFailure ?? st.actualReps;
            const weight = st.actualWeight ?? 0;
            const volume = reps * weight;
            rows.push(`${date},${s.dayLabel},${ex.exerciseName},${st.setNumber},${reps},${weight},${volume},"${st.notes}"`);
          }
        }
      }
      const csv = rows.join('\n');
      const path = FileSystem.documentDirectory + `se7en_export_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Se7en Data (CSV)' });
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    }
  };

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
      Alert.alert(
        'Import Plan',
        `Import "${validation.plan!.planName}"?\n${validation.warnings.length > 0 ? '\nWarnings:\n' + validation.warnings.join('\n') : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              const plan = importPlan(validation.plan!);
              Alert.alert('Success', `Plan "${plan.name}" imported.`);
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import Failed', 'Invalid JSON file.');
    }
  };

  const handleDeletePlan = (planId: string, planName: string) => {
    Alert.alert(
      'Delete Plan',
      `Delete "${planName}"? History will be retained.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlan(planId);
            if (selectedPlan?.id === planId) setSelectedPlan(null);
          },
        },
      ],
    );
  };

  const handleSwitchPlan = (planId: string) => {
    setActivePlan(planId);
    save({ activePlanId: planId, currentDayPosition: 1 });
    setManagePlansVisible(false);
  };

  const handleAddExercise = () => {
    if (!selectedPlan || !selectedDayId || !exForm.name) return;
    addExercise(selectedPlan.id, selectedDayId, {
      name: exForm.name!,
      order: exForm.order ?? 1,
      setType: exForm.setType ?? 'standard',
      supersetGroup: null,
      targetSets: exForm.targetSets ?? 3,
      targetRepsMin: exForm.toFailure ? null : exForm.targetRepsMin ?? null,
      targetRepsMax: exForm.toFailure ? null : exForm.targetRepsMax ?? null,
      toFailure: exForm.toFailure ?? false,
      targetWeight: exForm.targetWeight ?? null,
      weightUnit: exForm.weightUnit ?? 'kg',
      barType: exForm.barType ?? 'none',
      barWeight: BAR_WEIGHTS[exForm.barType ?? 'none'] ?? 0,
      perSetTargets: null,
      notes: exForm.notes ?? '',
    });
    setAddExerciseVisible(false);
    setExForm({ name: '', setType: 'standard', targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, toFailure: false, targetWeight: 60, weightUnit: 'kg', barType: 'barbell', barWeight: 20, notes: '', order: 1 });
  };

  const handleAddPlate = () => {
    const v = parseFloat(customPlate);
    if (!isNaN(v) && v > 0 && !settings.availablePlates.includes(v)) {
      save({ availablePlates: [...settings.availablePlates, v].sort((a, b) => b - a) });
    }
    setCustomPlate('');
  };

  const handleRemovePlate = (plate: number) => {
    save({ availablePlates: settings.availablePlates.filter((p) => p !== plate) });
  };

  const Section = ({ title }: { title: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

        {/* Weight Unit */}
        <Card style={styles.card}>
          <Section title="Weight & Plates" />
          <Row label="Weight Unit">
            <View style={styles.optRow}>
              {(['kg', 'lb'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.optBtn, { borderColor: settings.weightUnit === u ? colors.accent : colors.border, backgroundColor: settings.weightUnit === u ? colors.accentDim : 'transparent' }]}
                  onPress={() => save({ weightUnit: u })}
                >
                  <Text style={[styles.optText, { color: settings.weightUnit === u ? colors.accent : colors.textSecondary }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>

          <Row label="Plate System">
            <View style={styles.optRow}>
              {(['metric', 'imperial'] as const).map((ps) => (
                <TouchableOpacity
                  key={ps}
                  style={[styles.optBtn, { borderColor: settings.plateSystem === ps ? colors.accent : colors.border, backgroundColor: settings.plateSystem === ps ? colors.accentDim : 'transparent' }]}
                  onPress={() =>
                    save({
                      plateSystem: ps,
                      availablePlates: ps === 'metric' ? DEFAULT_METRIC_PLATES : DEFAULT_IMPERIAL_PLATES,
                    })
                  }
                >
                  <Text style={[styles.optText, { color: settings.plateSystem === ps ? colors.accent : colors.textSecondary }]}>
                    {ps === 'metric' ? 'Metric' : 'Imperial'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>

          {/* Plate Manager */}
          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Available Plates</Text>
          <View style={styles.plateGrid}>
            {settings.availablePlates.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.plateTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onLongPress={() => handleRemovePlate(p)}
              >
                <Text style={[styles.plateTagText, { color: colors.text }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Long-press to remove a plate</Text>
          <View style={styles.addPlateRow}>
            <TextInput
              style={[styles.addPlateInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              value={customPlate}
              onChangeText={setCustomPlate}
              placeholder="Add plate (e.g. 20)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Button label="Add" onPress={handleAddPlate} style={styles.addPlateBtn} />
          </View>
        </Card>

        {/* Theme */}
        <Card style={styles.card}>
          <Section title="Appearance" />
          <Row label="Dark Mode">
            <Switch
              value={settings.theme === 'dark'}
              onValueChange={(v) => save({ theme: v ? 'dark' : 'light' })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </Row>
        </Card>

        {/* Backup */}
        <Card style={styles.card}>
          <Section title="Backup" />
          <Row label="Auto Backup">
            <Switch
              value={settings.autoBackup}
              onValueChange={(v) => save({ autoBackup: v })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </Row>
          <Row label="Frequency">
            <View style={styles.optRow}>
              {(['daily', 'weekly'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.optBtn, { borderColor: settings.backupFrequency === f ? colors.accent : colors.border, backgroundColor: settings.backupFrequency === f ? colors.accentDim : 'transparent' }]}
                  onPress={() => save({ backupFrequency: f })}
                >
                  <Text style={[styles.optText, { color: settings.backupFrequency === f ? colors.accent : colors.textSecondary }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Row>
          {settings.lastBackupDate && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Last backup: {new Date(settings.lastBackupDate).toLocaleString()}
            </Text>
          )}
        </Card>

        {/* Export / Import */}
        <Card style={styles.card}>
          <Section title="Export & Import" />
          <View style={styles.btnGroup}>
            <Button label="Export as JSON" onPress={handleExportJSON} style={styles.exportBtn} />
            <Button label="Export as CSV" variant="secondary" onPress={handleExportCSV} style={styles.exportBtn} />
            <Button label="Import JSON Plan" variant="ghost" onPress={handleImportJSON} style={styles.exportBtn} />
          </View>
        </Card>

        {/* Manage Plans */}
        <Card style={styles.card}>
          <Section title="Workout Plans" />
          <Text style={[styles.hint, { color: colors.textMuted, marginBottom: SPACING.sm }]}>
            Active: {activePlan?.name ?? 'None'}
          </Text>
          <Button label="Manage Plans" onPress={() => setManagePlansVisible(true)} />
        </Card>

        {/* App Info */}
        <Card style={styles.card}>
          <Section title="About" />
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>Se7en · v1.0 MVP</Text>
          <Text style={[styles.aboutText, { color: colors.textMuted }]}>
            {sessions.length} sessions logged · {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </Text>
        </Card>
      </ScrollView>

      {/* Manage Plans Modal */}
      <Modal visible={managePlansVisible} title="Manage Plans" onClose={() => setManagePlansVisible(false)}>
        <ScrollView style={{ maxHeight: 400 }}>
          {plans.map((plan) => (
            <View key={plan.id} style={[styles.planRow, { borderColor: colors.border }]}>
              <View style={styles.planRowLeft}>
                <Text style={[styles.planRowName, { color: colors.text }]}>{plan.name}</Text>
                <Text style={[styles.planRowSub, { color: colors.textSecondary }]}>{plan.splitType}</Text>
                {plan.isActive && (
                  <Text style={[styles.activeBadge, { color: colors.accent }]}>✓ Active</Text>
                )}
              </View>
              <View style={styles.planRowActions}>
                {!plan.isActive && (
                  <TouchableOpacity onPress={() => handleSwitchPlan(plan.id)}>
                    <Text style={[styles.planAction, { color: colors.accent }]}>Activate</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPlan(plan);
                    setManagePlansVisible(false);
                    setEditDayVisible(true);
                  }}
                >
                  <Text style={[styles.planAction, { color: colors.textSecondary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeletePlan(plan.id, plan.name)}>
                  <Text style={[styles.planAction, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
        <Button label="+ New Plan" onPress={() => { setManagePlansVisible(false); setAddPlanVisible(true); }} style={{ marginTop: SPACING.md }} />
      </Modal>

      {/* Add Plan Modal */}
      <Modal visible={addPlanVisible} title="New Plan" onClose={() => setAddPlanVisible(false)}>
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Plan Name</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
          value={newPlanName}
          onChangeText={setNewPlanName}
          placeholder="e.g. Push Pull Legs"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Split Type</Text>
        <View style={styles.splitGrid}>
          {SPLIT_TYPES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.splitOpt, { borderColor: newPlanSplit === s ? colors.accent : colors.border, backgroundColor: newPlanSplit === s ? colors.accentDim : 'transparent' }]}
              onPress={() => setNewPlanSplit(s)}
            >
              <Text style={[styles.splitOptText, { color: newPlanSplit === s ? colors.accent : colors.text }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button
          label="Create Plan"
          onPress={() => {
            if (!newPlanName) return;
            createPlan(newPlanName, newPlanSplit);
            setNewPlanName('');
            setAddPlanVisible(false);
            setManagePlansVisible(true);
          }}
          style={{ marginTop: SPACING.md }}
        />
      </Modal>

      {/* Edit Day / Exercises Modal */}
      <Modal visible={editDayVisible} title={selectedPlan?.name ?? 'Edit Plan'} onClose={() => { setEditDayVisible(false); setManagePlansVisible(true); }}>
        <ScrollView style={{ maxHeight: 400 }}>
          {selectedPlan?.days.sort((a, b) => a.dayPosition - b.dayPosition).map((day) => (
            <View key={day.id} style={[styles.daySection, { borderColor: colors.border }]}>
              <View style={styles.daySectionHeader}>
                <Text style={[styles.daySectionTitle, { color: colors.text }]}>Day {day.dayPosition}: {day.label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    updateDay(selectedPlan.id, day.id, { isRestDay: !day.isRestDay });
                  }}
                  style={[styles.restToggle, { backgroundColor: day.isRestDay ? colors.accentDim : colors.surfaceElevated }]}
                >
                  <Text style={[styles.restToggleText, { color: day.isRestDay ? colors.accent : colors.textSecondary }]}>
                    {day.isRestDay ? 'Rest ✓' : 'Set Rest'}
                  </Text>
                </TouchableOpacity>
              </View>

              {!day.isRestDay && (
                <>
                  {day.exercises.sort((a, b) => a.order - b.order).map((ex) => (
                    <View key={ex.id} style={[styles.exRow, { borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.exRowName, { color: colors.text }]}>{ex.name}</Text>
                        <Text style={[styles.exRowDetail, { color: colors.textSecondary }]}>
                          {ex.targetSets}×{ex.toFailure ? 'Failure' : `${ex.targetRepsMin ?? '?'}${ex.targetRepsMin !== ex.targetRepsMax ? '–' + ex.targetRepsMax : ''}`} @ {ex.targetWeight ?? '?'}{ex.weightUnit}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Delete Exercise', `Remove "${ex.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteExercise(selectedPlan.id, day.id, ex.id) },
                          ]);
                        }}
                      >
                        <Text style={[styles.exDelete, { color: colors.danger }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.addExBtn, { borderColor: colors.accent }]}
                    onPress={() => {
                      setSelectedDayId(day.id);
                      setAddExerciseVisible(true);
                    }}
                  >
                    <Text style={[styles.addExText, { color: colors.accent }]}>+ Add Exercise</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      </Modal>

      {/* Add Exercise Modal */}
      <Modal visible={addExerciseVisible} title="Add Exercise" onClose={() => setAddExerciseVisible(false)}>
        <ScrollView style={{ maxHeight: 400 }}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Exercise Name</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
            value={exForm.name}
            onChangeText={(v) => setExForm((p) => ({ ...p, name: v }))}
            placeholder="e.g. Bench Press"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Set Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
              <TouchableOpacity
                key={k}
                style={[styles.setTypeOpt, { borderColor: exForm.setType === k ? colors.accent : colors.border, backgroundColor: exForm.setType === k ? colors.accentDim : 'transparent' }]}
                onPress={() => setExForm((p) => ({ ...p, setType: k as SetType, toFailure: k === 'toFailure' }))}
              >
                <Text style={[styles.setTypeText, { color: exForm.setType === k ? colors.accent : colors.textSecondary }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Sets</Text>
              <TextInput
                style={[styles.formInputSm, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                value={String(exForm.targetSets ?? '')}
                onChangeText={(v) => setExForm((p) => ({ ...p, targetSets: parseInt(v, 10) || 0 }))}
                keyboardType="numeric"
              />
            </View>
            {!exForm.toFailure && (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Reps Min</Text>
                  <TextInput
                    style={[styles.formInputSm, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                    value={String(exForm.targetRepsMin ?? '')}
                    onChangeText={(v) => setExForm((p) => ({ ...p, targetRepsMin: parseInt(v, 10) || 0 }))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Reps Max</Text>
                  <TextInput
                    style={[styles.formInputSm, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                    value={String(exForm.targetRepsMax ?? '')}
                    onChangeText={(v) => setExForm((p) => ({ ...p, targetRepsMax: parseInt(v, 10) || 0 }))}
                    keyboardType="numeric"
                  />
                </View>
              </>
            )}
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Target Weight</Text>
              <TextInput
                style={[styles.formInputSm, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                value={String(exForm.targetWeight ?? '')}
                onChangeText={(v) => setExForm((p) => ({ ...p, targetWeight: parseFloat(v) || 0 }))}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Unit</Text>
              <View style={styles.optRow}>
                {(['kg', 'lb', 'bodyweight'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitOpt, { borderColor: exForm.weightUnit === u ? colors.accent : colors.border, backgroundColor: exForm.weightUnit === u ? colors.accentDim : 'transparent' }]}
                    onPress={() => setExForm((p) => ({ ...p, weightUnit: u as WeightUnit }))}
                  >
                    <Text style={[styles.unitOptText, { color: exForm.weightUnit === u ? colors.accent : colors.textSecondary }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Bar Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['barbell', 'ezbar', 'smith', 'dumbbell', 'none'] as BarType[]).map((bt) => (
              <TouchableOpacity
                key={bt}
                style={[styles.setTypeOpt, { borderColor: exForm.barType === bt ? colors.accent : colors.border, backgroundColor: exForm.barType === bt ? colors.accentDim : 'transparent' }]}
                onPress={() => setExForm((p) => ({ ...p, barType: bt, barWeight: BAR_WEIGHTS[bt] ?? 0 }))}
              >
                <Text style={[styles.setTypeText, { color: exForm.barType === bt ? colors.accent : colors.textSecondary }]}>{bt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
            value={exForm.notes}
            onChangeText={(v) => setExForm((p) => ({ ...p, notes: v }))}
            placeholder="e.g. Control the eccentric"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </ScrollView>
        <Button label="Add Exercise" onPress={handleAddExercise} style={{ marginTop: SPACING.md }} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: SPACING.md },
  card: { marginBottom: SPACING.md },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingVertical: SPACING.sm },
  rowLabel: { fontSize: 15, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  optRow: { flexDirection: 'row', gap: SPACING.xs },
  optBtn: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  optText: { fontSize: 12, fontWeight: '700' },
  subLabel: { fontSize: 12, fontWeight: '600', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  hint: { fontSize: 11, marginBottom: SPACING.xs },
  plateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
  plateTag: { borderWidth: 1, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  plateTagText: { fontSize: 13, fontWeight: '700' },
  addPlateRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  addPlateInput: { flex: 1, borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.sm, height: 40 },
  addPlateBtn: { minHeight: 40, paddingVertical: 0 },
  btnGroup: { gap: SPACING.sm },
  exportBtn: {},
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingVertical: SPACING.sm },
  planRowLeft: { flex: 1 },
  planRowName: { fontSize: 15, fontWeight: '700' },
  planRowSub: { fontSize: 12 },
  activeBadge: { fontSize: 11, fontWeight: '700' },
  planRowActions: { flexDirection: 'row', gap: SPACING.md },
  planAction: { fontSize: 13, fontWeight: '700' },
  formLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: SPACING.sm },
  formInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, fontSize: 14, marginBottom: SPACING.xs },
  formInputSm: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, fontSize: 14, textAlign: 'center' },
  formRow: { flexDirection: 'row', gap: SPACING.sm },
  splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  splitOpt: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  splitOptText: { fontSize: 13, fontWeight: '600' },
  setTypeOpt: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4, marginRight: SPACING.xs },
  setTypeText: { fontSize: 12, fontWeight: '600' },
  unitOpt: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.xs, paddingVertical: 2, marginRight: 4 },
  unitOptText: { fontSize: 10, fontWeight: '600' },
  daySection: { borderTopWidth: 1, paddingTop: SPACING.sm, marginTop: SPACING.sm },
  daySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  daySectionTitle: { fontSize: 14, fontWeight: '700' },
  restToggle: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  restToggleText: { fontSize: 12, fontWeight: '700' },
  exRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: SPACING.xs },
  exRowName: { fontSize: 13, fontWeight: '600' },
  exRowDetail: { fontSize: 11 },
  exDelete: { fontSize: 16, padding: SPACING.xs },
  addExBtn: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, alignItems: 'center', marginTop: SPACING.sm },
  addExText: { fontSize: 13, fontWeight: '700' },
  aboutText: { fontSize: 14, marginBottom: 4 },
});
