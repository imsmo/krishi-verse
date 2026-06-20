// packages/ui-native/src/components/OfflineBanner.tsx · a thin status strip shown when the device is offline.
// Presentational only — the app passes `visible` (from the connectivity store) + a localized message. Tokens-only,
// announced to screen readers. Reassures the farmer that queued work will sync, not that it's lost (Law 12).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '../theme';

export function OfflineBanner({ visible, message, testID }: { visible: boolean; message: string; testID?: string }) {
  if (!visible) return null;
  return (
    <View style={styles.bar} accessibilityLiveRegion="polite" accessibilityRole="alert" testID={testID}>
      <Text style={styles.text} numberOfLines={2}>📴 {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.ink700, paddingVertical: space[2], paddingHorizontal: space[4] },
  text: { fontFamily: font.body, fontSize: font.size.sm, color: color.white, textAlign: 'center' },
});
