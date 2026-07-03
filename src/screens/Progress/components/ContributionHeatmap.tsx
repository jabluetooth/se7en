import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../../constants';
import { WorkoutSession } from '../../../types';

const HM_WEEKS    = 8;
const HM_SHIFT_BY = 4;   // shift the window by 4 weeks per ‹ / › tap

// Fixed cell size keeps day-of-week labels perfectly aligned to their rows.
const HM_CELL = 28;
const HM_GAP  = 4;

// 8-week × 7-day GitHub-style contribution grid, navigable backwards/forwards
// by 4-week chunks. Forward navigation is hard-capped at today.
export function ContributionHeatmap({ sessions }: { sessions: WorkoutSession[] }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // `anchor` = the most recent day shown (Saturday of the rightmost column).
  // Initial anchor: the Saturday of the current week.
  const initialAnchor = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (6 - d.getDay())); // jump to Saturday this week
    return d;
  }, [today]);
  const [anchor, setAnchor] = useState<Date>(initialAnchor);

  // Compute the grid relative to anchor: 8 columns, each 7 days, rightmost
  // column ends on anchor.
  const { days, startDate, endDate } = useMemo(() => {
    const end = new Date(anchor);
    const startSunday = new Date(end);
    startSunday.setDate(end.getDate() - (HM_WEEKS * 7 - 1));
    // Snap start to Sunday for proper week alignment
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());

    const grid: Date[][] = [];
    for (let w = 0; w < HM_WEEKS; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(startSunday);
        day.setDate(startSunday.getDate() + w * 7 + d);
        week.push(day);
      }
      grid.push(week);
    }
    return { days: grid, startDate: startSunday, endDate: end };
  }, [anchor]);

  // Session counts per day key
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== 'completed' || !s.finishedAt) continue;
      const d = new Date(s.finishedAt); d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [sessions]);

  // Sum sessions inside the visible window only
  const windowTotal = useMemo(() => {
    let t = 0;
    for (const week of days) for (const d of week) {
      if (d > today) continue;
      t += counts.get(d.toISOString().slice(0,10)) ?? 0;
    }
    return t;
  }, [days, counts, today]);

  const intensity = (n: number) =>
    n === 0 ? 'rgba(255,240,220,0.08)' :
    n === 1 ? 'rgba(255,140,0,0.35)'   :
    n === 2 ? 'rgba(255,140,0,0.65)'   :
              COLORS.accent;

  const fmtRange = (a: Date, b: Date) => {
    const sameYear  = a.getFullYear() === b.getFullYear();
    const sameMonth = sameYear && a.getMonth() === b.getMonth();
    const left  = sameYear ? a.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                           : a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    const right = sameMonth ? b.toLocaleDateString('en-US', { day: 'numeric' })
                            : b.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${left} – ${right}`;
  };

  const shift = (weeks: number) => {
    const next = new Date(anchor);
    next.setDate(next.getDate() + weeks * 7);
    if (next > initialAnchor) setAnchor(initialAnchor);
    else                       setAnchor(next);
  };

  const canGoForward = anchor.getTime() < initialAnchor.getTime();

  return (
    <View>
      {/* Nav row — calendar-style ‹ / › around the date range */}
      <View style={s.navRow}>
        <Pressable
          onPress={() => shift(-HM_SHIFT_BY)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [s.navBtn, pressed && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel="Show earlier weeks"
        >
          <Ionicons name="chevron-back" size={16} color={COLORS.textSecondary} />
        </Pressable>
        <Text style={s.navLabel}>{fmtRange(startDate, endDate)}</Text>
        <Pressable
          onPress={() => shift(HM_SHIFT_BY)}
          disabled={!canGoForward}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            s.navBtn,
            !canGoForward && { opacity: 0.25 },
            pressed && canGoForward && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Show later weeks"
          accessibilityState={{ disabled: !canGoForward }}
        >
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <View style={s.metaRow}>
        <Text style={s.metaTxt}>
          {windowTotal} session{windowTotal === 1 ? '' : 's'} in this window
        </Text>
      </View>

      <View style={s.wrap}>
        <View style={s.dayCol}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={s.dayLbl}>{d}</Text>
          ))}
        </View>
        <View style={s.grid}>
          {days.map((week, wi) => (
            <View key={wi} style={s.weekCol}>
              {week.map((day, di) => {
                const key = day.toISOString().slice(0, 10);
                const c = counts.get(key) ?? 0;
                const isFuture = day > today;
                return (
                  <View
                    key={di}
                    style={[
                      s.cell,
                      { backgroundColor: isFuture ? 'transparent' : intensity(c) },
                    ]}
                    accessible={!isFuture}
                    accessibilityLabel={
                      isFuture
                        ? undefined
                        : `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${c} workout${c === 1 ? '' : 's'}`
                    }
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={s.legendRow}>
        <Text style={s.legendTxt}>Less</Text>
        {[0, 1, 2, 3].map(n => (
          <View key={n} style={[s.legendCell, { backgroundColor: intensity(n) }]} />
        ))}
        <Text style={s.legendTxt}>More</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  navRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:     { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,240,220,0.04)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  navLabel:   { fontSize: 12, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.48 },
  metaRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metaTxt:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', fontFamily: FONTS.semibold },
  wrap:       { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'center' },
  dayCol:     { gap: HM_GAP },
  dayLbl:     { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', fontFamily: FONTS.headline, height: HM_CELL, lineHeight: HM_CELL, textAlign: 'right', width: 14 },
  grid:       { flexDirection: 'row', gap: HM_GAP },
  weekCol:    { gap: HM_GAP },
  cell:       { width: HM_CELL, height: HM_CELL, borderRadius: 5 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' },
  legendTxt:  { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', fontFamily: FONTS.semibold },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
});
