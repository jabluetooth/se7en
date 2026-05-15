import React, { useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Pressable, StyleSheet, Modal, Alert,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { GlassView } from '../../components/common/GlassView';
import { Badge } from '../../components/common/Badge';
import { SetTypeBadge } from '../../components/common/SetTypeBadge';
import { TrophyIcon } from '../../components/common/TrophyIcon';
import { COLORS } from '../../constants';
import { WorkoutSession, WorkoutDay } from '../../types';
import { AppBackground } from '../../components/ui/AppBackground';

// ─── Constants ────────────────────────────────────────────────────────────────

const EX_COLORS  = [COLORS.accent, COLORS.rest, COLORS.warning, '#A78BFA'];
const PAGE_NAMES = ['Summary', 'Exercises', 'Next Up'];

// ─── Shared icons ─────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={COLORS.textSecondary} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronDown({ flipped = false }: { flipped?: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      style={{ transform: [{ rotate: flipped ? '180deg' : '0deg' }] } as any}>
      <Path d="M6 9l6 6 6-6" stroke={COLORS.accent} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Volume Line Graph ────────────────────────────────────────────────────────
// Transparent-background line chart of per-set volume. Peak set highlighted.

interface SetPoint { vol: number; reps: number; weight: number; unit: string; exName: string; }

function VolumeLineGraph({ data, peakIdx, width }:
  { data: SetPoint[]; peakIdx: number; width: number }) {
  const W = width;
  const H = 160;
  const padX = 18, padTop = 18, padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  if (data.length === 0) {
    return <View style={{ width: W, height: H }} />;
  }

  const maxVol = Math.max(...data.map(d => d.vol), 1);
  const points = data.map((d, i) => ({
    x: padX + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1)),
    y: padTop + innerH * (1 - d.vol / maxVol),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const baseY = padTop + innerH;
  const areaPath =
    `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseY} ` +
    `L${points[0].x.toFixed(1)},${baseY} Z`;

  const peak = points[peakIdx];

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Subtle baseline (transparent background — no fill on root SVG) */}
      <Path d={`M${padX},${baseY} L${W - padX},${baseY}`}
        stroke="rgba(255,240,220,0.10)" strokeWidth={1} />

      {/* Area fill — semi-transparent accent */}
      <Path d={areaPath} fill="rgba(255,140,0,0.10)" />

      {/* Line */}
      <Path d={linePath} stroke={COLORS.accent} strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Vertical guide to the peak */}
      <Path d={`M${peak.x},${peak.y} L${peak.x},${baseY}`}
        stroke={COLORS.accent} strokeWidth={1}
        strokeDasharray="2,3" strokeLinecap="round" />

      {/* Plain data points */}
      {points.map((p, i) => i !== peakIdx && (
        <Circle key={i} cx={p.x} cy={p.y} r={2.8}
          fill={COLORS.accent} fillOpacity={0.55} />
      ))}

      {/* Peak point — bigger ring + filled center */}
      <Circle cx={peak.x} cy={peak.y} r={9}
        fill="none" stroke={COLORS.accent} strokeOpacity={0.30} strokeWidth={2} />
      <Circle cx={peak.x} cy={peak.y} r={5} fill={COLORS.accent} />
    </Svg>
  );
}

// ─── Page 1: Summary ──────────────────────────────────────────────────────────

