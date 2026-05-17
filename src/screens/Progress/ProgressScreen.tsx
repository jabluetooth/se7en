import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { useSessionStore } from '../../stores/sessionStore';
import { usePlanStore } from '../../stores/planStore';
import { COLORS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';
import { fmtVol } from '../../utils/format';
import { aggregateExercises } from '../../utils/exerciseHistory';
import { ContributionHeatmap } from './components/ContributionHeatmap';
import { ExerciseCard } from './components/ExerciseCard';

// Progress signal text colour — applied to font only.
const PROGRESS_GREEN_TXT = '#34D399';

type SortMode = 'recent' | 'volume' | 'name';

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
    const completed = sessions.filter(s => s.status === 'completed');
    const recent14  = completed.slice(-14);
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

          <View style={{ height: 80 }} />
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
