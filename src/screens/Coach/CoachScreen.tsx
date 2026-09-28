import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { enterFade, enterRise, enterSettle, exitFade } from '../../motion/presets';
import { AppBackground } from '../../components/ui/AppBackground';
import { InfoTip } from '../../components/common/InfoTip';
import { COLORS, FONTS } from '../../constants';
import { continueConversation, ConversationMessage } from '../../services/coachService';
import { useAuthStore } from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { generateId } from '../../utils/idGen';
import { accentA, ink, themed } from '../../theme/runtime';

// The coach as a quiet conversation. Coach replies are plain, readable text
// (with bold and lists), not bubbles; your messages are small neutral
// bubbles on the right. New replies write themselves in word by word, and a
// tap shows the rest at once.

interface ChatMessage {
  id:    string;
  role:  'user' | 'coach';
  text:  string;
  /** Just arrived: write it in word by word. */
  fresh: boolean;
}

interface Props {
  onClose:         () => void;
  initialMessage?: string;
}

type SendError = 'rate_limit' | 'offline' | 'unknown';

const IDLE_SUGGESTIONS = [
  'How am I doing overall?',
  'Which muscles am I neglecting?',
  'Should I take a rest day?',
  'What should I focus on next week?',
];
const LIVE_SUGGESTIONS = [
  'What weight should I use for my next set?',
  'How long should I rest?',
  'This feels too heavy. What should I change?',
];

// ─── Coach reply text: **bold** and simple lists ──────────────────────────────

function Inline({ text, style }: { text: string; style: any }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <Text key={i} style={m.bold}>{p.slice(2, -2)}</Text>
          : p,
      )}
    </Text>
  );
}

function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  return (
    <View style={m.body}>
      {blocks.map((line, i) => {
        const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
        if (bullet) {
          const num = line.match(/^(\d+)[.)]/)?.[1];
          return (
            <View key={i} style={m.li}>
              <Text style={m.marker}>{num ? `${num}.` : '•'}</Text>
              <Inline text={bullet[1]} style={[m.p, { flex: 1 }]} />
            </View>
          );
        }
        return <Inline key={i} text={line} style={m.p} />;
      })}
    </View>
  );
}

const m = themed(() => StyleSheet.create({
  body:   { gap: 10 },
  p:      { fontSize: 16, lineHeight: 24, fontFamily: FONTS.body, color: COLORS.text },
  bold:   { fontFamily: FONTS.semibold, color: COLORS.text },
  li:     { flexDirection: 'row', gap: 10 },
  marker: { width: 18, fontSize: 16, lineHeight: 24, fontFamily: FONTS.semibold, color: COLORS.textMuted, textAlign: 'right' },
}));

// ─── Messages ─────────────────────────────────────────────────────────────────

/** Reveals `text` a few words at a time; returns the visible part. */
function useWordReveal(text: string, active: boolean, onTick?: () => void) {
  const reduced = useReducedMotion();
  const words = useRef(text.split(/(\s+)/)).current;
  const [count, setCount] = useState(active && !reduced ? 0 : words.length);

  useEffect(() => {
    if (!active || reduced) { setCount(words.length); return; }
    const t = setInterval(() => {
      setCount(c => {
        const next = Math.min(words.length, c + 3);
        if (next >= words.length) clearInterval(t);
        return next;
      });
      onTick?.();
    }, 45);
    return () => clearInterval(t);
  }, [active, reduced]);

  return { shown: words.slice(0, count).join(''), done: count >= words.length, finish: () => setCount(words.length) };
}

const CoachMessage = React.memo(function CoachMessage({ msg, onGrow }: { msg: ChatMessage; onGrow: () => void }) {
  const { shown, done, finish } = useWordReveal(msg.text, msg.fresh, onGrow);
  return (
    <Animated.View entering={msg.fresh ? enterFade : undefined} style={st.coachRow}>
      <View style={st.coachHead}>
        <View style={st.mark}><Ionicons name="sparkles" size={11} color={COLORS.accent} /></View>
        <Text style={st.coachName}>Coach</Text>
      </View>
      <Pressable onPress={done ? undefined : finish} accessibilityLabel={msg.text} accessibilityHint={done ? undefined : 'Shows the full reply'}>
        <RichText text={shown} />
      </Pressable>
    </Animated.View>
  );
});

const UserMessage = React.memo(function UserMessage({ msg }: { msg: ChatMessage }) {
  return (
    <Animated.View entering={msg.fresh ? enterRise(0) : undefined} style={st.userRow}>
      <View style={st.userBubble}>
        <Text style={st.userText}>{msg.text}</Text>
      </View>
    </Animated.View>
  );
});

