import React from 'react';
import { Modal as RNModal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassView } from './GlassView';
import { BORDER_RADIUS, SPACING, COLORS } from '../../constants';

interface Props { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; }

export function Modal({ visible, title, onClose, children }: Props) {
  return (
    <RNModal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={s.overlay}>
        <GlassView opacity='mid' radius={BORDER_RADIUS.xl} style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><Text style={s.close}>x</Text></TouchableOpacity>
          </View>
          {children}
        </GlassView>
      </View>
    </RNModal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  sheet:   { width: '100%', padding: SPACING.lg },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title:   { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  close:   { fontSize: 18, color: COLORS.textSecondary, padding: SPACING.xs },
});