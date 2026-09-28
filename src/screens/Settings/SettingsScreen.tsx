import React from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { useFeedback } from '../../components/feedback/Feedback';
import { InfoTip } from '../../components/common/InfoTip';
import { Segmented } from '../../components/common/Segmented';
import { InlineBanner } from '../../components/common/InlineBanner';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAuthStore } from '../../stores/authStore';
import { COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { useDockClearance } from '../../hooks/useDockClearance';
import {
  scheduleDailyCoachReminder,
  cancelDailyCoachReminder,
} from '../../services/notificationService';
import { PALETTES, type ThemeName } from '../../theme/palettes';
import { ink, themed } from '../../theme/runtime';
import { useThemeStore } from '../../theme/themeStore';

// Settings as a plain list: section names, rows divided by hairlines, native
// switches, and no boxes. What a setting does lives behind its ⓘ, so each
// row is just a name and a control.

interface Props {
  onOpenExerciseBuilder?: () => void;
  onOpenPlan?:            () => void;
  onSignOut?:             () => void;
  userEmail?:             string;
  userName?:              string;
}

export function SettingsScreen({ onOpenExerciseBuilder, onOpenPlan, onSignOut, userEmail, userName }: Props) {
  const { activePlan }              = usePlanStore();
  const { settings, save, loadError, load: loadSettings } = useSettingsStore();
  const { toast, confirm }          = useFeedback();
  const { clearAllSessions, sessions } = useSessionStore();
  const dockClearance               = useDockClearance();
  const uid                         = useAuthStore(u => u.user?.uid);
  const theme                       = useThemeStore(t => t.theme);
  const setTheme                    = useThemeStore(t => t.setTheme);

  const workouts = sessions.filter(x => x.status === 'completed').length;
  const initial = (userName?.trim()[0] ?? userEmail?.trim()[0] ?? '7').toUpperCase();
  const reminderTime = `${String(settings.coachNotificationHour).padStart(2, '0')}:${String(settings.coachNotificationMinute).padStart(2, '0')}`;
  const lastBackup = settings.lastBackupDate ? new Date(settings.lastBackupDate).toLocaleDateString() : 'never';

  const pickTheme = (t: ThemeName) => {
    if (t === theme) return;
    save({ theme: t });
    setTheme(t);
  };

  const toggleCoach = async (next: boolean) => {
    await save({ coachNotificationsEnabled: next });
    if (next) {
      const ok = await scheduleDailyCoachReminder(settings.coachNotificationHour, settings.coachNotificationMinute);
      if (!ok) {
        toast.warning('Turn on notifications for Se7en in your phone settings to get daily tips.', { title: 'Notifications are off' });
        await save({ coachNotificationsEnabled: false });
      }
    } else {
      await cancelDailyCoachReminder();
    }
  };

  const handleClearHistory = () =>
    confirm({
      title: 'Clear all workout history?',
      message: 'Every logged workout is deleted for good. Your plan and settings stay.',
      confirmLabel: 'Clear history',
      destructive: true,
    }).then(ok => { if (ok) clearAllSessions(); });

  const switchColors = { false: ink(0.16), true: COLORS.accent };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {loadError && (
          <InlineBanner
            message="Couldn't sync your settings. Showing the last saved copy."
            onRetry={uid ? () => loadSettings(uid) : undefined}
          />
        )}
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: dockClearance }]} showsVerticalScrollIndicator={false}>
          <Text style={s.title} accessibilityRole="header">Settings</Text>

          {/* ── You ── */}
          <View style={s.profile}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{initial}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name} numberOfLines={1}>{userName || 'Your account'}</Text>
              {userEmail ? <Text style={s.email} numberOfLines={1}>{userEmail}</Text> : null}
            </View>
            <View style={s.count}>
              <Text style={s.countVal}>{workouts}</Text>
              <Text style={s.countLbl}>{workouts === 1 ? 'workout' : 'workouts'}</Text>
            </View>
          </View>

          {/* ── Training ── */}
          <Section title="Training">
            {activePlan && (
              <Row
                label="Plan"
                value={activePlan.name}
                onPress={onOpenPlan}
              />
            )}
            <Row
              label="Weight unit"
              info="The unit new exercises start in, and the unit totals are shown in. Exercises you already have keep their own unit."
              right={
                <Segmented
                  options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }] as const}
                  value={settings.defaultWeightUnit ?? 'kg'}
                  onChange={v => save({ defaultWeightUnit: v })}
                  a11yLabel="Weight unit"
                />
              }
            />
            {onOpenExerciseBuilder && (
              <Row label="Exercise library" onPress={onOpenExerciseBuilder} />
            )}
          </Section>

          {/* ── Appearance ── */}
          <Section title="Appearance" info="Saved on this phone only, so each device can have its own look.">
            <View style={s.themes}>
              {(['dark', 'light'] as const).map(t => (
                <ThemeTile key={t} name={t} selected={theme === t} onPress={() => pickTheme(t)} />
              ))}
            </View>
          </Section>

          {/* ── Coach ── */}
          <Section title="Coach">
            <Row
              label="Daily tip"
              value={settings.coachNotificationsEnabled ? reminderTime : undefined}
              info="One notification a day with a tip based on your recent workouts."
              right={
                <Switch
                  value={settings.coachNotificationsEnabled}
                  onValueChange={toggleCoach}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={ink(0.16)}
                  accessibilityLabel="Daily coach tip"
                />
              }
            />
          </Section>

          {/* ── Backup ── */}
          <Section title="Backup">
            <Row
              label="Automatic backup"
              info={`Keeps a copy of your plans and workouts in your account. Last backup: ${lastBackup}.`}
              right={
                <Switch
                  value={settings.autoBackup}
                  onValueChange={v => save({ autoBackup: v })}
                  trackColor={switchColors}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={ink(0.16)}
                  accessibilityLabel="Automatic backup"
                />
              }
            />
            {settings.autoBackup && (
              <Row
                label="How often"
                right={
                  <Segmented
                    options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }] as const}
                    value={settings.backupFrequency}
                    onChange={v => save({ backupFrequency: v })}
                    a11yLabel="Backup frequency"
                  />
                }
              />
            )}
          </Section>

          {/* ── Account ── */}
          <Section title="Account">
            {onSignOut && <Row label="Sign out" onPress={onSignOut} chevron={false} />}
            <Row
              label="Clear workout history"
              danger
              info="Deletes every logged workout for good. Your plan and settings stay."
              onPress={handleClearHistory}
              chevron={false}
            />
          </Section>

          <Text style={s.version}>Se7en 1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Section({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {info && <InfoTip title={title} text={info} size={15} />}
      </View>
      {children}
    </View>
  );
}

