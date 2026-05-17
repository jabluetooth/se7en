import React from 'react';
import { View, Text, Image, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { GlassView } from '../../../components/common/GlassView';
import { TrophyIcon } from '../../../components/common/TrophyIcon';
import { COLORS } from '../../../constants';
import { WorkoutSession } from '../../../types';
import { fmtVol } from '../../../utils/format';
import { VolumeLineGraph, SetPoint } from './VolumeLineGraph';

interface Props {
  session: WorkoutSession;
  width:   number;
  bgImage: string | null;
  shotRef: React.RefObject<ViewShot | null>;
}

// Page 1 — workout-complete identity, line-graph hero, reps × sets = volume.
// Wrapped in ViewShot so the parent can capture this page as a PNG.
export function SummaryPage({ session, width, bgImage, shotRef }: Props) {
  // Build per-set data points for the line graph
  const setData: SetPoint[] = session.exercises.flatMap(ex =>
    ex.sets.filter(s => s.isCompleted).map(s => {
      const reps   = s.actualRepsToFailure ?? s.actualReps;
      const weight = s.actualWeight ?? 0;
      return {
        reps,
        weight,
        unit:   ex.weightUnit,
        exName: ex.exerciseName,
        vol:    Math.max(reps * (weight || 1), 1),
      };
    }),
  );

  const peakIdx = setData.reduce(
    (mi, d, i) => (d.vol > setData[mi].vol ? i : mi), 0,
  );
  const peak    = setData[peakIdx];

  const totalReps  = setData.reduce((a, s) => a + s.reps, 0);
  const totalSets  = setData.length;
  const volDisplay = fmtVol(Math.round(session.totalVolume));

  const finishedDate = session.finishedAt
    ? new Date(session.finishedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  const graphWidth = Math.min(width - 32, 360);

  return (
    <ViewShot
      ref={shotRef}
      options={{ format: 'png', quality: 1, result: 'tmpfile' }}
      style={{ width, flex: 1, backgroundColor: bgImage ? '#000' : '#0d0d0f' }}
    >
      {/* User-picked background image (only rendered when set) */}
      {bgImage && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={{ uri: bgImage }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={e => Alert.alert('Image failed to load', e.nativeEvent?.error ?? 'Unknown error')}
          />
          {/* Light overlay — keeps text legible without hiding the image */}
          <LinearGradient
            colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.60)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View style={[s.page, { width }]}>

        {/* ── Workout identity — centered ─────────────────── */}
        <View style={s.top}>
          <GlassView radius={99} style={s.chip}>
            <TrophyIcon size={12} color={COLORS.accent} />
            <Text style={s.chipText}>Workout Complete</Text>
            <Text style={s.chipDot}>·</Text>
            <Text style={s.chipDate}>{finishedDate}</Text>
          </GlassView>
          <Text style={s.name}>{session.dayLabel}</Text>
          <Text style={s.nameSub}>Day {session.dayPosition} · {session.duration} min</Text>
        </View>

        {/* ── Line graph hero (transparent bg) ────────────── */}
        <View style={s.hero}>
          <View style={s.graphLabelRow}>
            <Text style={s.graphTitle}>Set Volume</Text>
            <Text style={s.graphAxis}>peak highlighted</Text>
          </View>
          <VolumeLineGraph data={setData} peakIdx={peakIdx} width={graphWidth} />

          {peak && (
            <View style={s.peakPill}>
              <TrophyIcon size={11} color={COLORS.accent} />
              <Text style={s.peakLbl}>Highest set</Text>
              <Text style={s.peakVal}>
                {peak.reps} × {peak.weight}{peak.unit} = {Math.round(peak.vol)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats: Reps × Sets = Volume ─────────────────── */}
        <GlassView radius={14} style={s.statsStrip}>
          <View style={s.statCell}>
            <Text style={s.statVal}>{totalReps}</Text>
            <Text style={s.statLabel}>Reps</Text>
          </View>
          <View style={s.statOp}><Text style={s.statOpTxt}>×</Text></View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{totalSets}</Text>
            <Text style={s.statLabel}>Sets</Text>
          </View>
          <View style={s.statOp}><Text style={s.statOpTxt}>=</Text></View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{volDisplay}</Text>
            <Text style={s.statLabel}>Volume</Text>
          </View>
        </GlassView>

      </View>
    </ViewShot>
  );
}

const s = StyleSheet.create({
  page:          { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, justifyContent: 'space-between', alignItems: 'center' },

  // Top identity block
  top:           { alignItems: 'center', gap: 4 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  chipText:      { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  chipDot:       { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  chipDate:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  name:          { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 36, textAlign: 'center' },
  nameSub:       { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Hero
  hero:          { alignItems: 'center', alignSelf: 'stretch', gap: 10 },
  graphLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 4 },
  graphTitle:    { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  graphAxis:     { fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.3 },

  // Peak set pill
  peakPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,140,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.30)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  peakLbl:  { fontSize: 10, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  peakVal:  { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Stats strip
  statsStrip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  statCell:   { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statOp:     { paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  statOpTxt:  { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  statVal:    { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statLabel:  { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
});
