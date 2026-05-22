import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';

export type AvatarState = 'idle' | 'talking' | 'celebrating' | 'thinking' | 'concerned';
export type AvatarTheme = 'classic' | 'cool' | 'glow';

export const AVATAR_THEMES: Record<AvatarTheme, { head: string; headDark: string; hair: string; blush: string; label: string }> = {
  classic: { head: '#F5A623', headDark: '#E8952A', hair: '#2C1810', blush: '#FF8C00', label: 'Classic' },
  cool:    { head: '#5BCDC1', headDark: '#4AB5AA', hair: '#1A3540', blush: '#64D2FF', label: 'Cool'    },
  glow:    { head: '#B07EF7', headDark: '#9268E0', hair: '#2D1B5E', blush: '#8B5CF6', label: 'Glow'    },
};

interface Props {
  state:   AvatarState;
  size?:   number;
  theme?:  AvatarTheme;
}

// ─── Expression definitions ───────────────────────────────────────────────────
// All paths drawn on a 100×110 viewBox, face centred at (50, 52).

const EXPR = {
  idle: {
    leftBrow:  'M 23 30 Q 34 24 43 28',
    rightBrow: 'M 57 28 Q 66 24 77 30',
    mouth:     'M 35 65 Q 50 75 65 65',
    eyeType:   'normal' as const,
  },
  talking: {
    leftBrow:  'M 23 27 Q 34 21 43 25',
    rightBrow: 'M 57 25 Q 66 21 77 27',
    mouth:     'M 35 63 Q 50 77 65 63',
    eyeType:   'normal' as const,
  },
  celebrating: {
    leftBrow:  'M 21 24 Q 34 17 44 23',
    rightBrow: 'M 56 23 Q 66 17 79 24',
    mouth:     'M 28 62 Q 50 84 72 62',
    eyeType:   'squint' as const,
  },
  thinking: {
    leftBrow:  'M 23 26 Q 34 21 43 27',
    rightBrow: 'M 57 28 Q 66 25 77 31',
    mouth:     'M 38 67 Q 50 63 62 67',
    eyeType:   'normal' as const,
  },
  concerned: {
    leftBrow:  'M 25 33 Q 33 27 43 31',
    rightBrow: 'M 57 31 Q 67 27 75 33',
    mouth:     'M 35 70 Q 50 61 65 70',
    eyeType:   'wide' as const,
  },
};

// ─── Eye renderers ────────────────────────────────────────────────────────────

function Eyes({ type, blink }: { type: 'normal' | 'squint' | 'wide'; blink: boolean }) {
  if (blink || type === 'squint') {
    // Closed / happy-squint: draw two small arcs
    return (
      <G>
        <Path d="M 26 44 Q 35 38 44 44" stroke="#1A0A00" strokeWidth={3} strokeLinecap="round" fill="none" />
        <Path d="M 56 44 Q 65 38 74 44" stroke="#1A0A00" strokeWidth={3} strokeLinecap="round" fill="none" />
      </G>
    );
  }

  const ry = type === 'wide' ? 11 : 10;
  const pupilR = type === 'wide' ? 4.5 : 5;

  return (
    <G>
      {/* Sclera */}
      <Ellipse cx={35} cy={44} rx={9} ry={ry} fill="white" />
      <Ellipse cx={65} cy={44} rx={9} ry={ry} fill="white" />
      {/* Pupils */}
      <Circle cx={35} cy={45} r={pupilR} fill="#1A0A00" />
      <Circle cx={65} cy={45} r={pupilR} fill="#1A0A00" />
      {/* Shine */}
      <Circle cx={37.5} cy={42.5} r={2} fill="white" />
      <Circle cx={67.5} cy={42.5} r={2} fill="white" />
    </G>
  );
}

// ─── Talking mouth (open vs closed) ──────────────────────────────────────────

type ExprValue = { leftBrow: string; rightBrow: string; mouth: string; eyeType: 'normal' | 'squint' | 'wide' };

function Mouth({ expr, mouthOpen }: { expr: ExprValue; mouthOpen: boolean }) {
  if (expr.eyeType === 'talking' as any || mouthOpen) {
    // Open mouth: filled arc
    return (
      <G>
        <Path
          d="M 35 63 Q 50 77 65 63 Q 50 85 35 63"
          fill="#1A0A00"
        />
        {/* Teeth */}
        <Path d="M 35 63 Q 50 69 65 63" stroke="white" strokeWidth={2.5} fill="none" />
      </G>
    );
  }
  return (
    <Path
      d={expr.mouth}
      stroke="#1A0A00"
      strokeWidth={3}
      strokeLinecap="round"
      fill="none"
    />
  );
}

// ─── Sparkles for celebrating ─────────────────────────────────────────────────

