import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { GlassView } from '../../components/common/GlassView';
import { WorkoutSession } from '../../types';
import { COLORS } from '../../constants';

interface Props {
  sessions: WorkoutSession[];
}

const WEEKS = 14;
const CELL  = 13;
const GAP   = 3;

function getMondayOf(d: Date): Date {
  const day  = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m    = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function cellColor(volume: number, maxVol: number): string {
  if (volume === 0) return 'rgba(255,255,255,0.05)';
  const t = Math.min(volume / maxVol, 1);
  if (t < 0.25) return 'rgba(123,94,250,0.28)';
  if (t < 0.5)  return 'rgba(123,94,250,0.52)';
  if (t < 0.75) return 'rgba(123,94,250,0.72)';
  return 'rgba(123,94,250,0.95)';
}

export function ContributionHeatmap({ sessions }: Props) {
  const now         = new Date();
  const currMonday  = getMondayOf(now);

  // Build the list of week-start dates, oldest first
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const m = new Date(currMonday);
    m.setDate(currMonday.getDate() - (WEEKS - 1 - i) * 7);
    return m;
  });

  // Build lookup: isoMonday → dayPosition → session
  const lookup = new Map<string, Map<number, WorkoutSession>>();
  sessions.forEach(s => {
    if (s.status !== 'completed' || !s.finishedAt) return;
    const key = getMondayOf(new Date(s.finishedAt)).toISOString().split('T')[0];
    if (!lookup.has(key)) lookup.set(key, new Map());
    // Keep highest-volume session if multiple fall in same week+dayPos
    const existing = lookup.get(key)!.get(s.dayPosition);
    if (!existing || s.totalVolume > existing.totalVolume) {
      lookup.get(key)!.set(s.dayPosition, s);
    }
  });

  const maxVol = Math.max(...sessions.map(s => s.totalVolume), 1);

  const CELL_STRIDE = CELL + GAP;

  return (
    <GlassView opacity="mid" radius={16} style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Consistency</Text>
        <Text style={s.sub}>{WEEKS}W</Text>
      </View>

      <View style={s.gridRow}>
        {/* Fixed day labels on the left */}
        <View style={s.labelsCol}>
          {[1, 2, 3, 4, 5, 6, 7].map(dp => (
            <View key={dp} style={[s.labelWrap, { height: CELL, marginBottom: dp < 7 ? GAP : 0 }]}>
              <Text style={s.dayLbl}>D{dp}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable week columns */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.gridContent, { gap: GAP }]}
        >
          {weeks.map((monday, wi) => {
            const key     = monday.toISOString().split('T')[0];
            const weekMap = lookup.get(key);
            return (
              <View key={wi} style={[s.col, { gap: GAP }]}>
                {[1, 2, 3, 4, 5, 6, 7].map(dp => {
                  const sess = weekMap?.get(dp);
                  return (
                    <View
                      key={dp}
                      style={[s.cell, { backgroundColor: cellColor(sess?.totalVolume ?? 0, maxVol) }]}
                    />
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <Text style={s.legendTxt}>Less</Text>
        {[0, 0.25, 0.55, 0.85, 1].map((v, i) => (
          <View key={i} style={[s.legendCell, { backgroundColor: cellColor(v * maxVol, maxVol) }]} />
        ))}
        <Text style={s.legendTxt}>More</Text>
      </View>
    </GlassView>
  );
}

const s = StyleSheet.create({
  card:       { marginHorizontal: 16, marginBottom: 8, padding: 16 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:      { fontSize: 14, fontWeight: '800', color: '#fff' },
  sub:        { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },

  gridRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  labelsCol:  { marginRight: 6 },
  labelWrap:  { justifyContent: 'center' },
  dayLbl:     { fontSize: 8, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', width: 18 },

  gridContent:{ alignItems: 'flex-start' },
  col:        { alignItems: 'flex-start' },
  cell:       { width: CELL, height: CELL, borderRadius: 2 },

  legend:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  legendTxt:  { fontSize: 9, color: COLORS.textMuted },
  legendCell: { width: 9, height: 9, borderRadius: 1 },
});
