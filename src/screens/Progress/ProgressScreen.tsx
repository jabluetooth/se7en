import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { FadeInItem } from '../../components/common/FadeInItem';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { sessionLoad } from '../../utils/volume';
import { COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { fmtVol } from '../../utils/format';
import { aggregateExercises } from '../../utils/exerciseHistory';
import { ContributionHeatmap } from './components/ContributionHeatmap';
import { ExerciseCard } from './components/ExerciseCard';
import { useDockClearance } from '../../hooks/useDockClearance';
import Animated from 'react-native-reanimated';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import { enterRise } from '../../motion/presets';
import { accentA, ink, themed } from '../../theme/runtime';

// Progress signal text colour — applied to font only.

type SortMode = 'recent' | 'volume' | 'name';

interface Props {
  /** Takes a brand-new user to Home to start their first workout. */
  onStartWorkout?: () => void;
}

export function ProgressScreen({ onStartWorkout }: Props = {}) {
  const { sessions }   = useSessionStore();
  const { activePlan } = usePlanStore();
  const unit           = useSettingsStore(st => st.settings.defaultWeightUnit ?? 'kg');
  const { width: windowWidth } = useWindowDimensions();
  const dockClearance  = useDockClearance();

  const [sortMode,    setSortMode]    = useState<SortMode>('recent');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll,     setShowAll]     = useState(false);

  // Initial card limit — keeps the Progress screen scannable for users with
  // dozens of tracked exercises. Search bypasses the cap (the user is already
  // narrowing the list themselves).
  const INITIAL_LIMIT = 5;

  // Memoised together so unrelated state updates (sort / search) don't redo
  // these passes over the full sessions list every render.
  const { totalWorkouts, recentVolume } = useMemo(() => {
    const completed = sessions.filter(s => s.status === 'completed');
    const recent14  = completed.slice(-14);
    return {
      totalWorkouts: completed.length,
      recentVolume:  recent14.reduce((a, s) => a + sessionLoad(s.exercises, unit), 0),
    };
  }, [sessions, unit]);

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

  // Apply the initial 5-card cap unless the user has opened search OR has
  // already expanded the list. Capped list shows the most recent activity
  // first when the default sort is 'recent'; switching sort changes which
  // 5 are surfaced.
  const isSearching = searchQuery.trim().length > 0;
  const displayedHistories = (showAll || isSearching)
    ? visibleHistories
    : visibleHistories.slice(0, INITIAL_LIMIT);
  const hiddenCount = visibleHistories.length - displayedHistories.length;

  // Chart width = window - ScrollView padding (32) - card padding (24) - border (2) - safety margin (4)
  const chartWidth = Math.max(240, windowWidth - 32 - 24 - 6);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Progress</Text>
          {activePlan && <Text style={s.sub}>{activePlan.name}</Text>}
        </View>

        {totalWorkouts === 0 ? (
          <FirstRun bottom={dockClearance} onStart={onStartWorkout} />
        ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: dockClearance }]} showsVerticalScrollIndicator={false}>
          {/* Summary stats — bare typographic numbers, no glass. The Activity
              heatmap below is this screen's genuinely distinct visual surface;
              three more glass boxes just to show three numbers ahead of it
              was diminishing that instead of leading into it. */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="barbell-outline" size={13} color={COLORS.accent} />
                <Text style={s.statLabel}>Workouts</Text>
              </View>
              <Text style={s.statValue}>{totalWorkouts}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="trending-up-outline" size={13} color={COLORS.accent} />
                <Text style={s.statLabel}>Volume</Text>
              </View>
              <Text style={[s.statValue, s.statAccent]}>
                {fmtVol(recentVolume)}
                <Text style={s.statUnit}>{unit}</Text>
              </Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCard}>
              <View style={s.statHeader}>
                <Ionicons name="list-outline" size={13} color={COLORS.accent} />
                <Text style={s.statLabel}>Exercises</Text>
              </View>
              <Text style={s.statValue}>{exerciseCount}</Text>
            </View>
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
                accessibilityLabel="Search exercises"
              />
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                style={({ pressed }) => [s.searchClose, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Close search"
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
                  accessibilityRole="button"
                  accessibilityLabel="Search exercises"
                >
                  <Ionicons name="search" size={15} color={COLORS.textSecondary} />
                </Pressable>
              </View>
              <View style={s.toggle}>
                {(['recent', 'volume', 'name'] as const).map(m => {
                  const active = sortMode === m;
                  const mLabel = m === 'recent' ? 'Recent' : m === 'volume' ? 'Volume' : 'A–Z';
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setSortMode(m)}
                      style={[s.togglePill, active && s.togglePillActive]}
                      accessibilityRole="button"
                      accessibilityLabel={`Sort by ${mLabel}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.toggleTxt, active && s.toggleTxtActive]}>
                        {mLabel}
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
              <Ionicons
                name={searchQuery.trim() ? 'search-outline' : 'trending-up-outline'}
                size={28}
                color={COLORS.textLabel}
                style={{ marginBottom: 8 }}
              />
              <Text style={s.emptyText}>
                {searchQuery.trim()
                  ? `No exercises matching "${searchQuery.trim()}".`
                  : 'Complete workouts to see exercise progress here.'}
              </Text>
            </GlassView>
          ) : (
            <View style={s.cardList}>
              {displayedHistories.map((h, i) => (
                <FadeInItem key={h.exerciseId} index={i}>
                  <ExerciseCard
                    history={h}
                    expanded={expandedId === h.exerciseId}
                    onToggle={() =>
                      setExpandedId(id => (id === h.exerciseId ? null : h.exerciseId))
                    }
                    chartWidth={chartWidth}
                  />
                </FadeInItem>
              ))}

              {/* Show-more / show-less control — only when the cap is actually
                  hiding something OR when the user already expanded the list. */}
              {!isSearching && (hiddenCount > 0 || showAll) && (
                <Pressable
                  onPress={() => setShowAll(v => !v)}
                  style={({ pressed }) => [s.seeMoreBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={s.seeMoreTxt}>
                    {showAll ? 'See less' : `See ${hiddenCount} more`}
                  </Text>
                  <Ionicons
                    name={showAll ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={COLORS.accent}
                  />
                </Pressable>
              )}
            </View>
          )}

          {/* Bottom breathing room — AppNavigator already pads 80px for the
              floating dock, so this is just the small gap between the last
              card and the dock's top edge (about half the dock's height). */}
          <View style={{ height: 24 }} />
        </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * Before the first workout, Progress has nothing to chart. Rather than a
 * screen of zeros, say what will appear here and point to where to start.
 */
function FirstRun({ bottom, onStart }: { bottom: number; onStart?: () => void }) {
  const items: [React.ComponentProps<typeof Ionicons>['name'], string, string][] = [
    ['calendar-outline', 'Your training calendar', 'Every day you train, filled in.'],
    ['trending-up-outline', 'A trend for each lift', 'How your weights and reps move over time.'],
    ['trophy-outline', 'Personal records', 'Flagged the moment you beat a previous best.'],
  ];
  return (
    <ScrollView contentContainerStyle={[fr.wrap, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
      <Animated.View entering={enterRise(0)} style={fr.hero}>
        <View style={fr.icon}><Ionicons name="pulse" size={28} color={COLORS.accent} /></View>
        <Text style={fr.title}>Your progress starts here</Text>
        <Text style={fr.sub}>Finish your first workout and this screen fills in with:</Text>
      </Animated.View>
      {items.map(([icon, title, desc], i) => (
        <Animated.View key={title} entering={enterRise(i + 1)} style={fr.item}>
          <Ionicons name={icon} size={20} color={COLORS.accent} />
          <View style={{ flex: 1 }}>
            <Text style={fr.itemTitle}>{title}</Text>
            <Text style={fr.itemDesc}>{desc}</Text>
          </View>
        </Animated.View>
      ))}
      {onStart && (
        <Animated.View entering={enterRise(4)}>
          <AnimatedPressable haptic="light" style={fr.cta} onPress={onStart} accessibilityRole="button" accessibilityLabel="Go to Home to start your first workout">
            <Text style={fr.ctaTxt}>Start your first workout</Text>
          </AnimatedPressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const fr = themed(() => StyleSheet.create({
  wrap:      { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  hero:      { alignItems: 'center', paddingVertical: 20 },
  icon:      { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: accentA(0.12), marginBottom: 16 },
  title:     { fontSize: 24, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.8, textAlign: 'center' },
  sub:       { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  item:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: ink(0.04), borderWidth: 1, borderColor: ink(0.08) },
  itemTitle: { fontSize: 15, fontFamily: FONTS.headline, color: COLORS.text },
  itemDesc:  { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, marginTop: 2 },
  cta:       { marginTop: 8, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  ctaTxt:    { fontSize: 16, fontFamily: FONTS.display, color: COLORS.onAccent },
}));

const s = themed(() => StyleSheet.create({
  header:           { paddingHorizontal: 20, paddingBottom: 14, zIndex: 10 },
  title:            { fontSize: 30, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -1.20 },
  sub:              { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 2 },
  scroll:           { paddingHorizontal: 16 },

  // Stats row — bare, no card background
  statsRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  statCard:         { flex: 1, alignItems: 'center' },
  statDivider:      { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: ink(0.14) },
  statHeader:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  statLabel:        { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textMuted, letterSpacing: 0 },
  statValue:        { fontSize: 22, fontFamily: FONTS.data, color: COLORS.text, letterSpacing: -0.88 },
  statAccent:       { color: COLORS.success },
  statUnit:         { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.textSecondary },

  // Activity card
  activityCard:     { padding: 14, marginBottom: 14 },
  cardTitle:        { fontSize: 12, fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0, marginBottom: 12 },

  // Section header + sort toggle
  progressHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10, paddingHorizontal: 2 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:     { fontSize: 11, fontFamily: FONTS.label, color: COLORS.textSecondary, letterSpacing: 0 },
  searchIcon:       { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  toggle:           { flexDirection: 'row', backgroundColor: ink(0.05), borderRadius: 8, padding: 2, borderWidth: 1, borderColor: ink(0.08) },
  togglePill:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  togglePillActive: { backgroundColor: ink(0.14) },
  toggleTxt:        { fontSize: 11, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  toggleTxtActive:  { color: COLORS.text, fontFamily: FONTS.display },

  // Search bar (replaces section header when active)
  searchRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: ink(0.05), borderWidth: 1, borderColor: ink(0.1) },
  searchInput:      { flex: 1, fontSize: 14, color: COLORS.text, padding: 0, fontFamily: FONTS.medium },
  searchClose:      { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  searchHint:       { fontSize: 11, color: COLORS.textMuted, marginBottom: 8, paddingHorizontal: 4, fontFamily: FONTS.semibold },

  // Card list
  cardList:         { gap: 8 },
  emptyCard:        { padding: 20, alignItems: 'center' },
  emptyText:        { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  // See more / less control
  seeMoreBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, marginTop: 2, borderRadius: 10, borderWidth: 1, borderColor: accentA(0.28), backgroundColor: accentA(0.06) },
  seeMoreTxt:       { fontSize: 12, fontFamily: FONTS.headline, color: COLORS.accent },
}));
