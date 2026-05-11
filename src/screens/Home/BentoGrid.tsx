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
  const now   = Date.now();
  const start = now - daysBack * 86_400_000;
  const end   = now - (daysBack - spanDays) * 86_400_000;
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

      {/* Row 1 — Streak + Volume delta */}
      <View style={s.row}>

        {/* Streak tile — accent left-border instead of absoluteFill gradient */}
        <GlassView opacity="mid" radius={16} style={s.tileHalf}>
          <View style={s.streakAccent} />
          <Text style={s.tileLabel}>STREAK</Text>
          <Text style={[s.tileBigNum, s.numAccent]}>{streak}</Text>
          <Text style={s.tileUnit}>days</Text>
        </GlassView>

        {/* Volume delta tile */}
        <GlassView opacity="mid" radius={16} style={s.tileHalf}>
          <Text style={s.tileLabel}>WEEKLY VOL</Text>
          <Text style={[s.tileBigNum, volUp ? s.numGood : s.numBad]}>
            {volUp ? '+' : ''}{volDelta}%
          </Text>
          <Text style={s.tileUnit}>vs last week</Text>
        </GlassView>
      </View>

      {/* Row 2 — All-time tonnage */}
      <GlassView opacity="mid" radius={16} style={s.tileWide}>
        <View style={s.wideRow}>
          <View style={s.iconBox}>
            <Text style={s.iconTxt}>∑</Text>
          </View>
          <View style={s.wideContent}>
            <Text style={s.tileLabel}>ALL-TIME TONNAGE</Text>
            <Text style={s.tileMedNum}>{totalStr} kg</Text>
            <Text style={s.tileUnit}>total weight moved</Text>
          </View>
        </View>
      </GlassView>

      {/* Row 3 — Last session note (conditional) */}
      {!!lastNote && (
        <GlassView opacity="mid" radius={16} style={s.tileWide}>
          <View style={s.wideRow}>
            <View style={[s.iconBox, s.iconBoxBlue]}>
              <Text style={[s.iconTxt, s.iconTxtBlue]}>"</Text>
            </View>
            <View style={s.wideContent}>
              <Text style={s.tileLabel}>LAST NOTE</Text>
              <Text style={s.noteText} numberOfLines={2}>{lastNote}</Text>
            </View>
          </View>
        </GlassView>
      )}

      {/* Row 4 — Latest PR (conditional) */}
      {!!latestPR && (
        <GlassView opacity="mid" radius={16} style={s.tileWide}>
          <View style={s.wideRow}>
            <LinearGradient
              colors={GRAD.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.prBadge}
            >
              <Text style={s.prBadgeTxt}>PR</Text>
            </LinearGradient>
            <View style={s.wideContent}>
              <Text style={s.tileLabel}>PERSONAL RECORD</Text>
              <Text style={s.prName} numberOfLines={1}>{latestPR.exerciseName}</Text>
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

  // Two-column row
  row:          { flexDirection: 'row', gap: 8 },
  tileHalf:     { flex: 1, padding: 16, minHeight: 110 },

  // Streak accent — a vertical colored bar on the left edge
  streakAccent: {
    position: 'absolute', top: 16, left: 0, bottom: 16,
    width: 3, borderRadius: 2, backgroundColor: COLORS.accent,
  },

  // Full-width tile
  tileWide:     { padding: 16 },
  wideRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  wideContent:  { flex: 1 },

  // Icon box
  iconBox:      { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(123,94,250,0.18)', alignItems: 'center', justifyContent: 'center' },
  iconBoxBlue:  { backgroundColor: 'rgba(76,170,240,0.18)' },
  iconTxt:      { fontSize: 20, fontWeight: '900', color: COLORS.accent },
  iconTxtBlue:  { color: COLORS.rest },

  // Text styles
  tileLabel:    { fontSize: 9,  fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  tileBigNum:   { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1.5, lineHeight: 36 },
  tileMedNum:   { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 26 },
  tileUnit:     { fontSize: 10, color: COLORS.textSecondary, marginTop: 3 },

  numAccent:    { color: COLORS.accent },
  numGood:      { color: COLORS.gradientEnd },
  numBad:       { color: COLORS.danger },

  noteText:     { fontSize: 13, color: 'rgba(255,240,220,0.78)', fontStyle: 'italic', lineHeight: 19 },

  // PR badge (LinearGradient as a standalone block — no absoluteFill)
  prBadge:      { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prBadgeTxt:   { fontSize: 13, fontWeight: '900', color: '#000' },
  prName:       { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 1 },
  prVal:        { fontSize: 20, fontWeight: '900', color: COLORS.accent, letterSpacing: -0.5, marginTop: 2 },
});
