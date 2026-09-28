import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../components/FloatingDock/FloatingDock';

// Vertical space the tab bar occupies, including the device's bottom safe
// area, plus a little breathing room. Use it as the `paddingBottom` of any
// ScrollView (or a trailing spacer's height) so the last item clears the bar.
const BREATHING = 20;

export function useDockClearance() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + BREATHING;
}
