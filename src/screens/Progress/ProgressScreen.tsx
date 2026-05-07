import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { GlassView } from '../../components/common/GlassView';
import { SectionHeader } from '../../components/common/SectionHeader';
import { TrophyIcon } from '../../components/common/TrophyIcon';
import { useSessionStore } from '../../stores/sessionStore';
import { usePRStore } from '../../stores/prStore';
import { usePlanStore } from '../../stores/planStore';
import { GRAD, COLORS, SPACING } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';

export function ProgressScreen() {
  const { sessions } = useSessionStore();
  const { records: prs } = usePRStore();
  const { activePlan } = usePlanStore();
  const [period, setPeriod] = useState<'1w'|'2w'|'1m'|'3m'>('2w');

  const recentSessions = sessions.filter(s => s.status === 'completed').slice(-14);
  const totalWorkouts  = recentSessions.length;
  const completionRate = sessions.length === 0 ? 0 : Math.round(recentSessions.length / Math.max(sessions.length, 1) * 100);
  const totalVolume    = recentSessions.reduce((a, s) => a + s.totalVolume, 0);

  const volData = recentSessions.map(s => s.totalVolume);
  const maxVol  = Math.max(...volData, 1);
  const w = 320, h = 60;
  const pts = volData.length > 1
    ? volData.map((v, i) => ({ x: (i / (volData.length - 1)) * w, y: h - (v / maxVol) * (h - 8) - 4 }))
    : [];

  const prList = prs.slice(0, 4);

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          {activePlan && <Text style={s.sub}>{activePlan.name}</Text>}
        </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary stats */}
          <View style={s.statsRow}>
            {[
              { label: 'Completion', value: completionRate + '%', accent: true  },
              { label: 'Workouts',   value: String(totalWorkouts), accent: false },
              { label: 'PRs',        value: String(prList.length),  accent: true  },
            ].map((st, i) => (
              <GlassView key={i} radius={16} style={s.statCard}>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={[s.statValue, st.accent && s.statAccent]}>{st.value}</Text>
              </GlassView>
            ))}
          </View>

          {/* Volume chart */}
          <GlassView radius={16} style={s.chartCard}>
            <View style={s.chartHeader}>
              <View>
                <Text style={s.chartLabel}>Training Volume</Text>
                <Text style={s.chartValue}>{(totalVolume / 1000).toFixed(1)}k <Text style={s.chartUnit}>kg total</Text></Text>
              </View>
              <View style={s.periodRow}>
                {(['1w','2w','1m','3m'] as const).map(p => (
                  <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[s.periodBtn, period === p && s.periodBtnActive]}>
                    {period === p
                      ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.periodGrad}><Text style={s.periodTextActive}>{p}</Text></LinearGradient>
                      : <Text style={s.periodText}>{p}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {pts.length > 1 ? (
              <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                <Defs>
                  <SvgGrad id="vg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor="#9035F0" />
                    <Stop offset="50%"  stopColor="#7B5EFA" />
                    <Stop offset="100%" stopColor="#2ECAC4" />
                  </SvgGrad>
                </Defs>
                <Polyline points={pts.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="url(#vg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="4" fill={COLORS.accent} />
              </Svg>
            ) : (
              <View style={s.noData}><Text style={s.noDataText}>Complete workouts to see chart</Text></View>
            )}
          </GlassView>

          {/* PRs */}
          {prList.length > 0 && (
            <GlassView radius={16} style={s.prCard}>
              <SectionHeader title="Personal Records" />
              {prList.map((pr, i) => (
                <View key={pr.exerciseId} style={[s.prRow, i < prList.length - 1 && s.prRowBorder]}>
                  <View style={s.prLeft}>
                    <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={s.prIcon}>
                      <Text style={s.prIconText}>PR</Text>
                    </LinearGradient>
                    <View>
                      <Text style={s.prName}>{pr.exerciseName}</Text>
                      <Text style={s.prMeta}>{new Date(pr.updatedAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={s.prRight}>
                    <Text style={s.prVal}>{pr.heaviestWeight}kg</Text>
                    <Text style={s.prReps}>{pr.mostReps} reps</Text>
                  </View>
                </View>
              ))}
            </GlassView>
          )}

          {/* Completion history */}
          <GlassView radius={16} style={s.histCard}>
            <SectionHeader title="Session Frequency" />
            <View style={s.heatRow}>
              {['M','T','W','T','F','S','S'].map((d, i) => {
                const intensity = [3,2,3,0,2,1,0][i] as number;
                return (
                  <View key={i} style={s.heatCol}>
                    <View style={[s.heatBox, { opacity: intensity === 0 ? 0.2 : 0.3 + intensity * 0.23 }]}>
                      {intensity > 0 ? <LinearGradient colors={GRAD.accent} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex: 1, borderRadius: 6 }} /> : null}
                    </View>
                    <Text style={s.heatDay}>{d}</Text>
                  </View>
                );
              })}
            </View>
          </GlassView>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({

  header:        { paddingHorizontal: 20, paddingBottom: 16 },
  title:         { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub:           { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll:        { paddingHorizontal: 16 },
  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard:      { flex: 1, padding: 12 },
  statLabel:     { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 4 },
  statValue:     { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  statAccent:    { color: COLORS.accent },
  chartCard:     { padding: 16, marginBottom: 8 },
  chartHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  chartLabel:    { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1.0, marginBottom: 3 },
  chartValue:    { fontSize: 20, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.4 },
  chartUnit:     { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  periodRow:     { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 2, gap: 2 },
  periodBtn:     { borderRadius: 6, overflow: 'hidden' },
  periodBtnActive: {},
  periodGrad:    { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  periodText:    { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, paddingHorizontal: 9, paddingVertical: 4 },
  periodTextActive: { fontSize: 12, fontWeight: '700', color: '#000' },
  noData:        { height: 60, alignItems: 'center', justifyContent: 'center' },
  noDataText:    { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  prCard:        { padding: 16, marginBottom: 8 },
  prRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  prRowBorder:   { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  prLeft:        { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  prIcon:        { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  prIconText:    { fontSize: 10, fontWeight: '900', color: '#000' },
  prName:        { fontSize: 14, fontWeight: '700', color: '#fff' },
  prMeta:        { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary },
  prRight:       { alignItems: 'flex-end' },
  prVal:         { fontSize: 15, fontWeight: '900', color: COLORS.accent },
  prReps:        { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary },
  histCard:      { padding: 16, marginBottom: 8 },
  heatRow:       { flexDirection: 'row', gap: 6 },
  heatCol:       { flex: 1, alignItems: 'center', gap: 6 },
  heatBox:       { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.10)' },
  heatDay:       { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
});
