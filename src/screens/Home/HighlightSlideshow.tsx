import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions,
  TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { usePRStore } from '../../stores/prStore';
import { WorkoutSession } from '../../types';
import { COLORS, DAY_COLOR, FONTS } from '../../constants';
import { TabName } from '../../components/FloatingDock/FloatingDock';
import { fmtVol as fmtNum } from '../../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDE   = 16;
const GAP    = 10;
const CARD_W = SCREEN_W - SIDE * 2;
const CARD_H = 236;

function toRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

interface Props {
  sessions:       WorkoutSession[];
  currentDay:     number;
  cycleStartDate: string | null;
  planLength:     number;
  onNavigate:     (tab: TabName) => void;
}

interface CardModel {
  id:      string;
  tag:     string;
  icon:    string;
  hero:    string;
  unit:    string;
  title:   string;
  sub:     string;
  grad:    readonly [string, string, ...string[]];
  hi:      string;
  tab:     TabName;
}

// Local wrapper so "no data yet" (v === 0) shows an em-dash instead of "0".
function fmtVol(v: number): string {
  if (v === 0) return '—';
  return fmtNum(v);
}

export function HighlightSlideshow({ sessions, currentDay, cycleStartDate, planLength, onNavigate }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const { records } = usePRStore();

  const completed = sessions.filter(s => s.status === 'completed' && s.finishedAt);

  // ── Cycle boundaries ──────────────────────────────────────────────────────
  const cycleStart    = cycleStartDate ? new Date(cycleStartDate + 'T00:00:00') : null;
  const cycleEnd      = cycleStart ? new Date(+cycleStart + planLength * 86_400_000) : null;
  const prevCycleStart = cycleStart ? new Date(+cycleStart - planLength * 86_400_000) : null;

  const inWindow = (s: WorkoutSession, from: Date | null, to: Date | null) => {
    if (!from || !to || !s.finishedAt) return false;
    const t = new Date(s.finishedAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  const thisCycleSessions = completed.filter(s => inWindow(s, cycleStart, cycleEnd));
  const prevCycleSessions = completed.filter(s => inWindow(s, prevCycleStart, cycleStart));

  const thisCycleVol  = thisCycleSessions.reduce((a, s) => a + s.totalVolume, 0);
  const prevCycleVol  = prevCycleSessions.reduce((a, s) => a + s.totalVolume, 0);
  const cycleVolDelta = prevCycleVol > 0
    ? Math.round(((thisCycleVol - prevCycleVol) / prevCycleVol) * 100)
    : thisCycleVol > 0 ? 100 : 0;

  // Most recent completed session within the current cycle
  const lastSession = thisCycleSessions.length > 0
    ? [...thisCycleSessions].sort(
        (a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime(),
      )[0]
    : null;

  const latestPR = records.length > 0
    ? [...records].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0]
    : null;

  const cards: CardModel[] = [
    {
      id:    'progress',
      tag:   'CYCLE PROGRESS',
      icon:  'pulse',
      hero:  fmtVol(thisCycleVol),
      unit:  thisCycleVol > 0 ? 'kg this cycle' : 'no data yet',
      title: 'Progress',
      sub:   thisCycleSessions.length > 0
        ? `${thisCycleSessions.length} session${thisCycleSessions.length !== 1 ? 's' : ''} · ${cycleVolDelta > 0 ? '+' : ''}${cycleVolDelta}% vs last cycle`
        : 'No sessions this cycle yet',
      grad: ['#CC4A00', '#FF8C00', '#FFA940'] as const,
      hi:   '#FFD080',
      tab:  'Progress',
    },
    {
      id:    'pr',
      tag:   'PERSONAL RECORD',
      icon:  'trophy',
      hero:  latestPR ? `${latestPR.heaviestWeight}` : '—',
      unit:  latestPR ? 'kg' : 'no records yet',
      title: 'Records',
      sub:   latestPR ? latestPR.exerciseName : 'Train to set your first PR',
      grad:  ['#2A0F9E', '#5B30D6', '#8B63FF'] as const,
      hi:    '#C4AAFF',
      tab:   'Progress',
    },
    {
      id:    'prev',
      tag:   'LAST SESSION',
      icon:  'barbell',
      hero:  lastSession ? fmtVol(lastSession.totalVolume) : '—',
      unit:  lastSession ? 'kg lifted' : 'no sessions yet',
      title: 'Last Session',
      sub:   lastSession
        ? `${lastSession.dayLabel} · ${lastSession.exercises.length} exercise${lastSession.exercises.length !== 1 ? 's' : ''}`
        : 'Complete a workout to see history',
      grad: ['#062D6B', '#0D5BC4', '#3A94F5'] as const,
      hi:   '#8FCEFF',
      tab:  'Cycle',
    },
  ];

  const ringColor = DAY_COLOR[currentDay] ?? COLORS.accent;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)));
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>HIGHLIGHTS</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        contentContainerStyle={s.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {cards.map((card, i) => (
          <TouchableOpacity
            key={card.id}
            activeOpacity={0.88}
            onPress={() => onNavigate(card.tab)}
            style={i < cards.length - 1 ? s.cardGap : undefined}
          >
            <CardView card={card} ringColor={ringColor} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {cards.map((c, i) => (
          <View key={c.id} style={[s.dot, i === activeIdx && s.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function CardView({ card, ringColor }: { card: CardModel; ringColor: string }) {
  return (
    <View style={s.card}>
      <LinearGradient
        colors={card.grad}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative rings tinted by current cycle day */}
      <View style={[ring.outer, { borderColor: toRgba(ringColor, 0.32) }]} />
      <View style={[ring.inner, { borderColor: toRgba(ringColor, 0.22) }]} />

      {/* Tag + icon row */}
      <View style={s.topRow}>
        <View style={s.tagPill}>
          <Text style={s.tagTxt}>{card.tag}</Text>
        </View>
        <View style={s.iconCircle}>
          <Ionicons name={card.icon as any} size={15} color={card.hi} />
        </View>
      </View>

      {/* Hero number */}
      <View style={s.heroWrap}>
        <Text style={s.heroNum} adjustsFontSizeToFit numberOfLines={1}>{card.hero}</Text>
        <Text style={[s.heroUnit, { color: card.hi }]}>{card.unit}</Text>
      </View>

      {/* Bottom frosted panel */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={26} tint="dark" style={s.panel}>
          <PanelRow card={card} />
        </BlurView>
      ) : (
        <View style={[s.panel, { backgroundColor: 'rgba(0,0,0,0.42)' }]}>
          <PanelRow card={card} />
        </View>
      )}
    </View>
  );
}

function PanelRow({ card }: { card: CardModel }) {
  return (
    <View style={s.panelRow}>
      <View style={s.panelText}>
        <Text style={s.panelTitle}>{card.title}</Text>
        <Text style={s.panelSub} numberOfLines={1}>{card.sub}</Text>
      </View>
      <View style={[s.arrow, { backgroundColor: `${card.hi}1A` }]}>
        <Ionicons name="arrow-forward" size={13} color={card.hi} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { marginBottom: 8 },
  label: {
    fontSize: 11, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.textMuted,
    letterSpacing: 0.88, textTransform: 'uppercase',
    marginBottom: 10, marginHorizontal: SIDE,
  },

  scroll:   { paddingHorizontal: SIDE },
  cardGap:  { marginRight: GAP },
  card:     {
    width: CARD_W, height: CARD_H,
    borderRadius: 22, overflow: 'hidden',
    justifyContent: 'space-between',
  },

  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  tagPill:    {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  tagTxt:     { fontSize: 8, fontWeight: '800', fontFamily: FONTS.label, color: 'rgba(255,255,255,0.78)', letterSpacing: 0.64, textTransform: 'uppercase' },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.24)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  heroNum:  { fontSize: 54, fontWeight: '800', fontFamily: FONTS.data, color: '#fff', letterSpacing: -2.16, lineHeight: 58 },
  heroUnit: { fontSize: 12, fontWeight: '700', fontFamily: FONTS.headline, letterSpacing: -0.36, marginTop: -2 },

  panel:      { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  panelRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  panelText:  { flex: 1 },
  panelTitle: { fontSize: 14, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.56 },
  panelSub:   { fontSize: 11, fontFamily: FONTS.body, color: 'rgba(255,255,255,0.52)', marginTop: 2 },
  arrow:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 11 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
});

const ring = StyleSheet.create({
  outer: {
    position: 'absolute', width: 210, height: 210, borderRadius: 105,
    borderWidth: 34, top: -85, right: -65,
  },
  inner: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    borderWidth: 22, bottom: 24, left: -45,
  },
});
