// packages/ui-native/src/components/ProgressBar.tsx · a determinate progress bar (0..1). Tokens-only,
// accessible (progressbar role + value). Used by UploadTile and any long-running action.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius } from '../theme';

export function ProgressBar({ value, testID }: { value: number; testID?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.track}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.pill, backgroundColor: color.ink100, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: color.primary600 },
});
