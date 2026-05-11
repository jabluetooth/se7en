import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';
import { WorkoutSession, WorkoutPlan } from '../../types';
import { MOCK_CALENDAR_SESSIONS } from '../../data/mockCalendarSessions';

// ─── Palette ──────────────────────────────────────────────────────────────────
// Carefully chosen: distinct at low opacity, still readable on obsidian bg

const CYCLE_COLORS = [
  '#F43F5E',  // D1 — rose
  '#38BDF8',  // D2 — sky
  '#C084FC',  // D3 — violet
  '#34D399',  // D4 — emerald
  '#FCD34D',  // D5 — amber-gold
  '#FB923C',  // D6 — orange
  '#22D3EE',  // D7 — cyan
];

const MONTH_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBR  = ['S','M','T','W','T','F','S'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function volAlpha(vol: number, max: number): number {
  const t = Math.min(vol / (max || 1), 1);
  if (t === 0)   return 0;
  if (t < 0.25)  return 0.30;
  if (t < 0.5)   return 0.54;
  if (t < 0.75)  return 0.76;
  return 0.97;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sel { day: number; session: WorkoutSession | null; accent: string; }
interface Props { sessions: WorkoutSession[]; activePlan?: WorkoutPlan | null; }

// ─── Component ────────────────────────────────────────────────────────────────

export function ContributionHeatmap({ sessions, activePlan }: Props) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel,  setSel]  = useState<Sel | null>(null);

  const year  = view.getFullYear();
  const month = view.getMonth();

  const all = useMemo(
    () => [...sessions, ...MOCK_CALENDAR_SESSIONS],
    [sessions],
  );

  // day-of-month → best session this month
  const dayMap = useMemo(() => {
    const m = new Map<number, WorkoutSession>();
    all.forEach(s => {
      if (s.status !== 'completed' || !s.finishedAt) return;
      const d = new Date(s.finishedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const day = d.getDate();
      const cur = m.get(day);
      if (!cur || s.totalVolume > cur.totalVolume) m.set(day, s);
    });
    return m;
  }, [all, year, month]);

  const maxVol     = useMemo(() => Math.max(...all.map(s => s.totalVolume), 1), [all]);
  const monthCount = dayMap.size;
  const usedPos    = useMemo(
    () => [...new Set([...dayMap.values()].map(s => s.dayPosition))].sort(),
    [dayMap],
  );

  // ── Cycle detection ──────────────────────────────────────────────────────
  // Each time dayPosition 1 appears (new cycle start), increment cycle counter.
  // Map each week's Monday date → cycle number for the label column.
  const weekCycleMap = useMemo(() => {
    const d1Times = all
      .filter(s => s.dayPosition === 1 && s.status === 'completed' && s.finishedAt)
      .map(s => new Date(s.finishedAt!).getTime())
      .sort((a, b) => a - b);

    // For a week starting at `date`, cycle = count of D1 sessions up to end of that week
    return (weekStartDay: number) => {
      const weekEnd = new Date(year, month, weekStartDay + 6, 23, 59, 59).getTime();
      const count   = d1Times.filter(t => t <= weekEnd).length;
      return count > 0 ? count : null;
    };
  }, [all, year, month]);

  // Build calendar grid
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length/7 }, (_, i) => cells.slice(i*7, i*7+7));

  const isToday  = (d: number) =>
    today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;

  const onPress = (day: number) => {
    if (sel?.day === day) { setSel(null); return; }
    const s  = dayMap.get(day) ?? null;
    setSel({ day, session: s, accent: s ? CYCLE_COLORS[(s.dayPosition-1)%CYCLE_COLORS.length] : COLORS.textLabel });
  };

  const navMonth = (delta: number) => { setView(new Date(year, month+delta, 1)); setSel(null); };

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Training Log</Text>
          <Text style={s.sub}>
            {activePlan ? `${activePlan.splitType}  ·  ` : ''}
            {monthCount} session{monthCount !== 1 ? 's' : ''} in {MONTH_FULL[month]}
          </Text>
        </View>
        <View style={s.navRow}>
          <TouchableOpacity onPress={() => navMonth(-1)} hitSlop={{top:10,bottom:10,left:10,right:6}} activeOpacity={0.5}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navLabel}>{MONTH_FULL[month].slice(0,3).toUpperCase()} {year}</Text>
          <TouchableOpacity onPress={() => navMonth(1)} hitSlop={{top:10,bottom:10,left:6,right:10}} activeOpacity={0.5}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Day-name row (offset by cycle label width) ── */}
      <View style={s.dayNameRow}>
        <View style={s.cycleLabelSpacer} />
        {DAY_ABBR.map((d, i) => (
          <Text key={i} style={s.dayName}>{d}</Text>
        ))}
      </View>

      {/* ── Grid + cycle labels ── */}
      <View style={s.gridArea}>
        {/* Cycle label column */}
        <View style={s.cycleCol}>
          {weeks.map((week, wi) => {
            const firstDay = week.find(d => d !== null);
            const cycle    = firstDay != null ? weekCycleMap(firstDay) : null;
            return (
              <View key={wi} style={s.cycleLabelCell}>
                {cycle != null ? (
                  <>
                    <Text style={s.cycleLabelNum}>C{cycle}</Text>
                  </>
                ) : (
                  <Text style={s.cycleLabelDash}>—</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={s.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={s.emptyCell} />;
                const sess   = dayMap.get(day) ?? null;
                const color  = sess ? CYCLE_COLORS[(sess.dayPosition-1)%CYCLE_COLORS.length] : null;
                const alpha  = sess ? volAlpha(sess.totalVolume, maxVol) : 0;
                const todayD = isToday(day);
                const active = sel?.day === day;
                return (
                  <TouchableOpacity
                    key={di}
                    onPress={() => onPress(day)}
                    activeOpacity={0.75}
                    style={[
                      s.cell,
                      { backgroundColor: color ? rgba(color, alpha) : 'rgba(255,240,220,0.06)' },
                      todayD && { borderWidth: 1.5, borderColor: rgba(COLORS.accent, 0.7) },
                      active && color  && { borderWidth: 1.5, borderColor: rgba(color, 0.85) },
                      active && !color && { borderWidth: 1.5, borderColor: 'rgba(255,240,220,0.40)' },
                    ]}
                  >
                    <Text style={[
                      s.cellNum,
                      !!sess   && s.cellNumSess,
                      todayD   && s.cellNumToday,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* ── Training log card ── */}
      {sel && (
        <View style={s.logCard}>
          {sel.session ? (
            <>
              {/* Colored top tab */}
              <View style={[s.logTab, { backgroundColor: sel.accent }]} />

              <View style={s.logBody}>
                {/* Top row: date + day badge */}
                <View style={s.logTopRow}>
                  <Text style={s.logDate}>
                    {new Date(year, month, sel.day)
                      .toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
                      .toUpperCase()}
                  </Text>
                  <View style={[s.logDayPill, { backgroundColor: rgba(sel.accent, 0.14), borderColor: rgba(sel.accent, 0.32) }]}>
                    <Text style={[s.logDayPillTxt, { color: sel.accent }]}>DAY {sel.session.dayPosition}</Text>
                  </View>
                </View>

                {/* Workout name — hero text */}
                <Text style={s.logWorkoutName}>{sel.session.dayLabel.toUpperCase()}</Text>

                {/* Volume hero */}
                <Text style={s.logVolumeRow}>
                  <Text style={[s.logVolumeNum, { color: sel.accent }]}>
                    {Math.round(sel.session.totalVolume).toLocaleString()}
                  </Text>
                  <Text style={s.logVolumeUnit}> kg  </Text>
                  <Text style={s.logMeta}>
                    {sel.session.exercises.reduce((a,e)=>a+e.sets.filter(st=>st.isCompleted).length,0)} sets
                    {'  ·  '}
                    {sel.session.duration > 0 ? `${sel.session.duration}min` : `${sel.session.exercises.length} exercises`}
                  </Text>
                </Text>

                {/* Exercise breakdown */}
                <View style={s.logExList}>
                  {sel.session.exercises.slice(0, 4).map((ex, i) => {
                    const completedSets = ex.sets.filter(st=>st.isCompleted).length;
                    const reps          = ex.sets[0]?.targetReps ?? null;
                    const wt            = ex.sets[0]?.targetWeight;
                    return (
                      <View key={i} style={s.logExRow}>
                        <Text style={s.logExName} numberOfLines={1}>{ex.exerciseName}</Text>
                        <Text style={s.logExDetail}>
                          {completedSets}×{reps ?? '—'}
                          {wt ? `  @${wt}kg` : ''}
                        </Text>
                      </View>
                    );
                  })}
                  {sel.session.exercises.length > 4 && (
                    <Text style={s.logExMore}>+{sel.session.exercises.length - 4} more exercises</Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <View style={[s.logBody, s.logEmpty]}>
              <Text style={s.logEmptyDate}>
                {new Date(year, month, sel.day)
                  .toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
              </Text>
              <Text style={s.logEmptyTxt}>No session recorded</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Legend ── */}
      <View style={s.legend}>
        {/* Volume intensity */}
        <View style={s.legendRow}>
          <Text style={s.legendKey}>vol</Text>
          {[0.06, 0.30, 0.54, 0.76, 0.97].map((a,i) => (
            <View key={i} style={[s.legendSq, { backgroundColor: `rgba(255,140,0,${a})` }]} />
          ))}
          <View style={s.legendDivider} />
          {/* Cycle day dots — only days seen this month */}
          {usedPos.map(dp => {
            const color  = CYCLE_COLORS[(dp-1)%CYCLE_COLORS.length];
            const dayObj = activePlan?.days.find(d => d.dayPosition === dp);
            const label  = (dayObj?.label ?? `D${dp}`).split(' ')[0];
            return (
              <View key={dp} style={s.legendDay}>
                <View style={[s.legendDot, { backgroundColor: color }]} />
                <Text style={[s.legendDayTxt, { color }]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL    = 38;
const GAP     = 3;
const CR      = 8;
const CL_W    = 26; // cycle label column width

const s = StyleSheet.create({
  root: { marginHorizontal: 20, marginBottom: 8 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  title:       { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4, marginBottom: 3 },
  sub:         { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.1 },
  navRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navArrow:    { fontSize: 22, color: COLORS.textSecondary, lineHeight: 26, fontWeight: '300' },
  navLabel:    { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, minWidth: 68, textAlign: 'center' },

  // Day names row
  dayNameRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cycleLabelSpacer: { width: CL_W + 6 },
  dayName:          { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: 'rgba(255,240,220,0.22)', letterSpacing: 0.8 },

  // Grid area: cycle labels + cells
  gridArea:  { flexDirection: 'row', gap: 6 },

  // Cycle label column
  cycleCol:       { width: CL_W, gap: GAP },
  cycleLabelCell: { height: CELL, justifyContent: 'center', alignItems: 'center' },
  cycleLabelNum:  { fontSize: 9, fontWeight: '800', color: COLORS.textLabel, letterSpacing: 0.5 },
  cycleLabelDash: { fontSize: 9, color: 'rgba(255,240,220,0.10)' },

  // Grid
  grid:      { flex: 1, gap: GAP },
  weekRow:   { flexDirection: 'row', gap: GAP },
  emptyCell: { flex: 1, height: CELL },
  cell:      { flex: 1, height: CELL, borderRadius: CR, alignItems: 'center', justifyContent: 'center' },

  cellNum:       { fontSize: 12, fontWeight: '400', color: 'rgba(255,240,220,0.20)' },
  cellNumSess:   { fontWeight: '700', color: '#fff' },
  cellNumToday:  { color: COLORS.accent, fontWeight: '800' },

  // Training log card
  logCard: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,240,220,0.04)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,240,220,0.08)',
  },
  logTab:  { height: 3, width: '100%' },
  logBody: { padding: 14, gap: 6 },

  logTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logDate:      { fontSize: 10, fontWeight: '700', color: COLORS.textLabel, letterSpacing: 1.2 },
  logDayPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  logDayPillTxt:{ fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  logWorkoutName:{ fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },

  logVolumeRow:  { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  logVolumeNum:  { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  logVolumeUnit: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  logMeta:       { fontSize: 12, color: COLORS.textLabel },

  logExList: { marginTop: 6, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', paddingTop: 10 },
  logExRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logExName: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  logExDetail:{ fontSize: 12, color: COLORS.textLabel, fontVariant: ['tabular-nums'] },
  logExMore: { fontSize: 11, color: COLORS.textLabel, marginTop: 2 },

  logEmpty:     { alignItems: 'center', paddingVertical: 12 },
  logEmptyDate: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  logEmptyTxt:  { fontSize: 12, color: COLORS.textLabel },

  // Legend — one compact row
  legend:       { marginTop: 12 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  legendKey:    { fontSize: 9, fontWeight: '700', color: COLORS.textLabel, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 3 },
  legendSq:     { width: 12, height: 12, borderRadius: 3 },
  legendDivider:{ width: 1, height: 12, backgroundColor: 'rgba(255,240,220,0.12)', marginHorizontal: 4 },
  legendDay:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:    { width: 7, height: 7, borderRadius: 2 },
  legendDayTxt: { fontSize: 10, fontWeight: '700' },
});
