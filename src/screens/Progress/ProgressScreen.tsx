import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Path, Text as SvgText } from 'react-native-svg';
import { GlassView } from '../../components/common/GlassView';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { COLORS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { WorkoutSession, SetLog, WeightUnit } from '../../types';
import { fmtVol, fmtDate } from '../../utils/format';

// Shared text colors for progress signals — applied to font color only so the
// surrounding card / chip surfaces stay unchanged.
const PROGRESS_GREEN_TXT = '#34D399';
const DECLINE_RED_TXT    = '#FF8E8E';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ExerciseSessionPoint {
  sessionId:   string;
  finishedAt:  string;
  topWeight:   number;
  topReps:     number;
  topVolume:   number;
  est1RM:      number;
  sets:        SetLog[];
}

interface ExerciseHistory {
  exerciseId:   string;
  exerciseName: string;
  weightUnit:   WeightUnit;
  isBodyweight: boolean;
  sessions:     ExerciseSessionPoint[];   // chronological, oldest → newest
}

type SortMode = 'recent' | 'volume' | 'name';

// ─── Helpers ───────────────────────────────────────────────────────────────

function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// All exercise cards share the same accent (orange) — single-hue surface so the
// status/sparkline are the only colour signals the eye has to parse.

// Walk every completed session → group sets by exerciseId, capture top weight,
// top reps, volume, est1RM for each session occurrence.
function aggregateExercises(sessions: WorkoutSession[]): ExerciseHistory[] {
  const byId = new Map<string, ExerciseHistory>();

  for (const session of sessions) {
    if (session.status !== 'completed' || !session.finishedAt) continue;
    for (const ex of session.exercises) {
      const completed = ex.sets.filter(s => s.isCompleted);
      if (completed.length === 0) continue;

      const heaviest = completed.reduce<SetLog>(
        (b, s) => ((s.actualWeight ?? 0) > (b.actualWeight ?? 0) ? s : b),
        completed[0],
      );
      const topWeight = heaviest.actualWeight ?? 0;
      const topReps   = heaviest.actualRepsToFailure ?? heaviest.actualReps;

      const isBw     = ex.weightUnit === 'bodyweight';
      const topVolume = completed.reduce(
        (a, s) => a + (s.actualRepsToFailure ?? s.actualReps) * (s.actualWeight ?? (isBw ? 1 : 0)),
        0,
      );
      const est1RM  = (isBw || ex.weightUnit === 'plates') ? 0 : epley1RM(topWeight, topReps);

      const entry = byId.get(ex.exerciseId) ?? {
        exerciseId:   ex.exerciseId,
        exerciseName: ex.exerciseName,
        weightUnit:   ex.weightUnit,
        isBodyweight: isBw,
        sessions:     [],
      };
      entry.sessions.push({
        sessionId:  session.id,
        finishedAt: session.finishedAt,
        topWeight, topReps, topVolume, est1RM,
        sets:       completed,
      });
      byId.set(ex.exerciseId, entry);
    }
  }

  for (const h of byId.values()) {
    h.sessions.sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
  }
  return [...byId.values()];
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ data, color, width, height }:
  { data: number[]; color: string; width: number; height: number }) {
  if (data.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color + '88' }} />
      </View>
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 6) - 3,
  }));
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
        stroke={color} strokeWidth={1.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}

// ─── Contribution Heatmap (8 weeks × 7 days, navigable) ────────────────────

const HM_WEEKS    = 8;
const HM_SHIFT_BY = 4;   // shift the window by 4 weeks per ‹ / › tap

