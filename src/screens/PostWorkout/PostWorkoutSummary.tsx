import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Pressable, StyleSheet, Modal, Alert,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, InteractionManager, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { GlassView } from '../../components/common/GlassView';
import { TrophyIcon } from '../../components/common/TrophyIcon';
import { COLORS } from '../../constants';
import { WorkoutSession, WorkoutDay, Exercise } from '../../types';
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
        <GlassView radius={99} style={pg.chip}>
          <TrophyIcon size={12} color={COLORS.accent} />
          <Text style={pg.chipText}>Workout Complete</Text>
          <Text style={pg.chipDot}>·</Text>
          <Text style={pg.chipDate}>{finishedDate}</Text>
        </GlassView>
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
  const [openId,   setOpenId]   = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'volume' | 'order'>('volume');

  // Per-exercise stats. Color is locked to the exercise's *original* index so
  // it stays stable regardless of how the list is sorted below.
  const exStats = session.exercises.map((ex, originalIdx) => {
    const completed = ex.sets.filter(s => s.isCompleted);
    const volume    = completed.reduce(
      (a, s) => a + (s.actualRepsToFailure ?? s.actualReps) * (s.actualWeight ?? 1),
      0,
    );
    const totalReps = completed.reduce(
      (a, s) => a + (s.actualRepsToFailure ?? s.actualReps),
      0,
    );
    const bestSet = completed.reduce<typeof completed[0] | null>(
      (b, s) => ((s.actualWeight ?? 0) > (b?.actualWeight ?? 0) ? s : b),
      null,
    );
    return {
      ex,
      completed,
      volume,
      totalReps,
      bestSet,
      color: EX_COLORS[originalIdx % EX_COLORS.length],
    };
  });

  const totalVolume = exStats.reduce((a, x) => a + x.volume, 0);
  const list        = sortMode === 'volume'
    ? [...exStats].sort((a, b) => b.volume - a.volume)
    : exStats;

  const fmtVol = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section header: title + sort toggle ─────────── */}
      <View style={ex2.header}>
        <Text style={ex2.headerTitle}>Volume Breakdown</Text>
        <View style={ex2.toggle}>
          {(['volume', 'order'] as const).map(mode => {
            const active = sortMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setSortMode(mode)}
                style={[ex2.togglePill, active && ex2.togglePillActive]}
              >
                <Text style={[ex2.toggleTxt, active && ex2.toggleTxtActive]}>
                  {mode === 'volume' ? 'By volume' : 'By order'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Stacked volume bar — each exercise's share of total ─ */}
      {totalVolume > 0 && (
        <View style={ex2.bar}>
          {list.map((x, i) => {
            const pct = x.volume / totalVolume;
            if (pct <= 0) return null;
            const isFirst = i === 0;
            const isLast  = i === list.length - 1;
            return (
              <View
                key={x.ex.id}
                style={[
                  ex2.barSeg,
                  { flex: pct, backgroundColor: x.color },
                  isFirst && { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
                  isLast  && { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
                ]}
              >
                {pct >= 0.15 && (
                  <Text style={ex2.barLabel} numberOfLines={1}>
                    {Math.round(pct * 100)}%
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Exercise rows ─────────────────────────────── */}
      {list.map((x, i) => {
        const open       = openId === x.ex.id;
        const isFirst    = i === 0;
        const isLast     = i === list.length - 1;
        const prevOpen   = !isFirst && openId === list[i - 1].ex.id;
        const nextOpen   = !isLast  && openId === list[i + 1].ex.id;
        // A "gap" exists above/below the card when it sits next to a boundary,
        // or when either it or its neighbour is expanded. Round the corner
        // wherever a gap is present so the card reads as separated.
        const gapAbove   = isFirst || open || prevOpen;
        const gapBelow   = isLast  || open || nextOpen;
        // Generous breathing room around an opened card; visible 4px between
        // closed pairs so they read as a stack of cards, not one fused panel.
        const marginBot  = isLast ? 0 : (open || nextOpen ? 14 : 4);
        const showWeight = x.ex.weightUnit !== 'bodyweight';
        const volLabel   = `${fmtVol(x.volume)}${showWeight ? ' ' + x.ex.weightUnit : ' reps'}`;

        return (
          <GlassView
            key={x.ex.id}
            radius={0}
            style={[
              ex2.card,
              { borderTopLeftRadius:    gapAbove ? 12 : 0,
                borderTopRightRadius:   gapAbove ? 12 : 0,
                borderBottomLeftRadius: gapBelow ? 12 : 0,
                borderBottomRightRadius:gapBelow ? 12 : 0,
                marginBottom: marginBot },
            ]}
          >
            <Pressable
              onPress={() => setOpenId(open ? null : x.ex.id)}
              style={({ pressed }) => [ex2.row, pressed && { opacity: 0.75 }]}
            >
              {/* Color marker on the left — matches the bar segment */}
              <View style={[ex2.marker, { backgroundColor: x.color }]} />

              <View style={ex2.info}>
                <Text style={ex2.name} numberOfLines={1}>{x.ex.exerciseName}</Text>

                <View style={ex2.chipsRow}>
                  <View style={ex2.chip}>
                    <Text style={ex2.chipTxt}>{x.completed.length}/{x.ex.sets.length} sets</Text>
                  </View>
                  <View style={[
                    ex2.chip,
                    { backgroundColor: x.color + '22', borderColor: x.color + '55' },
                  ]}>
                    <Text style={[ex2.chipTxt, { color: x.color, fontWeight: '700' }]}>
                      {volLabel}
                    </Text>
                  </View>
                  {showWeight && x.bestSet && x.bestSet.actualWeight != null && (
                    <View style={ex2.chip}>
                      <Text style={ex2.chipTxt}>
                        best {x.bestSet.actualWeight}{x.ex.weightUnit} × {x.bestSet.actualRepsToFailure ?? x.bestSet.actualReps}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Svg
                width={14} height={14} viewBox="0 0 24 24" fill="none"
                style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] } as any}
              >
                <Path d="M6 9l6 6 6-6" stroke={COLORS.textMuted} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            {open && (
              <View style={ex2.table}>
                <View style={ex2.tableHead}>
                  {['Set', 'Weight', 'Reps', 'Vol'].map((h, hi) => (
                    <Text key={hi} style={[ex2.th, hi > 0 && ex2.thRight]}>{h}</Text>
                  ))}
                </View>
                {x.completed.map((set, si) => {
                  const reps = set.actualRepsToFailure ?? set.actualReps;
                  const vol  = Math.round(reps * (set.actualWeight ?? 1));
                  return (
                    <View key={si} style={ex2.tableRow}>
                      <Text style={ex2.td}>S{set.setNumber}</Text>
                      <Text style={[ex2.td, ex2.tdRight]}>
                        {set.actualWeight != null ? `${set.actualWeight}${x.ex.weightUnit}` : '—'}
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

function NextUpPage({ nextDay, width, visible }:
  { nextDay?: WorkoutDay; width: number; visible: boolean }) {
  if (!nextDay) {
    return (
      <View style={[pg.page, { width, alignItems: 'center', justifyContent: 'center' }]}>
        <TrophyIcon size={40} color={COLORS.textLabel} />
        <Text style={nu.empty}>No next workout scheduled</Text>
        <Text style={nu.emptySub}>Rest and recover — you've earned it.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={[pg.page, { width, alignItems: 'center', paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Centered identity block — mirrors the Summary page's header */}
      <View style={nu.head}>
        <Text style={nu.eyebrow}>Up Next</Text>
        <Text style={nu.dayName}>{nextDay.label}</Text>
        <Text style={nu.daySub}>
          Day {nextDay.dayPosition} · {nextDay.exercises.length} exercise{nextDay.exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Animated exercise list — each row drifts up from below, staggered */}
      <View style={nu.list}>
        {nextDay.exercises.map((ex, i) => (
          <UpcomingRow key={ex.id} ex={ex} index={i} visible={visible} />
        ))}
      </View>
    </ScrollView>
  );
}

function UpcomingRow({ ex, index, visible }:
  { ex: Exercise; index: number; visible: boolean }) {
  const translateY = useRef(new Animated.Value(28)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  // Drive the stagger off `visible` (true only when Page 3 is the active pager
  // page). Without this gate the animations would all fire on mount of the
  // pager — long before the user swiped over — and finish before being seen.
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          delay: 80 + index * 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          delay: 80 + index * 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset so the animation can replay next time the user navigates back.
      translateY.setValue(28);
      opacity.setValue(0);
    }
  }, [visible, index, translateY, opacity]);

  // Formula display: sets × reps × weight = volume
  const repsLabel = ex.toFailure
    ? 'fail'
    : ex.targetRepsMin === ex.targetRepsMax || !ex.targetRepsMax
      ? `${ex.targetRepsMin ?? '–'}`
      : `${ex.targetRepsMin}–${ex.targetRepsMax}`;

  const hasWeight = ex.targetWeight != null && ex.targetWeight > 0 && ex.weightUnit !== 'bodyweight';
  const vol       = hasWeight && !ex.toFailure && ex.targetRepsMin
    ? ex.targetSets * ex.targetRepsMin * (ex.targetWeight ?? 0)
    : null;
  const volLabel  = vol != null
    ? vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : `${Math.round(vol)}`
    : null;

  return (
    <Animated.View style={[nu.row, { opacity, transform: [{ translateY }] }]}>
      <Text style={nu.exName} numberOfLines={1}>{ex.name}</Text>
      <Text style={nu.exMeta}>
        {ex.targetSets} × {repsLabel}
        {hasWeight ? ` × ${ex.targetWeight}${ex.weightUnit}` : ''}
        {volLabel ? ` = ${volLabel}` : ''}
      </Text>
    </Animated.View>
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
          <NextUpPage    nextDay={nextDay}  width={width} visible={page === 2} />
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
  // Glass pill — GlassView provides the blurred background + subtle border
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  chipText:      { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  chipDot:       { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  chipDate:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
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
  // Section header — title + sort toggle
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle:      { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.9 },

  // Sort toggle (By volume / By order)
  toggle:           { flexDirection: 'row', backgroundColor: 'rgba(255,240,220,0.05)', borderRadius: 9, padding: 3, borderWidth: 1, borderColor: 'rgba(255,240,220,0.08)' },
  togglePill:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  togglePillActive: { backgroundColor: 'rgba(255,240,220,0.14)' },
  toggleTxt:        { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.2 },
  toggleTxtActive:  { color: '#fff', fontWeight: '800' },

  // Stacked volume bar — generous height for visibility
  bar:              { flexDirection: 'row', height: 32, marginBottom: 14, gap: 2 },
  barSeg:           { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  barLabel:         { fontSize: 11, fontWeight: '800', color: '#0d0d0f', letterSpacing: 0.3 },

  // Exercise card — cards stack flush with one another for a single-panel feel
  card:             { overflow: 'hidden' },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  marker:           { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  info:             { flex: 1, minWidth: 0, gap: 7 },
  name:             { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },

  // Chip row (sets / volume / best set)
  chipsRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chip:             { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', backgroundColor: 'rgba(255,240,220,0.04)' },
  chipTxt:          { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.1 },

  // Expanded set table
  table:            { borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)', backgroundColor: 'rgba(0,0,0,0.18)' },
  tableHead:        { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 9 },
  th:               { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  thRight:          { textAlign: 'right' },
  tableRow:         { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.06)' },
  td:               { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  tdRight:          { textAlign: 'right' },
});

// Options menu (Page 1 settings)
const mn = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 },
  sheet:     { minWidth: 220, borderRadius: 14, backgroundColor: 'rgba(28,28,32,0.97)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', paddingVertical: 6 },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemTxt:   { fontSize: 14, fontWeight: '600', color: '#fff' },
  divider:   { height: 1, backgroundColor: 'rgba(255,240,220,0.08)', marginVertical: 2 },
});

// Next Up page — minimal, centered, mirrors the Summary page's identity block
const nu = StyleSheet.create({
  // Empty state
  empty:    { fontSize: 16, fontWeight: '600', color: COLORS.textMuted, marginTop: 16 },
  emptySub: { fontSize: 13, color: COLORS.textLabel, marginTop: 6 },

  // Centered header
  head:     { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 28, alignSelf: 'stretch' },
  eyebrow:  { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  dayName:  { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 36, textAlign: 'center' },
  daySub:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Animated list
  list:     { gap: 22, alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 8 },
  row:      { alignItems: 'center', gap: 5, alignSelf: 'stretch' },
  exName:   { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3, textAlign: 'center' },
  exMeta:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.3, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
