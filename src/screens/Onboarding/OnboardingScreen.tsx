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
import { recommendTemplates } from '../../utils/planRecommender';
import { PLAN_TEMPLATES } from '../../data/planTemplates';
import { BORDER_RADIUS, SPACING } from '../../constants';
import { UserGoal, ExperienceLevel, EquipmentType, PlanTemplate } from '../../types';

type Step = 1 | 2 | 3 | 4;

interface Props {
  onComplete: () => void;
}

const GOAL_OPTIONS: { value: UserGoal; label: string; desc: string }[] = [
  { value: 'muscle', label: 'Build Muscle', desc: 'Hypertrophy & size' },
  { value: 'strength', label: 'Get Stronger', desc: 'Heavy lifts & PRs' },
  { value: 'weightloss', label: 'Lose Weight', desc: 'Burn fat & tone up' },
  { value: 'general', label: 'Stay Active', desc: 'General fitness' },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'Under 1 year lifting' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years lifting' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years lifting' },
];

const DAYS_OPTIONS = [3, 4, 5, 6];

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string; desc: string }[] = [
  { value: 'full_gym', label: 'Full Gym', desc: 'Barbells, machines & more' },
  { value: 'home_gym', label: 'Home Gym', desc: 'Dumbbells & basic gear' },
  { value: 'bodyweight', label: 'Bodyweight', desc: 'No equipment needed' },
];

