import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, FlatList, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, TouchableOpacity,
  View, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { AppBackground } from '../../components/ui/AppBackground';
import { CoachAvatar, AvatarState, AvatarTheme } from '../../components/CoachAvatar/CoachAvatar';
import { useCoachTheme } from '../../hooks/useCoachTheme';
import { GlassView } from '../../components/common/GlassView';
import { COLORS, GRAD, SPACING } from '../../constants';
import { continueConversation, ConversationMessage } from '../../services/coachService';
import { useAuthStore } from '../../stores/authStore';
import { generateId } from '../../utils/idGen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id:   string;
  role: 'user' | 'coach';
  text: string;
}

interface Props {
  onClose:          () => void;
  /** Optional opening message from the widget — shown as first coach message */
  initialMessage?:  string;
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How am I doing overall?',
  'What should I focus on next?',
  'Am I overtraining?',
  'Which muscles am I neglecting?',
  'Should I take a rest day?',
  'How can I improve my consistency?',
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={COLORS.textSecondary}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SendIcon({ active }: { active: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13" stroke={active ? '#000' : COLORS.textMuted}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 2L15 22 11 13 2 9l20-7z" stroke={active ? '#000' : COLORS.textMuted}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ theme }: { theme: AvatarTheme }) {
  const dots = [
    useRef(new Animated.Value(0.25)).current,
    useRef(new Animated.Value(0.25)).current,
    useRef(new Animated.Value(0.25)).current,
  ];

  useEffect(() => {
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
  }, []);

  return (
    <View style={b.coachRow}>
      <CoachAvatar state="thinking" size={28} theme={theme} />
      <GlassView radius={14} style={b.coachBubble}>
        <View style={b.dotRow}>
          {dots.map((op, i) => (
            <Animated.View key={i} style={[b.dot, { opacity: op }]} />
          ))}
        </View>
      </GlassView>
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, avatarState, theme }: { msg: ChatMessage; avatarState: AvatarState; theme: AvatarTheme }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <View style={b.userRow}>
        <LinearGradient
          colors={GRAD.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={b.userBubble}
        >
          <Text style={b.userText}>{msg.text}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={b.coachRow}>
      <CoachAvatar state={avatarState} size={28} />
      <GlassView radius={14} style={b.coachBubble}>
        <Text style={b.coachText}>{msg.text}</Text>
      </GlassView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function CoachScreen({ onClose, initialMessage }: Props) {
  const { user }         = useAuthStore();
  const [theme]          = useCoachTheme();

  // ── Conversation state ─────────────────────────────────────────────────────
  const [messages,  setMessages ] = useState<ChatMessage[]>(() =>
    initialMessage
      ? [{ id: generateId(), role: 'coach', text: initialMessage }]
      : [],
  );
  const [input,     setInput    ] = useState('');
  const [loading,   setLoading  ] = useState(false);
  const [exchanges, setExchanges] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const hasMessages = messages.length > 0;

  // Avatar state for the most recent coach message
  const lastCoachMsg = [...messages].reverse().find(m => m.role === 'coach')?.text ?? '';
  const headerAvatarState: AvatarState = loading ? 'thinking' : 'idle';
  const lastMsgAvatarState: AvatarState = (() => {
    if (loading) return 'thinking';
    const lower = lastCoachMsg.toLowerCase();
    if (lower.includes('⚠️') || lower.includes('overtraining') || lower.includes('neglect')) return 'concerned';
    if (lower.includes('streak') || lower.includes(' pr') || lower.includes('progress') || lower.includes('crushed')) return 'celebrating';
    return 'idle';
  })();

  // ── Send message ───────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !user?.uid) return;

    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSendError(null);

    const history: ConversationMessage[] = messages.map(m => ({ role: m.role, text: m.text }));

    try {
      const res = await continueConversation(user.uid, history, trimmed);
      const coachMsg: ChatMessage = { id: generateId(), role: 'coach', text: res.text };
      setMessages(prev => [...prev, coachMsg]);
      setExchanges(e => e + 1);
      if (res.error === 'rate_limit') setSendError('rate_limit');
    } catch (e: any) {
      const errMsg: string = e?.message ?? '';
      setSendError(errMsg.includes('Network request failed') ? 'offline' : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, user?.uid]);

  // Scroll to end after every new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, loading]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <AppBackground />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.backBtn} activeOpacity={0.7}>
            <BackIcon />
          </TouchableOpacity>

          <View style={s.headerTitle}>
            <CoachAvatar state={headerAvatarState} size={32} theme={theme} />
            <View>
              <Text style={s.titleText}>Coach</Text>
              <Text style={s.subtitleText}>
                {loading ? 'thinking…' : 'AI · powered by Groq'}
              </Text>
            </View>
          </View>

          {/* Exchange counter */}
          <View style={s.counterBadge}>
            <Text style={s.counterTxt}>{exchanges} sent</Text>
          </View>
        </View>

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
            renderItem={({ item, index }) => (
              <MessageBubble
                msg={item}
                avatarState={item.role === 'coach' && index === messages.length - 1 ? lastMsgAvatarState : 'idle'}
                theme={theme}
              />
            )}
            ListHeaderComponent={
              !hasMessages ? (
                <View style={s.emptyState}>
                  <CoachAvatar state="idle" size={72} theme={theme} />
                  <Text style={s.emptyTitle}>Your Personal Coach</Text>
                  <Text style={s.emptySub}>
                    Ask me anything about your training — I have access to your full
                    workout history, RPE logs, and exercise notes.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={loading ? <TypingIndicator theme={theme} /> : null}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {/* ── Suggested prompts ── */}
          {!hasMessages && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.suggestionsContent}
              style={s.suggestions}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map(prompt => (
                <TouchableOpacity
                  key={prompt}
                  onPress={() => send(prompt)}
                  activeOpacity={0.75}
                  style={s.suggestionPill}
                >
                  <Text style={s.suggestionTxt}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Send error banner ── */}
          {sendError && (
            <View style={s.errorBanner}>
              <Text style={s.errorBannerTxt}>
                {sendError === 'rate_limit'
                  ? '⚠️ Rate limit reached — wait a moment before sending again.'
                  : sendError === 'offline'
                  ? '📡 No connection — check your network and try again.'
                  : '⚠️ Something went wrong — try again.'}
              </Text>
            </View>
          )}

          {/* ── Input bar ── */}
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach…"
              placeholderTextColor={COLORS.textLabel}
              multiline
              maxLength={400}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => send(input)}
            />
            <TouchableOpacity
              onPress={() => send(input)}
              activeOpacity={input.trim() ? 0.85 : 1}
              disabled={!input.trim() || loading}
              style={[s.sendWrap, !input.trim() && s.sendDisabled]}
            >
              {input.trim() ? (
                <LinearGradient
                  colors={GRAD.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.sendBtn}
                >
                  <SendIcon active />
                </LinearGradient>
              ) : (
                <View style={[s.sendBtn, s.sendInactive]}>
                  <SendIcon active={false} />
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
  root:        { flex: 1 },
  safe:        { flex: 1 },
  flex:        { flex: 1 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56, gap: SPACING.sm },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  titleText:   { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitleText:{ fontSize: 10, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  counterBadge:{ backgroundColor: 'rgba(255,240,220,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)', paddingHorizontal: 8, paddingVertical: 4 },
  counterTxt:  { fontSize: 10, color: COLORS.textLabel, fontWeight: '700' },

  // Messages list
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md, flexGrow: 1 },

  // Empty state
  emptyState:  { alignItems: 'center', paddingTop: 32, paddingBottom: 24, gap: SPACING.sm, paddingHorizontal: 24 },
  emptyTitle:  { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4, marginTop: 8 },
  emptySub:    { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Suggested prompts
  suggestions:        { maxHeight: 48, flexGrow: 0, flexShrink: 0 },
  suggestionsContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: 'center' },
  suggestionPill:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,140,0,0.28)', backgroundColor: 'rgba(255,140,0,0.08)' },
  suggestionTxt:      { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

  // Input bar
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.08)' },
  input:       { flex: 1, backgroundColor: 'rgba(255,240,220,0.06)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#fff', maxHeight: 100, lineHeight: 20 },
  sendWrap:    { borderRadius: 18, overflow: 'hidden' },
  sendDisabled:{ opacity: 0.4 },
  sendBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  sendInactive: { backgroundColor: 'rgba(255,240,220,0.07)', borderWidth: 1, borderColor: 'rgba(255,240,220,0.10)' },
  errorBanner:  { marginHorizontal: SPACING.md, marginBottom: 6, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,140,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.22)' },
  errorBannerTxt:{ fontSize: 12, color: COLORS.accent, fontWeight: '600', lineHeight: 17 },
});

// Bubble styles in their own StyleSheet so they don't bloat `s`
const b = StyleSheet.create({
  userRow:    { alignItems: 'flex-end', marginBottom: 10 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%' },
  userText:   { fontSize: 14, color: '#000', fontWeight: '600', lineHeight: 20 },

  coachRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  coachBubble:{ borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '78%' },
  coachText:  { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  dotRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 2 },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted },
});
