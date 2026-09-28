import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterFade } from '../../motion/presets';
import { askCoachProactive } from '../../services/coachService';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { COLORS, FONTS } from '../../constants';
import { accentA, ink, themed } from '../../theme/runtime';

const MIN_SESSIONS_FOR_AI = 3;

interface Props {
  onOpen?: (initialMessage?: string) => void;
}

/**
 * One line of coaching on Home, tappable to open the full coach chat. It
 * replaced the large insight card: the tip is useful, but it shouldn't
 * compete with today's workout for attention.
 */
export function CoachTip({ onOpen }: Props) {
  const uid = useAuthStore(a => a.user?.uid);
  const completed = useSessionStore(st => st.sessions.filter(x => x.status === 'completed').length);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const locked = completed < MIN_SESSIONS_FOR_AI;

  useEffect(() => {
    if (!uid || locked) return;
    let alive = true;
    askCoachProactive(uid, false)
      .then(res => {
        if (!alive) return;
        setText(res.text);
        if (res.text) {
          import('../../services/widgetService')
            .then(({ widgetService }) => widgetService.updateCoach(res.text))
            .catch(() => {});
        }
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [uid, locked]);

  const left = MIN_SESSIONS_FOR_AI - completed;
  const body = locked
    ? `Log ${left} more workout${left === 1 ? '' : 's'} and your coach starts spotting patterns.`
    : text || (failed ? 'Ask your coach about your training.' : 'Looking over your last few workouts…');

  return (
    <AnimatedPressable
      scale="subtle"
      style={s.row}
      onPress={() => onOpen?.(text || undefined)}
      disabled={!onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Coach tip. ${body}`}
      accessibilityHint="Opens the coach"
    >
      <View style={s.badge}>
        <Ionicons name="sparkles" size={15} color={COLORS.accent} />
      </View>
      <Animated.View key={body} entering={enterFade} style={{ flex: 1 }}>
        <Text style={s.label}>Coach</Text>
        <Text style={s.body} numberOfLines={3}>{body}</Text>
      </Animated.View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLabel} />
    </AnimatedPressable>
  );
}

const s = themed(() => StyleSheet.create({
  row:   {
    marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 18, backgroundColor: ink(0.04),
  },
  badge: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: accentA(0.12) },
  label: { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textMuted, marginBottom: 2 },
  body:  { fontSize: 14, fontFamily: FONTS.body, color: COLORS.text, lineHeight: 20 },
}));
