import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AnimatedPressable } from '../../motion/AnimatedPressable';
import Svg, { Path } from 'react-native-svg';
import { GlassView } from '../common/GlassView';
import { askCoachProactive, clearCoachCache } from '../../services/coachService';
import { useAuthStore }    from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { COLORS, SPACING, FONTS } from '../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_SECS     = 60;
const MIN_SESSIONS_FOR_AI = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onAskMore?: (initialMessage?: string) => void;
}

type WidgetError = 'rate_limit' | 'offline' | 'unknown' | null;

// ─── SVG icons ────────────────────────────────────────────────────────────────

function BoltSvg({ size = 11 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill={COLORS.accent} />
    </Svg>
  );
}

function RefreshSvg({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 4v6h6M23 20v-6h-6"
        stroke={COLORS.textLabel} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
        stroke={COLORS.textLabel} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Typewriter ───────────────────────────────────────────────────────────────

function useTypewriter(fullText: string, speed = 16) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(fullText);
      setDone(true);
      return;
    }
    setDisplayed('');
    setDone(false);
    if (!fullText) return;
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) { clearInterval(tick); setDone(true); }
    }, speed);
    return () => clearInterval(tick);
  }, [fullText, reducedMotion]);

  return { displayed, done };
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    phase.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [reducedMotion]);

  return (
    <View style={td.row} accessibilityLabel="Coach is thinking">
      {[0, 1, 2].map(i => <TypingDot key={i} index={i} phase={phase} still={reducedMotion} />)}
    </View>
  );
}

function TypingDot({ index, phase, still }: { index: number; phase: SharedValue<number>; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1 };
    // Distance (0-1, wrapping) between the wave's position and this dot.
    const d = Math.abs(((phase.value - index * 0.18) % 1 + 1) % 1 - 0.25);
    return { opacity: 0.3 + 0.7 * Math.max(0, 1 - d * 4) };
  });
  return <Animated.View style={[td.dot, style]} />;
}

const td = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingVertical: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.accent },
});

// ─── Rate-limit countdown ─────────────────────────────────────────────────────

function RateLimitBanner({ secsLeft, onRetry }: { secsLeft: number; onRetry: () => void }) {
  return (
    <View style={rl.wrap}>
      <Text style={rl.txt}>Rate limit — retrying in {secsLeft}s</Text>
      <AnimatedPressable onPress={onRetry} style={rl.btn}>
        <Text style={rl.btnTxt}>Try now</Text>
      </AnimatedPressable>
    </View>
  );
}

const rl = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,140,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.18)' },
  txt:    { flex: 1, fontSize: 11, color: COLORS.accent, fontWeight: '600', fontFamily: FONTS.semibold },
  btn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,140,0,0.35)', backgroundColor: 'rgba(255,140,0,0.12)' },
  btnTxt: { fontSize: 11, color: COLORS.accent, fontWeight: '800', fontFamily: FONTS.display },
});

// ─── InsightHeader ────────────────────────────────────────────────────────────

function InsightHeader({ cached, loading }: { cached?: boolean; loading?: boolean }) {
  // The bolt breathes slowly while the AI is fetching.
  const boltOp = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    cancelAnimation(boltOp);
    if (!loading || reducedMotion) {
      boltOp.value = withTiming(1, { duration: 200 });
      return;
    }
    boltOp.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [loading, reducedMotion]);
  const boltStyle = useAnimatedStyle(() => ({ opacity: boltOp.value }));

  return (
    <View style={ih.row}>
      <Animated.View style={boltStyle}>
        <BoltSvg size={11} />
      </Animated.View>
      <Text style={ih.label}>Coach Insight</Text>
      <View style={ih.line} />
      {cached && (
        <View style={ih.cachedPill}>
          <Text style={ih.cachedTxt}>cached</Text>
        </View>
      )}
    </View>
  );
}

const ih = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  label:     { fontSize: 11, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.80, textTransform: 'uppercase' },
  line:      { flex: 1, height: 1, backgroundColor: 'rgba(255,140,0,0.15)' },
  cachedPill:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.06)' },
  cachedTxt: { fontSize: 11, color: COLORS.textLabel, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
});

// ─── CoachWidget ──────────────────────────────────────────────────────────────

