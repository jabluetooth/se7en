import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity,
  View, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { AppBackground } from '../../components/ui/AppBackground';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, GRAD, SPACING, FONTS } from '../../constants';
import { continueConversation, ConversationMessage } from '../../services/coachService';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { generateId } from '../../utils/idGen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id:    string;
  role:  'user' | 'coach';
  text:  string;
  fresh: boolean; // true = just arrived, animate in
}

interface Props {
  onClose:         () => void;
  initialMessage?: string;
}

// ─── Quick chips ──────────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  'How am I doing overall?',
  'Am I overtraining?',
  'Which muscles am I neglecting?',
  'Should I take a rest day?',
  'What should I focus on next week?',
  'How can I improve my consistency?',
];

// ─── SVG icons ────────────────────────────────────────────────────────────────

function BoltSvg({ size = 16, color = COLORS.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill={color} />
    </Svg>
  );
}
function BackSvg() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={COLORS.textSecondary}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SendSvg({ active }: { active: boolean }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13" stroke={active ? '#000' : COLORS.textMuted}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={active ? '#000' : COLORS.textMuted}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── BoltAvatar ───────────────────────────────────────────────────────────────
// Replaces the cartoon CoachAvatar. A glass circle with the bolt icon inside.

function BoltAvatar({ size = 36, glow = false }: { size?: number; glow?: boolean }) {
  const boltSize = size * 0.45;
  return (
    <View style={[
      av.wrap,
      { width: size, height: size, borderRadius: size / 2 },
      glow && av.glow,
    ]}>
      <BoltSvg size={boltSize} />
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,140,0,0.10)', borderWidth: 1.5, borderColor: 'rgba(255,140,0,0.30)' },
  glow: { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 10, elevation: 8 },
});

// ─── Context strip (active session only) ─────────────────────────────────────

function ContextStrip({ activeSession }: { activeSession: any | null }) {
  if (!activeSession) return null;
  const currentEx = activeSession.exercises.find((e: any) => !e.isCompleted);
  if (!currentEx) return null;
  const doneSets = currentEx.sets.filter((s: any) => s.isCompleted).length;
  const totalSets = currentEx.sets.length;
  return (
    <View style={cx.strip}>
      <View style={cx.dot} />
      <Text style={cx.exercise} numberOfLines={1}>{currentEx.exerciseName}</Text>
      <Text style={cx.sep}>·</Text>
      <Text style={cx.meta}>Set {doneSets + 1}/{totalSets}</Text>
      <Text style={cx.sep}>·</Text>
      <Text style={cx.meta}>{activeSession.dayLabel}</Text>
    </View>
  );
}

