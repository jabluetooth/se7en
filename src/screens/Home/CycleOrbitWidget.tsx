import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from 'react-native-svg';
import { WorkoutSession, WorkoutPlan } from '../../types';
import { COLORS, GRAD } from '../../constants';

interface Props {
  currentDay:     number; // 1–7
  sessions:       WorkoutSession[];
  dayLabel:       string;
  activePlan?:    WorkoutPlan | null;
  cycleStartDate: string | null;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, R: number, ri: number, a0: number, a1: number) {
  const p1 = polar(cx, cy, R,  a0);
  const p2 = polar(cx, cy, R,  a1);
  const p3 = polar(cx, cy, ri, a1);
  const p4 = polar(cx, cy, ri, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return (
    `M${p1.x},${p1.y} A${R},${R} 0 ${big} 1 ${p2.x},${p2.y}` +
    ` L${p3.x},${p3.y} A${ri},${ri} 0 ${big} 0 ${p4.x},${p4.y} Z`
  );
}

// Date window for the current cycle (7-day rolling, anchored on cycleStartDate).
// Returns null when no cycle is anchored — caller falls back to "no done arcs"
// and uses the positional currentDay only for the bright "current" arc.
function currentCycleWindow(cycleStartDate: string | null): { start: Date; end: Date; cycleNum: number } | null {
  if (!cycleStartDate) return null;
  const startDate = new Date(cycleStartDate + 'T00:00:00');
  startDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
  if (diff < 0) return null;
  const cyclesPassed = Math.floor(diff / 7);
  const start = new Date(startDate);
  start.setDate(start.getDate() + cyclesPassed * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end, cycleNum: cyclesPassed + 1 };
}

export function CycleOrbitWidget({ currentDay, sessions, dayLabel, activePlan, cycleStartDate }: Props) {
  const SZ = 200, cx = 100, cy = 100, R = 88, ri = 68;
  const SEG = 360 / 7;
  const GAP = 3.5;

  // Pre-compute which slots have a completed session inside the *current* cycle
  // window. Previous-cycle sessions are excluded so a fresh cycle shows fresh
  // arcs even after a full streak last cycle.
  const { doneSlots, cycleNum, completedThisCycle } = useMemo(() => {
    const win = currentCycleWindow(cycleStartDate);
    if (!win || !activePlan) {
      return { doneSlots: new Set<number>(), cycleNum: 1, completedThisCycle: 0 };
    }
    const cycleSessions = sessions.filter(s => {
      if (s.status !== 'completed' || !s.finishedAt) return false;
      const d = new Date(s.finishedAt);
      return d >= win.start && d < win.end;
    });
    const done = new Set<number>();
    for (let slot = 1; slot <= 7; slot++) {
      // Slot → the day at that index in the user's (possibly reordered) plan.
      const day = activePlan.days[slot - 1];
      if (!day) continue;
      if (day.isRestDay) {
        // Rest days can't be manually marked done (no swipe-Done), but a
        // PAST rest day in this cycle counts as "successfully rested" and
        // fills its arc automatically. Future rest days stay dim/upcoming.
        if (slot < currentDay) done.add(slot);
        continue;
      }
      // Match workout sessions by the day's stable dayPosition so a completed
      // exercise stays "done" even if the user dragged it elsewhere in the cycle.
      if (cycleSessions.some(s => s.dayPosition === day.dayPosition)) {
        done.add(slot);
      }
    }
    return { doneSlots: done, cycleNum: win.cycleNum, completedThisCycle: done.size };
  }, [sessions, activePlan, cycleStartDate]);

  const pct = Math.round((completedThisCycle / 7) * 100);

  return (
    <View style={s.container}>
      <Svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
        <Defs>
          {/* Orange-only palette for the cycle arcs.
              `curr` — bright accent at near-full opacity → today's vivid arc.
              `done` — same accent hue but at low opacity → past days read as
                       a darker, dimmer inverse of today, never green / violet. */}
          <SvgGrad id="curr" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={GRAD.accent[0]} stopOpacity="1" />
            <Stop offset="100%" stopColor={GRAD.accent[1]} stopOpacity="0.9" />
          </SvgGrad>
          <SvgGrad id="done" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={GRAD.accent[0]} stopOpacity="0.38" />
            <Stop offset="100%" stopColor={GRAD.accent[1]} stopOpacity="0.22" />
          </SvgGrad>
        </Defs>

        {/* Inner dark circle first so arcs sit on top */}
        <Circle cx={cx} cy={cy} r={ri - 1} fill="rgba(8,9,15,0.92)" />

        {Array.from({ length: 7 }, (_, i) => {
          const slot = i + 1;
          const a0  = i * SEG + GAP / 2;
          const a1  = a0 + SEG - GAP;
          const d   = arcPath(cx, cy, R, ri, a0, a1);

          // Priority: actually-completed-this-cycle > current day > upcoming.
          // The dim "past but not done" slot deliberately renders as upcoming
          // (faint outline) — there's no visual "missed" state in the orbit so
          // the user sees real progress, not slot pre-fill.
          if (doneSlots.has(slot)) {
            return <Path key={i} d={d} fill="url(#done)" />;
          }
          if (slot === currentDay) {
            return <Path key={i} d={d} fill="url(#curr)" />;
          }
          return (
            <Path
              key={i}
              d={d}
              fill="rgba(255,240,220,0.06)"
              stroke="rgba(255,240,220,0.14)"
              strokeWidth={0.6}
            />
          );
        })}
      </Svg>

      <View style={s.overlay} pointerEvents="none">
        <Text style={s.lbl}>DAY {currentDay}</Text>
        <View style={s.nameWrap}>
          <Text
            style={s.name}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {dayLabel.toUpperCase()}
          </Text>
        </View>
        <Text style={s.pct}>C{cycleNum} · {pct}%</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  overlay:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lbl:      { fontSize: 9,  fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  // Fixed-width chord that fits inside the inner ring (ri=68 → diameter 136).
  // Gives adjustsFontSizeToFit something concrete to shrink against.
  nameWrap: { width: 124, alignItems: 'center', justifyContent: 'center' },
  name:     { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  pct:      { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
});
