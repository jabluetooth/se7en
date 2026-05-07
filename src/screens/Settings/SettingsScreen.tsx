import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { GRAD, COLORS, SPACING, BORDER_RADIUS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';

interface Props {
  onOpenExerciseBuilder?: () => void;
  onSignOut?:             () => void;
  userEmail?:             string;
  userName?:              string;
}

export function SettingsScreen({ onOpenExerciseBuilder, onSignOut, userEmail, userName }: Props) {
  const { activePlan } = usePlanStore();
  const { settings } = useSettingsStore();
  const [weightUnit, setWeightUnit] = useState<'kg'|'lb'>('kg');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <GlassView radius={16} style={{ overflow: 'hidden', padding: 0 }}>
        {children}
      </GlassView>
    </View>
  );

  const Row = ({ label, sub, right, onPress, danger, last }: {
    label: string; sub?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean; last?: boolean;
  }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}
      style={[s.row, !last && s.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  const SegControl = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <GlassView radius={8} style={s.seg}>
      {options.map(opt => (
        <TouchableOpacity key={opt} onPress={() => onChange(opt)} style={[s.segBtn, value === opt && s.segBtnActive]}>
          {value === opt
            ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.segGrad}><Text style={s.segTextActive}>{opt}</Text></LinearGradient>
            : <Text style={s.segText}>{opt}</Text>}
        </TouchableOpacity>
      ))}
    </GlassView>
  );

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={[s.toggle, on && s.toggleOn]}>
      {on && <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />}
      <View style={[s.toggleThumb, on && s.toggleThumbOn]} />
    </TouchableOpacity>
  );

  const ChevronRight = () => (
    <Text style={s.chevron}>{'>'}</Text>
  );

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Active plan card */}
          {activePlan && (
            <GlassView radius={18} style={s.planCard} glow>
              <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.planIcon}>
                <Text style={s.planIconText}>7</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.planName}>{activePlan.name}</Text>
                <Text style={s.planSub}>Active plan  {activePlan.splitType} split</Text>
              </View>
              <Badge label="Active" variant="accent" size="xs" />
            </GlassView>
          )}

          <Section title="Weight & Units">
            <Row label="Weight Unit" right={<SegControl options={['kg', 'lb']} value={weightUnit} onChange={v => setWeightUnit(v as any)} />} />
            <Row label="Plate System" sub="Metric (20, 15, 10, 5, 2.5, 1.25 kg)" right={<ChevronRight />} onPress={() => {}} last />
          </Section>

          <Section title="Backup">
            <Row label="Auto Backup" sub={'Last backup: ' + (settings.lastBackupDate ? new Date(settings.lastBackupDate).toLocaleDateString() : 'Never')}
              right={<Toggle on={settings.autoBackup} onToggle={() => useSettingsStore.getState().save({ autoBackup: !settings.autoBackup })} />} />
            <Row label="Backup Frequency" right={<SegControl options={['daily','weekly']} value={settings.backupFrequency} onChange={v => useSettingsStore.getState().save({ backupFrequency: v as any })} />} />
            <Row label="Backup History" sub="7 backups retained" right={<ChevronRight />} onPress={() => {}} last />
          </Section>

          <Section title="Data">
            <Row label="Export Data" sub="JSON or CSV" right={<ChevronRight />} onPress={() => {}} />
            <Row label="Import Plan" sub="From JSON file" right={<ChevronRight />} onPress={() => {}} last />
          </Section>

          <Section title="Plans">
            <Row label="Manage Plans" sub={activePlan ? '1 active plan' : 'No plan set'} right={<ChevronRight />} onPress={() => {}} />
            {onOpenExerciseBuilder && (
              <Row label="Exercise Builder" sub="Add or edit exercises" right={<ChevronRight />} onPress={onOpenExerciseBuilder} />
            )}
            <Row label="Delete All Data" danger right={<Text style={{ color: COLORS.danger }}>{'>'}</Text>} onPress={() => {}} last />
          </Section>

          {/* Account */}
          <Section title="Account">
            {(userName || userEmail) && (
              <Row
                label={userName ?? 'Your account'}
                sub={userEmail}
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

          <Text style={s.version}>Se7en v1.0.0 · MVP</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({

  header:         { paddingHorizontal: 20, paddingBottom: 16 },
  title:          { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  scroll:         { paddingHorizontal: 16 },
  planCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 24 },
  planIcon:       { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planIconText:   { fontSize: 24, fontWeight: '900', color: '#000' },
  planName:       { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  planSub:        { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  section:        { marginBottom: 24 },
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder:      { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.09)' },
  rowLabel:       { fontSize: 15, fontWeight: '600', color: '#fff' },
  rowSub:         { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
  chevron:        { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  seg:            { flexDirection: 'row', padding: 2, gap: 2 },
  segBtn:         { borderRadius: 6, overflow: 'hidden' },
  segBtnActive:   {},
  segGrad:        { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 6 },
  segText:        { paddingHorizontal: 11, paddingVertical: 5, fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  segTextActive:  { fontSize: 13, fontWeight: '700', color: '#000' },
  toggle:         { width: 48, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', position: 'relative' },
  toggleOn:       { borderColor: 'transparent' },
  toggleThumb:    { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.textSecondary },
  toggleThumbOn:  { left: 24, backgroundColor: '#000' },
  version:        { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, paddingTop: 8 },
});