const cx = StyleSheet.create({
  strip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)', backgroundColor: 'rgba(255,140,0,0.04)' },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.8, shadowRadius: 4, elevation: 2 },
  exercise: { fontSize: 11, fontWeight: '700', fontFamily: FONTS.headline, color: COLORS.accent, flex: 1 },
  sep:      { fontSize: 11, fontFamily: FONTS.body, color: 'rgba(255,240,220,0.25)' },
  meta:     { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textLabel, fontWeight: '500' },
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot0 = useRef(new Animated.Value(0.25)).current;
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const dots  = [dot0, dot1, dot2];
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1,    duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.25, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 160 + 200),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [dot0, dot1, dot2]);

  return (
    <View style={b.coachRow}>
      <BoltAvatar size={26} />
      <GlassView radius={14} style={b.coachBubble}>
        <View style={b.dotRow}>
          {([dot0, dot1, dot2] as Animated.Value[]).map((op, i) => (
            <Animated.View key={i} style={[b.dot, { opacity: op }]} />
          ))}
        </View>
      </GlassView>
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: ChatMessage }) {
  const fadeAnim = useRef(new Animated.Value(msg.fresh ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(msg.fresh ? 10 : 0)).current;

  useEffect(() => {
    if (!msg.fresh) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  if (msg.role === 'user') {
    return (
      <Animated.View style={[b.userRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={GRAD.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={b.userBubble}
        >
          <Text style={b.userText}>{msg.text}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[b.coachRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <BoltAvatar size={26} />
      <GlassView radius={14} style={b.coachBubble}>
        <Text style={b.coachText}>{msg.text}</Text>
      </GlassView>
    </Animated.View>
  );
});

const b = StyleSheet.create({
  userRow:    { alignItems: 'flex-end', marginBottom: 10 },
  userBubble: { borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '82%' },
  userText:   { fontSize: 14, fontFamily: FONTS.semibold, color: '#000', fontWeight: '600', lineHeight: 20 },

  coachRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  coachBubble:{ borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '78%' },
  coachText:  { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 21 },

  dotRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 2 },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.accent, opacity: 0.5 },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={em.wrap}>
      <View style={em.iconWrap}>
        <BoltAvatar size={64} glow />
      </View>
      <Text style={em.title}>Se7en Coach</Text>
      <Text style={em.body}>
        Ask me anything about your training — I have access to your full workout history,
        RPE logs, and exercise notes.
      </Text>
    </View>
  );
}

const em = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 28, gap: 12 },
  iconWrap:{ marginBottom: 4 },
  title:   { fontSize: 20, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.80 },
  body:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});

// ─── CoachScreen ──────────────────────────────────────────────────────────────

export function CoachScreen({ onClose, initialMessage }: Props) {
  const { user }          = useAuthStore();
  const activeSession     = useSessionStore(state => state.activeSession);

  const [messages,     setMessages    ] = useState<ChatMessage[]>(() =>
    initialMessage
      ? [{ id: generateId(), role: 'coach', text: initialMessage, fresh: false }]
      : [],
  );
  const [input,        setInput       ] = useState('');
  const [loading,      setLoading     ] = useState(false);
  const [sendError,    setSendError   ] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const listRef  = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const hasMessages = messages.length > 0;
  // Chips visible until user has sent 2+ messages
  const showChips   = messages.filter(m => m.role === 'user').length < 2;

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !user?.uid) return;

    const userMsg: ChatMessage = { id: generateId(), role: 'user',  text: trimmed, fresh: true };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSendError(null);

    const history: ConversationMessage[] = messages.map(m => ({ role: m.role, text: m.text }));

    try {
      const res = await continueConversation(user.uid, history, trimmed);
      const coachMsg: ChatMessage = { id: generateId(), role: 'coach', text: res.text, fresh: true };
      setMessages(prev => [...prev, coachMsg]);
      if (res.error === 'rate_limit') setSendError('rate_limit');
    } catch (e: any) {
      const errMsg: string = e?.message ?? '';
      setSendError(errMsg.includes('Network request failed') ? 'offline' : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, user?.uid]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length, loading]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={onClose}
            style={s.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Close coach chat"
          >
            <BackSvg />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <BoltAvatar size={30} glow={loading} />
            <View>
              <Text style={s.titleText}>Se7en Coach</Text>
              <Text style={s.subtitleText}>
                {loading ? 'thinking…' : 'AI · powered by Groq'}
              </Text>
            </View>
          </View>

          {/* Right spacer — same width as backBtn so the title stays centred */}
          <View style={s.backBtn} />
        </View>

        {/* ── Context strip (active session only) ── */}
        <ContextStrip activeSession={activeSession} />

        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* ── Messages ── */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            ListHeaderComponent={!hasMessages ? <EmptyState /> : null}
            ListFooterComponent={loading ? <TypingIndicator /> : null}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {/* ── Quick chips ── */}
          {showChips && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsContent}
              style={s.chips}
              keyboardShouldPersistTaps="handled"
            >
              {QUICK_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => send(chip)}
                  activeOpacity={0.75}
                  style={s.chip}
                  disabled={loading}
                >
                  <Text style={[s.chipTxt, loading && s.chipTxtDisabled]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Send error ── */}
          {sendError && (
            <View style={s.errorBanner}>
              <Text style={s.errorTxt}>
                {sendError === 'rate_limit'
                  ? '⚠️  Rate limit reached — wait a moment before sending again.'
                  : sendError === 'offline'
                  ? '📡  No connection — check your network and try again.'
                  : '⚠️  Something went wrong — try again.'}
              </Text>
            </View>
          )}

          {/* ── Input bar ── */}
          <View style={s.inputBar}>
            <TextInput
              ref={inputRef}
              style={[s.input, inputFocused && s.inputFocused]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach…"
              placeholderTextColor={COLORS.textLabel}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => send(input)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              accessibilityLabel="Message to coach"
            />
            <TouchableOpacity
              onPress={() => send(input)}
              activeOpacity={input.trim() ? 0.85 : 1}
              disabled={!input.trim() || loading}
              style={s.sendWrap}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !input.trim() || loading }}
            >
              {input.trim() && !loading ? (
                <LinearGradient
                  colors={GRAD.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.sendBtn}
                >
                  <SendSvg active />
                </LinearGradient>
              ) : (
                <View style={[s.sendBtn, s.sendInactive]}>
                  <SendSvg active={false} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56, borderBottomWidth: 1, borderBottomColor: 'rgba(255,240,220,0.06)', zIndex: 10 },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  titleText:    { fontSize: 16, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -0.64 },
  subtitleText: { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.3 },

  // Message list
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md, flexGrow: 1 },

  // Quick chips
  chips:        { maxHeight: 44, flexGrow: 0, flexShrink: 0 },
  chipsContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: 'center' },
  chip:         { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,140,0,0.25)', backgroundColor: 'rgba(255,140,0,0.07)' },
  chipTxt:      { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.accent, fontWeight: '600' },
  chipTxtDisabled: { color: 'rgba(255,140,0,0.35)' },

  // Error banner
  errorBanner:  { marginHorizontal: SPACING.md, marginBottom: 6, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,140,0,0.07)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.20)' },
  errorTxt:     { fontSize: 12, fontFamily: FONTS.semibold, color: COLORS.accent, fontWeight: '600', lineHeight: 17 },

  // Input bar
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)' },
  input:       { flex: 1, backgroundColor: 'rgba(255,240,220,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', borderRadius: 18, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 14, fontFamily: FONTS.body, color: '#fff', maxHeight: 100, lineHeight: 20 },
  inputFocused:{ borderColor: 'rgba(255,140,0,0.40)', backgroundColor: 'rgba(255,140,0,0.04)' },
  sendWrap:    { borderRadius: 18, overflow: 'hidden' },
  sendBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  sendInactive:{ backgroundColor: 'rgba(255,240,220,0.06)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
});
