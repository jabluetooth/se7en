import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { fireHaptic } from '../../motion/AnimatedPressable';
import { TIMING } from '../../motion/tokens';
import { COLORS, FONTS } from '../../constants';
import { ink, themed } from '../../theme/runtime';

interface Props<T extends string> {
  options:  readonly { value: T; label: string }[];
  value:    T;
  onChange: (v: T) => void;
  /** Stretch to fill the row (Progress) or hug the labels (settings rows). */
  stretch?: boolean;
  style?:   StyleProp<ViewStyle>;
  a11yLabel?: string;
}

interface Box { x: number; w: number }

/**
 * The app's one segmented control: a quiet grey track with the chosen option
 * raised on a surface that glides to the option you tap. No accent fill, so
 * it never competes with the data or the primary button on the same screen.
 */
export function Segmented<T extends string>({ options, value, onChange, stretch, style, a11yLabel }: Props<T>) {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = Object.keys(boxes).length === options.length;
  const target = boxes[value];

  // First placement jumps; after that the thumb slides.
  const placed = useSharedValue(false);
  useEffect(() => {
    if (!target) return;
    if (!placed.value) {
      x.value = target.x;
      w.value = target.w;
      placed.value = true;
      return;
    }
    x.value = withTiming(target.x, TIMING.standard);
    w.value = withTiming(target.w, TIMING.standard);
  }, [target?.x, target?.w]);

  const thumb = useAnimatedStyle(() => ({
    opacity: placed.value ? 1 : 0,
    width: w.value,
    transform: [{ translateX: x.value }],
  }));

  const onItemLayout = (v: T) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setBoxes(prev => (prev[v]?.x === lx && prev[v]?.w === width ? prev : { ...prev, [v]: { x: lx, w: width } }));
  };

  return (
    <View style={[s.track, stretch && s.stretch, style]} accessibilityRole="tablist" accessibilityLabel={a11yLabel}>
      <Animated.View pointerEvents="none" style={[s.thumb, thumb]} />
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onLayout={onItemLayout(o.value)}
            onPress={() => { if (!on) { fireHaptic('selection'); onChange(o.value); } }}
            style={[s.item, stretch && { flex: 1 }, on && !ready && s.itemOn]}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.txt, on && s.txtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  track:   { flexDirection: 'row', padding: 3, borderRadius: 11, backgroundColor: ink(0.06) },
  stretch: { alignSelf: 'stretch' },
  thumb:   {
    position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: 9,
    backgroundColor: COLORS.surfaceElevated,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  item:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  itemOn:  { backgroundColor: COLORS.surfaceElevated },
  txt:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  txtOn:   { fontFamily: FONTS.semibold, color: COLORS.text },
}));