export function CoachWidget({ onAskMore }: Props) {
  const { user }     = useAuthStore();
  const { sessions } = useSessionStore();

  const [message,   setMessage  ] = useState('');
  const [loading,   setLoading  ] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error,     setError    ] = useState<WidgetError>(null);
  const [retryAt,   setRetryAt  ] = useState<number | null>(null);
  const [secsLeft,  setSecsLeft ] = useState(0);
  const fetchedRef = useRef(false);

  const { displayed, done } = useTypewriter(message);

  const completedCount  = sessions.filter(s => s.status === 'completed').length;
  const isFirstTimeUser = completedCount < MIN_SESSIONS_FOR_AI;

  // ── Rate-limit countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!retryAt) return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setSecsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        setRetryAt(null);
        fetchMessage(false);
      }
    }, 1000);
    setSecsLeft(Math.ceil((retryAt - Date.now()) / 1000));
    return () => clearInterval(tick);
  }, [retryAt]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchMessage = useCallback(async (force = false) => {
    if (!user?.uid || isFirstTimeUser) return;
    setLoading(true);
    setError(null);
    if (force) {
      setMessage('');
      await clearCoachCache();
    }
    try {
      const res = await askCoachProactive(user.uid, force);
      setMessage(res.text);
      setFromCache(res.cached);
      if (res.error === 'rate_limit') {
        setError('rate_limit');
        if (!res.cached) setRetryAt(Date.now() + RATE_LIMIT_SECS * 1000);
      }
      if (res.text) {
        import('../../services/widgetService').then(({ widgetService }) => {
          widgetService.updateCoach(res.text);
        }).catch(() => {});
      }
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      setError(msg.includes('Network request failed') ? 'offline' : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isFirstTimeUser]);

  useEffect(() => {
    if (fetchedRef.current || !user?.uid) return;
    fetchedRef.current = true;
    fetchMessage(false);
  }, [user?.uid]);

  // ── First-time state ───────────────────────────────────────────────────────
  if (isFirstTimeUser) {
    const remaining = MIN_SESSIONS_FOR_AI - completedCount;
    return (
      <View style={s.card}>
        <GlassView radius={20} style={s.cardInner}>
          <InsightHeader />
          <Text style={s.messageText}>
            Log {remaining} more workout{remaining !== 1 ? 's' : ''} and I'll start
            analysing your patterns — I need a few sessions before my insights become useful.
          </Text>
        </GlassView>
      </View>
    );
  }

  // ── Card ───────────────────────────────────────────────────────────────────
  const showFooter = (!!message || error === 'offline') && !loading;

  return (
    <View style={s.card}>
      <GlassView radius={20} style={s.cardInner}>
        {/* Top accent bar */}
        <View style={s.accentBar} />

        {/* Header */}
        <InsightHeader cached={fromCache && !loading} loading={loading} />

        {/* Rate-limit banner */}
        {error === 'rate_limit' && retryAt && (
          <RateLimitBanner secsLeft={secsLeft} onRetry={() => fetchMessage(true)} />
        )}

        {/* Body */}
        {loading && !message ? (
          <TypingDots />
        ) : message ? (
          <Text style={s.messageText}>
            {displayed}
            {!done && <Text style={s.cursor}>▌</Text>}
          </Text>
        ) : error === 'offline' ? (
          <Text style={s.errorText}>No connection — last insight will reappear once you're back online.</Text>
        ) : error && error !== 'rate_limit' ? (
          <Text style={s.errorText}>Couldn't reach the coach right now.</Text>
        ) : null}

        {/* Footer */}
        {showFooter && (
          <View style={s.footer}>
            <AnimatedPressable onPress={() => fetchMessage(true)} style={s.refreshBtn}>
              <RefreshSvg size={12} />
              <Text style={s.refreshTxt}>Refresh</Text>
            </AnimatedPressable>
            {onAskMore && (
              <AnimatedPressable
                onPress={() => onAskMore(message || undefined)}
                style={s.askBtn}
              >
                <Text style={s.askTxt}>Ask Coach →</Text>
              </AnimatedPressable>
            )}
          </View>
        )}
      </GlassView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card:        { marginHorizontal: 16, marginBottom: 8 },
  cardInner:   { padding: SPACING.md, paddingBottom: SPACING.sm, overflow: 'hidden' },
  accentBar:   { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,140,0,0.35)' },
  messageText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 21, letterSpacing: -0.13 },
  cursor:      { color: COLORS.accent, fontWeight: '900' },
  errorText:   { fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMuted, fontStyle: 'italic', lineHeight: 18 },
  footer:      { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)' },
  refreshBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingRight: 12 },
  refreshTxt:  { fontSize: 11, color: COLORS.textLabel, fontWeight: '600', fontFamily: FONTS.semibold, letterSpacing: -0.11 },
  askBtn:      { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,140,0,0.28)', backgroundColor: 'rgba(255,140,0,0.08)' },
  askTxt:      { fontSize: 12, fontWeight: '800', fontFamily: FONTS.display, color: COLORS.accent, letterSpacing: -0.48 },
});
