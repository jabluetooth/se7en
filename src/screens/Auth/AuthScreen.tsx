import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassView } from '../../components/common/GlassView';
import { useAuthStore } from '../../stores/authStore';
import { GRAD, COLORS, FONTS } from '../../constants';
import { AppBackground } from '../../components/ui/AppBackground';

type Tab = 'login' | 'signup';

export function AuthScreen() {
  const { signIn, signUp, resetPassword, loading, error, clearError } = useAuthStore();
  const [tab,         setTab        ] = useState<Tab>('login');
  const [name,        setName       ] = useState('');
  const [email,       setEmail      ] = useState('');
  const [password,    setPassword   ] = useState('');
  const [confirm,     setConfirm    ] = useState('');
  const [showPass,    setShowPass   ] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef   = useRef<TextInput>(null);
  const passRef    = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const switchTab = (t: Tab) => {
    setTab(t);
    setName(''); setEmail(''); setPassword(''); setConfirm('');
    clearError();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    await signIn(email.trim().toLowerCase(), password);
  };

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) return;
    if (password !== confirm) {
      Alert.alert('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password must be at least 6 characters');
      return;
    }
    await signUp(name.trim(), email.trim().toLowerCase(), password);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email address first, then tap Forgot Password.');
      return;
    }
    try {
      await resetPassword(email.trim().toLowerCase());
      Alert.alert('Check your inbox', 'A password reset link has been sent.');
    } catch {}
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <View style={s.logoWrap}>
              <LinearGradient
                colors={GRAD.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoBadge}
              >
                <Text style={s.logoNum}>7</Text>
              </LinearGradient>
              <Text style={s.logoWordmark}>
                Se<Text style={{ color: COLORS.accent }}>7</Text>en
              </Text>
              <Text style={s.logoTagline}>Your personal training companion</Text>
            </View>

            {/* Tab switcher */}
            <View style={s.tabs}>
              {(['login', 'signup'] as Tab[]).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => switchTab(t)}
                  style={[s.tab, tab === t && s.tabActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                    {t === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form card */}
            <GlassView opacity="mid" radius={20} style={s.card}>
              {/* Error banner */}
              {!!error && (
                <View style={s.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={15} color={COLORS.danger} />
                  <Text style={s.errorTxt}>{error}</Text>
                </View>
              )}

              {/* Sign-up only: display name */}
              {tab === 'signup' && (
                <Field
                  label="Full Name"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Alex Johnson"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  autoCapitalize="words"
                />
              )}

              <Field
                ref={emailRef}
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />

              <Field
                ref={passRef}
                label="Password"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                secureTextEntry={!showPass}
                returnKeyType={tab === 'login' ? 'done' : 'next'}
                onSubmitEditing={tab === 'login' ? handleLogin : () => confirmRef.current?.focus()}
                rightEl={
                  <TouchableOpacity onPress={() => setShowPass(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                }
              />

              {/* Sign-up only: confirm password */}
              {tab === 'signup' && (
                <Field
                  ref={confirmRef}
                  label="Confirm Password"
                  icon="lock-closed-outline"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter password"
                  secureTextEntry={!showConfirm}
                  returnKeyType="done"
                  onSubmitEditing={handleSignUp}
                  rightEl={
                    <TouchableOpacity onPress={() => setShowConfirm(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  }
                />
              )}

              {/* Forgot password (login only) */}
              {tab === 'login' && (
                <TouchableOpacity onPress={handleForgotPassword} style={s.forgotBtn} activeOpacity={0.7}>
                  <Text style={s.forgotTxt}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Primary CTA */}
              <TouchableOpacity
                style={s.ctaWrap}
                onPress={tab === 'login' ? handleLogin : handleSignUp}
                activeOpacity={0.85}
                disabled={loading}
              >
                <LinearGradient
                  colors={GRAD.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[s.ctaGrad, loading && { opacity: 0.7 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.ctaTxt}>
                      {tab === 'login' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </GlassView>

            {/* Footer */}
            <Text style={s.footer}>
              Your data is private and encrypted.{'\n'}Only you can access your workouts.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Reusable field ───────────────────────────────────────────────────────────

interface FieldProps {
  label:             string;
  icon:              string;
  value:             string;
  onChangeText:      (v: string) => void;
  placeholder?:      string;
  secureTextEntry?:  boolean;
  keyboardType?:     any;
  autoCapitalize?:   any;
  returnKeyType?:    any;
  onSubmitEditing?:  () => void;
  rightEl?:          React.ReactNode;
  ref?:              React.Ref<TextInput>;
}

const Field = React.forwardRef<TextInput, FieldProps>(function Field(
  { label, icon, value, onChangeText, placeholder, secureTextEntry,
    keyboardType, autoCapitalize, returnKeyType, onSubmitEditing, rightEl },
  ref,
) {
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <GlassView opacity="low" radius={12} style={fi.row}>
        <Ionicons name={icon as any} size={17} color={COLORS.textMuted} style={fi.icon} />
        <TextInput
          ref={ref}
          style={fi.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,240,220,0.30)"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {rightEl}
      </GlassView>
    </View>
  );
});

const fi = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', fontFamily: FONTS.label, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.88, marginBottom: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  icon:  {},
  input: { flex: 1, fontSize: 15, fontWeight: '500', fontFamily: FONTS.medium, color: '#fff', padding: 0 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  scroll:       { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  logoWrap:     { alignItems: 'center', marginBottom: 36 },
  logoBadge:    { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoNum:      { fontSize: 36, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -1.44 },
  logoWordmark: { fontSize: 32, fontWeight: '800', fontFamily: FONTS.display, color: '#fff', letterSpacing: -1.28, marginBottom: 6 },
  logoTagline:  { fontSize: 14, fontWeight: '500', fontFamily: FONTS.medium, color: COLORS.textSecondary, lineHeight: 20 },

  tabs:         { flexDirection: 'row', backgroundColor: 'rgba(255,240,220,0.07)', borderRadius: 12, padding: 3, marginBottom: 20 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:    { backgroundColor: 'rgba(255,240,220,0.12)' },
  tabTxt:       { fontSize: 14, fontWeight: '600', fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  tabTxtActive: { color: '#fff', fontWeight: '700', fontFamily: FONTS.headline },

  card:         { padding: 20, marginBottom: 24 },

  errorBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,69,58,0.10)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt:     { fontSize: 13, fontFamily: FONTS.body, color: COLORS.danger, flex: 1 },

  forgotBtn:    { alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 },
  forgotTxt:    { fontSize: 13, fontFamily: FONTS.body, color: COLORS.accent },

  ctaWrap:      { borderRadius: 14, overflow: 'hidden' },
  ctaGrad:      { height: 52, alignItems: 'center', justifyContent: 'center' },
  ctaTxt:       { fontSize: 16, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff', letterSpacing: -0.48 },

  footer:       { textAlign: 'center', fontSize: 12, fontWeight: '500', fontFamily: FONTS.medium, color: COLORS.textMuted, lineHeight: 20 },
});
