import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInLeft, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { DRIFT, EASE_OUT, TIMING } from '../../motion/tokens';
import { enterRise } from '../../motion/presets';
import { useFeedback } from '../../components/feedback/Feedback';
import { AppBackground } from '../../components/ui/AppBackground';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { validateImportJSON } from '../../utils/importValidator';
import { recommendTemplates } from '../../utils/planRecommender';
import { PLAN_TEMPLATES } from '../../data/planTemplates';
import { COLORS, FONTS } from '../../constants';
import { UserGoal, ExperienceLevel, EquipmentType, PlanTemplate } from '../../types';
import { accentA, ink, themed } from '../../theme/runtime';

interface Props {
  onComplete: () => void;
}

type Icon = keyof typeof Ionicons.glyphMap;
type Unit = 'kg' | 'lb';

// ─── Questions ────────────────────────────────────────────────────────────────

const GOALS: { value: UserGoal; label: string; desc: string; icon: Icon }[] = [
  { value: 'muscle',     label: 'Build muscle',  desc: 'Size and definition',   icon: 'fitness-outline' },
  { value: 'strength',   label: 'Get stronger',  desc: 'Heavier lifts and PRs', icon: 'barbell-outline' },
  { value: 'weightloss', label: 'Lose weight',   desc: 'Burn fat, stay strong', icon: 'flame-outline' },
  { value: 'general',    label: 'Stay active',   desc: 'General fitness',       icon: 'walk-outline' },
];

const EXPERIENCE: { value: ExperienceLevel; label: string; desc: string; icon: Icon }[] = [
  { value: 'beginner',     label: 'New to lifting',  desc: 'Under a year',  icon: 'leaf-outline' },
  { value: 'intermediate', label: 'Some experience', desc: '1 to 3 years',  icon: 'trending-up-outline' },
  { value: 'advanced',     label: 'Experienced',     desc: '3+ years',      icon: 'ribbon-outline' },
];

const DAYS: { value: number; desc: string }[] = [
  { value: 3, desc: 'A steady start' },
  { value: 4, desc: 'Balanced' },
  { value: 5, desc: 'Committed' },
  { value: 6, desc: 'All in' },
];

const EQUIPMENT: { value: EquipmentType; label: string; desc: string; icon: Icon }[] = [
  { value: 'full_gym',   label: 'Full gym',   desc: 'Barbells, machines and more', icon: 'business-outline' },
  { value: 'home_gym',   label: 'Home gym',   desc: 'Dumbbells and basic gear',    icon: 'home-outline' },
  { value: 'bodyweight', label: 'No equipment', desc: 'Bodyweight only',           icon: 'body-outline' },
];

const UNITS: { value: Unit; label: string; desc: string }[] = [
  { value: 'kg', label: 'Kilograms', desc: 'kg' },
  { value: 'lb', label: 'Pounds',    desc: 'lb' },
];

// Every screen after the welcome, in order. The progress bar counts these.
const STEPS = ['goal', 'experience', 'days', 'equipment', 'units', 'plan', 'review'] as const;
type Step = 'welcome' | typeof STEPS[number];

