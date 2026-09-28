// In-app feedback: toasts and confirm sheets, replacing Alert.alert.
//
//   const { toast, confirm } = useFeedback();
//   toast.success('Preset saved');
//   if (await confirm({ title: 'Skip Push?', confirmLabel: 'Skip day', destructive: true })) { … }
//   actions({ title: 'Push', options: [{ label: 'Mark done', icon: 'checkmark', onPress: markDone }] });
//
// Why hosts: every flow in this app lives in a React Native <Modal>, which is
// a separate native window. Anything rendered at the app root is hidden
// behind an open modal. So state lives in <FeedbackProvider> (once, at the
// root) while <FeedbackHost /> is mounted at the root AND inside each Modal;
// only the most recently mounted host draws, which is always the top window.
import React, {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../constants';
import { AnimatedPressable, fireHaptic } from '../../motion/AnimatedPressable';
import { enterFade, enterFromTop, enterSheet, exitFade, exitSheet, exitToTop, layoutSoft } from '../../motion/presets';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'info' | 'warning' | 'error';

interface ToastOptions {
  title?: string;
  /** Shown as a button on the toast, e.g. { label: 'Undo', onPress: undo }. */
  action?: { label: string; onPress: () => void };
  /** ms before it hides itself. Defaults to 2.6 s, or 5 s when it has an action. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red, for actions that discard something. */
  destructive?: boolean;
}

interface ConfirmItem extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export interface ActionOption {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Red, for actions that discard something. */
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionsOptions {
  title: string;
  message?: string;
  options: ActionOption[];
}

type ToastApi = {
  [K in ToastVariant]: (message: string, options?: ToastOptions) => void;
};

interface FeedbackApi {
  toast: ToastApi;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** A bottom sheet of choices; picking one closes the sheet then runs it. */
  actions: (options: ActionsOptions) => void;
}

interface FeedbackState {
  toasts: ToastItem[];
  pending: ConfirmItem | null;
  menu: ActionsOptions | null;
  dismissToast: (id: number) => void;
  answer: (ok: boolean) => void;
  closeMenu: () => void;
  hosts: string[];
  registerHost: (id: string) => () => void;
}

const ApiContext = createContext<FeedbackApi | null>(null);
const StateContext = createContext<FeedbackState | null>(null);

const MAX_TOASTS = 3;

const VARIANT: Record<ToastVariant, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: 'checkmark-circle', color: COLORS.accent },
  info:    { icon: 'information-circle', color: COLORS.rest },
  warning: { icon: 'alert-circle', color: COLORS.warning },
  error:   { icon: 'close-circle', color: COLORS.danger },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<ConfirmItem | null>(null);
  const [menu, setMenu] = useState<ActionsOptions | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts(list => list.filter(x => x.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, message: string, options: ToastOptions = {}) => {
    const id = nextId.current++;
    setToasts(list => [...list, { id, message, variant, ...options }].slice(-MAX_TOASTS));
    fireHaptic(variant === 'error' ? 'warning' : variant === 'success' ? 'light' : 'none');
    AccessibilityInfo.announceForAccessibility([options.title, message].filter(Boolean).join('. '));
    const ms = options.duration ?? (options.action ? 5000 : 2600);
    timers.current.set(id, setTimeout(() => dismissToast(id), ms));
  }, [dismissToast]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    // A second confirm while one is open cancels the first rather than stacking.
    setPending(prev => {
      prev?.resolve(false);
      return { ...options, resolve };
    });
  }), []);

  const answer = useCallback((ok: boolean) => {
    setPending(prev => {
      prev?.resolve(ok);
      return null;
    });
  }, []);

  const actions = useCallback((options: ActionsOptions) => setMenu(options), []);
  const closeMenu = useCallback(() => setMenu(null), []);

  const registerHost = useCallback((id: string) => {
    setHosts(list => [...list, id]);
    return () => setHosts(list => list.filter(h => h !== id));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const api = useMemo<FeedbackApi>(() => ({
    toast: {
      success: (m, o) => show('success', m, o),
      info:    (m, o) => show('info', m, o),
      warning: (m, o) => show('warning', m, o),
      error:   (m, o) => show('error', m, o),
    },
    confirm,
    actions,
  }), [show, confirm, actions]);

  const state = useMemo<FeedbackState>(
    () => ({ toasts, pending, menu, dismissToast, answer, closeMenu, hosts, registerHost }),
    [toasts, pending, menu, dismissToast, answer, closeMenu, hosts, registerHost],
  );

  return (
    <ApiContext.Provider value={api}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ApiContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return api;
}

// ─── Host ─────────────────────────────────────────────────────────────────────

/**
 * Draws toasts and the confirm sheet. Mount one at the app root and one as
 * the last child inside every <Modal>. Only the top-most mounted host renders.
 */
export function FeedbackHost() {
  const state = useContext(StateContext);
  const id = useId();
  const register = state?.registerHost;

  useEffect(() => register?.(id), [register, id]);

  if (!state || state.hosts[state.hosts.length - 1] !== id) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ToastStack toasts={state.toasts} onDismiss={state.dismissToast} />
      {state.menu && <ActionSheet item={state.menu} onClose={state.closeMenu} />}
      {state.pending && <ConfirmSheet item={state.pending} onAnswer={state.answer} />}
    </View>
  );
}

// ─── Toasts ───────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ts.stack, { top: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map(t => {
        const v = VARIANT[t.variant];
        return (
          <Animated.View
            key={t.id}
            entering={enterFromTop}
            exiting={exitToTop}
            layout={layoutSoft}
            style={ts.toast}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Pressable
              style={ts.body}
              onPress={() => onDismiss(t.id)}
              accessibilityRole="button"
              accessibilityLabel={`${[t.title, t.message].filter(Boolean).join('. ')}. Tap to dismiss.`}
            >
              <Ionicons name={v.icon} size={20} color={v.color} />
              <View style={ts.textCol}>
                {t.title ? <Text style={ts.title}>{t.title}</Text> : null}
                <Text style={ts.message}>{t.message}</Text>
              </View>
            </Pressable>
            {t.action && (
              <AnimatedPressable
                scale="strong"
                haptic="light"
                style={[ts.action, { borderColor: v.color + '55' }]}
                onPress={() => { t.action!.onPress(); onDismiss(t.id); }}
                accessibilityRole="button"
                accessibilityLabel={t.action.label}
              >
                <Text style={[ts.actionTxt, { color: v.color }]}>{t.action.label}</Text>
              </AnimatedPressable>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Confirm sheet ────────────────────────────────────────────────────────────

function ActionSheet({ item, onClose }: { item: ActionsOptions; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={enterFade} exiting={exitFade} style={StyleSheet.absoluteFill}>
        <Pressable style={cs.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View entering={enterSheet} exiting={exitSheet} style={[cs.sheet, { paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
        <View style={cs.grabber} />
        <Text style={cs.title} accessibilityRole="header">{item.title}</Text>
        {item.message ? <Text style={cs.message}>{item.message}</Text> : <View style={{ height: 10 }} />}
        {item.options.map((o, i) => (
          <AnimatedPressable
            key={o.label}
            scale="subtle"
            haptic={o.destructive ? 'warning' : 'selection'}
            style={[as.row, i > 0 && as.rowBorder]}
            onPress={() => { onClose(); o.onPress(); }}
            accessibilityRole="button"
            accessibilityLabel={o.label}
          >
            {o.icon && (
              <View style={[as.icon, o.destructive && { backgroundColor: 'rgba(255,69,58,0.14)' }]}>
                <Ionicons name={o.icon} size={18} color={o.destructive ? COLORS.danger : COLORS.accent} />
              </View>
            )}
            <Text style={[as.label, o.destructive && { color: COLORS.danger }]}>{o.label}</Text>
          </AnimatedPressable>
        ))}
        <AnimatedPressable style={cs.cancelBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={cs.cancelTxt}>Cancel</Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

function ConfirmSheet({ item, onAnswer }: { item: ConfirmItem; onAnswer: (ok: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const confirmColor = item.destructive ? COLORS.danger : COLORS.accent;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={enterFade} exiting={exitFade} style={StyleSheet.absoluteFill}>
        <Pressable
          style={cs.backdrop}
          onPress={() => onAnswer(false)}
          accessibilityRole="button"
          accessibilityLabel={item.cancelLabel ?? 'Cancel'}
        />
      </Animated.View>
      <Animated.View
        entering={enterSheet}
        exiting={exitSheet}
        style={[cs.sheet, { paddingBottom: insets.bottom + 16 }]}
        accessibilityViewIsModal
      >
        <View style={cs.grabber} />
        <Text style={cs.title} accessibilityRole="header">{item.title}</Text>
        {item.message ? <Text style={cs.message}>{item.message}</Text> : null}
        <AnimatedPressable
          haptic={item.destructive ? 'warning' : 'medium'}
          style={[cs.confirmBtn, { backgroundColor: confirmColor }]}
          onPress={() => onAnswer(true)}
          accessibilityRole="button"
          accessibilityLabel={item.confirmLabel ?? 'Confirm'}
        >
          <Text style={[cs.confirmTxt, { color: item.destructive ? '#fff' : '#000' }]}>
            {item.confirmLabel ?? 'Confirm'}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={cs.cancelBtn}
          onPress={() => onAnswer(false)}
          accessibilityRole="button"
          accessibilityLabel={item.cancelLabel ?? 'Cancel'}
        >
          <Text style={cs.cancelTxt}>{item.cancelLabel ?? 'Cancel'}</Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ts = StyleSheet.create({
  stack:   { position: 'absolute', left: 12, right: 12, gap: 8 },
  toast:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 14, paddingRight: 10, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  body:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  textCol: { flex: 1, gap: 2 },
  title:   { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.text },
  message: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary, lineHeight: 19 },
  action:  { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  actionTxt: { fontSize: 13, fontFamily: FONTS.headline, letterSpacing: 0.3 },
});

const as = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,240,220,0.10)' },
  icon:      { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,140,0,0.12)' },
  label:     { fontSize: 16, fontFamily: FONTS.semibold, color: COLORS.text },
});

const cs = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: COLORS.surface, borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  grabber:    { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: 18 },
  title:      { fontSize: 22, fontFamily: FONTS.display, color: COLORS.text, letterSpacing: -0.6, marginBottom: 8 },
  message:    { fontSize: 15, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 22 },
  confirmBtn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  confirmTxt: { fontSize: 16, fontFamily: FONTS.headline, letterSpacing: -0.2 },
  cancelBtn:  { height: 50, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:  { fontSize: 15, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
});
