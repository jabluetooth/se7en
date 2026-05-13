import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from '../../components/common/GlassView';
import { WorkoutDay } from '../../types';
import { COLORS, GRAD } from '../../constants';

interface Props {
  currentDay:    WorkoutDay | undefined;
  currentDayNum: number;
  onStart:       () => void;
}

export function MissionCard({ currentDay, currentDayNum, onStart }: Props) {
  // isRestDay may be undefined on plans stored before the field was added — fall back to label check
  const isRest      = currentDay?.isRestDay === true || currentDay?.label?.toLowerCase() === 'rest';
  const primaryLift = currentDay?.exercises[0]?.name ?? null;

  const title    = isRest
    ? 'Recovery Day'
    : `Day ${currentDayNum}: ${currentDay?.label ?? 'Workout'}`;

  const subtitle = isRest
    ? 'Your muscles grow during rest — come back strong.'
    : primaryLift
    ? `Starting with ${primaryLift}`
    : `${currentDay?.exercises.length ?? 0} exercises planned`;

  return (
    <GlassView opacity="high" radius={20} style={s.card}>
      {/* Status badge */}
      <View style={s.badgeRow}>
        <View style={[s.dot, { backgroundColor: isRest ? COLORS.rest : COLORS.accent }]} />
        <Text style={s.badgeTxt}>{isRest ? 'REST DAY' : 'NEXT MISSION'}</Text>
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>

      {!isRest && (
        <TouchableOpacity style={s.ctaWrap} onPress={onStart} activeOpacity={0.85}>
          <LinearGradient
            colors={GRAD.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGrad}
          >
            <Text style={s.ctaTxt}>START SESSION</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  card:     { marginHorizontal: 16, marginBottom: 8, padding: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.3, textTransform: 'uppercase' },
  title:    { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 14 },
  ctaWrap:  { borderRadius: 14, overflow: 'hidden' },
  ctaGrad:  { height: 50, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:   { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 0.8 },
});
