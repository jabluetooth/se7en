import React from 'react';
import { Badge, BadgeVariant } from './Badge';
import { SET_TYPE_LABELS, SET_TYPE_VARIANTS } from '../../constants';
import { SetType } from '../../types';

interface Props { type: SetType; size?: 'xs' | 'sm'; }

export function SetTypeBadge({ type, size = 'xs' }: Props) {
  const label   = SET_TYPE_LABELS[type] ?? type;
  const variant = (SET_TYPE_VARIANTS[type] ?? 'neutral') as BadgeVariant;
  return <Badge label={label} variant={variant} size={size} />;
}