function SummaryPage({ session, width, bgImage, shotRef }: {
  session: WorkoutSession;
  width:   number;
  bgImage: string | null;
  shotRef: React.RefObject<ViewShot | null>;
}) {
  // Build per-set data points for the line graph
  const setData: SetPoint[] = session.exercises.flatMap(ex =>
    ex.sets.filter(s => s.isCompleted).map(s => {
      const reps   = s.actualRepsToFailure ?? s.actualReps;
      const weight = s.actualWeight ?? 0;
      return {
        reps,
        weight,
        unit:   ex.weightUnit,
        exName: ex.exerciseName,
        vol:    Math.max(reps * (weight || 1), 1),
      };
    }),
  );

  const peakIdx = setData.reduce(
    (mi, d, i) => (d.vol > setData[mi].vol ? i : mi), 0,
  );
  const peak    = setData[peakIdx];

  const totalReps = setData.reduce((a, s) => a + s.reps, 0);
  const totalSets = setData.length;
  const volNum    = Math.round(session.totalVolume);
  const volDisplay = volNum >= 1000 ? (volNum / 1000).toFixed(1) + 'k' : String(volNum);

  const finishedDate = session.finishedAt
    ? new Date(session.finishedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  const graphWidth = Math.min(width - 32, 360);

  return (
    <ViewShot
      ref={shotRef}
      options={{ format: 'png', quality: 1, result: 'tmpfile' }}
      style={{ width, flex: 1, backgroundColor: bgImage ? '#000' : '#0d0d0f' }}
    >
      {/* User-picked background image (only rendered when set). Wrapped in a
          single absolute-fill View so layering is unambiguous inside ViewShot. */}
      {bgImage && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={{ uri: bgImage }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={e => Alert.alert('Image failed to load', e.nativeEvent?.error ?? 'Unknown error')}
          />
          {/* Light overlay — keeps text legible without hiding the image */}
          <LinearGradient
            colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.60)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <View style={[pg.page, { width, alignItems: 'center', paddingBottom: 24 }]}>

      {/* ── Workout identity — centered ─────────────────── */}
      <View style={pg.top}>
        <View style={pg.chip}>
          <TrophyIcon size={12} color={COLORS.accent} />
          <Text style={pg.chipText}>Workout Complete</Text>
          <Text style={pg.chipDate}>{finishedDate}</Text>
        </View>
        <Text style={pg.name}>{session.dayLabel}</Text>
        <Text style={pg.nameSub}>Day {session.dayPosition} · {session.duration} min</Text>
      </View>

      {/* ── Line graph hero (transparent bg) ────────────── */}
      <View style={pg.hero}>
        <View style={pg.graphLabelRow}>
          <Text style={pg.graphTitle}>Set Volume</Text>
          <Text style={pg.graphAxis}>peak highlighted</Text>
        </View>
        <VolumeLineGraph data={setData} peakIdx={peakIdx} width={graphWidth} />

        {peak && (
          <View style={pg.peakPill}>
            <TrophyIcon size={11} color={COLORS.accent} />
            <Text style={pg.peakLbl}>Highest set</Text>
            <Text style={pg.peakVal}>
              {peak.reps} × {peak.weight}{peak.unit} = {Math.round(peak.vol)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Stats: Reps × Sets × Volume ─────────────────── */}
      <GlassView radius={14} style={pg.statsStrip}>
        <View style={pg.statCell}>
          <Text style={pg.statVal}>{totalReps}</Text>
          <Text style={pg.statLabel}>Reps</Text>
        </View>
        <View style={pg.statOp}><Text style={pg.statOpTxt}>×</Text></View>
        <View style={pg.statCell}>
          <Text style={pg.statVal}>{totalSets}</Text>
          <Text style={pg.statLabel}>Sets</Text>
        </View>
        <View style={pg.statOp}><Text style={pg.statOpTxt}>=</Text></View>
        <View style={pg.statCell}>
          <Text style={pg.statVal}>{volDisplay}</Text>
          <Text style={pg.statLabel}>Volume</Text>
        </View>
      </GlassView>

      </View>
    </ViewShot>
  );
}

// ─── Page 2: Exercises ────────────────────────────────────────────────────────

function ExercisesPage({ session, width }: { session: WorkoutSession; width: number }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {session.exercises.map((ex, i) => {
        const color     = EX_COLORS[i % EX_COLORS.length];
        const completed = ex.sets.filter(s => s.isCompleted);
        const bestSet   = completed.reduce<typeof completed[0] | null>(
          (b, s) => (s.actualWeight ?? 0) > (b?.actualWeight ?? 0) ? s : b, null
        );
        const open      = openId === ex.id;
        const isFirst   = i === 0;
        const isLast    = i === session.exercises.length - 1;

        return (
          <GlassView key={ex.id} radius={0} style={[
            ex2.card,
            { borderTopLeftRadius: isFirst ? 12 : 3, borderTopRightRadius: isFirst ? 12 : 3,
              borderBottomLeftRadius: isLast ? 12 : 3, borderBottomRightRadius: isLast ? 12 : 3 },
            !isLast && ex2.gap,
          ]}>
            <TouchableOpacity style={ex2.row} onPress={() => setOpenId(open ? null : ex.id)} activeOpacity={0.75}>
              <View style={[ex2.orb, { backgroundColor: color + '22' }]}>
                <Text style={[ex2.orbNum, { color }]}>{i + 1}</Text>
              </View>
              <View style={ex2.info}>
                <View style={ex2.nameRow}>
                  <Text style={ex2.name} numberOfLines={1}>{ex.exerciseName}</Text>
                  {ex.isCompleted && <Badge label="Done" variant="completed" size="xs" />}
                </View>
                <Text style={ex2.meta}>
                  {completed.length}/{ex.sets.length} sets
                  {bestSet ? ` · best ${bestSet.actualWeight ?? '-'}${ex.weightUnit} × ${bestSet.actualRepsToFailure ?? bestSet.actualReps}` : ''}
                </Text>
              </View>
              <View style={[ex2.chevron, open && ex2.chevronOpen]}>
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </View>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] } as any}>
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {open && (
              <View style={ex2.table}>
                <View style={ex2.tableHead}>
                  {['Set', 'Weight', 'Reps', 'Vol'].map((h, hi) => (
                    <Text key={hi} style={[ex2.th, hi > 0 && ex2.thRight]}>{h}</Text>
                  ))}
                </View>
                {completed.map((set, si) => {
                  const reps = set.actualRepsToFailure ?? set.actualReps;
                  const vol  = Math.round(reps * (set.actualWeight ?? 1));
                  return (
                    <View key={si} style={ex2.tableRow}>
                      <Text style={ex2.td}>S{set.setNumber}</Text>
                      <Text style={[ex2.td, ex2.tdRight]}>
                        {set.actualWeight != null ? `${set.actualWeight}${ex.weightUnit}` : '—'}
                      </Text>
                      <Text style={[ex2.td, ex2.tdRight]}>{reps}</Text>
                      <Text style={[ex2.td, ex2.tdRight, { color: COLORS.textMuted }]}>{vol}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassView>
        );
      })}
    </ScrollView>
  );
}

// ─── Page 3: Next Up ──────────────────────────────────────────────────────────

function NextUpPage({ nextDay, width }: { nextDay?: WorkoutDay; width: number }) {
  const [showAll, setShowAll] = useState(false);

  if (!nextDay) {
    return (
      <View style={[pg.page, { width, alignItems: 'center', justifyContent: 'center' }]}>
        <TrophyIcon size={40} color={COLORS.textLabel} />
        <Text style={nu.empty}>No next workout scheduled</Text>
        <Text style={nu.emptySub}>Rest and recover — you've earned it.</Text>
      </View>
    );
  }

  const exercises = showAll ? nextDay.exercises : nextDay.exercises.slice(0, 5);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Day header */}
      <GlassView radius={14} style={nu.header}>
        <LinearGradient
          colors={['rgba(100,210,255,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={nu.headerGrad}
        >
          <View>
            <Text style={nu.dayName}>{nextDay.label}</Text>
            <Text style={nu.daySub}>Day {nextDay.dayPosition} · {nextDay.exercises.length} exercises</Text>
          </View>
          <Badge label={`Day ${nextDay.dayPosition}`} variant="rest" size="xs" />
        </LinearGradient>
      </GlassView>

      {/* Exercise rows */}
      <GlassView radius={12} style={nu.listCard}>
        {exercises.map((ex, i) => (
          <View key={ex.id} style={[nu.exRow, i < exercises.length - 1 && nu.exRowBorder]}>
            <SetTypeBadge type={ex.setType} />
            <Text style={nu.exName} numberOfLines={1}>{ex.name}</Text>
            <Text style={nu.exTarget}>
              {ex.targetSets} × {ex.toFailure ? 'fail' : (ex.targetRepsMin ?? '—')}
            </Text>
            {ex.targetWeight != null && (
              <Text style={nu.exWeight}>{ex.targetWeight}{ex.weightUnit}</Text>
            )}
          </View>
        ))}

        {nextDay.exercises.length > 5 && (
          <TouchableOpacity onPress={() => setShowAll(v => !v)} style={nu.showMore} activeOpacity={0.7}>
            <Text style={nu.showMoreText}>
              {showAll ? 'Show less' : `+${nextDay.exercises.length - 5} more exercises`}
            </Text>
            <ChevronDown flipped={showAll} />
          </TouchableOpacity>
        )}
      </GlassView>
    </ScrollView>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

interface Props {
  session: WorkoutSession;
  nextDay?: WorkoutDay;
  onDone:  () => void;
}

export function PostWorkoutSummary({ session, nextDay, onDone }: Props) {
  const { width }  = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [bgImage,   setBgImage]   = useState<string | null>(null);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [busy,      setBusy]      = useState(false);
  const scrollRef  = useRef<ScrollView>(null);
  const shotRef    = useRef<ViewShot>(null);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(newPage);
  };

  // Close the options menu, then wait for the dismiss animation + any
  // queued interactions before launching the next native modal/intent.
  // setTimeout is unreliable on slower devices; InteractionManager waits
  // for the JS-driven animation queue to drain.
  const afterMenuClose = (fn: () => void | Promise<void>) => {
    setMenuOpen(false);
    InteractionManager.runAfterInteractions(() => {
      // small extra buffer in case the modal's fade-out is still in flight
      setTimeout(fn, 120);
    });
  };

  // Pick a background image from the device's photo library.
  // Note: we DO NOT close the menu modal first. On Android the picker is a
  // separate Activity and launches fine over our modal; closing our modal
  // first was causing the picker Activity to be dismissed by the lifecycle
  // event before it could present (which is why the promise hung).
  const pickBackground = async () => {
    console.log('[bg] pickBackground: Pressable tap fired');
    try {
      console.log('[bg] pickBackground: launching ImagePicker (modal stays open)');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      console.log('[bg] pickBackground result:', res);
      if (res.canceled) {
        setMenuOpen(false);
        return;
      }
      const uri = res.assets?.[0]?.uri;
      if (uri) setBgImage(uri);
    } catch (e) {
      console.log('[bg] pickBackground error:', e);
      Alert.alert('Could not pick image', e instanceof Error ? e.message : String(e));
    } finally {
      setMenuOpen(false);
    }
  };

  // Capture the Summary page as a PNG and save it to the device's photo library
  const saveAsImage = () => afterMenuClose(async () => {
    if (busy) return;
    try {
      setBusy(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access so the workout image can be saved.');
        return;
      }
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Workout summary saved to your Photos.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  });

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* ── Persistent header ─────────────────────────── */}
        <View style={hd.bar}>
          <TouchableOpacity onPress={onDone} style={hd.backBtn} activeOpacity={0.7}>
            <ChevronLeft />
          </TouchableOpacity>

          <Text style={hd.title}>{PAGE_NAMES[page]}</Text>

          {/* Top-right options — background / save (Page 1 only) */}
          <View style={hd.rightSlot}>
            {page === 0 && (
              <TouchableOpacity onPress={() => setMenuOpen(true)} style={hd.iconBtn} activeOpacity={0.7}>
                <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Horizontal pager ──────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          decelerationRate="fast"
        >
          <SummaryPage   session={session}  width={width} bgImage={bgImage} shotRef={shotRef} />
          <ExercisesPage session={session}  width={width} />
          <NextUpPage    nextDay={nextDay}  width={width} />
        </ScrollView>

        {/* ── Bottom page indicator ─────────────────────── */}
        <View style={hd.bottomDots}>
          {PAGE_NAMES.map((_, i) => (
            <View key={i} style={[hd.dot, i === page && hd.dotActive]} />
          ))}
        </View>

      </SafeAreaView>

      {/* ── Options menu modal ─────────────────────────── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={mn.backdrop}>
          {/* Tap-anywhere-to-dismiss layer sits BEHIND the sheet, so it can
              never swallow taps destined for menu items above it. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />

          <View style={mn.sheet}>
            <Pressable
              onPress={pickBackground}
              style={({ pressed }) => [mn.item, pressed && { opacity: 0.65 }]}
            >
              <Ionicons name="image-outline" size={20} color={COLORS.accent} />
              <Text style={mn.itemTxt}>{bgImage ? 'Replace Background' : 'Pick Background Image'}</Text>
            </Pressable>

            {bgImage && (
              <Pressable
                onPress={() => { setBgImage(null); setMenuOpen(false); }}
                style={({ pressed }) => [mn.item, pressed && { opacity: 0.65 }]}
              >
                <Ionicons name="close-circle-outline" size={20} color={COLORS.textSecondary} />
                <Text style={[mn.itemTxt, { color: COLORS.textSecondary }]}>Remove Background</Text>
              </Pressable>
            )}

            <View style={mn.divider} />

            <Pressable
              onPress={saveAsImage}
              disabled={busy}
              style={({ pressed }) => [mn.item, busy && { opacity: 0.5 }, pressed && { opacity: 0.65 }]}
            >
              <Ionicons name="download-outline" size={20} color={COLORS.accent} />
              <Text style={mn.itemTxt}>{busy ? 'Saving…' : 'Save as Image'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Header
const hd = StyleSheet.create({
  bar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 44 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flex: 1, textAlign: 'center' },
  rightSlot:  { width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  iconBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  // Bottom-anchored page indicator (visible across all pages)
  bottomDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,240,220,0.22)' },
  dotActive:  { backgroundColor: COLORS.accent, width: 18, borderRadius: 3 },
});

// Shared page
const pg = StyleSheet.create({
  page:          { flex: 1, paddingHorizontal: 16, paddingTop: 8, justifyContent: 'space-between' },

  // Summary — top (centered)
  top:           { alignItems: 'center', gap: 4 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(255,140,0,0.16)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.32)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  chipText:      { fontSize: 11, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipDate:      { fontSize: 11, color: COLORS.textMuted },
  name:          { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 36, textAlign: 'center' },
  nameSub:       { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Hero — line graph (transparent background)
  hero:           { alignItems: 'center', alignSelf: 'stretch', gap: 10 },
  graphLabelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 4 },
  graphTitle:     { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  graphAxis:      { fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.3 },

  // Peak set pill — shown under the graph
  peakPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,140,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.30)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  peakLbl:       { fontSize: 10, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  peakVal:       { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Stats strip — Reps × Sets = Volume
  statsStrip:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  statCell:      { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statOp:        { paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  statOpTxt:     { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  statVal:       { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  statLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
});

// Exercises page
const ex2 = StyleSheet.create({
  card:     { overflow: 'hidden' },
  gap:      { marginBottom: 2 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  orb:      { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  orbNum:   { fontSize: 14, fontWeight: '800', lineHeight: 16 },
  info:     { flex: 1, minWidth: 0 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  name:     { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  meta:     { fontSize: 11, color: COLORS.textMuted },
  chevron:  {},
  chevronOpen: {},
  table:    { borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', backgroundColor: 'rgba(0,0,0,0.18)' },
  tableHead:{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 },
  th:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  thRight:  { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  td:       { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  tdRight:  { textAlign: 'right' },
});

// Options menu (Page 1 settings)
const mn = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 },
  sheet:     { minWidth: 220, borderRadius: 14, backgroundColor: 'rgba(28,28,32,0.97)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', paddingVertical: 6 },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemTxt:   { fontSize: 14, fontWeight: '600', color: '#fff' },
  divider:   { height: 1, backgroundColor: 'rgba(255,240,220,0.08)', marginVertical: 2 },
});

// Next Up page
const nu = StyleSheet.create({
  empty:        { fontSize: 16, fontWeight: '600', color: COLORS.textMuted, marginTop: 16 },
  emptySub:     { fontSize: 13, color: COLORS.textLabel, marginTop: 6 },
  header:       { marginBottom: 12, overflow: 'hidden' },
  headerGrad:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  dayName:      { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  daySub:       { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  listCard:     { overflow: 'hidden' },
  exRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  exRowBorder:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.07)' },
  exName:       { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  exTarget:     { fontSize: 11, color: COLORS.textMuted },
  exWeight:     { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, minWidth: 52, textAlign: 'right' },
  showMore:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', paddingVertical: 11 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: COLORS.accent },
});