function Thinking() {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    phase.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [reduced]);
  return (
    <Animated.View entering={enterFade} exiting={exitFade} style={st.coachRow} accessibilityLabel="Coach is thinking">
      <View style={st.coachHead}>
        <View style={st.mark}><Ionicons name="sparkles" size={11} color={COLORS.accent} /></View>
        <Text style={st.coachName}>Coach</Text>
      </View>
      <View style={st.dots}>
        {[0, 1, 2].map(i => <Dot key={i} index={i} phase={phase} still={reduced} />)}
      </View>
    </Animated.View>
  );
}

function Dot({ index, phase, still }: { index: number; phase: SharedValue<number>; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6 };
    const d = Math.abs(((phase.value - index * 0.2) % 1 + 1) % 1 - 0.3);
    return { opacity: 0.25 + 0.75 * Math.max(0, 1 - d * 3.5) };
  });
  return <Animated.View style={[st.dot, style]} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CoachScreen({ onClose, initialMessage }: Props) {
  const { user }      = useAuthStore();
  const activeSession = useSessionStore(state => state.activeSession);
  const workouts      = useSessionStore(state => state.sessions.filter(x => x.status === 'completed').length);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessage ? [{ id: generateId(), role: 'coach', text: initialMessage, fresh: false }] : [],
  );
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<{ kind: SendError; text: string } | null>(null);
  const listRef = useRef<FlatList>(null);

  const scrollEnd = useCallback(() => listRef.current?.scrollToEnd({ animated: true }), []);
  // While a reply writes itself in, keep its last line in view without
  // stacking dozens of scroll animations.
  const followReply = useCallback(() => listRef.current?.scrollToEnd({ animated: false }), []);

  const send = useCallback(async (raw: string, retry = false) => {
    const text = raw.trim();
    if (!text || loading || !user?.uid) return;
    fireHaptic('light');
    if (!retry) setMessages(prev => [...prev, { id: generateId(), role: 'user', text, fresh: true }]);
    setInput('');
    setLoading(true);
    setError(null);

    // On a retry the question is already the last message; don't send it twice.
    const before = retry && messages[messages.length - 1]?.role === 'user' ? messages.slice(0, -1) : messages;
    const history: ConversationMessage[] = before.map(x => ({ role: x.role, text: x.text }));
    try {
      const res = await continueConversation(user.uid, history, text);
      setMessages(prev => [...prev, { id: generateId(), role: 'coach', text: res.text, fresh: true }]);
      if (res.error === 'rate_limit') setError({ kind: 'rate_limit', text });
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      setError({ kind: msg.includes('Network request failed') ? 'offline' : 'unknown', text });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, user?.uid]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(scrollEnd, 80);
  }, [messages.length, loading]);

  const hasUserMessages = messages.some(x => x.role === 'user');
  const suggestions = activeSession ? LIVE_SUGGESTIONS : IDLE_SUGGESTIONS;
  const canSend = !!input.trim() && !loading;

  const currentEx = activeSession?.exercises.find(e => !e.isCompleted);
  const status = loading
    ? 'Thinking…'
    : currentEx
    ? `During ${activeSession!.dayLabel} · ${currentEx.exerciseName}`
    : `Knows your ${workouts} workout${workouts === 1 ? '' : 's'}`;

  return (
    <View style={s.root}>
      <AppBackground />
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        {/* ── Header ── */}
        <View style={s.header}>
          <AnimatedPressable
            scale="strong"
            onPress={onClose}
            style={s.iconBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close coach"
          >
            <Ionicons name="chevron-down" size={22} color={COLORS.text} />
          </AnimatedPressable>
          <View style={s.headerCenter}>
            <View style={s.titleRow}>
              <Text style={s.title}>Coach</Text>
              <InfoTip
                title="Your coach"
                text="Answers use your workout history, sets, effort ratings and notes. It's an AI, so treat advice as a starting point and listen to your body."
                size={15}
              />
            </View>
            <Animated.Text key={status} entering={enterFade} style={s.status} numberOfLines={1}>{status}</Animated.Text>
          </View>
          <View style={s.iconBtn} />
        </View>

        <KeyboardAvoidingView
          style={s.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={x => x.id}
            renderItem={({ item }) =>
              item.role === 'coach'
                ? <CoachMessage msg={item} onGrow={followReply} />
                : <UserMessage msg={item} />}
            ListHeaderComponent={!hasUserMessages ? (
              <Animated.View entering={enterRise(0)} style={s.intro}>
                <Text style={s.introTitle}>{messages.length ? 'Ask a follow-up' : 'What would you like to know?'}</Text>
              </Animated.View>
            ) : null}
            ListFooterComponent={
              <>
                {loading && <Thinking />}
                {error && !loading && (
                  <Animated.View entering={enterFade} style={s.error}>
                    <Ionicons name={error.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'} size={17} color={COLORS.textMuted} />
                    <Text style={s.errorTxt}>
                      {error.kind === 'rate_limit'
                        ? 'The coach needs a moment. Try again shortly.'
                        : error.kind === 'offline'
                        ? "You're offline. Check your connection."
                        : "The coach couldn't answer."}
                    </Text>
                    {error.kind !== 'rate_limit' && (
                      <AnimatedPressable scale="strong" onPress={() => send(error.text, true)} style={s.retry} accessibilityRole="button" accessibilityLabel="Try again">
                        <Text style={s.retryTxt}>Try again</Text>
                      </AnimatedPressable>
                    )}
                  </Animated.View>
                )}
                {!hasUserMessages && !loading && (
                  <View style={s.suggestions}>
                    {suggestions.map((q, i) => (
                      <Animated.View key={q} entering={enterRise(i + 1)}>
                        <AnimatedPressable
                          scale="subtle"
                          dimOnPress
                          onPress={() => send(q)}
                          style={s.suggestion}
                          accessibilityRole="button"
                          accessibilityLabel={`Ask: ${q}`}
                        >
                          <Text style={s.suggestionTxt}>{q}</Text>
                          <Ionicons name="arrow-up" size={16} color={COLORS.textLabel} style={{ transform: [{ rotate: '45deg' }] }} />
                        </AnimatedPressable>
                      </Animated.View>
                    ))}
                  </View>
                )}
              </>
            }
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />

          {/* ── Composer ── */}
          <View style={s.composerWrap}>
            <View style={s.composer}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="Message your coach"
                placeholderTextColor={COLORS.textLabel}
                multiline
                maxLength={500}
                accessibilityLabel="Message to coach"
              />
              {canSend && (
                <Animated.View entering={enterSettle} exiting={exitFade}>
                  <AnimatedPressable
                    scale="strong"
                    onPress={() => send(input)}
                    style={s.send}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                  >
                    <Ionicons name="arrow-up" size={19} color={COLORS.onAccent} />
                  </AnimatedPressable>
                </Animated.View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = themed(() => StyleSheet.create({
  coachRow:   { marginBottom: 26, gap: 8 },
  coachHead:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mark:       { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: accentA(0.14) },
  coachName:  { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textMuted },

  userRow:    { alignItems: 'flex-end', marginBottom: 26 },
  userBubble: { maxWidth: '84%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: COLORS.surfaceElevated },
  userText:   { fontSize: 16, lineHeight: 22, fontFamily: FONTS.body, color: COLORS.text },

  dots:       { flexDirection: 'row', gap: 6, paddingVertical: 8 },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted },
}));

const s = themed(() => StyleSheet.create({
  root:         { flex: 1 },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  iconBtn:      { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:        { fontSize: 17, fontFamily: FONTS.headline, color: COLORS.text },
  status:       { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textMuted, marginTop: 1 },

  list:         { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexGrow: 1 },
  intro:        { paddingTop: 24, paddingBottom: 18 },
  introTitle:   { fontSize: 28, lineHeight: 33, fontFamily: FONTS.hero, color: COLORS.text, letterSpacing: -0.8 },

  suggestions:  { marginTop: 4 },
  suggestion:   {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  suggestionTxt:{ flex: 1, fontSize: 16, fontFamily: FONTS.medium, color: COLORS.text },

  error:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  errorTxt:     { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  retry:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: ink(0.06) },
  retryTxt:     { fontSize: 14, fontFamily: FONTS.semibold, color: COLORS.text },

  composerWrap: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  composer:     {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 50,
    paddingLeft: 18, paddingRight: 6, paddingVertical: 5, borderRadius: 25,
    backgroundColor: COLORS.surface, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: COLORS.border,
  },
  input:        {
    flex: 1, maxHeight: 120, paddingTop: 10, paddingBottom: 10,
    fontSize: 16, lineHeight: 21, fontFamily: FONTS.body, color: COLORS.text,
  },
  send:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
}));
