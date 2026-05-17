import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, Modal, Alert,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { COLORS } from '../../constants';
import { WorkoutSession, WorkoutDay } from '../../types';
import { AppBackground } from '../../components/ui/AppBackground';
import { SummaryPage } from './components/SummaryPage';
import { ExercisesPage } from './components/ExercisesPage';
import { NextUpPage } from './components/NextUpPage';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Root component — header, horizontal pager, options modal ─────────────────

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
  const afterMenuClose = (fn: () => void | Promise<void>) => {
    setMenuOpen(false);
    InteractionManager.runAfterInteractions(() => {
      // small extra buffer in case the modal's fade-out is still in flight
      setTimeout(fn, 120);
    });
  };

  // Pick a background image from the device's photo library. We deliberately
  // do NOT close the menu modal first — on Android the picker is a separate
  // Activity and launches fine over our modal; closing our modal first was
  // causing the picker Activity to be dismissed by the lifecycle event.
  const pickBackground = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      if (res.canceled) {
        setMenuOpen(false);
        return;
      }
      const uri = res.assets?.[0]?.uri;
      if (uri) setBgImage(uri);
    } catch (e) {
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

// Options menu (Page 1 settings)
const mn = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 12 },
  sheet:    { minWidth: 220, borderRadius: 14, backgroundColor: 'rgba(28,28,32,0.97)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', paddingVertical: 6 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  itemTxt:  { fontSize: 14, fontWeight: '600', color: '#fff' },
  divider:  { height: 1, backgroundColor: 'rgba(255,240,220,0.08)', marginVertical: 2 },
});
