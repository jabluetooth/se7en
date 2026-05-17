import React from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants';

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
    inputRange: [-DAY_ACTIONS_WIDTH, 0], outputRange: [0, DAY_ACTIONS_WIDTH], extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[sw.row, sw.rowRight, { transform: [{ translateX }] }]}>
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
  rowRight: { paddingRight: 16 },
  editBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, marginRight: 6 },
  editTxt:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.danger, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  clearTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Swipe-RIGHT action: Done button ─────────────────────────────────────────

const DONE_ACTION_WIDTH = 120;

export function DoneAction({
  dragX, onPress,
}: {
  dragX:   Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}) {
  const translateX = dragX.interpolate({
    inputRange: [0, DONE_ACTION_WIDTH], outputRange: [-DONE_ACTION_WIDTH, 0], extrapolate: 'clamp',
  });
  return (
    <Animated.View style={[sd.wrap, { transform: [{ translateX }] }]}>
      <TouchableOpacity style={sd.btn} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="checkmark-circle" size={18} color="#000" />
        <Text style={sd.txt}>Done</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sd = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 10, marginBottom: 8 },
  btn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#34D399', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14 },
  txt:  { fontSize: 13, fontWeight: '800', color: '#000' },
});
