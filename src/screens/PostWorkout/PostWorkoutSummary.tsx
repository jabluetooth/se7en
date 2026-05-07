import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { Button } from '../../components/common/Button';
import { SectionHeader } from '../../components/common/SectionHeader';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/StatCard';
import { TrophyIcon } from '../../components/common/TrophyIcon';
import { GRAD, COLORS, SPACING } from '../../constants';
import { WorkoutSession, WorkoutDay } from '../../types';
import { AppBackground } from '../../components/ui/AppBackground';

interface Props {
  session: WorkoutSession;
  nextDay?: WorkoutDay;
  onDone: () => void;
}

export function PostWorkoutSummary({ session, nextDay, onDone }: Props) {
  const [tab, setTab]   = useState<'today'|'progress'|'next'>('today');
  const [note, setNote] = useState('');
  const tabs = ['today','progress','next'] as const;

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.trophyBadge}>
              <TrophyIcon size={18} color="#000" />
            </LinearGradient>
            <Text style={s.accentLabel}>Workout Complete</Text>
          </View>
          <Text style={s.title}>{session.dayLabel}</Text>
          <Text style={s.sub}>{session.prsBreached.length > 0 ? session.prsBreached.length + ' PRs broken today' : 'Great session!'}</Text>
        </View>

        {/* Tab bar */}
        <View style={s.tabBarWrap}>
          <GlassView radius={12} style={s.tabBar}>
            {tabs.map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnActive]} activeOpacity={0.8}>
                {tab === t
                  ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.tabGrad}><Text style={s.tabTextActive}>{t === 'next' ? 'Next Up' : t.charAt(0).toUpperCase() + t.slice(1)}</Text></LinearGradient>
                  : <Text style={s.tabText}>{t === 'next' ? 'Next Up' : t.charAt(0).toUpperCase() + t.slice(1)}</Text>}
              </TouchableOpacity>
            ))}
          </GlassView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'today' && (
            <>
              <View style={s.statsGrid}>
                <StatCard label="Duration"  value={String(session.duration)} unit="min" />
                <StatCard label="Sets Done"  value={String(session.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.isCompleted).length,0))} accent />
              </View>
              <View style={[s.statsGrid, { marginTop: 8 }]}>
                <StatCard label="Volume"    value={(session.totalVolume/1000).toFixed(1) + 'k'} unit="kg" />
                <StatCard label="Exercises" value={String(session.exercises.length)} />
              </View>
              {session.prsBreached.length > 0 && (
                <GlassView radius={16} style={s.prCard}>
                  <SectionHeader title="Personal Records" />
                  {session.prsBreached.map((prId, i) => (
                    <View key={i} style={[s.prRow, i < session.prsBreached.length-1 && s.prRowBorder]}>
                      <Text style={s.prName}>{prId}</Text>
                      <Badge label="NEW PR" variant="accent" size="xs" />
                    </View>
                  ))}
                </GlassView>
              )}
            </>
          )}

          {tab === 'progress' && (
            <GlassView radius={16} style={s.progressCard}>
              {session.exercises.map((ex, i) => {
                const completedSets = ex.sets.filter(s => s.isCompleted);
                const topSet = completedSets.reduce((best, s) => (s.actualWeight ?? 0) > (best.actualWeight ?? 0) ? s : best, completedSets[0]);
                return (
                  <View key={ex.id} style={[s.exRow, i < session.exercises.length-1 && s.exRowBorder]}>
                    <Text style={s.exName}>{ex.exerciseName}</Text>
                    <View style={s.exMeta}>
                      <Text style={s.exDone}>{completedSets.length}/{ex.sets.length} sets</Text>
                      {topSet && <Text style={s.exTop}>{topSet.actualWeight ?? '-'}{ex.weightUnit} x {topSet.actualReps}</Text>}
                    </View>
                  </View>
                );
              })}
            </GlassView>
          )}

          {tab === 'next' && nextDay && (
            <>
              <GlassView radius={16} style={s.nextCard}>
                <View style={s.nextHeader}>
                  <Text style={s.nextTitle}>{nextDay.label}</Text>
                  <Text style={s.nextSub}>{nextDay.exercises.length} exercises</Text>
                </View>
                {nextDay.exercises.slice(0,4).map((ex, i) => (
                  <View key={ex.id} style={[s.nextRow, i < Math.min(nextDay.exercises.length,4)-1 && s.nextRowBorder]}>
                    <View style={s.nextLeft}>
                      <SetTypeBadge type={ex.setType} />
                      <Text style={s.nextEx}>{ex.name}</Text>
                    </View>
                    <Text style={s.nextTarget}>{ex.targetSets} x {ex.targetRepsMin ?? 'f'}</Text>
                  </View>
                ))}
              </GlassView>
            </>
          )}
          <View style={{ height: 140 }} />
        </ScrollView>

        {/* Bottom */}
        <View style={s.bottom}>
          <TextInput
            style={s.noteInput}
            placeholder="Add a session note..."
            placeholderTextColor={COLORS.textMuted}
            value={note}
            onChangeText={setNote}
          />
          <TouchableOpacity onPress={onDone} activeOpacity={0.9} style={s.doneBtn}>
            <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.doneGrad}>
              <Text style={s.doneText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({

  header:        { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  trophyBadge:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accentLabel:   { fontSize: 13, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  title:         { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub:           { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  tabBarWrap:    { paddingHorizontal: 16, marginBottom: 12 },
  tabBar:        { padding: 4, flexDirection: 'row', gap: 4 },
  tabBtn:        { flex: 1, borderRadius: 9, overflow: 'hidden' },
  tabBtnActive:  {},
  tabGrad:       { height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabText:       { height: 36, lineHeight: 36, textAlign: 'center', fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { fontSize: 13, fontWeight: '800', color: '#000' },
  scroll:        { paddingHorizontal: 16 },
  statsGrid:     { flexDirection: 'row', gap: 8 },
  prCard:        { padding: 16, marginTop: 8 },
  prRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  prRowBorder:   { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  prName:        { fontSize: 14, fontWeight: '600', color: '#fff' },
  progressCard:  { padding: 16 },
  exRow:         { paddingVertical: 12 },
  exRowBorder:   { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  exName:        { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
  exMeta:        { flexDirection: 'row', gap: 12 },
  exDone:        { fontSize: 13, color: COLORS.accent },
  exTop:         { fontSize: 13, color: COLORS.textSecondary },
  nextCard:      { padding: 16 },
  nextHeader:    { marginBottom: 12 },
  nextTitle:     { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  nextSub:       { fontSize: 13, color: COLORS.textSecondary },
  nextRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  nextRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  nextLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nextEx:        { fontSize: 14, fontWeight: '600', color: '#fff' },
  nextTarget:    { fontSize: 12, color: COLORS.textSecondary },
  bottom:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: 'rgba(11,8,20,0.85)', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  noteInput:     { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, height: 44, paddingHorizontal: 14, color: '#fff', fontSize: 14 },
  doneBtn:       { borderRadius: 14, overflow: 'hidden' },
  doneGrad:      { height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  doneText:      { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: -0.2 },
});
