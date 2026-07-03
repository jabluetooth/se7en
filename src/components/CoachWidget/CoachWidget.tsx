import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassView } from '../common/GlassView';
import { askCoachProactive, clearCoachCache } from '../../services/coachService';
import { useAuthStore }    from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
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
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);

  useEffect(() => {
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
  }, [fullText]);

  return { displayed, done };
}

// ─── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  const reducedMotion = useReducedMotion();
  const dots = [
    useRef(new Animated.Value(0.35)).current,
    useRef(new Animated.Value(0.35)).current,
    useRef(new Animated.Value(0.35)).current,
  ];

  useEffect(() => {
    if (reducedMotion) {
      // Static "active" state — same visual weight, no motion.
      dots.forEach(d => d.setValue(1));
      return;
    }
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1,    duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.35, duration: 280, useNativeDriver: true }),
          Animated.delay((2 - i) * 180 + 120),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [reducedMotion]);

  return (
    <View style={td.row}>
      {dots.map((op, i) => (
        <Animated.View key={i} style={[td.dot, { opacity: op }]} />
      ))}
    </View>
  );
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
      <TouchableOpacity onPress={onRetry} activeOpacity={0.75} style={rl.btn}>
        <Text style={rl.btnTxt}>Try now</Text>
      </TouchableOpacity>
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
  // Bolt pulses while the AI is fetching
  const boltOp = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!loading || reducedMotion) {
      boltOp.stopAnimation();
      Animated.timing(boltOp, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(boltOp, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(boltOp, { toValue: 1,    duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loading, reducedMotion]);

  return (
    <View style={ih.row}>
      <Animated.View style={{ opacity: boltOp }}>
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
  label:     { fontSize: 10, fontWeight: '800', fontFamily: FONTS.label, color: COLORS.accent, letterSpacing: 0.80, textTransform: 'uppercase' },
  line:      { flex: 1, height: 1, backgroundColor: 'rgba(255,140,0,0.15)' },
  cachedPill:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,240,220,0.12)', backgroundColor: 'rgba(255,240,220,0.06)' },
  cachedTxt: { fontSize: 9, color: COLORS.textLabel, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
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
            <TouchableOpacity onPress={() => fetchMessage(true)} activeOpacity={0.7} style={s.refreshBtn}>
              <RefreshSvg size={12} />
              <Text style={s.refreshTxt}>Refresh</Text>
            </TouchableOpacity>
            {onAskMore && (
              <TouchableOpacity
                onPress={() => onAskMore(message || undefined)}
                activeOpacity={0.8}
                style={s.askBtn}
              >
                <Text style={s.askTxt}>Ask Coach →</Text>
              </TouchableOpacity>
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
