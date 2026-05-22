import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { GlassView } from '../common/GlassView';
import { CoachAvatar, AVATAR_THEMES, AvatarTheme, AvatarState } from '../CoachAvatar/CoachAvatar';
import { askCoachProactive, clearCoachCache } from '../../services/coachService';
import { useAuthStore }    from '../../stores/authStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useCoachTheme }   from '../../hooks/useCoachTheme';
import { COLORS, SPACING } from '../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_SECS  = 60;
const MIN_SESSIONS_FOR_AI = 3; // below this we show the first-time nudge

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onAskMore?: (initialMessage?: string) => void;
}

type WidgetError = 'rate_limit' | 'offline' | 'unknown' | null;

// ─── Typewriter ───────────────────────────────────────────────────────────────

function useTypewriter(fullText: string, speed = 18) {
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

// ─── Avatar state from message ────────────────────────────────────────────────

function deriveAvatarState(loading: boolean, typing: boolean, msg: string): AvatarState {
  if (loading) return 'thinking';
  if (typing)  return 'talking';
  const l = msg.toLowerCase();
  if (l.includes('⚠️') || l.includes('overtraining') || l.includes('neglect') || l.includes('missing')) return 'concerned';
  if (l.includes('streak') || l.includes(' pr') || l.includes('progress') || l.includes('crushed') || l.includes('great')) return 'celebrating';
  return 'idle';
}

// ─── Theme colour swatch ──────────────────────────────────────────────────────

function ThemePicker({ current, onChange }: { current: AvatarTheme; onChange: (t: AvatarTheme) => void }) {
  const themes: AvatarTheme[] = ['classic', 'cool', 'glow'];
  return (
    <View style={tp.row}>
      {themes.map(t => (
        <TouchableOpacity
          key={t}
          onPress={() => onChange(t)}
          activeOpacity={0.75}
          style={[
            tp.swatch,
            { backgroundColor: AVATAR_THEMES[t].head },
            current === t && tp.swatchActive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Rate-limit countdown ─────────────────────────────────────────────────────

function RateLimitBanner({ secsLeft, onRetry }: { secsLeft: number; onRetry: () => void }) {
  return (
    <View style={rl.wrap}>
      <Text style={rl.txt}>
        Rate limit — retrying in {secsLeft}s
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.75} style={rl.btn}>
        <Text style={rl.btnTxt}>Try now</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CoachWidget ──────────────────────────────────────────────────────────────

export function CoachWidget({ onAskMore }: Props) {
  const { user }               = useAuthStore();
  const { sessions }           = useSessionStore();
  const [theme, setTheme]      = useCoachTheme();

  const [message,   setMessage  ] = useState('');
  const [loading,   setLoading  ] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error,     setError    ] = useState<WidgetError>(null);
  const [retryAt,   setRetryAt  ] = useState<number | null>(null);  // epoch ms
  const [secsLeft,  setSecsLeft ] = useState(0);
  const fetchedRef = useRef(false);

  const { displayed, done } = useTypewriter(message);
  const avatarState = deriveAvatarState(loading, !done && !!message, message);

  // ── Session-count gate ─────────────────────────────────────────────────────
  const completedCount = sessions.filter(s => s.status === 'completed').length;
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
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      setError(msg.includes('Network request failed') ? 'offline' : 'unknown');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isFirstTimeUser]);

  // Fetch once on mount
  useEffect(() => {
    if (fetchedRef.current || !user?.uid) return;
    fetchedRef.current = true;
    fetchMessage(false);
  }, [user?.uid]);

  // ── First-time / empty state ───────────────────────────────────────────────
  if (isFirstTimeUser) {
    return (
      <GlassView radius={20} style={s.card}>
        <View style={s.row}>
          <View style={s.avatarCol}>
            <CoachAvatar state="idle" size={72} theme={theme} />
            <ThemePicker current={theme} onChange={setTheme} />
          </View>
          <View style={s.messageArea}>
            <View style={s.badge}><Text style={s.badgeTxt}>AI COACH</Text></View>
            <Text style={s.messageText}>
              Log {MIN_SESSIONS_FOR_AI - completedCount} more workout{MIN_SESSIONS_FOR_AI - completedCount !== 1 ? 's' : ''} and I'll start learning your patterns — consistency data is what makes my insights useful.
            </Text>
          </View>
        </View>
      </GlassView>
    );
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading && !message) {
    return (
      <GlassView radius={20} style={s.card}>
        <View style={s.row}>
          <View style={s.avatarCol}>
            <CoachAvatar state="thinking" size={72} theme={theme} />
            <ThemePicker current={theme} onChange={setTheme} />
          </View>
          <View style={s.messageArea}>
            <View style={s.badge}><Text style={s.badgeTxt}>AI COACH</Text></View>
            <View style={s.skeletonLong}  />
            <View style={s.skeletonShort} />
            <SkeletonDots />
          </View>
        </View>
      </GlassView>
    );
  }

  // ── Normal / error state ───────────────────────────────────────────────────
  return (
    <GlassView radius={20} style={s.card} glow={avatarState === 'celebrating'}>
      <View style={s.row}>
        {/* Avatar — tappable to refresh */}
        <TouchableOpacity onPress={() => fetchMessage(true)} activeOpacity={0.8} style={s.avatarCol}>
          <CoachAvatar state={avatarState} size={72} theme={theme} />
          <Text style={s.tapHint}>{loading ? 'thinking…' : 'tap to refresh'}</Text>
          <ThemePicker current={theme} onChange={setTheme} />
        </TouchableOpacity>

        {/* Message area */}
        <View style={s.messageArea}>
          <View style={s.topRow}>
            <View style={s.badge}><Text style={s.badgeTxt}>AI COACH</Text></View>
            {fromCache && !loading && (
              <Text style={s.cachedHint}>cached</Text>
            )}
          </View>

          {/* Rate-limit banner */}
          {error === 'rate_limit' && retryAt && (
            <RateLimitBanner secsLeft={secsLeft} onRetry={() => fetchMessage(true)} />
          )}

          {/* Offline notice */}
          {error === 'offline' && !message && (
            <Text style={s.errorText}>No connection — showing last saved insight once you're back online.</Text>
          )}

          {/* Message text */}
          {message ? (
            <Text style={s.messageText}>
              {displayed}
              {!done && <Text style={s.cursor}>▌</Text>}
            </Text>
          ) : !error ? null : (
            error !== 'rate_limit' && error !== 'offline' ? (
              <Text style={s.errorText}>Couldn't reach the coach right now.</Text>
            ) : null
          )}
        </View>
      </View>

      {/* Footer */}
      {(!!message || error === 'offline') && !loading && (
        <View style={s.footer}>
          <View style={s.footerLeft} />
          {onAskMore && (
            <TouchableOpacity onPress={() => onAskMore(message || undefined)} activeOpacity={0.8} style={s.askBtn}>
              <Text style={s.askTxt}>Ask Coach →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </GlassView>
  );
}

// ─── Animated skeleton dots ───────────────────────────────────────────────────

function SkeletonDots() {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: 1,   duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.delay((2 - i) * 150 + 100),
      ])),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
      {dots.map((op, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted, opacity: op }} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card:         { marginHorizontal: 16, marginBottom: 8, padding: SPACING.md, paddingBottom: SPACING.sm },
  row:          { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  avatarCol:    { alignItems: 'center', gap: 4, paddingTop: 2 },
  tapHint:      { fontSize: 9, color: COLORS.textLabel, fontWeight: '600', letterSpacing: 0.4 },
  messageArea:  { flex: 1, minWidth: 0 },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  badge:        { backgroundColor: 'rgba(255,140,0,0.14)', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,140,0,0.28)', paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt:     { fontSize: 9, fontWeight: '900', color: COLORS.accent, letterSpacing: 1.1 },
  cachedHint:   { fontSize: 9, color: COLORS.textLabel, fontWeight: '600', letterSpacing: 0.3 },
  messageText:  { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, letterSpacing: 0.1 },
  cursor:       { color: COLORS.accent, fontWeight: '900' },
  errorText:    { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', lineHeight: 18 },
  skeletonLong: { height: 11, borderRadius: 6, backgroundColor: 'rgba(255,240,220,0.08)', marginBottom: 6, width: '90%' },
  skeletonShort:{ height: 11, borderRadius: 6, backgroundColor: 'rgba(255,240,220,0.08)', width: '65%' },
  footer:       { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,240,220,0.07)' },
  footerLeft:   { flex: 1 },
  askBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,140,0,0.28)', backgroundColor: 'rgba(255,140,0,0.08)' },
  askTxt:       { fontSize: 12, fontWeight: '800', color: COLORS.accent, letterSpacing: 0.3 },
});

const tp = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 5, marginTop: 4 },
  swatch:      { width: 12, height: 12, borderRadius: 6, opacity: 0.5 },
  swatchActive:{ opacity: 1, transform: [{ scale: 1.25 }] },
});

const rl = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,140,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.20)' },
  txt:    { flex: 1, fontSize: 11, color: COLORS.accent, fontWeight: '600' },
  btn:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,140,0,0.40)', backgroundColor: 'rgba(255,140,0,0.15)' },
  btnTxt: { fontSize: 11, color: COLORS.accent, fontWeight: '800' },
});
