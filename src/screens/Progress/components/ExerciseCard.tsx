import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassView } from '../../../components/common/GlassView';
import { COLORS, FONTS } from '../../../constants';
import { fmtDate, fmtVol } from '../../../utils/format';
import { ExerciseHistory, ExerciseSessionPoint } from '../../../utils/exerciseHistory';
import { Sparkline } from './Sparkline';
import { ExpandedChart } from './ExpandedChart';

// All exercise cards share the same accent (orange) — single-hue surface so the
// status/sparkline are the only colour signals the eye has to parse.
const PROGRESS_GREEN_TXT = '#34D399';
const DECLINE_RED_TXT    = '#FF8E8E';

// 'kg' and 'lb' glue directly to the number ("40kg"); word-based units like
// 'plates' or 'bodyweight' need a separating space ("7 plates").
const unitSuffix = (u: string) => (u === 'kg' || u === 'lb') ? u : ` ${u}`;

interface Props {
  history:     ExerciseHistory;
  expanded:    boolean;
  onToggle:    () => void;
  chartWidth:  number;
}

export function ExerciseCard({ history, expanded, onToggle, chartWidth }: Props) {
  const { sessions, weightUnit, isBodyweight, exerciseName } = history;
  if (sessions.length === 0) return null;

  const latest = sessions[sessions.length - 1];
  const prev   = sessions.length >= 2 ? sessions[sessions.length - 2] : null;

  const metric = (s: ExerciseSessionPoint) => isBodyweight ? s.topReps : s.topWeight;
  const bestSession = sessions.reduce((b, x) => (metric(x) > metric(b) ? x : b), sessions[0]);

  const lastMetric = metric(latest);
  const prevMetric = prev ? metric(prev) : lastMetric;
  const delta      = lastMetric - prevMetric;
  const direction: 'up' | 'down' | 'flat' =
    delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'flat';

  // Recent PR — most recent session is the unique strict high
  const priorMax   = sessions.length >= 2
    ? Math.max(...sessions.slice(0, -1).map(metric))
    : -Infinity;
  const isRecentPR = sessions.length >= 2 && metric(latest) > priorMax;

  // ── Decline tracking (multi-session) ─────────────────────────────────
  // The TREND chip above only compares the latest 2 sessions; that misses
  // sustained regressions. Two extra signals surface those:
  //   • declineStreak — count of consecutive declining sessions (latest going
  //     back). 1 = just this session, 2+ = "this isn't a one-off dip".
  //   • offPeakPct    — how far below the all-time best the latest sits, so
  //     the user knows the scale of the regression even mid-streak.
  let declineStreak = 0;
  for (let i = sessions.length - 1; i > 0; i--) {
    if (metric(sessions[i]) < metric(sessions[i - 1]) - 0.001) declineStreak++;
    else break;
  }
  const allTimeBest = sessions.reduce((m, x) => Math.max(m, metric(x)), 0);
  const offPeakPct  = allTimeBest > 0 && lastMetric < allTimeBest
    ? Math.round(((allTimeBest - lastMetric) / allTimeBest) * 100)
    : 0;
  // Surface the line only when there's something worth flagging. A 1-session
  // dip with <5% off peak is noise; ≥2 consecutive declines OR a meaningful
  // gap from peak is signal.
  const showRegression = declineStreak >= 2 || offPeakPct >= 5;

  const sparkN    = Math.min(8, sessions.length);
  const sparkData = sessions.slice(-sparkN).map(metric);

  const exColor = COLORS.accent;

  const bestLabel = isBodyweight
    ? `${bestSession.topReps} reps`
    : `${bestSession.topWeight}${unitSuffix(weightUnit)} × ${bestSession.topReps}`;
  const lastLabel = isBodyweight
    ? `${latest.topReps} reps`
    : `${latest.topWeight}${unitSuffix(weightUnit)} × ${latest.topReps}`;

  return (
    <GlassView radius={12} style={s.wrap}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [s.head, pressed && { opacity: 0.75 }]}
      >
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{exerciseName}</Text>
            {isRecentPR && (
              <View style={s.prBadge}>
                <Text style={s.prTxt}>NEW PR</Text>
              </View>
            )}
          </View>
          <Text style={s.meta}>
            {sessions.length} session{sessions.length === 1 ? '' : 's'} · last {fmtDate(latest.finishedAt)}
          </Text>
        </View>
        <Sparkline data={sparkData} color={exColor} width={70} height={28} />
        {prev && direction !== 'flat' && (
          <View style={[
            s.trendDot,
            direction === 'up' ? s.trendDotUp : s.trendDotDown,
          ]}>
            <Text style={[
              s.trendDotTxt,
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

      <View style={s.chipsRow}>
        <View style={[s.chip, { borderColor: exColor + '55', backgroundColor: exColor + '15' }]}>
          <Text style={[s.chipLbl, { color: exColor }]}>BEST</Text>
          <Text style={s.chipVal}>{bestLabel}</Text>
        </View>
        <View style={[s.chip, { borderColor: exColor + '55', backgroundColor: exColor + '15' }]}>
          <Text style={[s.chipLbl, { color: exColor }]}>LAST</Text>
          <Text style={s.chipVal}>{lastLabel}</Text>
        </View>
        {prev && (
          <View style={[
            s.chip,
            direction === 'up'   && { borderColor: 'rgba(80,200,120,0.45)', backgroundColor: 'rgba(80,200,120,0.10)' },
            direction === 'down' && { borderColor: 'rgba(255,80,80,0.45)',  backgroundColor: 'rgba(255,80,80,0.10)'  },
          ]}>
            <Text style={s.chipLbl}>TREND</Text>
            <Text style={[
              s.chipVal,
              direction === 'up'   && { color: PROGRESS_GREEN_TXT },
              direction === 'down' && { color: DECLINE_RED_TXT },
            ]}>
              {direction === 'up' ? '+' : direction === 'down' ? '−' : '·'}{' '}
              {Math.abs(delta) % 1 === 0
                ? Math.abs(delta).toFixed(0)
                : Math.abs(delta).toFixed(1)}
              {!isBodyweight ? unitSuffix(weightUnit) : ' reps'}
            </Text>
          </View>
        )}
      </View>

      {/* Multi-session decline banner — only when there's something to flag.
          Streak captures sustained regression ("3 in a row"); off-peak captures
          scale ("currently 8% below your best"). Combined, the user sees both
          the WHY (streak) and the HOW BAD (off-peak). */}
      {showRegression && (
        <View style={s.regressionRow}>
          <Text style={s.regressionTxt}>
            {declineStreak >= 2 && (
              <Text style={s.regressionStrong}>↓ {declineStreak} in a row</Text>
            )}
            {declineStreak >= 2 && offPeakPct >= 5 && <Text>  ·  </Text>}
            {offPeakPct >= 5 && (
              <Text style={s.regressionStrong}>−{offPeakPct}% off peak</Text>
            )}
          </Text>
        </View>
      )}

      {expanded && (
        <View style={s.expanded}>
          <ExpandedChart sessions={sessions} isBodyweight={isBodyweight} unit={weightUnit} width={chartWidth} />

          <View style={s.logHead}>
            <Text style={[s.logCol, { flex: 1 }]}>Date</Text>
            <Text style={[s.logCol, s.logRight, { flex: 1.2 }]}>Top Set</Text>
            <Text style={[s.logCol, s.logRight, { width: 56 }]}>Volume</Text>
          </View>
          {sessions.slice(-5).reverse().map(sess => (
            <View key={sess.sessionId} style={s.logRow}>
              <Text style={[s.logCell, { flex: 1 }]}>{fmtDate(sess.finishedAt)}</Text>
              <Text style={[s.logCell, s.logRight, { flex: 1.2 }]}>
                {isBodyweight ? `${sess.topReps} reps` : `${sess.topWeight}${unitSuffix(weightUnit)} × ${sess.topReps}`}
              </Text>
              <Text style={[s.logCell, s.logRight, { width: 56, color: COLORS.textMuted }]}>
                {fmtVol(sess.topVolume)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </GlassView>
  );
}

const s = StyleSheet.create({
  wrap:    { padding: 12, gap: 10 },
  head:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  info:    { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:    { fontSize: 15, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.45, flexShrink: 1 },
  meta:    { fontSize: 11, fontFamily: FONTS.body, color: COLORS.textMuted },

  prBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: COLORS.accent },
  prTxt:   { fontSize: 8, fontWeight: '800', fontFamily: FONTS.label, color: '#000', letterSpacing: 0.64, textTransform: 'uppercase' },

  // Circular +/- trend indicator near the sparkline
  trendDot:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  trendDotUp:  { backgroundColor: 'rgba(80,200,120,0.18)', borderColor: 'rgba(80,200,120,0.55)' },
  trendDotDown:{ backgroundColor: 'rgba(255,80,80,0.18)',  borderColor: 'rgba(255,80,80,0.55)'  },
  trendDotTxt: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.display, lineHeight: 16 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:     { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)', flexDirection: 'column', gap: 1 },
  chipLbl:  { fontSize: 8, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0.64, textTransform: 'uppercase' },
  chipVal:  { fontSize: 12, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },

  // Regression banner — appears only when a sustained decline exists
  regressionRow:    { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,80,80,0.28)', backgroundColor: 'rgba(255,80,80,0.06)' },
  regressionTxt:    { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', fontFamily: FONTS.semibold },
  regressionStrong: { color: DECLINE_RED_TXT, fontWeight: '800', fontFamily: FONTS.display },

  expanded: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)' },

  logHead:  { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.07)' },
  logCol:   { fontSize: 9, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.72 },
  logRight: { textAlign: 'right' },
  logRow:   { flexDirection: 'row', paddingVertical: 6 },
  logCell:  { fontSize: 12, fontWeight: '600', fontFamily: FONTS.semibold, color: '#fff' },
});
