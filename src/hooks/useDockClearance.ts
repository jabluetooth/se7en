import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Vertical space the floating dock occupies, including its own padding and the
// device's bottom safe area. Use this as the `paddingBottom` of any ScrollView
// (or as a trailing spacer's height) so the last item clears the dock with a
// small breathing gap instead of sitting flush behind it.
//
// Math: FloatingDock height (72) + wrapper bottom margin (8) + insets.bottom
// + 16px breathing room between last content and the dock's top edge.
const DOCK_HEIGHT      = 72;
const WRAPPER_PADDING  = 8;
const BREATHING        = 16;

export function useDockClearance() {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + WRAPPER_PADDING + insets.bottom + BREATHING;
}
