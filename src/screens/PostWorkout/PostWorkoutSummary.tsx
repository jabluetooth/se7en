import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Image, useWindowDimensions, InteractionManager,
} from 'react-native';
import Animated, {
  useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, scrollTo, runOnUI,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { useFeedback, FeedbackHost } from '../../components/feedback/Feedback';
import { ViewShot, captureRef, isViewShotAvailable, type ViewShotRef } from '../../compat/viewShot';
import { COLORS, FONTS } from '../../constants';
import { WorkoutSession, WorkoutDay } from '../../types';
import { AppBackground } from '../../components/ui/AppBackground';
import { SummaryPage } from './components/SummaryPage';
import { ExercisesPage } from './components/ExercisesPage';
import { NextUpPage } from './components/NextUpPage';
import { accentA, ink, themed } from '../../theme/runtime';

const PAGE_NAMES = ['Summary', 'Exercises', 'Next up'] as const;
const MAX_TAB_W = 96;
const FOOTER_H = 54;

interface Props {
  session: WorkoutSession;
  nextDay?: WorkoutDay;
  onDone:  () => void;
}

export function PostWorkoutSummary({ session, nextDay, onDone }: Props) {
  const { width }  = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { toast } = useFeedback();
  const [page, setPage] = useState(0);
  const [bgImage,  setBgImage]  = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const shotRef = useRef<ViewShotRef>(null);
  // Three tabs between two 40pt side slots, inside 12pt margins: shrink the
  // tabs on narrow phones (375pt iPhone SE / mini) instead of overflowing.
  const tabW = Math.min(MAX_TAB_W, Math.floor((width - 24 - 80 - 12) / 3));

  // The tab highlight follows the pager's scroll position frame by frame, so
  // it glides with your finger rather than jumping when a swipe settles.
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: e => { scrollX.value = e.contentOffset.x; } });
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (scrollX.value / Math.max(width, 1)) * tabW }],
  }));

  const goTo = (i: number) => {
    if (i === page) return;
    fireHaptic('selection');
    setPage(i);
    runOnUI(() => { scrollTo(pagerRef, i * width, 0, true); })();
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
      toast.error(e instanceof Error ? e.message : String(e), { title: 'Could not pick an image' });
    } finally {
      setMenuOpen(false);
    }
  };

  // Capture the summary (everything but the Done button) as a PNG and save it
  // to the photo library. Explains itself where the capture module is absent.
  const saveAsImage = () => afterMenuClose(async () => {
    if (busy) return;
    if (!isViewShotAvailable) {
      toast.info('Saving the summary as an image needs the full app build, not Expo Go.', { title: 'Not available in Expo Go' });
      return;
    }
    try {
      setBusy(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        toast.warning('Allow photo access in Settings to save your workout image.', { title: 'Photo access needed' });
        return;
      }
      const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(uri);
      toast.success('Saved to your Photos');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.', { title: 'Could not save the image' });
    } finally {
      setBusy(false);
    }
  });

  const footerSpace = FOOTER_H + insets.bottom + 28;

  return (
    <View style={{ flex: 1 }}>
      <ViewShot ref={shotRef} style={{ flex: 1 }}>
        {/* Background — a picked image takes over the whole screen so the
            saved PNG reads as an edge-to-edge poster. */}
        {bgImage ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.60)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <AppBackground />
        )}

        {/* ── Header: page tabs + options ─────────────────────
            Explicit inset + buffer instead of SafeAreaView's top edge: inside
            a fullScreen Modal on iOS that inset has landed too small, leaving
            corner buttons inside the zone where Control Center / Notification
            Center swipes win over app touches. */}
        <View style={[hd.bar, { paddingTop: insets.top + 12 }]}>
          <View style={hd.side} />
          <View style={hd.tabs} accessibilityRole="tablist">
            <Animated.View style={[hd.pill, { width: tabW }, pillStyle]} pointerEvents="none" />
            {PAGE_NAMES.map((name, i) => (
              <Pressable
                key={name}
                onPress={() => goTo(i)}
                style={[hd.tab, { width: tabW }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: page === i }}
                accessibilityLabel={name}
              >
                <Text style={[hd.tabTxt, page === i && hd.tabTxtActive]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={hd.side}>
            {page === 0 && (
              <AnimatedPressable
                scale="strong"
                onPress={() => setMenuOpen(true)}
                style={hd.iconBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Background and save options"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.accent} />
              </AnimatedPressable>
            )}
          </View>
        </View>

        {/* ── Pages ───────────────────────────────────────── */}
        <Animated.ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
          decelerationRate="fast"
        >
          <SummaryPage   session={session} width={width} active={page === 0} bottomInset={footerSpace} />
          <ExercisesPage session={session} width={width} active={page === 1} bottomInset={footerSpace} />
          <NextUpPage    nextDay={nextDay} width={width} visible={page === 2} bottomInset={footerSpace} />
        </Animated.ScrollView>
      </ViewShot>

      {/* ── Done: outside the ViewShot so it never appears in saved images ── */}
      <View style={[ft.bar, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <AnimatedPressable
          haptic="light"
          style={ft.done}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Done, back to Home"
        >
          <Text style={ft.doneTxt}>Done</Text>
        </AnimatedPressable>
      </View>

      {/* ── Options menu ─────────────────────────────────── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={mn.backdrop}>
          {/* Tap-anywhere-to-dismiss layer sits BEHIND the sheet, so it can
              never swallow taps destined for menu items above it. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />

          <View style={[mn.sheet, { marginTop: insets.top + 56 }]}>
            <Pressable
              onPress={pickBackground}
              style={({ pressed }) => [mn.item, pressed && { opacity: 0.65 }]}
            >
              <Ionicons name="image-outline" size={20} color={COLORS.accent} />
              <Text style={mn.itemTxt}>{bgImage ? 'Replace background' : 'Pick a background image'}</Text>
            </Pressable>

            {bgImage && (
              <Pressable
                onPress={() => { setBgImage(null); setMenuOpen(false); }}
                style={({ pressed }) => [mn.item, pressed && { opacity: 0.65 }]}
              >
                <Ionicons name="close-circle-outline" size={20} color={COLORS.textSecondary} />
                <Text style={[mn.itemTxt, { color: COLORS.textSecondary }]}>Remove background</Text>
              </Pressable>
            )}

            <View style={mn.divider} />

            <Pressable
              onPress={saveAsImage}
              disabled={busy}
              style={({ pressed }) => [mn.item, busy && { opacity: 0.5 }, pressed && { opacity: 0.65 }]}
            >
              <Ionicons name="download-outline" size={20} color={COLORS.accent} />
              <Text style={mn.itemTxt}>{busy ? 'Saving…' : 'Save as image'}</Text>
            </Pressable>
          </View>
          <FeedbackHost />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const hd = themed(() => StyleSheet.create({
  bar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12 },
  side:    { width: 40, alignItems: 'flex-end' },
  tabs:    { flexDirection: 'row', borderRadius: 99, backgroundColor: ink(0.06), padding: 3 },
  pill:    { position: 'absolute', top: 3, left: 3, bottom: 3, borderRadius: 99, backgroundColor: accentA(0.18), borderWidth: 1, borderColor: accentA(0.35) },
  tab:     { height: 34, alignItems: 'center', justifyContent: 'center' },
  tabTxt:  { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted },
  tabTxtActive: { color: COLORS.text },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
}));

const ft = themed(() => StyleSheet.create({
  bar:     { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12 },
  done:    { height: FOOTER_H, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  doneTxt: { fontSize: 16, fontFamily: FONTS.display, color: COLORS.onAccent, letterSpacing: -0.3 },
}));

const mn = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'flex-end', paddingRight: 12 },
  sheet:    { minWidth: 230, borderRadius: 14, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: ink(0.1), paddingVertical: 6 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  itemTxt:  { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },
  divider:  { height: 1, backgroundColor: ink(0.08), marginVertical: 2 },
}));
