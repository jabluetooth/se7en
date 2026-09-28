import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { fireHaptic } from '../../motion/AnimatedPressable';
import { enterBubble } from '../../motion/presets';
import { COLORS, FONTS } from '../../constants';
import { themed } from '../../theme/runtime';

interface Props {
  /** The explanation, in a sentence or two. */
  text:   string;
  /** Optional bold first line. */
  title?: string;
  size?:  number;
  style?: StyleProp<ViewStyle>;
}

interface Anchor { x: number; y: number; w: number; h: number }

const GAP = 8;
const EDGE = 16;
const MAX_W = 280;

/**
 * A small ⓘ next to a heading or number. Screens show only the data; what a
 * figure means, how it's worked out, or what a setting does lives here, one
 * tap (or long press) away. The bubble opens beside the icon and closes on
 * the next tap anywhere.
 */
export function InfoTip({ text, title, size = 16, style }: Props) {
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { width: W, height: H } = useWindowDimensions();

  const open = () => {
    fireHaptic('selection');
    ref.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  };
  const close = () => setAnchor(null);

  const bubbleW = Math.min(MAX_W, W - EDGE * 2);
  const place = (() => {
    if (!anchor) return null;
    const cx = anchor.x + anchor.w / 2;
    const left = Math.max(EDGE, Math.min(W - EDGE - bubbleW, cx - bubbleW / 2));
    const below = anchor.y < H * 0.6;
    const arrowLeft = Math.max(14, Math.min(bubbleW - 14, cx - left)) - 6;
    return below
      ? { box: { left, top: anchor.y + anchor.h + GAP }, arrow: { top: -5, left: arrowLeft } }
      : { box: { left, bottom: H - anchor.y + GAP }, arrow: { bottom: -5, left: arrowLeft } };
  })();

  return (
    <>
      <Pressable
        ref={ref}
        onPress={open}
        onLongPress={open}
        hitSlop={12}
        style={({ pressed }) => [s.icon, style, pressed && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel={title ? `About ${title}` : 'More info'}
        accessibilityHint={text}
      >
        <Ionicons name="information-circle-outline" size={size} color={COLORS.textLabel} />
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
          {place && (
            <Animated.View entering={enterBubble} style={[s.bubble, { width: bubbleW }, place.box]}>
              <View style={[s.arrow, place.arrow]} />
              {title ? <Text style={s.title}>{title}</Text> : null}
              <Text style={s.text}>{text}</Text>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const s = themed(() => StyleSheet.create({
  icon:   { alignItems: 'center', justifyContent: 'center' },
  bubble: {
    position: 'absolute', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    backgroundColor: COLORS.text,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  arrow:  { position: 'absolute', width: 12, height: 12, backgroundColor: COLORS.text, transform: [{ rotate: '45deg' }] },
  title:  { fontSize: 14, fontFamily: FONTS.headline, color: COLORS.background, marginBottom: 3 },
  text:   { fontSize: 14, fontFamily: FONTS.body, color: COLORS.background, lineHeight: 20 },
}));
