import React from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../../constants';

// ─── Swipe-LEFT actions: Edit / Clear (revealed from the right edge) ─────────

const DAY_ACTIONS_WIDTH = 200;

export function SwipeActions({
  dragX, onEdit, onClear,
}: {
  dragX:   Animated.AnimatedInterpolation<number>;
  onEdit:  () => void;
  onClear: () => void;
}) {
  const translateX = dragX.interpolate({
    inputRange:  [-DAY_ACTIONS_WIDTH, -DAY_ACTIONS_WIDTH * 0.5, 0],
    outputRange: [0, DAY_ACTIONS_WIDTH * 0.18, DAY_ACTIONS_WIDTH],
    extrapolate: 'clamp',
  });

  const opacity = dragX.interpolate({
    inputRange:  [-DAY_ACTIONS_WIDTH, -DAY_ACTIONS_WIDTH * 0.4, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[sw.row, sw.rowRight, { transform: [{ translateX }], opacity }]}>
      <TouchableOpacity style={sw.editBtn} onPress={onEdit} activeOpacity={0.8}>
        <Ionicons name="pencil" size={16} color="#fff" />
        <Text style={sw.editTxt}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sw.clearBtn} onPress={onClear} activeOpacity={0.8}>
        <Ionicons name="trash-outline" size={16} color="#fff" />
        <Text style={sw.clearTxt}>Clear</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sw = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rowRight: { paddingLeft: 10, paddingRight: 16 },
  editBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginRight: 6 },
  editTxt:  { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  clearTxt: { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: '#fff' },
});

// ─── Swipe-RIGHT action: Done button ─────────────────────────────────────────

const DONE_ACTION_WIDTH = 126;

export function DoneAction({
  dragX, onPress,
}: {
  dragX:   Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}) {
  // 3-point ease-out: button accelerates quickly then decelerates into place,
  // matching the natural feel of the card's momentum.
  const translateX = dragX.interpolate({
    inputRange:  [0, DONE_ACTION_WIDTH * 0.5, DONE_ACTION_WIDTH],
    outputRange: [-DONE_ACTION_WIDTH, -DONE_ACTION_WIDTH * 0.18, 0],
    extrapolate: 'clamp',
  });

  // Fade in as the button enters — fully opaque only in the last 40% of drag.
  const opacity = dragX.interpolate({
    inputRange:  [0, DONE_ACTION_WIDTH * 0.4, DONE_ACTION_WIDTH],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[sd.row, sd.rowLeft, { transform: [{ translateX }], opacity }]}>
      <TouchableOpacity style={sd.btn} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="checkmark-circle" size={18} color="#000" />
        <Text style={sd.txt}>Done</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sd = StyleSheet.create({
  row:     { width: DONE_ACTION_WIDTH, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  rowLeft: { paddingRight: 10 },
  btn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#34D399', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  txt:     { fontSize: 13, fontWeight: '700', fontFamily: FONTS.headline, color: '#000' },
});