function Sparkle({ x, y, opacity }: { x: number; y: number; opacity: Animated.Value }) {
  const star = '★';
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: x, top: y,
        fontSize: 12,
        color: '#FFD60A',
        opacity,
      }}
    >
      {star}
    </Animated.Text>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CoachAvatar({ state, size = 80, theme = 'classic' }: Props) {
  const expr     = EXPR[state];
  const scale    = size / 100;
  const palette  = AVATAR_THEMES[theme];

  // ── Blink state ────────────────────────────────────────────────────────────
  const [blink, setBlink] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleBlink = () => {
    const delay = 2800 + Math.random() * 2400;
    blinkTimer.current = setTimeout(() => {
      setBlink(true);
      setTimeout(() => {
        setBlink(false);
        scheduleBlink();
      }, 130);
    }, delay);
  };

  useEffect(() => {
    scheduleBlink();
    return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current); };
  }, []);

  // ── Talking mouth open/close ───────────────────────────────────────────────
  const [mouthOpen, setMouthOpen] = useState(false);
  const mouthInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mouthInterval.current) clearInterval(mouthInterval.current);
    if (state === 'talking') {
      mouthInterval.current = setInterval(() => setMouthOpen(p => !p), 220);
    } else {
      setMouthOpen(false);
    }
    return () => { if (mouthInterval.current) clearInterval(mouthInterval.current); };
  }, [state]);

  // ── Bounce (celebrating) ───────────────────────────────────────────────────
  const bounceY   = useRef(new Animated.Value(0)).current;
  const breathScale = useRef(new Animated.Value(1)).current;
  const shakeX    = useRef(new Animated.Value(0)).current;
  const sparkleOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounceY.stopAnimation();
    breathScale.stopAnimation();
    shakeX.stopAnimation();
    sparkleOp.stopAnimation();

    bounceY.setValue(0);
    breathScale.setValue(1);
    shakeX.setValue(0);
    sparkleOp.setValue(0);

    if (state === 'celebrating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceY,    { toValue: -13, duration: 280, useNativeDriver: true }),
          Animated.timing(bounceY,    { toValue: 0,   duration: 280, useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleOp, { toValue: 1,   duration: 350, useNativeDriver: true }),
          Animated.timing(sparkleOp, { toValue: 0.2, duration: 350, useNativeDriver: true }),
        ]),
      ).start();
      return;
    }

    if (state === 'concerned') {
      const shake = () =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(shakeX, { toValue: 5,  duration: 75, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -5, duration: 75, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 4,  duration: 75, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -4, duration: 75, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 0,  duration: 75, useNativeDriver: true }),
            Animated.delay(3200),
          ]),
        );
      shake().start();
      return;
    }

    // Idle / thinking / talking → breathing
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, { toValue: state === 'thinking' ? 1.008 : 1.015, duration: 2600, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1, duration: 2600, useNativeDriver: true }),
      ]),
    ).start();
  }, [state]);

  const svgH = 110;

  return (
    <View style={{ width: size, height: size * (svgH / 100) }}>
      <Animated.View
        style={{
          transform: [
            { translateY: bounceY },
            { translateX: shakeX },
            { scale: breathScale },
          ],
        }}
      >
        <Svg width={size} height={size * (svgH / 100)} viewBox={`0 0 100 ${svgH}`}>
          {/* ── Head ── */}
          <Circle cx={50} cy={54} r={44} fill={palette.head} />
          {/* Subtle head shadow */}
          <Circle cx={50} cy={54} r={44} fill="rgba(0,0,0,0.06)" />
          <Circle cx={50} cy={52} r={44} fill={palette.head} />

          {/* ── Hair tufts ── */}
          <Path d="M 28 13 Q 36 4  50 8  Q 64 4  72 13 Q 61 19 50 16 Q 39 19 28 13" fill={palette.hair} />

          {/* ── Ears ── */}
          <Circle cx={6}  cy={52} r={8} fill={palette.head} />
          <Circle cx={94} cy={52} r={8} fill={palette.head} />
          <Circle cx={6}  cy={52} r={5} fill={palette.headDark} />
          <Circle cx={94} cy={52} r={5} fill={palette.headDark} />

          {/* ── Cheek blush ── */}
          <Ellipse cx={22} cy={60} rx={9} ry={6} fill={palette.blush} opacity={0.22} />
          <Ellipse cx={78} cy={60} rx={9} ry={6} fill={palette.blush} opacity={0.22} />

          {/* ── Eyes ── */}
          <Eyes type={expr.eyeType} blink={blink} />

          {/* ── Eyebrows ── */}
          <Path d={expr.leftBrow}  stroke="#2C1810" strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Path d={expr.rightBrow} stroke="#2C1810" strokeWidth={3.5} strokeLinecap="round" fill="none" />

          {/* ── Mouth ── */}
          <Mouth expr={expr} mouthOpen={state === 'talking' && mouthOpen} />

          {/* ── Nose dots ── */}
          <Circle cx={47} cy={58} r={2} fill={palette.headDark} opacity={0.6} />
          <Circle cx={53} cy={58} r={2} fill={palette.headDark} opacity={0.6} />
        </Svg>
      </Animated.View>

      {/* ── Celebrating sparkles (outside SVG, absolutely positioned) ── */}
      {state === 'celebrating' && (
        <>
          <Sparkle x={-8}         y={2}           opacity={sparkleOp} />
          <Sparkle x={size - 6}   y={0}           opacity={sparkleOp} />
          <Sparkle x={size * 0.1} y={-14 * scale} opacity={sparkleOp} />
        </>
      )}
    </View>
  );
}