function ContributionHeatmap({ sessions }: { sessions: WorkoutSession[] }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // `anchor` = the most recent day shown (Saturday of the rightmost column).
  // Initial anchor: the Saturday of the current week.
  const initialAnchor = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (6 - d.getDay())); // jump to Saturday this week
    return d;
  }, [today]);
  const [anchor, setAnchor] = useState<Date>(initialAnchor);

  // Compute the grid relative to anchor: 8 columns, each 7 days, rightmost column ends on anchor.
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
    // Don't allow the anchor (right edge) to go past the current Saturday
    if (next > initialAnchor) {
      setAnchor(initialAnchor);
    } else {
      setAnchor(next);
    }
  };

  const canGoForward = anchor.getTime() < initialAnchor.getTime();

  return (
    <View>
      {/* Nav row — calendar-style ‹ / › around the date range */}
      <View style={hm.navRow}>
        <Pressable
          onPress={() => shift(-HM_SHIFT_BY)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [hm.navBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-back" size={16} color={COLORS.textSecondary} />
        </Pressable>
        <Text style={hm.navLabel}>{fmtRange(startDate, endDate)}</Text>
        <Pressable
          onPress={() => shift(HM_SHIFT_BY)}
          disabled={!canGoForward}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [hm.navBtn, !canGoForward && { opacity: 0.25 }, pressed && canGoForward && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <View style={hm.metaRow}>
        <Text style={hm.metaTxt}>
          {windowTotal} session{windowTotal === 1 ? '' : 's'} in this window
        </Text>
      </View>

      <View style={hm.wrap}>
        <View style={hm.dayCol}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={hm.dayLbl}>{d}</Text>
          ))}
        </View>
        <View style={hm.grid}>
          {days.map((week, wi) => (
            <View key={wi} style={hm.weekCol}>
              {week.map((day, di) => {
                const key = day.toISOString().slice(0, 10);
                const c = counts.get(key) ?? 0;
                const isFuture = day > today;
                return (
                  <View
                    key={di}
                    style={[
                      hm.cell,
                      { backgroundColor: isFuture ? 'transparent' : intensity(c) },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={hm.legendRow}>
        <Text style={hm.legendTxt}>Less</Text>
        {[0, 1, 2, 3].map(n => (
          <View key={n} style={[hm.legendCell, { backgroundColor: intensity(n) }]} />
        ))}
        <Text style={hm.legendTxt}>More</Text>
      </View>
    </View>
  );
}

// Fixed cell size keeps day-of-week labels perfectly aligned to their rows.
const HM_CELL = 28;
const HM_GAP  = 4;

const hm = StyleSheet.create({
  navRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn:     { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(255,240,220,0.04)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  navLabel:   { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  metaRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metaTxt:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  wrap:       { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'center' },
  dayCol:     { gap: HM_GAP },
  dayLbl:     { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', height: HM_CELL, lineHeight: HM_CELL, textAlign: 'right', width: 14 },
  grid:       { flexDirection: 'row', gap: HM_GAP },
  weekCol:    { gap: HM_GAP },
  cell:       { width: HM_CELL, height: HM_CELL, borderRadius: 5 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' },
  legendTxt:  { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
});

// ─── Expanded chart (full history line) ────────────────────────────────────

function ExpandedChart({ sessions, isBodyweight, unit, width }:
  { sessions: ExerciseSessionPoint[]; isBodyweight: boolean; unit: WeightUnit; width: number }) {

  const W = Math.max(width, 240);
  const H = 130;
  const padL = 36, padR = 12, padTop = 18, padBottom = 24;
  const innerW = W - padL - padR;
  const innerH = H - padTop - padBottom;

  const metric = (s: ExerciseSessionPoint) => isBodyweight ? s.topReps : s.topWeight;
  const data = sessions.map(metric);

  if (data.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Need 2+ sessions to chart</Text>
      </View>
    );
  }

  const max    = Math.max(...data);
  const min    = Math.min(...data);
  const isFlat = max === min;
  const range  = isFlat ? 1 : max - min;
  const mid    = (max + min) / 2;

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * innerW,
    // When every session shares the same value, plotting (v - min)/range = 0
    // would slam the line to the bottom. Place it on the centre line instead
    // so the visual matches the data — no progress, no movement.
    y: isFlat
      ? padTop + innerH / 2
      : padTop + (1 - (v - min) / range) * innerH,
  }));

  const linePath = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseY = padTop + innerH;
  const areaPath =
    `${linePath} L${pts[pts.length-1].x.toFixed(1)},${baseY} L${pts[0].x.toFixed(1)},${baseY} Z`;

  // Peak (highest metric value) for visual emphasis
  const peakIdx = data.reduce((mi, v, i) => (v > data[mi] ? i : mi), 0);
  const peak    = pts[peakIdx];

  const fmtAxis = (n: number) =>
    isBodyweight ? `${Math.round(n)}` : `${Math.round(n)}${unit}`;

  const firstDate = fmtDate(sessions[0].finishedAt);
  const lastDate  = fmtDate(sessions[sessions.length - 1].finishedAt);

  return (
    <View>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Horizontal grid lines */}
        <Path d={`M${padL},${padTop} L${W - padR},${padTop}`}
          stroke="rgba(255,240,220,0.06)" strokeWidth={1} />
        <Path d={`M${padL},${padTop + innerH / 2} L${W - padR},${padTop + innerH / 2}`}
          stroke="rgba(255,240,220,0.06)" strokeWidth={1} strokeDasharray="2,3" />
        <Path d={`M${padL},${baseY} L${W - padR},${baseY}`}
          stroke="rgba(255,240,220,0.10)" strokeWidth={1} />

        {/* Y-axis labels — single centred label when the data is flat,
            otherwise the usual max / mid / min triplet. */}
        {isFlat ? (
          <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={9} fontWeight="700"
            fill={COLORS.textMuted} textAnchor="end">
            {fmtAxis(max)}
          </SvgText>
        ) : (
          <>
            <SvgText x={padL - 6} y={padTop + 3} fontSize={9} fontWeight="700"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(max)}
            </SvgText>
            <SvgText x={padL - 6} y={padTop + innerH / 2 + 3} fontSize={9} fontWeight="600"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(mid)}
            </SvgText>
            <SvgText x={padL - 6} y={baseY + 3} fontSize={9} fontWeight="600"
              fill={COLORS.textMuted} textAnchor="end">
              {fmtAxis(min)}
            </SvgText>
          </>
        )}

        {/* Area fill + line */}
        <Path d={areaPath} fill="rgba(255,140,0,0.12)" />
        <Path d={linePath} stroke={COLORS.accent} strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Dashed vertical guide to the peak */}
        <Path d={`M${peak.x},${peak.y} L${peak.x},${baseY}`}
          stroke={COLORS.accent} strokeWidth={1} strokeDasharray="2,3" strokeOpacity={0.6} />

        {/* Plain points */}
        {pts.map((p, i) => i !== peakIdx && (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5}
            fill={COLORS.accent} fillOpacity={0.7} />
        ))}

        {/* Peak — emphasized */}
        <Circle cx={peak.x} cy={peak.y} r={8}
          fill="none" stroke={COLORS.accent} strokeOpacity={0.25} strokeWidth={2} />
        <Circle cx={peak.x} cy={peak.y} r={4.5} fill={COLORS.accent} />

        {/* X-axis: first + last date labels */}
        <SvgText x={padL} y={H - 6} fontSize={9} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="start">
          {firstDate}
        </SvgText>
        <SvgText x={W - padR} y={H - 6} fontSize={9} fontWeight="600"
          fill={COLORS.textMuted} textAnchor="end">
          {lastDate}
        </SvgText>
      </Svg>
    </View>
  );
}

// ─── Exercise Card ─────────────────────────────────────────────────────────

function ExerciseCard({ history, expanded, onToggle, chartWidth }: {
  history: ExerciseHistory;
  expanded: boolean;
  onToggle: () => void;
  chartWidth: number;
}) {
  const { sessions, weightUnit, isBodyweight, exerciseName } = history;
  if (sessions.length === 0) return null;

  const latest = sessions[sessions.length - 1];
  const prev   = sessions.length >= 2 ? sessions[sessions.length - 2] : null;

  const metric = (s: ExerciseSessionPoint) => isBodyweight ? s.topReps : s.topWeight;
  const bestSession = sessions.reduce((b, s) => (metric(s) > metric(b) ? s : b), sessions[0]);

  const lastMetric = metric(latest);
  const prevMetric = prev ? metric(prev) : lastMetric;
  const delta      = lastMetric - prevMetric;
  const direction: 'up' | 'down' | 'flat' =
    delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'flat';

  // Recent PR — most recent session is the unique strict high
  const priorMax = sessions.length >= 2
    ? Math.max(...sessions.slice(0, -1).map(metric))
    : -Infinity;
  const isRecentPR = sessions.length >= 2 && metric(latest) > priorMax;

  const sparkN = Math.min(8, sessions.length);
  const sparkData = sessions.slice(-sparkN).map(metric);

  const exColor = COLORS.accent;

  const bestLabel = isBodyweight
    ? `${bestSession.topReps} reps`
    : `${bestSession.topWeight}${weightUnit} × ${bestSession.topReps}`;
  const lastLabel = isBodyweight
    ? `${latest.topReps} reps`
    : `${latest.topWeight}${weightUnit} × ${latest.topReps}`;

  return (
    <GlassView radius={12} style={card.wrap}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [card.head, pressed && { opacity: 0.75 }]}
      >
        <View style={card.info}>
          <View style={card.nameRow}>
            <Text style={card.name} numberOfLines={1}>{exerciseName}</Text>
            {isRecentPR && (
              <View style={card.prBadge}>
                <Text style={card.prTxt}>NEW PR</Text>
              </View>
            )}
          </View>
          <Text style={card.meta}>
            {sessions.length} session{sessions.length === 1 ? '' : 's'} · last {fmtDate(latest.finishedAt)}
          </Text>
        </View>
        <Sparkline data={sparkData} color={exColor} width={70} height={28} />
        {prev && direction !== 'flat' && (
          <View style={[
            card.trendDot,
            direction === 'up' ? card.trendDotUp : card.trendDotDown,
          ]}>
            <Text style={[
              card.trendDotTxt,
              direction === 'up' ? { color: PROGRESS_GREEN_TXT } : { color: DECLINE_RED_TXT },
            ]}>
              {direction === 'up' ? '+' : '−'}
            </Text>
          </View>
        )}
        <Svg
          width={14} height={14} viewBox="0 0 24 24" fill="none"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] } as any}
        >
          <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <View style={card.chipsRow}>
        <View style={[card.chip, { borderColor: exColor + '55', backgroundColor: exColor + '15' }]}>
          <Text style={[card.chipLbl, { color: exColor }]}>BEST</Text>
          <Text style={card.chipVal}>{bestLabel}</Text>
        </View>
        <View style={[card.chip, { borderColor: exColor + '55', backgroundColor: exColor + '15' }]}>
          <Text style={[card.chipLbl, { color: exColor }]}>LAST</Text>
          <Text style={card.chipVal}>{lastLabel}</Text>
        </View>
        {prev && (
          <View style={[
            card.chip,
            direction === 'up'   && { borderColor: 'rgba(80,200,120,0.45)', backgroundColor: 'rgba(80,200,120,0.10)' },
            direction === 'down' && { borderColor: 'rgba(255,80,80,0.45)',  backgroundColor: 'rgba(255,80,80,0.10)'  },
          ]}>
            <Text style={card.chipLbl}>TREND</Text>
            <Text style={[
              card.chipVal,
              direction === 'up'   && { color: PROGRESS_GREEN_TXT },
              direction === 'down' && { color: DECLINE_RED_TXT },
            ]}>
              {direction === 'up' ? '+' : direction === 'down' ? '−' : '·'}{' '}
              {Math.abs(delta) % 1 === 0
                ? Math.abs(delta).toFixed(0)
                : Math.abs(delta).toFixed(1)}
              {!isBodyweight ? weightUnit : ' reps'}
            </Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={card.expanded}>
          <ExpandedChart sessions={sessions} isBodyweight={isBodyweight} unit={weightUnit} width={chartWidth} />

          <View style={card.logHead}>
            <Text style={[card.logCol, { flex: 1 }]}>Date</Text>
            <Text style={[card.logCol, card.logRight, { flex: 1.2 }]}>Top Set</Text>
            <Text style={[card.logCol, card.logRight, { width: 56 }]}>Volume</Text>
          </View>
          {sessions.slice(-5).reverse().map(sess => (
            <View key={sess.sessionId} style={card.logRow}>
              <Text style={[card.logCell, { flex: 1 }]}>{fmtDate(sess.finishedAt)}</Text>
              <Text style={[card.logCell, card.logRight, { flex: 1.2 }]}>
                {isBodyweight ? `${sess.topReps} reps` : `${sess.topWeight}${weightUnit} × ${sess.topReps}`}
              </Text>
              <Text style={[card.logCell, card.logRight, { width: 56, color: COLORS.textMuted }]}>
                {fmtVol(sess.topVolume)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </GlassView>
  );
}

const card = StyleSheet.create({
  wrap:        { padding: 12, gap: 10 },
  head:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info:        { flex: 1, minWidth: 0, gap: 3 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:        { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flexShrink: 1 },
  meta:        { fontSize: 11, color: COLORS.textMuted },

  prBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: COLORS.accent },
  prTxt:       { fontSize: 8, fontWeight: '900', color: '#000', letterSpacing: 0.6 },

  // Circular +/- trend indicator near the sparkline
  trendDot:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  trendDotUp:  { backgroundColor: 'rgba(80,200,120,0.18)', borderColor: 'rgba(80,200,120,0.55)' },
  trendDotDown:{ backgroundColor: 'rgba(255,80,80,0.18)',  borderColor: 'rgba(255,80,80,0.55)'  },
  trendDotTxt: { fontSize: 14, fontWeight: '900', lineHeight: 16 },

  chipsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:        { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)', flexDirection: 'column', gap: 1 },
  chipLbl:     { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.8 },
  chipVal:     { fontSize: 12, fontWeight: '700', color: '#fff' },

  expanded:    { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)' },

  chartWrap:   { paddingVertical: 2, position: 'relative' },
  chartAxis:   { position: 'absolute', right: 6, top: 6, bottom: 6, justifyContent: 'space-between' },
  chartAxisTxt:{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },

  logHead:     { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.07)' },
  logCol:      { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  logRight:    { textAlign: 'right' },
  logRow:      { flexDirection: 'row', paddingVertical: 6 },
  logCell:     { fontSize: 12, fontWeight: '600', color: '#fff' },
});

// ─── Main screen ───────────────────────────────────────────────────────────

export function ProgressScreen() {
  const { sessions }   = useSessionStore();
  const { activePlan } = usePlanStore();
  const { width: windowWidth } = useWindowDimensions();

  const [sortMode,    setSortMode]    = useState<SortMode>('recent');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Memoised together so unrelated state updates (sort / search) don't redo
  // these passes over the full sessions list every render.
  const { totalWorkouts, recentVolume } = useMemo(() => {
    const completed   = sessions.filter(s => s.status === 'completed');
    const recent14    = completed.slice(-14);
    return {
      totalWorkouts: completed.length,
      recentVolume:  recent14.reduce((a, s) => a + s.totalVolume, 0),
    };
  }, [sessions]);

  const histories = useMemo(() => aggregateExercises(sessions), [sessions]);
  const exerciseCount = histories.length;

  const sortedHistories = useMemo(() => {
    const arr = [...histories];
    if (sortMode === 'recent') {
      arr.sort((a, b) =>
        new Date(b.sessions[b.sessions.length - 1].finishedAt).getTime() -
        new Date(a.sessions[a.sessions.length - 1].finishedAt).getTime()
      );
    } else if (sortMode === 'volume') {
      arr.sort((a, b) => {
        const ta = a.sessions.reduce((acc, x) => acc + x.topVolume, 0);
        const tb = b.sessions.reduce((acc, x) => acc + x.topVolume, 0);
        return tb - ta;
      });
    } else {
      arr.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    }
    return arr;
  }, [histories, sortMode]);

  // Apply text search on top of the sorted list
  const visibleHistories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedHistories;
    return sortedHistories.filter(h => h.exerciseName.toLowerCase().includes(q));
  }, [sortedHistories, searchQuery]);

  // Chart width = window - ScrollView padding (32) - GlassView card padding (24)
  const chartWidth = Math.max(240, windowWidth - 32 - 24);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          {activePlan && <Text style={s.sub}>{activePlan.name}</Text>}
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary stats */}
          <View style={s.statsRow}>
            <GlassView radius={14} style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="barbell-outline" size={14} color={COLORS.accent} />
                <Text style={s.statLabel}>Workouts</Text>
              </View>
              <Text style={s.statValue}>{totalWorkouts}</Text>
            </GlassView>
            <GlassView radius={14} style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="trending-up-outline" size={14} color={COLORS.accent} />
                <Text style={s.statLabel}>Volume</Text>
              </View>
              <Text style={[s.statValue, s.statAccent]}>
                {fmtVol(recentVolume)}
                <Text style={s.statUnit}>kg</Text>
              </Text>
            </GlassView>
            <GlassView radius={14} style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="list-outline" size={14} color={COLORS.accent} />
                <Text style={s.statLabel}>Exercises</Text>
              </View>
              <Text style={s.statValue}>{exerciseCount}</Text>
            </GlassView>
          </View>

          {/* Activity heatmap */}
          <GlassView radius={14} style={s.activityCard}>
            <Text style={s.cardTitle}>Activity</Text>
            <ContributionHeatmap sessions={sessions} />
          </GlassView>

          {/* Exercise progress — section header swaps to a search bar on demand */}
          {searchOpen ? (
            <View style={s.searchRow}>
              <Ionicons name="search" size={15} color={COLORS.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exercises…"
                placeholderTextColor={COLORS.textMuted}
                style={s.searchInput}
                autoFocus
                returnKeyType="search"
              />
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                style={({ pressed }) => [s.searchClose, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <View style={s.progressHeader}>
              <View style={s.titleRow}>
                <Text style={s.sectionTitle}>Exercise Progress</Text>
                <Pressable
                  onPress={() => setSearchOpen(true)}
                  hitSlop={8}
                  style={({ pressed }) => [s.searchIcon, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="search" size={15} color={COLORS.textSecondary} />
                </Pressable>
              </View>
              <View style={s.toggle}>
                {(['recent', 'volume', 'name'] as const).map(m => {
                  const active = sortMode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setSortMode(m)}
                      style={[s.togglePill, active && s.togglePillActive]}
                    >
                      <Text style={[s.toggleTxt, active && s.toggleTxtActive]}>
                        {m === 'recent' ? 'Recent' : m === 'volume' ? 'Volume' : 'A–Z'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Search-active hint */}
          {searchOpen && searchQuery.trim().length > 0 && (
            <Text style={s.searchHint}>
              {visibleHistories.length} match{visibleHistories.length === 1 ? '' : 'es'} for "{searchQuery.trim()}"
            </Text>
          )}

          {visibleHistories.length === 0 ? (
            <GlassView radius={14} style={s.emptyCard}>
              <Text style={s.emptyText}>
                {searchQuery.trim()
                  ? `No exercises matching "${searchQuery.trim()}".`
                  : 'Complete workouts to see exercise progress here.'}
              </Text>
            </GlassView>
          ) : (
            <View style={s.cardList}>
              {visibleHistories.map(h => (
                <ExerciseCard
                  key={h.exerciseId}
                  history={h}
                  expanded={expandedId === h.exerciseId}
                  onToggle={() =>
                    setExpandedId(id => (id === h.exerciseId ? null : h.exerciseId))
                  }
                  chartWidth={chartWidth}
                />
              ))}
            </View>
          )}

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header:           { paddingHorizontal: 20, paddingBottom: 14 },
  title:            { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub:              { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  scroll:           { paddingHorizontal: 16 },

  // Stats row
  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:         { flex: 1, padding: 12 },
  statHeader:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  statLabel:        { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.9, textTransform: 'uppercase' },
  statValue:        { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  statAccent:       { color: PROGRESS_GREEN_TXT },
  statUnit:         { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  // Activity card
  activityCard:     { padding: 14, marginBottom: 14 },
  cardTitle:        { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1.0, marginBottom: 12 },

  // Section header + sort toggle
  progressHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10, paddingHorizontal: 2 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:     { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1.0 },
  searchIcon:       { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  toggle:           { flexDirection: 'row', backgroundColor: 'rgba(255,240,220,0.05)', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  togglePill:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  togglePillActive: { backgroundColor: 'rgba(255,240,220,0.14)' },
  toggleTxt:        { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.2 },
  toggleTxtActive:  { color: '#fff', fontWeight: '800' },

  // Search bar (replaces section header when active)
  searchRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,240,220,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  searchInput:      { flex: 1, fontSize: 14, color: '#fff', padding: 0, fontWeight: '500' },
  searchClose:      { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  searchHint:       { fontSize: 11, color: COLORS.textMuted, marginBottom: 8, paddingHorizontal: 4, fontWeight: '600' },

  // Card list
  cardList:         { gap: 8 },
  emptyCard:        { padding: 20, alignItems: 'center' },
  emptyText:        { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});