interface RowProps {
  label:    string;
  value?:   string;
  info?:    string;
  right?:   React.ReactNode;
  onPress?: () => void;
  danger?:  boolean;
  chevron?: boolean;
}

function Row({ label, value, info, right, onPress, danger, chevron = true }: RowProps) {
  const body = (
    <>
      <View style={s.rowLeft}>
        <Text style={[s.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {info && <InfoTip title={label} text={info} size={15} />}
      </View>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && chevron && <Ionicons name="chevron-forward" size={17} color={COLORS.textLabel} />}
    </>
  );
  if (!onPress) return <View style={s.row}>{body}</View>;
  return (
    <AnimatedPressable
      scale="subtle"
      dimOnPress
      onPress={onPress}
      style={s.row}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      {body}
    </AnimatedPressable>
  );
}

/** A miniature of the app in each theme, drawn from that theme's palette. */
function ThemeTile({ name, selected, onPress }: { name: ThemeName; selected: boolean; onPress: () => void }) {
  const p = PALETTES[name];
  return (
    <AnimatedPressable
      scale="subtle"
      onPress={onPress}
      style={s.tileWrap}
      accessibilityRole="radio"
      accessibilityLabel={name === 'dark' ? 'Dark theme' : 'Light theme'}
      accessibilityState={{ selected }}
    >
      <View style={[s.tile, { backgroundColor: p.background, borderColor: selected ? COLORS.accent : COLORS.border }, selected && s.tileOn]}>
        <View style={[s.miniLine, { width: '38%', backgroundColor: p.textMuted, opacity: 0.6 }]} />
        <View style={[s.miniTitle, { backgroundColor: p.text }]} />
        <View style={[s.miniCard, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[s.miniLine, { width: '70%', backgroundColor: p.textMuted, opacity: 0.5 }]} />
          <View style={[s.miniLine, { width: '55%', backgroundColor: p.textMuted, opacity: 0.5 }]} />
          <View style={[s.miniBtn, { backgroundColor: p.accent }]} />
        </View>
      </View>
      <View style={s.tileLabelRow}>
        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={selected ? COLORS.accent : COLORS.textLabel} />
        <Text style={[s.tileLabel, selected && { color: COLORS.text }]}>{name === 'dark' ? 'Dark' : 'Light'}</Text>
      </View>
    </AnimatedPressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = themed(() => StyleSheet.create({
  scroll:       { paddingHorizontal: 20 },
  title:        { fontSize: 36, lineHeight: 40, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.2, marginTop: 4 },

  profile:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, marginBottom: 8 },
  avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.text },
  avatarTxt:    { fontSize: 22, fontFamily: FONTS.hero, color: COLORS.background },
  name:         { fontSize: 18, fontFamily: FONTS.headline, color: COLORS.text },
  email:        { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
  count:        { alignItems: 'flex-end' },
  countVal:     { fontSize: 22, fontFamily: FONTS.hero, color: COLORS.text, fontVariant: ['tabular-nums'] },
  countLbl:     { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted },

  section:      { marginTop: 28 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.textMuted },

  row:          {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  rowLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel:     { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  rowValue:     { maxWidth: '50%', fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted },

  themes:       { flexDirection: 'row', gap: 14, marginTop: 10 },
  tileWrap:     { flex: 1, gap: 10 },
  tile:         { aspectRatio: 1.15, borderRadius: 16, borderWidth: 1.5, padding: 12, gap: 6, overflow: 'hidden' },
  tileOn:       { borderWidth: 2 },
  miniTitle:    { width: '52%', height: 9, borderRadius: 3 },
  miniCard:     { flex: 1, marginTop: 4, borderRadius: 9, borderWidth: 1, padding: 8, gap: 5, justifyContent: 'flex-end' },
  miniLine:     { height: 4, borderRadius: 2 },
  miniBtn:      { height: 12, borderRadius: 4, marginTop: 'auto' },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tileLabel:    { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textMuted },

  version:      { textAlign: 'center', fontSize: 12, fontFamily: FONTS.body, color: COLORS.textLabel, marginTop: 32 },
}));
