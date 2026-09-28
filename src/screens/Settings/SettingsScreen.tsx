import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { useFeedback } from '../../components/feedback/Feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
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
import { ink, themed } from '../../theme/runtime';
import { useThemeStore } from '../../theme/themeStore';

// ─── Sub-components ──────────────────────────────────────────────────────────
// All hoisted to module scope. Previously these lived inside SettingsScreen,
// which gave them a fresh identity on every render and caused React to
// unmount + remount the entire settings list on each state change.

// Flat solid surface, not blurred glass — five stacked blur cards on one
// scrollable list was the single heaviest "generated dashboard" tell on this
// screen (and five simultaneous BlurViews cost real GPU time on lower-end
// Android). A subtle border on a solid surface color groups the rows just as
// clearly without it.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>
        {children}
      </View>
    </View>
  );
}

interface RowProps {
  label:   string;
  sub?:    string;
  right?:  React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?:   boolean;
}
function Row({ label, sub, right, onPress, danger, last }: RowProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      scale={onPress ? 'normal' : 1}
      disabled={!onPress}
      style={[s.row, !last && s.rowBorder]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </AnimatedPressable>
  );
}

interface SegControlProps<T extends string> {
  options:  readonly T[];
  value:    T;
  onChange: (v: T) => void;
}
function SegControl<T extends string>({ options, value, onChange }: SegControlProps<T>) {
  return (
    <View style={s.seg}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <AnimatedPressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[s.segBtn, active && s.segBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={opt}
            accessibilityState={{ selected: active }}
          >
            <Text style={active ? s.segTextActive : s.segText}>{opt}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <AnimatedPressable
      onPress={onToggle}
      style={[s.toggle, on && s.toggleOn]}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
    >
      <View style={[s.toggleThumb, on && s.toggleThumbOn]} />
    </AnimatedPressable>
  );
}

function ChevronRight() {
  return <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />;
}

function DangerChevron() {
  return <Ionicons name="chevron-forward" size={16} color={COLORS.danger} />;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface Props {
  onOpenExerciseBuilder?: () => void;
  onSignOut?:             () => void;
  userEmail?:             string;
  userName?:              string;
}

export function SettingsScreen({ onOpenExerciseBuilder, onSignOut, userEmail, userName }: Props) {
  const { activePlan }              = usePlanStore();
  const { settings, save, loadError, load: loadSettings } = useSettingsStore();
  const { toast, confirm } = useFeedback();
  const { clearAllSessions }        = useSessionStore();
  const dockClearance               = useDockClearance();
  const uid                         = useAuthStore(u => u.user?.uid);
  const theme                       = useThemeStore(t => t.theme);
  const setTheme                    = useThemeStore(t => t.setTheme);

  const handleClearHistory = () =>
    confirm({
      title: 'Clear all workout history?',
      message: 'Every logged workout is deleted for good. Your plan and settings stay.',
      confirmLabel: 'Clear history',
      destructive: true,
    }).then(ok => { if (ok) clearAllSessions(); });

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
        </View>
        {loadError && (
          <InlineBanner
            message="Couldn't sync your settings — showing the last saved copy."
            onRetry={uid ? () => loadSettings(uid) : undefined}
          />
        )}
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: dockClearance }]} showsVerticalScrollIndicator={false}>

          {/* Active plan card */}
          {activePlan && (
            <GlassView radius={18} style={s.planCard} glow>
              <View style={s.planIcon}>
                <Text style={s.planIconText}>7</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.planName}>{activePlan.name}</Text>
                <Text style={s.planSub}>Active plan · {activePlan.splitType} split</Text>
              </View>
              <Badge label="Active" variant="accent" size="xs" />
            </GlassView>
          )}

          <Section title="Appearance">
            <Row
              label="Theme"
              sub="Applies on this device"
              right={
                <SegControl
                  options={['Dark', 'Light'] as const}
                  value={theme === 'dark' ? 'Dark' : 'Light'}
                  onChange={v => {
                    const next = v === 'Dark' ? 'dark' : 'light';
                    save({ theme: next });
                    setTheme(next);
                  }}
                />
              }
              last
            />
          </Section>

          {/* Weight & Units — now persisted via settings store */}
          <Section title="Weight & Units">
            <Row
              label="Weight Unit"
              sub="Used as the default for new exercises"
              right={
                <SegControl
                  options={['kg', 'lb'] as const}
                  value={settings.defaultWeightUnit ?? 'kg'}
                  onChange={v => save({ defaultWeightUnit: v })}
                />
              }
              last
            />
          </Section>

          <Section title="Backup">
            <Row
              label="Auto Backup"
              sub={`Last backup: ${settings.lastBackupDate ? new Date(settings.lastBackupDate).toLocaleDateString() : 'Never'}`}
              right={
                <Toggle
                  label="Auto Backup"
                  on={settings.autoBackup}
                  onToggle={() => save({ autoBackup: !settings.autoBackup })}
                />
              }
            />
            <Row
              label="Backup Frequency"
              right={
                <SegControl
                  options={['daily', 'weekly'] as const}
                  value={settings.backupFrequency}
                  onChange={v => save({ backupFrequency: v })}
                />
              }
              last
            />
          </Section>

          {/* AI Coach */}
          <Section title="AI Coach">
            <Row
              label="Daily Reminder"
              sub={
                settings.coachNotificationsEnabled
                  ? `Notifies you at ${String(settings.coachNotificationHour).padStart(2, '0')}:${String(settings.coachNotificationMinute).padStart(2, '0')} every day`
                  : 'Get a daily coaching tip notification'
              }
              right={
                <Toggle
                  label="Daily Coach Reminder"
                  on={settings.coachNotificationsEnabled}
                  onToggle={async () => {
                    const next = !settings.coachNotificationsEnabled;
                    await save({ coachNotificationsEnabled: next });
                    if (next) {
                      const ok = await scheduleDailyCoachReminder(
                        settings.coachNotificationHour,
                        settings.coachNotificationMinute,
                      );
                      if (!ok) {
                        toast.warning('Turn on notifications for Se7en in your device settings to get daily tips.', { title: 'Notifications are off' });
                        await save({ coachNotificationsEnabled: false });
                      }
                    } else {
                      await cancelDailyCoachReminder();
                    }
                  }}
                />
              }
            />
          </Section>

          {/* Plans */}
          <Section title="Plans">
            {onOpenExerciseBuilder && (
              <Row
                label="Exercise Builder"
                sub="Add or edit exercises"
                right={<ChevronRight />}
                onPress={onOpenExerciseBuilder}
              />
            )}
            <Row
              label="Clear Session History"
              sub="Removes all logged workouts from calendar"
              danger
              right={<DangerChevron />}
              onPress={handleClearHistory}
              last
            />
          </Section>

          {/* Account */}
          {(userName || userEmail || onSignOut) && (
            <Section title="Account">
              {(userName || userEmail) && (
                <Row
                  label={userName ?? 'Your account'}
                  sub={userEmail}
                  last={!onSignOut}
                />
              )}
              {onSignOut && (
                <Row
                  label="Sign Out"
                  danger
                  onPress={onSignOut}
                  last
                />
              )}
            </Section>
          )}

          <Text style={s.version}>Se7en v1.0.0 · MVP</Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  header:         { paddingHorizontal: 20, paddingBottom: 16 },
  title:          { fontSize: 30, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1.20 },
  scroll:         { paddingHorizontal: 16 },

  planCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 24 },
  planIcon:       { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  planIconText:   { fontSize: 24, fontFamily: FONTS.display, color: COLORS.onAccent },
  planName:       { fontSize: 17, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.68 },
  planSub:        { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 2 },

  section:        { marginBottom: 24 },
  sectionTitle:   { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0, marginBottom: 8, paddingLeft: 4 },
  sectionCard:    { overflow: 'hidden', borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderFaint },

  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder:      { borderBottomWidth: 1, borderBottomColor: ink(0.09) },
  rowLabel:       { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.text },
  rowSub:         { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: 2 },

  seg:            { flexDirection: 'row', padding: 2, gap: 2, borderRadius: 8, backgroundColor: COLORS.background },
  segBtn:         { borderRadius: 6, paddingHorizontal: 11, paddingVertical: 5 },
  segBtnActive:   { backgroundColor: COLORS.accent },
  segText:        { fontSize: 13, fontFamily: FONTS.headline, color: COLORS.textSecondary },
  segTextActive:  { fontSize: 13, fontFamily: FONTS.headline, color: COLORS.onAccent },

  toggle:         { width: 48, height: 28, borderRadius: 14, backgroundColor: ink(0.12), overflow: 'hidden', borderWidth: 1, borderColor: ink(0.16), position: 'relative' },
  toggleOn:       { borderColor: 'transparent', backgroundColor: COLORS.accent },
  toggleThumb:    { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.textSecondary },
  toggleThumbOn:  { left: 24, backgroundColor: COLORS.onAccent },

  version:        { textAlign: 'center', fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted, paddingTop: 8 },
}));
