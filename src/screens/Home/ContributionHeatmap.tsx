import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, DAY_COLOR, FONTS } from '../../constants';
import { WorkoutSession, WorkoutPlan, WorkoutDay } from '../../types';

// ─── Color maps ───────────────────────────────────────────────────────────────

const REST_STONE    = '#A8A29E';
const DEFAULT_COLOR = '#636366';
const MISSED_RED    = '#EF4444';

const MONTH_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_ABBR = ['S','M','T','W','T','F','S'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// Same as CycleScreen — converts a Date to YYYY-MM-DD in LOCAL time so
// UTC± offsets never shift a session onto the wrong calendar day.
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sel { day: number; session: WorkoutSession | null; }
interface Props {
  sessions:       WorkoutSession[];
  activePlan?:    WorkoutPlan | null;
  cycleStartDate: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContributionHeatmap({ sessions, activePlan, cycleStartDate }: Props) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel,  setSel]  = useState<Sel | null>(null);

  const year  = view.getFullYear();
  const month = view.getMonth();
  const all   = sessions;

  const splitName = activePlan?.name ?? 'Workout';

  // ── Anchor — cycle start at local midnight (mirrors CycleScreen) ─────────────
  const anchor = useMemo((): Date | null => {
    if (!cycleStartDate) return null;
    const d = new Date(cycleStartDate + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cycleStartDate]);

  // ── Slot helpers — identical algorithm to CycleScreen ────────────────────────
  // Returns the 0-based slot index for any calendar date, or null if the date
  // is before the cycle anchor. diff % days.length mirrors the CycleScreen bars.

  const daysLen = activePlan?.days.length ?? 7;

  const diffFromAnchor = (d: Date): number | null => {
    if (!anchor) return null;
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    midnight.setHours(0, 0, 0, 0);
    const diff = Math.floor((midnight.getTime() - anchor.getTime()) / 86_400_000);
    return diff < 0 ? null : diff;
  };

  const slotForCalDay = (calDay: number): number | null => {
    const diff = diffFromAnchor(new Date(year, month, calDay));
    return diff !== null ? diff % daysLen : null;
  };

  const planDayForCalDay = (calDay: number): WorkoutDay | null => {
    if (!activePlan) return null;
    const slot = slotForCalDay(calDay);
    return slot !== null ? (activePlan.days[slot] ?? null) : null;
  };

  // Cycle index (0, 1, 2 …) for a calendar day — used for pill grouping.
  const cycleForCalDay = (calDay: number): number | null => {
    const diff = diffFromAnchor(new Date(year, month, calDay));
    return diff !== null ? Math.floor(diff / daysLen) : null;
  };

  // Cycle index that contains today.
  const todayCycleIdx = useMemo((): number | null => {
    const diff = diffFromAnchor(today);
    return diff !== null ? Math.floor(diff / daysLen) : null;
  }, [anchor, daysLen]);

  // ── Session lookup by day position (content-id) ───────────────────────────────
  // Used for legend / cycle-info where sessions store their stable dayPosition.
  const isRestDay = (dayPos: number) =>
    activePlan?.days.find(d => d.dayPosition === dayPos)?.isRestDay ?? false;

  // ── dayMap — local-date string → best session for that calendar day ──────────
  const dayMap = useMemo(() => {
    const m = new Map<number, WorkoutSession>();
    all.forEach(s => {
      if (s.status !== 'completed' || !s.finishedAt) return;
      const d = new Date(s.finishedAt);
      // Use local year/month/date — same as CycleScreen toLocalDate approach.
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const day = d.getDate();
      const cur = m.get(day);
      if (!cur || s.totalVolume > cur.totalVolume) m.set(day, s);
    });
    return m;
  }, [all, year, month]);

  const maxVol     = useMemo(() => Math.max(...all.map(s => s.totalVolume), 1), [all]);
  const monthCount = dayMap.size;

  // ── First session date — no day before this can be "Missed" ──────────────────
  // Prevents retroactive red markers for periods before the user started training.
  const firstSessionDate = useMemo((): Date | null => {
    const completed = all.filter(s => s.status === 'completed' && s.finishedAt);
    if (!completed.length) return null;
    return completed.reduce<Date | null>((earliest, s) => {
      const d = new Date(s.finishedAt!);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return !earliest || midnight < earliest ? midnight : earliest;
    }, null);
  }, [all]);

  // ── Unique workout day positions for the legend ───────────────────────────────
  const usedPos = useMemo(() => {
    const positions = [...new Set(
      [...dayMap.values()]
        .filter(s => !isRestDay(s.dayPosition))
        .map(s => s.dayPosition),
    )].sort();
    const seen = new Set<string>();
    return positions.filter(dp => {
      const label = activePlan?.days.find(d => d.dayPosition === dp)?.label ?? `Day ${dp}`;
      if (label.toLowerCase().trim() === 'rest') return false;
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  }, [dayMap, activePlan]);

  // ── planId → name map for cycle pills ────────────────────────────────────────
  const planSplitMap = useMemo(() => {
    const m = new Map<string, string>();
    if (activePlan) m.set(activePlan.id, activePlan.name);
    return m;
  }, [activePlan]);

  // ── Per-cycle pill style ──────────────────────────────────────────────────────
  const cycleInfo = useMemo(() => {
    const info = new Map<number, { color: string; title: string }>();
    if (!anchor) return info;

    const byIdx = new Map<number, WorkoutSession[]>();
    all.forEach(s => {
      if (s.status !== 'completed' || !s.finishedAt) return;
      const d = new Date(s.finishedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const idx = cycleForCalDay(d.getDate());
      if (idx === null) return;
      const arr = byIdx.get(idx);
      if (arr) arr.push(s); else byIdx.set(idx, [s]);
    });

    byIdx.forEach((sess, idx) => {
      const counts = new Map<string, number>();
      sess.forEach(s => {
        if (isRestDay(s.dayPosition)) return;
        const c = DAY_COLOR[s.dayPosition] ?? DEFAULT_COLOR;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      });
      const color = counts.size
        ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : DEFAULT_COLOR;
      const title = planSplitMap.get(sess[0].planId) ?? splitName;
      info.set(idx, { color, title });
    });

    // Active cycle always uses the live plan's accent so renaming mid-cycle is reflected.
    if (todayCycleIdx !== null) {
      info.set(todayCycleIdx, { color: COLORS.accent, title: splitName });
    }
    return info;
  }, [all, planSplitMap, splitName, year, month, anchor, todayCycleIdx, activePlan]);

  const cycleStyleFor = (segDays: number[]): { color: string; title: string } | null => {
    if (!segDays.length) return null;
    const idx = cycleForCalDay(segDays[0]);
    return idx !== null ? (cycleInfo.get(idx) ?? null) : null;
  };

  // ── Cycle segments — split a week row at slot-0 boundaries ───────────────────
  // A new cycle pill begins when the slot wraps back to 0 (start of the next
  // daysLen-day cycle window), mirroring CycleScreen's slot calculation.
  const cycleSegments = (rowDays: number[]): number[][] => {
    if (!anchor || !activePlan) return rowDays.length ? [rowDays] : [];
    const out: number[][] = [];
    let cur: number[] = [];
    for (const day of rowDays) {
      const slot = slotForCalDay(day);
      // slot === 0 means this day is the start of a new cycle window.
      if (slot === 0 && cur.length > 0) { out.push(cur); cur = []; }
      cur.push(day);
    }
    if (cur.length) out.push(cur);
    return out;
  };

  // ── Calendar grid ─────────────────────────────────────────────────────────────
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const isTodayFn = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const onPress  = (day: number) =>
    setSel(prev => prev?.day === day ? null : { day, session: dayMap.get(day) ?? null });
  const navMonth = (delta: number) => { setView(new Date(year, month + delta, 1)); setSel(null); };

  // ── Detail-card state ─────────────────────────────────────────────────────────
  const selSess    = sel?.session ?? null;
  const selPlanDay = sel ? planDayForCalDay(sel.day) : null;
  const selIsRest  = selPlanDay
    ? selPlanDay.isRestDay
    : (selSess ? isRestDay(selSess.dayPosition) : false);
  const selIsPast  = sel ? new Date(year, month, sel.day) < today : false;
  const selIsToday = sel ? isTodayFn(sel.day) : false;
  const selColor   = selIsRest
    ? REST_STONE
    : (selSess ? (DAY_COLOR[selSess.dayPosition] ?? DEFAULT_COLOR) : DEFAULT_COLOR);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Training Log</Text>
          <Text style={s.sub}>
            <Text style={s.subAccent}>{splitName}</Text>
            {'  ·  '}{monthCount} session{monthCount !== 1 ? 's' : ''} in {MONTH_FULL[month]}
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

      {/* ── Calendar ── */}
      <View style={s.enclosure}>
        <View style={s.dayNameRow}>
          {DAY_ABBR.map((d, i) => <Text key={i} style={s.dayName}>{d}</Text>)}
        </View>

        <View style={s.grid}>
          {weeks.map((week, wi) => {
            const firstReal = week.findIndex(d => d !== null);
            const lastReal  = week.reduce<number>((l, d, i) => (d !== null ? i : l), -1);
            if (firstReal === -1) return null;

            const preCount  = firstReal;
            const postCount = week.length - 1 - lastReal;
            const pillDays  = week.slice(firstReal, lastReal + 1).filter((d): d is number => d !== null);
            const segments  = cycleSegments(pillDays);

            return (
              <View key={wi} style={s.weekWrap}>
                <View style={s.weekRow}>
                  {Array.from({ length: preCount }).map((_, i) => (
                    <View key={`pre-${i}`} style={s.weekSlot} />
                  ))}

                  {segments.map((segDays, si) => {
                    const style      = cycleStyleFor(segDays);
                    const pillColor  = style?.color ?? null;

                    // Pill edge rounding — flatten where a cycle continues across
                    // a row boundary so the 7-day band reads as one continuous strip.
                    const firstSlot = slotForCalDay(segDays[0]);
                    const lastSlot  = slotForCalDay(segDays[segDays.length - 1]);
                    const continuesLeft  = firstSlot !== null && firstSlot > 0;
                    const continuesRight = lastSlot  !== null && lastSlot  < daysLen - 1;

                    return (
                      <View key={`seg-${si}`} style={[s.pillWrap, { flex: segDays.length }]}>
                        <View style={[
                          s.weekPill,
                          pillColor
                            ? { backgroundColor: rgba(pillColor, 0.08) }
                            : s.weekPillEmpty,
                          continuesLeft  && { borderTopLeftRadius:    4, borderBottomLeftRadius:    4 },
                          continuesRight && { borderTopRightRadius:   4, borderBottomRightRadius:   4 },
                        ]}>
                          {segDays.map((day, di) => {
                            const sess      = dayMap.get(day) ?? null;
                            const todayD    = isTodayFn(day);
                            const active    = sel?.day === day;
                            const isPast    = new Date(year, month, day) < today;

                            const planDay   = planDayForCalDay(day);
                            const schedRest = planDay
                              ? planDay.isRestDay
                              : (!!sess && isRestDay(sess.dayPosition));

                            const color = sess && !schedRest
                              ? (DAY_COLOR[sess.dayPosition] ?? DEFAULT_COLOR)
                              : null;

                            // Missed: past workout slot with no session —
                            // but only on or after the user's first ever session
                            // so pre-activity cycle iterations aren't penalised.
                            const cellDate   = new Date(year, month, day);
                            const afterStart = !firstSessionDate || cellDate >= firstSessionDate;
                            const missed     = !sess && isPast && !todayD
                              && !!planDay && !planDay.isRestDay
                              && !!cycleStartDate && afterStart;

                            const isRestCell    = schedRest;
                            const isPastOrToday = isPast || todayD;

                            const showAsRest   = isRestCell && (pillColor !== null || isPastOrToday);
                            const previewColor = !color && !missed && !isRestCell && pillColor && planDay && !sess && !isPast
                              ? (DAY_COLOR[planDay.dayPosition] ?? DEFAULT_COLOR)
                              : null;

                            let bgStyle: object | null = null;
                            if (color) {
                              bgStyle = { backgroundColor: rgba(color, 0.20), borderColor: rgba(color, 0.42) };
                            } else if (missed) {
                              bgStyle = { backgroundColor: rgba(MISSED_RED, 0.06), borderColor: rgba(MISSED_RED, 0.75) };
                            } else if (showAsRest && pillColor && isPastOrToday) {
                              bgStyle = { backgroundColor: rgba(pillColor, 0.14), borderColor: rgba(pillColor, 0.30) };
                            } else if (showAsRest && pillColor) {
                              bgStyle = { backgroundColor: rgba(REST_STONE, 0.10), borderColor: rgba(REST_STONE, 0.22) };
                            } else if (showAsRest) {
                              bgStyle = { backgroundColor: rgba(REST_STONE, 0.16), borderColor: rgba(REST_STONE, 0.30) };
                            } else if (previewColor) {
                              bgStyle = { backgroundColor: rgba(previewColor, 0.14), borderColor: rgba(previewColor, 0.55) };
                            } else {
                              bgStyle = s.cellEmpty;
                            }

                            const fh = color ? fillHeight(sess!.totalVolume, maxVol) : 0;

                            return (
                              <TouchableOpacity
                                key={di}
                                onPress={() => onPress(day)}
                                activeOpacity={0.75}
                                style={[s.cell, bgStyle, todayD && s.cellToday, active && s.cellActive]}
                              >
                                {color && fh > 0 && (
                                  <View style={[s.fillBar, { height: fh, backgroundColor: rgba(color, 0.88) }]} />
                                )}
                                <Text style={[
                                  s.cellNum,
                                  !sess && !todayD && !showAsRest && !missed && !previewColor && s.cellNumEmpty,
                                  showAsRest && s.cellNumRest,
                                  todayD && !sess && s.cellNumToday,
                                  !!color && s.cellNumSess,
                                  missed       && { color: rgba(MISSED_RED, 0.70),    fontWeight: '600' } as any,
                                  !!previewColor && !todayD && { color: rgba(previewColor, 0.65), fontWeight: '600' } as any,
                                ]}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}

                  {Array.from({ length: postCount }).map((_, i) => (
                    <View key={`post-${i}`} style={s.weekSlot} />
                  ))}
                </View>

                {/* Active-cycle label — centred under this week's active segment */}
                {activePlan && (() => {
                  let preFlex  = preCount;
                  let activeSeg: number[] | null = null;
                  for (const seg of segments) {
                    if (cycleForCalDay(seg[0]) === todayCycleIdx) { activeSeg = seg; break; }
                    preFlex += seg.length;
                  }
                  if (!activeSeg) return null;
                  const activeFlex = activeSeg.length;
                  const postFlex   = 7 - preFlex - activeFlex;
                  return (
                    <View style={s.activeCycleRow}>
                      {preFlex  > 0 && <View style={{ flex: preFlex }} />}
                      <View style={[s.activeCycleBanner, { flex: activeFlex }]}>
                        <Text style={s.activeCycleName} numberOfLines={1}>{splitName}</Text>
                      </View>
                      {postFlex > 0 && <View style={{ flex: postFlex }} />}
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Detail card — shown on day tap ── */}
      {sel && (
        <GlassView radius={14} style={s.card} borderColor={rgba(selColor, 0.28)}>
          {selIsRest ? (
            <View style={s.cardEmpty}>
              <Text style={s.cardEmptyDate}>
                {new Date(year, month, sel.day)
                  .toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
              </Text>
              <View style={[s.cardPill, { borderColor: rgba(REST_STONE, 0.45), backgroundColor: rgba(REST_STONE, 0.14), marginTop: 6 }]}>
                <Text style={[s.cardPillTxt, { color: REST_STONE }]}>
                  {selIsToday ? 'REST · TODAY' : selIsPast ? 'REST · COMPLETED' : 'REST · SCHEDULED'}
                </Text>
              </View>
              <Text style={[s.cardEmptyTxt, { marginTop: 8 }]}>
                {selIsToday ? 'Take it easy today — no workout scheduled.' : selIsPast ? 'Recovery day — auto-completed.' : 'Recovery day — no workout scheduled.'}
              </Text>
            </View>
          ) : selSess ? (
            <View style={s.cardBody}>
              <View style={s.cardTopRow}>
                <Text style={s.cardDateTxt}>
                  {new Date(year, month, sel.day)
                    .toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
                    .toUpperCase()}
                </Text>
                <View style={[s.cardPill, { borderColor: rgba(selColor, 0.45), backgroundColor: rgba(selColor, 0.14) }]}>
                  <Text style={[s.cardPillTxt, { color: selColor }]}>{selSess.dayLabel}</Text>
                </View>
              </View>
              <View style={s.cardVolRow}>
                <Text style={[s.cardVolNum, { color: selColor }]}>
                  {Math.round(selSess.totalVolume).toLocaleString()}
                </Text>
                <Text style={s.cardVolUnit}> kg</Text>
              </View>
              <Text style={s.cardMeta}>
                {selSess.exercises.reduce((a, e) => a + e.sets.filter(st => st.isCompleted).length, 0)} sets
                {'  ·  '}{selSess.exercises.length} exercises
                {selSess.duration > 0 ? `  ·  ${selSess.duration} min` : ''}
              </Text>
              {selSess.exercises.length > 0 && (
                <View style={s.cardExWrap}>
                  {selSess.exercises.slice(0, 4).map((ex, i) => {
                    const reps = ex.sets[0]?.targetReps ?? null;
                    const wt   = ex.sets[0]?.targetWeight;
                    return (
                      <View key={i} style={s.cardExRow}>
                        <Text style={s.cardExName} numberOfLines={1}>{ex.exerciseName}</Text>
                        <Text style={s.cardExDetail}>
                          {ex.sets.filter(st => st.isCompleted).length}×{reps ?? '–'}
                          {wt ? `  @${wt}kg` : ''}
                        </Text>
                      </View>
                    );
                  })}
                  {selSess.exercises.length > 4 && (
                    <Text style={s.cardExMore}>+{selSess.exercises.length - 4} more</Text>
                  )}
                </View>
              )}
            </View>
          ) : (() => {
            const selCycleIdx   = sel ? cycleForCalDay(sel.day) : null;
            const selInCycle    = selCycleIdx !== null && cycleInfo.has(selCycleIdx);
            const selDayColor   = selPlanDay && !selPlanDay.isRestDay
              ? (DAY_COLOR[selPlanDay.dayPosition] ?? DEFAULT_COLOR)
              : null;
            const showScheduled = selInCycle && selPlanDay && !selPlanDay.isRestDay && (selIsToday || !selIsPast);
            return (
              <View style={s.cardEmpty}>
                <Text style={s.cardEmptyDate}>
                  {new Date(year, month, sel.day)
                    .toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                </Text>
                {showScheduled && selDayColor && (
                  <View style={[s.cardPill, { borderColor: rgba(selDayColor, 0.45), backgroundColor: rgba(selDayColor, 0.14), marginTop: 6 }]}>
                    <Text style={[s.cardPillTxt, { color: selDayColor }]}>
                      {selPlanDay!.label.toUpperCase()} · {selIsToday ? 'TODAY' : 'UPCOMING'}
                    </Text>
                  </View>
                )}
                <Text style={[s.cardEmptyTxt, showScheduled && { marginTop: 8 }]}>
                  {selIsToday ? 'No session yet today.' : selIsPast ? 'No session logged.' : showScheduled ? 'Scheduled — no session yet.' : 'Upcoming — no session yet.'}
                </Text>
              </View>
            );
          })()}
        </GlassView>
      )}

      {/* ── Legend ── */}
      <View style={s.legend}>
        <View style={s.legendWorkout}>
          <View style={[s.legendCell, { backgroundColor: rgba(REST_STONE, 0.18) }]} />
          <Text style={[s.legendWorkoutTxt, { color: REST_STONE }]}>Rest</Text>
        </View>
        {!!cycleStartDate && (
          <View style={s.legendWorkout}>
            <View style={[s.legendCell, { backgroundColor: rgba(MISSED_RED, 0.06), borderWidth: 1.5, borderColor: rgba(MISSED_RED, 0.75) }]} />
            <Text style={[s.legendWorkoutTxt, { color: rgba(MISSED_RED, 0.80) }]}>Missed</Text>
          </View>
        )}
        {usedPos.map(dp => {
          const color  = DAY_COLOR[dp] ?? DEFAULT_COLOR;
          const dayObj = activePlan?.days.find(d => d.dayPosition === dp);
          const label  = dayObj?.label ?? `Day ${dp}`;
          return (
            <View key={dp} style={s.legendWorkout}>
              <View style={[s.legendCell, { backgroundColor: rgba(color, 0.18) }]}>
                <View style={[s.legendFill, { backgroundColor: rgba(color, 0.88), height: '75%' }]} />
              </View>
              <Text style={[s.legendWorkoutTxt, { color }]} numberOfLines={1}>{label}</Text>
            </View>
          );
        })}
        <Text style={s.legendNote}>bar height = volume</Text>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL     = 40;
const GAP      = 4;
const CELL_GAP = 4;
const PILL_PAD = CELL_GAP / 2;

function fillHeight(vol: number, max: number): number {
  if (!vol || !max) return 0;
  return Math.round(4 + Math.min(vol / max, 1) * (CELL - 4));
}

const s = StyleSheet.create({
  root: { marginHorizontal: 20, marginBottom: 8 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  title:     { fontSize: 17, fontWeight: '800', fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.68, marginBottom: 3 },
  sub:       { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },
  subAccent: { fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textSecondary },
  navRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navArrow:  { fontSize: 22, color: COLORS.textSecondary, lineHeight: 26, fontWeight: '300' },
  navLabel:  { fontSize: 11, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0.88, textTransform: 'uppercase', minWidth: 68, textAlign: 'center' },

  enclosure: { borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', borderRadius: 16, padding: 12, marginBottom: 10 },

  dayNameRow: { flexDirection: 'row', marginBottom: 4 },
  dayName:    { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', fontFamily: FONTS.headline, color: 'rgba(255,240,220,0.22)' },

  activeCycleRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2 },
  activeCycleBanner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  activeCycleName:   { fontSize: 10, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.80, textTransform: 'uppercase', textAlign: 'center' },

  grid:          { gap: GAP },
  weekWrap:      {},
  weekRow:       { flexDirection: 'row', alignItems: 'center' },
  weekSlot:      { flex: 1 },
  weekPill:      { flexDirection: 'row', borderRadius: 999, height: CELL + 8, paddingHorizontal: PILL_PAD, gap: CELL_GAP, alignItems: 'center', alignSelf: 'stretch' },
  weekPillEmpty: { backgroundColor: 'rgba(255,240,220,0.04)' },
  pillWrap:      { alignItems: 'center' },

  cell:       { flex: 1, aspectRatio: 1, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  cellEmpty:  { backgroundColor: 'rgba(255,240,220,0.04)' },
  cellToday:  { borderWidth: 2, borderColor: 'rgba(255,140,0,0.70)' },
  cellActive: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
  fillBar:    { position: 'absolute', bottom: 0, left: 0, right: 0 },

  cellNum:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  cellNumEmpty: { color: 'rgba(255,240,220,0.20)', fontWeight: '400' },
  cellNumToday: { color: COLORS.accent, fontWeight: '800' },
  cellNumSess:  { color: '#fff', fontWeight: '700' },
  cellNumRest:  { color: 'rgba(168,162,158,0.65)', fontWeight: '500' },

  card:        { marginTop: 10 },
  cardBody:    { padding: 14, gap: 5 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardDateTxt: { fontSize: 10, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textLabel, letterSpacing: 0.80, textTransform: 'uppercase' },
  cardPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  cardPillTxt: { fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline },
  cardVolRow:  { flexDirection: 'row', alignItems: 'baseline' },
  cardVolNum:  { fontSize: 30, fontWeight: '800', fontFamily: FONTS.data, letterSpacing: -1.20 },
  cardVolUnit: { fontSize: 14, fontWeight: '500', fontFamily: FONTS.medium, color: COLORS.textMuted },
  cardMeta:    { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textLabel },
  cardExWrap:  { marginTop: 8, gap: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', paddingTop: 10 },
  cardExRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardExName:  { fontSize: 13, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary, flex: 1 },
  cardExDetail:{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.textLabel, fontVariant: ['tabular-nums'] },
  cardExMore:  { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textLabel },
  cardEmpty:     { padding: 16, alignItems: 'center' },
  cardEmptyDate: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.textSecondary, marginBottom: 4 },
  cardEmptyTxt:  { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textLabel },

  legend:         { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  legendWorkout:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell:     { width: 16, height: 16, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  legendFill:     { width: '100%' },
  legendWorkoutTxt:{ fontSize: 10, fontWeight: '700', fontFamily: FONTS.headline, maxWidth: 70 },
  legendNote:     { fontSize: 9, fontFamily: FONTS.body, color: COLORS.textLabel, fontStyle: 'italic', marginLeft: 'auto' as any },
});
