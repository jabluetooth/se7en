import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireHaptic } from '../../motion/AnimatedPressable';
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

/**
 * The app's one segmented control: a quiet grey track with the chosen option
 * raised on a surface. No accent fill, so it never competes with the data or
 * the primary button on the same screen.
 */
export function Segmented<T extends string>({ options, value, onChange, stretch, style, a11yLabel }: Props<T>) {
  return (
    <View style={[s.track, stretch && s.stretch, style]} accessibilityRole="tablist" accessibilityLabel={a11yLabel}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { if (!on) { fireHaptic('selection'); onChange(o.value); } }}
            style={[s.item, stretch && { flex: 1 }, on && s.itemOn]}
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
  item:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  itemOn:  {
    backgroundColor: COLORS.surfaceElevated,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  txt:     { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textMuted },
  txtOn:   { fontFamily: FONTS.semibold, color: COLORS.text },
}));
