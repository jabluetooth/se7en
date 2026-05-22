import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarTheme } from '../components/CoachAvatar/CoachAvatar';

const KEY = '@se7en_coach_theme';

export function useCoachTheme(): [AvatarTheme, (t: AvatarTheme) => void] {
  const [theme, setThemeState] = useState<AvatarTheme>('classic');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === 'classic' || v === 'cool' || v === 'glow') setThemeState(v);
    });
  }, []);

  const setTheme = (t: AvatarTheme) => {
    setThemeState(t);
    AsyncStorage.setItem(KEY, t).catch(() => {});
  };

  return [theme, setTheme];
}
