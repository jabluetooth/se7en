import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { COLORS, FONTS } from '../../../constants';
import { WorkoutDay } from '../../../types';
import { planLabel } from '../../../utils/format';
import { enterRise } from '../../../motion/presets';
import { InfoTip } from '../../../components/common/InfoTip';
import { themed } from '../../../theme/runtime';

interface Props {
  nextDay?:    WorkoutDay;
  width:       number;
  visible:     boolean;
  bottomInset: number;
}

// Page 3: what's coming next time, as a plain list. The rows are only mounted
// the first time this page is on screen, so their entrance plays when you
// actually swipe here.
export function NextUpPage({ nextDay, width, visible, bottomInset }: Props) {
  const [seen, setSeen] = useState(visible);
  useEffect(() => { if (visible) setSeen(true); }, [visible]);

  if (!nextDay) {
    return (
      <View style={[s.page, s.center, { width, paddingBottom: bottomInset }]}>
        <Text style={s.emptyTitle}>Nothing scheduled next</Text>
        <Text style={s.emptySub}>Rest and recover.</Text>
      </View>
    );
  }

  const sets = nextDay.exercises.reduce((a, e) => a + e.targetSets, 0);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[s.page, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <Text style={s.eyebrow}>Up next · Day {nextDay.dayPosition}</Text>
      <View style={s.titleRow}>
        <Text style={s.dayName}>{nextDay.label}</Text>
        <InfoTip
          title="Up next"
          text="Today's numbers will be waiting on each set as your starting point, so you can try to beat them."
          size={18}
        />
      </View>
      <Text style={s.daySub}>
        {nextDay.exercises.length} exercise{nextDay.exercises.length === 1 ? '' : 's'} · {sets} sets
      </Text>

      {seen && (
        <View style={s.list}>
          {nextDay.exercises.map((ex, i) => (
            <Animated.View key={ex.id} entering={enterRise(i)} style={s.row}>
              <Text style={s.index}>{i + 1}</Text>
              <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
              <Text style={s.exMeta} numberOfLines={1}>{planLabel(ex).replace(/ sets? × /, ' × ')}</Text>
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = themed(() => StyleSheet.create({
  page:       { paddingHorizontal: 20, paddingTop: 12 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text },
  emptySub:   { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 6 },

  eyebrow:    { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dayName:    { flexShrink: 1, fontSize: 40, lineHeight: 44, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -1.3 },
  daySub:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 6, fontVariant: ['tabular-nums'] },

  list:       { marginTop: 24 },
  row:        {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  index:      { width: 20, fontSize: 14, fontFamily: FONTS.display, color: COLORS.textLabel, fontVariant: ['tabular-nums'] },
  exName:     { flex: 1, fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },
  exMeta:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
}));
