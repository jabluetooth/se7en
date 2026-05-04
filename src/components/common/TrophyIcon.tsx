import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props { size?: number; color?: string; }
export function TrophyIcon({ size = 20, color = 'currentColor' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21h8M12 17v4M17 3H7v8a5 5 0 0010 0V3z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M17 5h2a2 2 0 010 4h-2M7 5H5a2 2 0 000 4h2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
}