/** How long a picked answer stays highlighted before moving on. */
const ADVANCE_MS = 220;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function OnboardingScreen({ onComplete }: Props) {
  const { save } = useSettingsStore();
  const { createPlanFromTemplate, setActivePlan, importPlan } = usePlanStore();
  const { toast, confirm } = useFeedback();

  const [step, setStep] = useState<Step>('welcome');
  const [direction, setDirection] = useState<1 | -1>(1);

  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [planName, setPlanName] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  const go = (next: Step, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setStep(next);
  };
  const back = () => {
    const i = STEPS.indexOf(step as typeof STEPS[number]);
    go(i <= 0 ? 'welcome' : STEPS[i - 1], -1);
  };

  /** Record an answer, let the highlight register, then move on. */
  const pick = <T,>(setter: (v: T) => void, value: T, next: Step) => {
    fireHaptic('selection');
    setter(value);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(next), ADVANCE_MS);
  };

  const ranked = useMemo(() => {
    if (!goal || !experience || !daysPerWeek || !equipment) return [];
    return recommendTemplates({ goal, experience, daysPerWeek, equipment });
  }, [goal, experience, daysPerWeek, equipment]);

  const chooseTemplate = (id: string) => {
    fireHaptic('selection');
    setTemplateId(id);
    setPlanName(PLAN_TEMPLATES.find(t => t.id === id)?.name ?? 'My plan');
    go('review');
  };

  const handleStartTraining = async () => {
    setLoading(true);
    try {
      const chosenUnit = unit ?? 'kg';
      const plan = createPlanFromTemplate(templateId, planName.trim() || undefined, chosenUnit);
      setActivePlan(plan.id);
      await save({ activePlanId: plan.id, defaultWeightUnit: chosenUnit });
      fireHaptic('success');
      onComplete();
    } catch {
      toast.error('Could not create your plan. Please try again.');
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
        toast.error('That file is over 10 MB. Pick a smaller plan file.', { title: 'File too large' });
        return;
      }

      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const raw = JSON.parse(content);
      const validation = validateImportJSON(raw);

      if (!validation.valid) {
        toast.error(validation.errors.join('\n'), { title: 'That plan could not be imported', duration: 6000 });
        return;
      }

      const doImport = async () => {
        const plan = importPlan(validation.plan!);
        setActivePlan(plan.id);
        await save({ activePlanId: plan.id });
        onComplete();
      };

      if (validation.warnings.length > 0) {
        const ok = await confirm({
          title: 'Import anyway?',
          message: validation.warnings.join('\n'),
          confirmLabel: 'Import plan',
        });
        if (ok) await doImport();
        return;
      }
      await doImport();
    } catch {
      toast.error('Could not read that file. Make sure it is a Se7en plan (.json).');
    }
  };

  // ── Welcome ─────────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <View style={{ flex: 1 }}>
        <AppBackground />
        <SafeAreaView style={w.wrap}>
          <Animated.View entering={enterRise(0)} style={w.brand}>
            <Image source={require('../../../assets/icon.png')} style={w.logo} accessibilityIgnoresInvertColors />
            <Text style={w.title}>Se7en</Text>
            <Text style={w.subtitle}>Your training, one week at a time.</Text>
          </Animated.View>

          <Animated.View entering={enterRise(1)} style={w.features}>
            {([
              ['sync-outline', 'A 7-day cycle that rolls with your life'],
              ['barbell-outline', 'Log every set in a tap, with last time shown'],
              ['trophy-outline', 'See personal records the moment you set them'],
            ] as [Icon, string][]).map(([icon, text]) => (
              <View key={text} style={w.feature}>
                <View style={w.featureIcon}><Ionicons name={icon} size={18} color={COLORS.accent} /></View>
                <Text style={w.featureText}>{text}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={enterRise(2)} style={w.actions}>
            <PrimaryButton label="Get started" onPress={() => go('goal')} />
            <AnimatedPressable style={w.link} onPress={handleImportJSON} accessibilityRole="button" accessibilityLabel="Import an existing plan file">
              <Text style={w.linkTxt}>I have a plan file to import</Text>
            </AnimatedPressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Question steps ──────────────────────────────────────────────────────────
  const index = STEPS.indexOf(step);
  const entering = (direction > 0 ? FadeInRight : FadeInLeft)
    .duration(TIMING.standard.duration)
    .easing(EASE_OUT)
    .withInitialValues({ opacity: 0, transform: [{ translateX: direction * DRIFT * 3 }] });

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={q.top}>
          <AnimatedPressable scale="strong" style={q.backBtn} onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </AnimatedPressable>
          <ProgressBar value={(index + 1) / STEPS.length} />
          <Text style={q.count} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>{index + 1}/{STEPS.length}</Text>
        </View>

        <ScrollView contentContainerStyle={q.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View key={step} entering={entering}>
            {step === 'goal' && (
              <Question title="What's your main goal?" sub="We'll match you with a plan built for it.">
                {GOALS.map(o => (
                  <OptionCard key={o.value} icon={o.icon} label={o.label} desc={o.desc}
                    selected={goal === o.value} onPress={() => pick(setGoal, o.value, 'experience')} />
                ))}
              </Question>
            )}

            {step === 'experience' && (
              <Question title="How long have you been lifting?" sub="So the volume and exercises suit you.">
                {EXPERIENCE.map(o => (
                  <OptionCard key={o.value} icon={o.icon} label={o.label} desc={o.desc}
                    selected={experience === o.value} onPress={() => pick(setExperience, o.value, 'days')} />
                ))}
              </Question>
            )}

            {step === 'days' && (
              <Question title="How many days a week can you train?" sub="Be realistic. You can change this later.">
                <View style={q.grid}>
                  {DAYS.map(o => (
                    <AnimatedPressable
                      key={o.value}
                      scale="subtle"
                      style={[q.dayCard, daysPerWeek === o.value && q.cardSelected]}
                      onPress={() => pick(setDaysPerWeek, o.value, 'equipment')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: daysPerWeek === o.value }}
                      accessibilityLabel={`${o.value} days a week, ${o.desc}`}
                    >
                      <Text style={[q.dayNum, daysPerWeek === o.value && { color: COLORS.accent }]}>{o.value}</Text>
                      <Text style={q.dayLbl}>days a week</Text>
                      <Text style={q.dayDesc}>{o.desc}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </Question>
            )}

            {step === 'equipment' && (
              <Question title="Where will you train?" sub="We'll only pick exercises you can actually do.">
                {EQUIPMENT.map(o => (
                  <OptionCard key={o.value} icon={o.icon} label={o.label} desc={o.desc}
                    selected={equipment === o.value} onPress={() => pick(setEquipment, o.value, 'units')} />
                ))}
              </Question>
            )}

            {step === 'units' && (
              <Question title="Kilograms or pounds?" sub="Used for every weight in the app. Change it any time in Settings.">
                <View style={q.grid}>
                  {UNITS.map(o => (
                    <AnimatedPressable
                      key={o.value}
                      scale="subtle"
                      style={[q.dayCard, unit === o.value && q.cardSelected]}
                      onPress={() => pick(setUnit, o.value, 'plan')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: unit === o.value }}
                      accessibilityLabel={o.label}
                    >
                      <Text style={[q.dayNum, unit === o.value && { color: COLORS.accent }]}>{o.desc}</Text>
                      <Text style={q.dayLbl}>{o.label}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </Question>
            )}

            {step === 'plan' && (
              <PlanPicker ranked={ranked} showAll={showAll} onShowAll={() => setShowAll(true)} onChoose={chooseTemplate} />
            )}

            {step === 'review' && (
              <Review
                template={PLAN_TEMPLATES.find(t => t.id === templateId)}
                planName={planName}
                onName={setPlanName}
                loading={loading}
                onStart={handleStartTraining}
              />
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const v = useSharedValue(value);
  useEffect(() => { v.value = withTiming(value, TIMING.emphasis); }, [value]);
  const fill = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));
  return (
    <View style={q.track}>
      <Animated.View style={[q.trackFill, fill]} />
    </View>
  );
}

function Question({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={q.title} accessibilityRole="header">{title}</Text>
      <Text style={q.sub}>{sub}</Text>
      <View style={q.options}>{children}</View>
    </View>
  );
}

function OptionCard({ icon, label, desc, selected, onPress }:
  { icon: Icon; label: string; desc: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      scale="subtle"
      style={[q.option, selected && q.cardSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${desc}`}
    >
      <View style={[q.optionIcon, selected && { backgroundColor: accentA(0.18) }]}>
        <Ionicons name={icon} size={20} color={selected ? COLORS.accent : COLORS.textSecondary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[q.optionLabel, selected && { color: COLORS.accent }]}>{label}</Text>
        <Text style={q.optionDesc}>{desc}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? COLORS.accent : ink(0.18)}
      />
    </AnimatedPressable>
  );
}

function templateMeta(t: PlanTemplate): string {
  return `${t.tags.daysPerWeek} days a week · ${t.splitType} · ${t.tags.experience.join(' / ')}`;
}

function PlanPicker({ ranked, showAll, onShowAll, onChoose }:
  { ranked: string[]; showAll: boolean; onShowAll: () => void; onChoose: (id: string) => void }) {
  const best = PLAN_TEMPLATES.find(t => t.id === ranked[0]) ?? PLAN_TEMPLATES[0];
  const shownIds = new Set([best.id, ...ranked.slice(1, 3)]);
  const alternatives = ranked.slice(1, 3)
    .map(id => PLAN_TEMPLATES.find(t => t.id === id))
    .filter((t): t is PlanTemplate => !!t);
  const rest = PLAN_TEMPLATES.filter(t => !shownIds.has(t.id));

  return (
    <View>
      <Text style={q.title} accessibilityRole="header">Your plan</Text>
      <Text style={q.sub}>Picked from your answers. You can switch plans later.</Text>

      <AnimatedPressable scale="subtle" style={q.best} onPress={() => onChoose(best.id)} accessibilityRole="button" accessibilityLabel={`Best match, ${best.name}. ${templateMeta(best)}`}>
        <View style={q.bestBadge}>
          <Ionicons name="star" size={12} color={COLORS.onAccent} />
          <Text style={q.bestBadgeTxt}>Best match</Text>
        </View>
        <Text style={q.bestName}>{best.name}</Text>
        <Text style={q.bestDesc}>{best.description}</Text>
        <Text style={q.meta}>{templateMeta(best)}</Text>
        <View style={q.bestCta}><Text style={q.bestCtaTxt}>Use this plan</Text></View>
      </AnimatedPressable>

      {alternatives.length > 0 && <Text style={q.section}>Also a good fit</Text>}
      {alternatives.map(t => <TemplateRow key={t.id} t={t} onPress={() => onChoose(t.id)} />)}

      {showAll ? (
        <>
          <Text style={q.section}>Every plan</Text>
          {rest.map(t => <TemplateRow key={t.id} t={t} onPress={() => onChoose(t.id)} />)}
        </>
      ) : rest.length > 0 && (
        <AnimatedPressable style={q.more} onPress={onShowAll} accessibilityRole="button">
          <Text style={q.moreTxt}>See all {PLAN_TEMPLATES.length} plans</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
        </AnimatedPressable>
      )}
    </View>
  );
}

function TemplateRow({ t, onPress }: { t: PlanTemplate; onPress: () => void }) {
  return (
    <AnimatedPressable scale="subtle" style={q.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t.name}. ${templateMeta(t)}`}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={q.rowName}>{t.name}</Text>
        <Text style={q.meta}>{templateMeta(t)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
    </AnimatedPressable>
  );
}

function Review({ template, planName, onName, loading, onStart }:
  { template?: PlanTemplate; planName: string; onName: (v: string) => void; loading: boolean; onStart: () => void }) {
  // Copy before sorting: sorting in place would reorder the shared template data.
  const days = template ? [...template.days].sort((a, b) => a.dayPosition - b.dayPosition) : [];
  return (
    <View>
      <Text style={q.title} accessibilityRole="header">Ready when you are</Text>
      <Text style={q.sub}>Give your plan a name and check the week.</Text>

      <Text style={q.section}>Plan name</Text>
      <TextInput
        style={q.input}
        value={planName}
        onChangeText={onName}
        placeholder="e.g. My push pull legs"
        placeholderTextColor={COLORS.textMuted}
        maxLength={50}
        autoCorrect={false}
        accessibilityLabel="Plan name"
      />

      <Text style={q.section}>Your week</Text>
      <View style={q.week}>
        {days.map((d, i) => (
          <View key={d.dayPosition} style={[q.weekRow, i > 0 && q.weekRowBorder]}>
            <View style={[q.weekDot, { backgroundColor: d.isRestDay ? ink(0.18) : COLORS.accent }]} />
            <Text style={q.weekDay}>Day {d.dayPosition}</Text>
            <Text style={q.weekLabel} numberOfLines={1}>{d.label}</Text>
            <Text style={q.weekMeta}>
              {d.isRestDay ? 'Rest' : `${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        ))}
      </View>

      <Text style={q.hint}>You can change any exercise, set, rep or weight later in the Plan tab.</Text>
      <PrimaryButton label={loading ? 'Setting up…' : 'Start training'} onPress={onStart} disabled={loading} />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <AnimatedPressable haptic="medium" style={pb.btn} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={pb.txt}>{label}</Text>
    </AnimatedPressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pb = themed(() => StyleSheet.create({
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, alignSelf: 'stretch' },
  txt: { fontSize: 17, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: -0.3 },
}));

const w = themed(() => StyleSheet.create({
  wrap:        { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 24 },
  brand:       { alignItems: 'center', marginTop: 48 },
  logo:        { width: 88, height: 88, borderRadius: 22, marginBottom: 16 },
  title:       { fontSize: 56, fontFamily: FONTS.display, color: COLORS.accent, letterSpacing: -2.2 },
  subtitle:    { fontSize: 17, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  features:    { gap: 16 },
  feature:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: accentA(0.12) },
  featureText: { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary, lineHeight: 21 },
  actions:     { gap: 6 },
  link:        { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  linkTxt:     { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textMuted },
}));

const q = themed(() => StyleSheet.create({
  top:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  track:        { flex: 1, height: 6, borderRadius: 3, backgroundColor: ink(0.1), overflow: 'hidden' },
  trackFill:    { height: '100%', borderRadius: 3, backgroundColor: COLORS.accent },
  count:        { width: 40, fontSize: 13, fontFamily: FONTS.dataBold, color: COLORS.textMuted, textAlign: 'right' },
  scroll:       { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  title:        { fontSize: 28, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1, lineHeight: 33 },
  sub:          { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 22, marginTop: 6, marginBottom: 22 },
  options:      { gap: 10 },
  option:       {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 18, borderWidth: 1.5, borderColor: ink(0.1), backgroundColor: ink(0.04),
  },
  cardSelected: { borderColor: COLORS.accent, backgroundColor: accentA(0.08) },
  optionIcon:   { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: ink(0.06) },
  optionLabel:  { fontSize: 17, fontFamily: FONTS.headline, color: COLORS.text, letterSpacing: -0.3 },
  optionDesc:   { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 2 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dayCard:      {
    width: '48%', flexGrow: 1, paddingVertical: 20, alignItems: 'center', borderRadius: 18,
    borderWidth: 1.5, borderColor: ink(0.1), backgroundColor: ink(0.04),
  },
  dayNum:       { fontSize: 36, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -1.2 },
  dayLbl:       { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  dayDesc:      { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 4 },

  best:         { padding: 18, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: accentA(0.07) },
  bestBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: COLORS.accent, marginBottom: 10 },
  bestBadgeTxt: { fontSize: 12, fontFamily: FONTS.label, color: COLORS.onAccent, letterSpacing: 0 },
  bestName:     { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.6 },
  bestDesc:     { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 20, marginTop: 6, marginBottom: 8 },
  meta:         { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  bestCta:      { marginTop: 14, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  bestCtaTxt:   { fontSize: 15, fontFamily: FONTS.display, color: COLORS.onAccent },

  section:      { fontSize: 12, fontFamily: FONTS.label, color: COLORS.textLabel, letterSpacing: 0, marginTop: 24, marginBottom: 10 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: ink(0.1), backgroundColor: ink(0.04), marginBottom: 8 },
  rowName:      { fontSize: 16, fontFamily: FONTS.headline, color: COLORS.text, marginBottom: 3 },
  more:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  moreTxt:      { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textMuted },

  input:        { height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 16, fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.text },
  week:         { borderRadius: 16, borderWidth: 1, borderColor: ink(0.08), backgroundColor: ink(0.03), paddingHorizontal: 14 },
  weekRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  weekRowBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink(0.1) },
  weekDot:      { width: 8, height: 8, borderRadius: 4 },
  weekDay:      { width: 46, fontSize: 12, fontFamily: FONTS.dataBold, color: COLORS.textMuted },
  weekLabel:    { flex: 1, fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.text },
  weekMeta:     { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },
  hint:         { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 19, marginTop: 16, marginBottom: 20, textAlign: 'center' },
}));
