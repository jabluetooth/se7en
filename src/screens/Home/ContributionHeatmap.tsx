import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, DAY_COLOR } from '../../constants';
import { WorkoutSession, WorkoutPlan, WorkoutDay } from '../../types';
import { dayPositionForDate } from '../../utils/cycleUtils';

// ─── Color maps ───────────────────────────────────────────────────────────────

const REST_STONE    = '#A8A29E';  // warm stone — rest days
const DEFAULT_COLOR = '#636366';  // fallback gray
const MISSED_RED    = '#EF4444';  // pure red outline for missed workout days

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

  const all = sessions;

  const splitName = activePlan?.name ?? 'Workout';

  const isRestDay = (dayPos: number) =>
    activePlan?.days.find(d => d.dayPosition === dayPos)?.isRestDay ?? false;

  // Returns the plan day for a calendar date using the cycle anchor.
  // `pos` (1-7) maps to the visible *slot* in the user's reordered plan, not
  // to the stable `dayPosition` content-id — same convention as the Cycle
  // screen so today's calendar cell paints the same exercise that's currently
  // showing as "Today" on the Cycle tab.
  const planDayForCalDay = (calDay: number): WorkoutDay | null => {
    const pos = dayPositionForDate(cycleStartDate, new Date(year, month, calDay));
    if (pos === null || !activePlan) return null;
    return activePlan.days[pos - 1] ?? null;
  };

  // planId → splitType — when a user changes plans mid-cycle,
  // each week row will show the correct split for that week.
  const planSplitMap = useMemo(() => {
    const m = new Map<string, string>();
    if (activePlan) m.set(activePlan.id, activePlan.name);
    return m;
  }, [activePlan]);

  // ── Cycle-index helpers ──
  // A "cycle" is one 7-day window since cycleStartDate, indexed from 0.
  // Used to key per-cycle pill colour/title so a cycle that spans a Sat→Sun
  // row boundary gets the SAME highlight on both rows (cross-row continuity).
  const cycleForDay = (calDay: number): number | null => {
    if (!cycleStartDate) return null;
    const start = new Date(cycleStartDate + 'T00:00:00'); start.setHours(0,0,0,0);
    const target = new Date(year, month, calDay);       target.setHours(0,0,0,0);
    const diff = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
    return diff < 0 ? null : Math.floor(diff / 7);
  };

  // Index of the cycle that contains today — always rendered, even with zero
  // sessions, so the user sees "what's currently on the Cycle screen".
  const todayCycleIdx: number | null = useMemo(() => {
    if (!cycleStartDate) return null;
    const start = new Date(cycleStartDate + 'T00:00:00'); start.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    const diff = Math.floor((t.getTime() - start.getTime()) / 86_400_000);
    return diff < 0 ? null : Math.floor(diff / 7);
  }, [cycleStartDate]);

  // day-of-month → best session (highest volume)
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

  // Unique non-rest workout day positions; deduplicate legend entries by label
  const usedPos = useMemo(() => {
    const positions = [...new Set(
      [...dayMap.values()]
        .filter(s => !isRestDay(s.dayPosition))
        .map(s => s.dayPosition),
    )].sort();
    const seenLabels = new Set<string>();
    return positions.filter(dp => {
      const label = activePlan?.days.find(d => d.dayPosition === dp)?.label ?? `Day ${dp}`;
      if (label.toLowerCase().trim() === 'rest') return false;
      if (seenLabels.has(label)) return false;
      seenLabels.add(label);
      return true;
    });
  }, [dayMap, activePlan]);

  // Build grid — standard Sun→Sat calendar.
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length/7 }, (_, i) => cells.slice(i*7, i*7+7));

  const isTodayFn = (d: number) =>
    today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;

  // Split a row's days into cycle-aligned segments. A new segment starts on any
  // day whose cycle position is 1 (the user's cycle start day-of-week). This
  // keeps pills bound to the user's cycle (e.g. Tue→Mon) instead of Sun→Sat.
  const cycleSegments = (days: number[]): number[][] => {
    if (!cycleStartDate) return days.length ? [days] : [];
    const out: number[][] = [];
    let cur: number[] = [];
    for (const day of days) {
      const pos = dayPositionForDate(cycleStartDate, new Date(year, month, day));
      if (pos === 1 && cur.length > 0) { out.push(cur); cur = []; }
      cur.push(day);
    }
    if (cur.length) out.push(cur);
    return out;
  };

  // Per-cycle pill style — keyed by cycle index so a cycle that spans rows
  // shares one colour and one title across all its segments. Past cycles
  // derive style from their own sessions; the active cycle always renders
  // with the active plan's accent + name so "what's on the Cycle screen"
  // is always reflected, even with zero sessions yet.
  const cycleInfo = useMemo(() => {
    const info = new Map<number, { color: string; title: string }>();
    if (!cycleStartDate) return info;

    const sessionsByCycle = new Map<number, WorkoutSession[]>();
    all.forEach(s => {
      if (s.status !== 'completed' || !s.finishedAt) return;
      const d = new Date(s.finishedAt);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const idx = cycleForDay(d.getDate());
      if (idx === null) return;
      const arr = sessionsByCycle.get(idx);
      if (arr) arr.push(s); else sessionsByCycle.set(idx, [s]);
    });

    sessionsByCycle.forEach((sess, idx) => {
      const counts = new Map<string, number>();
      sess.forEach(s => {
        if (isRestDay(s.dayPosition)) return;
        const c = DAY_COLOR[s.dayPosition] ?? DEFAULT_COLOR;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      });
      const color = counts.size
        ? [...counts.entries()].sort((a,b) => b[1] - a[1])[0][0]
        : DEFAULT_COLOR;
      const title = planSplitMap.get(sess[0].planId) ?? splitName;
      info.set(idx, { color, title });
    });

    // Active cycle: always present, always uses the active plan's name +
    // accent. Overrides any session-derived style so changing the active
    // plan mid-cycle "cuts" the highlight and re-labels this week.
    if (todayCycleIdx !== null) {
      info.set(todayCycleIdx, { color: COLORS.accent, title: splitName });
    }
    return info;
  }, [all, planSplitMap, splitName, year, month, cycleStartDate, todayCycleIdx, activePlan]);

  const cycleStyleFor = (segDays: number[]): { color: string; title: string } | null => {
    if (!segDays.length) return null;
    const idx = cycleForDay(segDays[0]);
    if (idx === null) return null;
    // Only active cycle + past cycles with session history get a pill. Future
    // cycles are intentionally not previewed — the user may swap the plan or
    // edit it before getting there, so anything past this week's cycle is
    // treated as unknown territory.
    return cycleInfo.get(idx) ?? null;
  };

  const onPress = (day: number) =>
    setSel(prev => prev?.day === day ? null : { day, session: dayMap.get(day) ?? null });

  const navMonth = (delta: number) => { setView(new Date(year, month+delta, 1)); setSel(null); };

  const selSess    = sel?.session ?? null;
  // Rest-day status comes from the plan schedule for the tapped date — NOT
  // from the session — because rest days have no session record.
  // Falls back to the session's dayPosition only when no cycle is anchored.
  const selPlanDay = sel ? planDayForCalDay(sel.day) : null;
  const selIsRest  = selPlanDay
    ? selPlanDay.isRestDay
    : (selSess ? isRestDay(selSess.dayPosition) : false);
  const selIsPast  = sel ? new Date(year, month, sel.day) <  today : false;
  const selIsToday = sel ? isTodayFn(sel.day)                       : false;
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

      {/* ── Calendar enclosure ── */}
      <View style={s.enclosure}>

        {/* Day-name header */}
        <View style={s.dayNameRow}>
          {DAY_ABBR.map((d, i) => (
            <Text key={i} style={s.dayName}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {weeks.map((week, wi) => {
            // Pill trims null-padding: spans only the actual calendar days
            const firstReal = week.findIndex(d => d !== null);
            const lastReal  = week.reduce<number>((l, d, i) => (d !== null ? i : l), -1);
            if (firstReal === -1) return null;

            const preCount  = firstReal;
            const postCount = week.length - 1 - lastReal;
            const pillDays  = week.slice(firstReal, lastReal + 1).filter((d): d is number => d !== null);

            // Split the row at cycle boundaries → one pill per cycle slice
            const segments = cycleSegments(pillDays);

            return (
              <View key={wi} style={s.weekWrap}>

                {/* Row: pre-spacers + one pill-wrapper per cycle segment + post-spacers */}
                <View style={s.weekRow}>
                  {Array.from({ length: preCount }).map((_, i) => (
                    <View key={`pre-${i}`} style={s.weekSlot} />
                  ))}

                  {segments.map((segDays, si) => {
                    const style     = cycleStyleFor(segDays);
                    const pillColor = style?.color ?? null;

                    // Cycle continuity across rows — when a cycle spans a
                    // Sat→Sun (or any other) boundary, flatten the pill edges
                    // where it joins its sibling slice on the previous/next
                    // row so the 7 cycle days read as ONE continuous band.
                    const firstPos = cycleStartDate
                      ? dayPositionForDate(cycleStartDate, new Date(year, month, segDays[0]))
                      : null;
                    const lastPos  = cycleStartDate
                      ? dayPositionForDate(cycleStartDate, new Date(year, month, segDays[segDays.length - 1]))
                      : null;
                    const continuesLeft  = firstPos !== null && firstPos > 1;
                    const continuesRight = lastPos  !== null && lastPos  < 7;

                    return (
                      <View key={`seg-${si}`} style={[s.pillWrap, { flex: segDays.length }]}>
                        <View style={[
                          s.weekPill,
                          // Faint pill bg so the 7 cycle days still read as one
                          // grouped band, but each day's individual color (Push
                          // red, Pull teal, etc.) inside it stays dominant —
                          // mirrors what the Cycle screen shows.
                          pillColor
                            ? { backgroundColor: rgba(pillColor, 0.08) }
                            : s.weekPillEmpty,
                          continuesLeft  && { borderTopLeftRadius: 4,  borderBottomLeftRadius: 4 },
                          continuesRight && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
                        ]}>
                          {segDays.map((day, di) => {
                            const sess      = dayMap.get(day) ?? null;
                            const todayD    = isTodayFn(day);
                            const active    = sel?.day === day;
                            const isPast    = new Date(year, month, day) < today;

                            // Use cycle schedule to determine if this date is a rest day.
                            // Falls back to session's own dayPosition when no cycle is anchored.
                            const planDay   = planDayForCalDay(day);
                            const schedRest = planDay
                              ? planDay.isRestDay
                              : (!!sess && isRestDay(sess.dayPosition));

                            // Workout color — suppressed when schedule says rest
                            const color = sess && !schedRest
                              ? (DAY_COLOR[sess.dayPosition] ?? DEFAULT_COLOR)
                              : null;

                            // Past workout days with no logged session → red outline.
                            // Only applies when the cycle was actively anchored
                            // (cycleStartDate is set) so synthesized fallback dates
                            // don't retroactively mark days as missed.
                            const missed = !sess && isPast && !todayD && planDay && !planDay.isRestDay && !!cycleStartDate;

                            const isRestCell    = schedRest;
                            const isPastOrToday = isPast || todayD;

                            // Rest UI shows only when the cell is either
                            //   (a) inside the currently-highlighted cycle, or
                            //   (b) already past/today (auto-completed).
                            // Future rest days in NON-highlighted cycles (e.g.
                            // a Sunday three weeks out) read as plain upcoming.
                            const showAsRest = isRestCell && (pillColor !== null || isPastOrToday);

                            // Upcoming-workout PREVIEW colour — only inside the active
                            // cycle, for today or future workout days not yet logged.
                            const previewColor = !color && !missed && !isRestCell && pillColor && planDay && !sess && !isPast
                              ? (DAY_COLOR[planDay.dayPosition] ?? DEFAULT_COLOR)
                              : null;

                            // Cell bg + border priority:
                            //   1. Completed workout                → workout colour (done)
                            //   2. Missed workout (past, no sess)   → red outline
                            //   3. Past/today rest, in active cycle → cycle accent (auto-done)
                            //   4. Future rest, in active cycle     → faint REST_STONE
                            //   5. Past/today rest, outside cycle   → REST_STONE (auto-done generic)
                            //   6. Today/future workout, in cycle   → faint workout colour (preview)
                            //   7. Everything else                  → cellEmpty (neutral)
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
                              // Upcoming workout inside an active/future cycle.
                              // The day color needs to read clearly through the
                              // accent-orange pill bg (0.18), so the fill is
                              // boosted and the border is heavy enough to hold
                              // its own visually. Still distinct from completed
                              // cells (bg 0.20 + volume fill bar).
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
                                style={[
                                  s.cell,
                                  bgStyle,
                                  todayD && s.cellToday,
                                  active && s.cellActive,
                                ]}
                              >
                                {color && fh > 0 && (
                                  <View style={[s.fillBar, { height: fh, backgroundColor: rgba(color, 0.88) }]} />
                                )}
                                <Text style={[
                                  s.cellNum,
                                  !sess && !todayD && !showAsRest && !missed && !previewColor && s.cellNumEmpty,
                                  showAsRest && s.cellNumRest,
                                  todayD && !sess && s.cellNumToday,
                                  !!color    && s.cellNumSess,
                                  missed && { color: rgba(MISSED_RED, 0.70), fontWeight: '600' } as any,
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

                {/* Active-cycle caption — just the cycle title, centered under
                    the columns the active cycle's segment occupies in this row.
                    Renders on every row the cycle touches (1 or 2 rows depending
                    on whether the cycle straddles a Sat→Sun boundary). */}
                {activePlan && (() => {
                  // Find the active cycle segment in this row + its column span
                  let preFlex   = preCount;
                  let activeSeg: number[] | null = null;
                  for (const seg of segments) {
                    if (cycleForDay(seg[0]) === todayCycleIdx) { activeSeg = seg; break; }
                    preFlex += seg.length;
                  }
                  if (!activeSeg) return null;
                  const activeFlex = activeSeg.length;
                  const postFlex   = 7 - preFlex - activeFlex;
                  return (
                    <View style={s.activeCycleRow}>
                      {preFlex > 0  && <View style={{ flex: preFlex }} />}
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

      </View>{/* end enclosure */}

      {/* ── Log card — shown on day tap ── */}
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
                  {selIsPast  ? 'REST · COMPLETED' :
                   selIsToday ? 'REST · TODAY'      :
                                'REST · SCHEDULED'}
                </Text>
              </View>
              <Text style={[s.cardEmptyTxt, { marginTop: 8 }]}>
                {selIsPast
                  ? 'Recovery day — auto-completed.'
                  : selIsToday
                    ? 'Take it easy today — no workout scheduled.'
                    : 'Recovery day — no workout scheduled.'}
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

              {/* Volume */}
              <View style={s.cardVolRow}>
                <Text style={[s.cardVolNum, { color: selColor }]}>
                  {Math.round(selSess.totalVolume).toLocaleString()}
                </Text>
                <Text style={s.cardVolUnit}> kg</Text>
              </View>
              <Text style={s.cardMeta}>
                {selSess.exercises.reduce((a,e)=>a+e.sets.filter(st=>st.isCompleted).length,0)} sets
                {'  ·  '}{selSess.exercises.length} exercises
                {selSess.duration > 0 ? `  ·  ${selSess.duration} min` : ''}
              </Text>

              {/* Exercises */}
              {selSess.exercises.length > 0 && (
                <View style={s.cardExWrap}>
                  {selSess.exercises.slice(0,4).map((ex, i) => {
                    const reps = ex.sets[0]?.targetReps ?? null;
                    const wt   = ex.sets[0]?.targetWeight;
                    return (
                      <View key={i} style={s.cardExRow}>
                        <Text style={s.cardExName} numberOfLines={1}>{ex.exerciseName}</Text>
                        <Text style={s.cardExDetail}>
                          {ex.sets.filter(st=>st.isCompleted).length}×{reps ?? '–'}
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
            // Non-rest, no session. Inside the active cycle we know exactly
            // what's scheduled for this date (Cycle screen is the truth) —
            // surface it as a pill so the user sees "PULL · UPCOMING" instead
            // of an anonymous "no session yet" line.
            const selCycleIdx  = sel ? cycleForDay(sel.day) : null;
            const selInCycle   = selCycleIdx !== null && cycleInfo.has(selCycleIdx);
            const selDayColor  = selPlanDay && !selPlanDay.isRestDay
              ? (DAY_COLOR[selPlanDay.dayPosition] ?? DEFAULT_COLOR)
              : null;
            const showScheduled = selInCycle && selPlanDay && !selPlanDay.isRestDay && !selIsPast;
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
                  {selIsPast    ? 'No session logged.' :
                   selIsToday   ? 'No session yet today.' :
                   showScheduled ? 'Scheduled — no session yet.' :
                                  'Upcoming — no session yet.'}
                </Text>
              </View>
            );
          })()}
        </GlassView>
      )}

      {/* ── Legend — only what's on the calendar ── */}
      <View style={s.legend}>
        {/* Rest / recovery legend entry — always shown */}
        {(
          <View style={s.legendWorkout}>
            <View style={[s.legendCell, { backgroundColor: rgba(REST_STONE, 0.18) }]} />
            <Text style={[s.legendWorkoutTxt, { color: REST_STONE }]}>Rest</Text>
          </View>
        )}

        {/* Workout types seen this month */}
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

const CELL = 40;
const GAP  = 4;          // vertical gap between calendar rows
const CELL_GAP = 4;      // horizontal gap between day cells
const PILL_PAD = CELL_GAP / 2;  // 2*pad === gap keeps cell size uniform across segments

function fillHeight(vol: number, max: number): number {
  if (!vol || !max) return 0;
  const t = Math.min(vol / max, 1);
  return Math.round(4 + t * (CELL - 4));
}

const s = StyleSheet.create({
  root: { marginHorizontal: 20, marginBottom: 8 },

  // Header
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  title:     { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4, marginBottom: 3 },
  sub:       { fontSize: 11, color: COLORS.textMuted },
  subAccent: { fontWeight: '700', color: COLORS.textSecondary },
  navRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navArrow:  { fontSize: 22, color: COLORS.textSecondary, lineHeight: 26, fontWeight: '300' },
  navLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, minWidth: 68, textAlign: 'center' },

  // Calendar enclosure — outer border wrapping the whole grid
  enclosure: {
    borderWidth: 1,
    borderColor: 'rgba(255,240,220,0.10)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },

  // Day name row
  dayNameRow: { flexDirection: 'row', marginBottom: 4 },
  dayName:    { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: 'rgba(255,240,220,0.22)', letterSpacing: 0.8 },

  // Active-cycle caption — sits under the active cycle's pill, column-aligned
  activeCycleRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2 },
  activeCycleBanner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  activeCycleName:   { fontSize: 10, fontWeight: '900', color: COLORS.accent, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },

  // Grid
  grid:     { gap: GAP },

  // Week row
  weekWrap:      {},  // column wrapper — one per week
  weekRow:       { flexDirection: 'row', alignItems: 'center' },  // pre-spacers + pill + post-spacers
  weekSlot:      { flex: 1 },  // transparent placeholder for null-padding days
  weekPill:      { flexDirection: 'row', borderRadius: 999, height: CELL + 8, paddingHorizontal: PILL_PAD, gap: CELL_GAP, alignItems: 'center', alignSelf: 'stretch' },
  weekPillEmpty: { backgroundColor: 'rgba(255,240,220,0.04)' },

  // pillWrap: occupies flex: pillDays.length in weekRow
  pillWrap:     { alignItems: 'center' },

  // Day circle — flex: 1 + aspectRatio: 1 inside fixed-height pill = circle
  emptyCell: { flex: 1, aspectRatio: 1 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,240,220,0.08)',
  },
  cellEmpty: { backgroundColor: 'rgba(255,240,220,0.04)' },
  cellToday: { borderWidth: 2, borderColor: 'rgba(255,140,0,0.70)' },
  cellActive:{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },

  // Volume arc fill — clipped to circle shape by overflow:hidden on parent
  fillBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  cellNum:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  cellNumEmpty: { color: 'rgba(255,240,220,0.20)', fontWeight: '400' },
  cellNumToday: { color: COLORS.accent, fontWeight: '800' },
  cellNumSess:  { color: '#fff', fontWeight: '700' },
  // Rest cell numeral — REST_STONE gray, matching the rest-cell bg palette.
  // (Was green previously, which leaked the old palette into the orange-only theme.)
  cellNumRest:  { color: 'rgba(168,162,158,0.65)', fontWeight: '500' },

  // Log card — backgroundColor/borderWidth/overflow now come from GlassView
  card: {
    marginTop: 10,
  },
  cardBody:    { padding: 14, gap: 5 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardDateTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textLabel, letterSpacing: 1.2 },
  cardPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  cardPillTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  cardVolRow:  { flexDirection: 'row', alignItems: 'baseline' },
  cardVolNum:  { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  cardVolUnit: { fontSize: 14, fontWeight: '500', color: COLORS.textMuted },
  cardMeta:    { fontSize: 12, color: COLORS.textLabel },

  cardExWrap:   { marginTop: 8, gap: 7, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', paddingTop: 10 },
  cardExRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardExName:   { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  cardExDetail: { fontSize: 12, color: COLORS.textLabel, fontVariant: ['tabular-nums'] },
  cardExMore:   { fontSize: 11, color: COLORS.textLabel },

  cardEmpty:     { padding: 16, alignItems: 'center' },
  cardEmptyDate: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 },
  cardEmptyTxt:  { fontSize: 12, color: COLORS.textLabel },

  // Legend
  legend:        { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  legendWorkout: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell:      { width: 16, height: 16, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  legendFill:      { width: '100%' },
  legendWorkoutTxt:{ fontSize: 10, fontWeight: '700', maxWidth: 70 },

  legendNote:      { fontSize: 9, color: COLORS.textLabel, fontStyle: 'italic', marginLeft: 'auto' as any },
});
