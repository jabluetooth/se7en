import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { WorkoutSession, PersonalRecord } from '../../types';
import { COLORS, GRAD } from '../../constants';

interface Props {
  sessions:  WorkoutSession[];
  latestPR:  PersonalRecord | null;
  streak:    number;
}

function weekVolume(sessions: WorkoutSession[], daysBack: number, spanDays: number): number {
  const now    = Date.now();
  const start  = now - daysBack * 86_400_000;
  const end    = now - (daysBack - spanDays) * 86_400_000;
  return sessions
    .filter(s => {
      if (s.status !== 'completed' || !s.finishedAt) return false;
      const t = new Date(s.finishedAt).getTime();
      return t >= start && t < end;
    })
    .reduce((a, s) => a + s.totalVolume, 0);
}

export function BentoGrid({ sessions, latestPR, streak }: Props) {
  const thisWeek = weekVolume(sessions, 7, 7);
  const lastWeek = weekVolume(sessions, 14, 7);

  const volDelta = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    : thisWeek > 0 ? 100 : 0;
  const volUp = volDelta >= 0;

  const lastNote = [...sessions]
    .filter(s => s.sessionNote)
    .sort((a, b) => new Date(b.finishedAt ?? '').getTime() - new Date(a.finishedAt ?? '').getTime())[0]
    ?.sessionNote ?? null;

  const totalLifted = sessions
    .filter(s => s.status === 'completed')
    .reduce((a, s) => a + s.totalVolume, 0);
  const totalStr = totalLifted >= 1_000_000
    ? `${(totalLifted / 1_000_000).toFixed(1)}M`
    : totalLifted >= 1000
    ? `${(totalLifted / 1000).toFixed(1)}k`
    : String(totalLifted);

  return (
    <View style={s.wrap}>
      <Text style={s.sectionTitle}>Quick Stats</Text>

      {/* Row 1: Streak + Volume delta */}
      <View style={s.row}>
        {/* Streak */}
        <GlassView opacity="high" radius={16} style={s.tileHalf}>
          <LinearGradient
            colors={GRAD.accentSoft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={s.tileLabel}>STREAK</Text>
          <Text style={s.tileBigNum}>{streak}</Text>
          <Text style={s.tileUnit}>consecutive</Text>
        </GlassView>

        {/* Weekly volume change */}
        <GlassView opacity="mid" radius={16} style={s.tileHalf}>
          <Text style={s.tileLabel}>WEEKLY VOL</Text>
          <Text style={[s.tileBigNum, volUp ? s.colorGood : s.colorBad]}>
            {volUp ? '+' : ''}{volDelta}%
          </Text>
          <Text style={s.tileUnit}>vs last week</Text>
        </GlassView>
      </View>

      {/* Row 2: Total tonnage (full width) */}
      <GlassView opacity="mid" radius={16} style={s.tileWide}>
        <View style={s.tileRow}>
          <View style={s.tileIconBox}>
            <Text style={s.tileIconTxt}>∑</Text>
          </View>
          <View style={s.tileContent}>
            <Text style={s.tileLabel}>ALL-TIME TONNAGE</Text>
            <Text style={s.tileMedNum}>{totalStr} kg</Text>
            <Text style={s.tileUnit}>total weight moved</Text>
          </View>
        </View>
      </GlassView>

      {/* Row 3: Last note (only if exists) */}
      {lastNote && (
        <GlassView opacity="mid" radius={16} style={s.tileWide}>
          <View style={s.tileRow}>
            <View style={[s.tileIconBox, s.iconNote]}>
              <Text style={s.tileIconTxt}>"</Text>
            </View>
            <View style={s.tileContent}>
              <Text style={s.tileLabel}>LAST SESSION NOTE</Text>
              <Text style={s.noteText} numberOfLines={2}>{lastNote}</Text>
            </View>
          </View>
        </GlassView>
      )}

      {/* Row 4: Latest PR (only if exists) */}
      {latestPR && (
        <GlassView opacity="mid" radius={16} style={s.tileWide}>
          <View style={s.tileRow}>
            <LinearGradient
              colors={GRAD.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.prBadge}
            >
              <Text style={s.prBadgeTxt}>PR</Text>
            </LinearGradient>
            <View style={s.tileContent}>
              <Text style={s.tileLabel}>PERSONAL RECORD</Text>
              <Text style={s.prName}>{latestPR.exerciseName}</Text>
              <Text style={s.prVal}>{latestPR.heaviestWeight} kg</Text>
            </View>
          </View>
        </GlassView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { marginHorizontal: 16, gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },

  row:          { flexDirection: 'row', gap: 8 },
  tileHalf:     { flex: 1, padding: 16, minHeight: 110, overflow: 'hidden', justifyContent: 'flex-end' },
  tileWide:     { padding: 16 },

  tileLabel:    { fontSize: 9,  fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  tileBigNum:   { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1.5, lineHeight: 36 },
  tileMedNum:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 26 },
  tileUnit:     { fontSize: 10, color: COLORS.textSecondary, marginTop: 3 },

  colorGood:    { color: COLORS.gradientEnd },
  colorBad:     { color: COLORS.danger },

  tileRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileIconBox:  { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(123,94,250,0.18)', alignItems: 'center', justifyContent: 'center' },
  iconNote:     { backgroundColor: 'rgba(76,170,240,0.18)' },
  tileIconTxt:  { fontSize: 22, fontWeight: '900', color: COLORS.accent },
  tileContent:  { flex: 1 },

  noteText:     { fontSize: 13, color: 'rgba(255,255,255,0.78)', fontStyle: 'italic', lineHeight: 19 },

  prBadge:      { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prBadgeTxt:   { fontSize: 13, fontWeight: '900', color: '#000' },
  prName:       { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 1 },
  prVal:        { fontSize: 20, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.5, marginTop: 2 },
});
