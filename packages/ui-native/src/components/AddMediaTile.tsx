// packages/ui-native/src/components/AddMediaTile.tsx · the "+ add photo" affordance (dashed square) shown in a
// media grid. Presentational; the screen wires onPress to the camera/gallery chooser in core/media. ≥48px, a11y.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { color, font, radius } from '../theme';

export interface AddMediaTileProps { label: string; onPress: () => void; disabled?: boolean; size?: number; testID?: string }

export function AddMediaTile({ label, onPress, disabled, size = 96, testID }: AddMediaTileProps) {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.plus}>＋</Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.md, borderWidth: 1.5, borderColor: color.ink200, borderStyle: 'dashed', backgroundColor: color.ink50, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  plus: { fontSize: 28, color: color.primary600, lineHeight: 30 },
  label: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500 },
});