export function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const { save } = useSettingsStore();
  const { createPlanFromTemplate, setActivePlan, importPlan } = usePlanStore();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Quiz state
  const [goal, setGoal] = useState<UserGoal>('muscle');
  const [experience, setExperience] = useState<ExperienceLevel>('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipment, setEquipment] = useState<EquipmentType>('full_gym');

  // Recommendation state
  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Plan name state
  const [planName, setPlanName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinueFromQuiz = () => {
    const ids = recommendTemplates({ goal, experience, daysPerWeek, equipment });
    setRankedIds(ids);
    const topId = ids[0] ?? PLAN_TEMPLATES[0].id;
    setSelectedTemplateId(topId);
    const template = PLAN_TEMPLATES.find((t) => t.id === topId);
    setPlanName(template?.name ?? 'My Plan');
    setStep(3);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId);
    setPlanName(template?.name ?? 'My Plan');
    setShowAllTemplates(false);
    setStep(4);
  };

  const handleStartTraining = async () => {
    setLoading(true);
    try {
      const plan = createPlanFromTemplate(selectedTemplateId, planName.trim() || undefined);
      setActivePlan(plan.id);
      await save({ activePlanId: plan.id });
      onComplete();
    } catch (e) {
      Alert.alert('Error', 'Failed to create plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportJSON = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;

      const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
      if (fileInfo.exists && 'size' in fileInfo && (fileInfo.size as number) > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Import file must be under 10 MB.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const raw = JSON.parse(content);
      const validation = validateImportJSON(raw);
      if (!validation.valid) {
        Alert.alert('Import Error', validation.errors.join('\n'));
        return;
      }
      const doImport = async () => {
        const plan = importPlan(validation.plan!);
        setActivePlan(plan.id);
        await save({ activePlanId: plan.id });
        onComplete();
      };
      if (validation.warnings.length > 0) {
        Alert.alert(
          'Import Warnings',
          validation.warnings.join('\n') + '\n\nImport anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import', onPress: doImport },
          ],
        );
        return;
      }
      await doImport();
    } catch {
      Alert.alert('Error', 'Failed to read file. Make sure it is a valid JSON file.');
    }
  };

  // Dots indicator is hoisted to module scope (see end of file) so that
  // remounting the screen body on keystroke doesn't reset the indicator.

  // ─── Step 1: Welcome ────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContent}>
          <Text style={[styles.logo, { color: colors.accent }]}>Se7en</Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Your personal gym companion
          </Text>

          <View style={styles.features}>
            {[
              { icon: '🔄', text: 'Smart 7-day rotating workout cycles' },
              { icon: '📊', text: 'Track every set, rep & weight' },
              { icon: '🏆', text: 'PR detection & progress analytics' },
            ].map((f) => (
              <View key={f.icon} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Button label="Get Started" onPress={() => setStep(2)} style={styles.mainCta} />
          <TouchableOpacity onPress={handleImportJSON} style={styles.importLink}>
            <Text style={[styles.importLinkText, { color: colors.textMuted }]}>
              Import existing plan →
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Step 2: Profile Quiz ────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Dots current={2} accent={colors.accent} border={colors.border} />
          <Text style={[styles.stepTitle, { color: colors.text }]}>Tell us about yourself</Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            We'll build your perfect plan based on your answers.
          </Text>

          {/* Goal */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your Goal</Text>
          <View style={styles.cardGrid}>
            {GOAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.quizCard,
                  {
                    borderColor: goal === opt.value ? colors.accent : colors.border,
                    backgroundColor: goal === opt.value ? colors.accentDim : colors.surface,
                  },
                ]}
                onPress={() => setGoal(opt.value)}
              >
                <Text style={[styles.quizCardLabel, { color: goal === opt.value ? colors.accent : colors.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.quizCardDesc, { color: colors.textMuted }]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Experience */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Experience Level</Text>
          <View style={styles.chipRow}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    borderColor: experience === opt.value ? colors.accent : colors.border,
                    backgroundColor: experience === opt.value ? colors.accentDim : colors.surface,
                    flex: 1,
                  },
                ]}
                onPress={() => setExperience(opt.value)}
              >
                <Text style={[styles.chipText, { color: experience === opt.value ? colors.accent : colors.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.chipDesc, { color: colors.textMuted }]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Days per week */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Days Per Week</Text>
          <View style={styles.daysRow}>
            {DAYS_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dayChip,
                  {
                    borderColor: daysPerWeek === d ? colors.accent : colors.border,
                    backgroundColor: daysPerWeek === d ? colors.accentDim : colors.surface,
                  },
                ]}
                onPress={() => setDaysPerWeek(d)}
              >
                <Text style={[styles.dayChipText, { color: daysPerWeek === d ? colors.accent : colors.text }]}>
                  {d}
                </Text>
                <Text style={[styles.dayChipSub, { color: colors.textMuted }]}>days</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Equipment */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Equipment Available</Text>
          <View style={styles.chipRow}>
            {EQUIPMENT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  {
                    borderColor: equipment === opt.value ? colors.accent : colors.border,
                    backgroundColor: equipment === opt.value ? colors.accentDim : colors.surface,
                    flex: 1,
                  },
                ]}
                onPress={() => setEquipment(opt.value)}
              >
                <Text style={[styles.chipText, { color: equipment === opt.value ? colors.accent : colors.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.chipDesc, { color: colors.textMuted }]}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button label="Find My Plan" onPress={handleContinueFromQuiz} style={styles.cta} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step 3: Recommendation ──────────────────────────────────────────────────
  if (step === 3) {
    const primaryTemplate = PLAN_TEMPLATES.find((t) => t.id === rankedIds[0]);
    const altTemplates = rankedIds
      .slice(1, showAllTemplates ? undefined : 3)
      .map((id) => PLAN_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is PlanTemplate => t !== undefined);
    const remainingTemplates = showAllTemplates
      ? []
      : PLAN_TEMPLATES.filter((t) => !rankedIds.slice(0, 3).includes(t.id));

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Dots current={3} accent={colors.accent} border={colors.border} />
          <Text style={[styles.stepTitle, { color: colors.text }]}>Your Recommended Plan</Text>
          <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
            Based on your profile. Tap a plan to select it.
          </Text>

          {/* Primary recommendation */}
          {primaryTemplate && (
            <TouchableOpacity
              onPress={() => handleSelectTemplate(primaryTemplate.id)}
              activeOpacity={0.85}
            >
              <Card
                style={{ ...styles.primaryCard, borderColor: colors.accent }}
                elevated
              >
                <View style={styles.recommendedBadge}>
                  <Text style={[styles.recommendedText, { color: colors.accent }]}>★ Best Match</Text>
                </View>
                <Text style={[styles.primaryName, { color: colors.text }]}>{primaryTemplate.name}</Text>
                <Text style={[styles.primaryDesc, { color: colors.textSecondary }]}>
                  {primaryTemplate.description}
                </Text>
                <View style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: colors.accentDim }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>
                      {primaryTemplate.tags.daysPerWeek}d/week
                    </Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      {primaryTemplate.splitType}
                    </Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      {primaryTemplate.tags.experience.join(' / ')}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Use This Plan"
                  onPress={() => handleSelectTemplate(primaryTemplate.id)}
                  style={styles.primaryCta}
                />
              </Card>
            </TouchableOpacity>
          )}

          {/* Alternatives */}
          {altTemplates.length > 0 && (
            <>
              <Text style={[styles.altTitle, { color: colors.textSecondary }]}>Other Options</Text>
              {altTemplates.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleSelectTemplate(t.id)}
                  activeOpacity={0.85}
                >
                  <Card style={{ ...styles.altCard, borderColor: colors.border }}>
                    <View style={styles.altCardInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.altName, { color: colors.text }]}>{t.name}</Text>
                        <Text style={[styles.altMeta, { color: colors.textMuted }]}>
                          {t.tags.daysPerWeek}d/week · {t.splitType} · {t.tags.experience.join(' / ')}
                        </Text>
                      </View>
                      <Text style={[styles.altArrow, { color: colors.accent }]}>→</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Browse all */}
          {!showAllTemplates ? (
            <TouchableOpacity onPress={() => setShowAllTemplates(true)} style={styles.browseBtn}>
              <Text style={[styles.browseBtnText, { color: colors.textMuted }]}>
                Browse all {PLAN_TEMPLATES.length} templates ↓
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={[styles.altTitle, { color: colors.textSecondary }]}>All Templates</Text>
              {PLAN_TEMPLATES.filter((t) => !rankedIds.slice(0, 1).includes(t.id)).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleSelectTemplate(t.id)}
                  activeOpacity={0.85}
                >
                  <Card style={{ ...styles.altCard, borderColor: colors.border }}>
                    <View style={styles.altCardInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.altName, { color: colors.text }]}>{t.name}</Text>
                        <Text style={[styles.altMeta, { color: colors.textMuted }]}>
                          {t.tags.daysPerWeek}d/week · {t.splitType} · {t.tags.experience.join(' / ')}
                        </Text>
                      </View>
                      <Text style={[styles.altArrow, { color: colors.accent }]}>→</Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </>
          )}

          <View style={styles.backRow}>
            <Button label="← Back" variant="ghost" onPress={() => setStep(2)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step 4: Plan Preview ────────────────────────────────────────────────────
  const previewTemplate = PLAN_TEMPLATES.find((t) => t.id === selectedTemplateId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Dots current={4} accent={colors.accent} border={colors.border} />
        <Text style={[styles.stepTitle, { color: colors.text }]}>Plan Overview</Text>
        <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
          Name your plan and review what's included.
        </Text>

        {/* Plan name input */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Plan Name</Text>
        <TextInput
          style={[styles.nameInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={planName}
          onChangeText={setPlanName}
          placeholder="e.g. My PPL Plan"
          placeholderTextColor={colors.textMuted}
          maxLength={50}
        />

        {/* Days preview */}
        {previewTemplate && (
          <Card style={styles.previewCard}>
            {previewTemplate.days
              .sort((a, b) => a.dayPosition - b.dayPosition)
              .map((day) => (
                <View
                  key={day.dayPosition}
                  style={[styles.previewDay, { borderColor: colors.border }]}
                >
                  <View style={styles.previewDayLeft}>
                    <View
                      style={[
                        styles.dayDot,
                        { backgroundColor: day.isRestDay ? colors.border : colors.accent },
                      ]}
                    />
                    <View>
                      <Text style={[styles.previewDayLabel, { color: colors.text }]}>
                        Day {day.dayPosition} · {day.label}
                      </Text>
                      {!day.isRestDay && (
                        <Text style={[styles.previewDayExCount, { color: colors.textMuted }]}>
                          {day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  {day.isRestDay && (
                    <Text style={[styles.restBadge, { color: colors.textMuted }]}>Rest</Text>
                  )}
                </View>
              ))}
          </Card>
        )}

        <Text style={[styles.customizeHint, { color: colors.textMuted }]}>
          You can customize exercises, sets, reps & weights in Settings after setup.
        </Text>

        <Button
          label="Start Training"
          onPress={handleStartTraining}
          loading={loading}
          style={styles.cta}
        />
        <Button
          label="← Choose Different Plan"
          variant="ghost"
          onPress={() => setStep(3)}
          style={styles.backBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Welcome
  welcomeContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  logo: { fontSize: 64, fontWeight: '900', letterSpacing: -2, marginBottom: SPACING.sm },
  welcomeSubtitle: { fontSize: 18, fontWeight: '600', marginBottom: SPACING.xl },
  features: { width: '100%', gap: SPACING.md, marginBottom: SPACING.xxl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  featureIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontSize: 15, flex: 1, lineHeight: 20 },
  mainCta: { width: '100%' },
  importLink: { marginTop: SPACING.md, paddingVertical: SPACING.sm },
  importLinkText: { fontSize: 14 },

  // Shared
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  stepTitle: { fontSize: 26, fontWeight: '800', marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, lineHeight: 22, marginBottom: SPACING.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  cta: { marginTop: SPACING.xl },
  backBtn: { marginTop: SPACING.sm },

  // Dots
  dots: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg },
  dot: { height: 8, borderRadius: 4 },

  // Quiz
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quizCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  quizCardLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  quizCardDesc: { fontSize: 12 },
  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  chipDesc: { fontSize: 11, textAlign: 'center' },
  daysRow: { flexDirection: 'row', gap: SPACING.sm },
  dayChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  dayChipText: { fontSize: 20, fontWeight: '800' },
  dayChipSub: { fontSize: 11, marginTop: 2 },

  // Recommendation
  primaryCard: { marginBottom: SPACING.md, borderWidth: 2 },
  recommendedBadge: { marginBottom: SPACING.xs },
  recommendedText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  primaryName: { fontSize: 22, fontWeight: '800', marginBottom: SPACING.sm },
  primaryDesc: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  tag: { borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '600' },
  primaryCta: {},
  altTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  altCard: { marginBottom: SPACING.sm },
  altCardInner: { flexDirection: 'row', alignItems: 'center' },
  altName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  altMeta: { fontSize: 12 },
  altArrow: { fontSize: 18, fontWeight: '700', paddingLeft: SPACING.sm },
  browseBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  browseBtnText: { fontSize: 14 },
  backRow: { marginTop: SPACING.md },

  // Preview
  nameInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  previewCard: { marginBottom: SPACING.md, padding: 0, overflow: 'hidden' },
  previewDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  previewDayLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dayDot: { width: 10, height: 10, borderRadius: 5 },
  previewDayLabel: { fontSize: 14, fontWeight: '600' },
  previewDayExCount: { fontSize: 12, marginTop: 1 },
  restBadge: { fontSize: 12, fontWeight: '600' },
  customizeHint: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: SPACING.sm },
});

// Hoisted so the screen body doesn't remount the indicator on every keystroke.
// Colours travel as props since `useTheme()` lives inside the screen component.
function Dots({ current, accent, border }:
  { current: number; accent: string; border: string }) {
  return (
    <View style={styles.dots}>
      {[2, 3, 4].map(s => (
        <View
          key={s}
          style={[
            styles.dot,
            {
              backgroundColor: current >= s ? accent : border,
              width: current === s ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}
