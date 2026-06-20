// packages/ui-native/src/components/Card.tsx · the standard white surface used across screens (dashboard tiles,
// list rows, sheets). Soft token shadow + rounded corners; optional `onPress` turns it into an accessible
// tappable surface with a pressed state.
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { color, radius, shadow, space } from '../theme';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, padded = true, style, testID, accessibilityLabel }: CardProps) {
  const inner = [styles.card, padded && styles.padded, style];
  if (!onPress) return <View style={inner} testID={testID} accessibilityLabel={accessibilityLabel}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...inner, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.lg, ...shadow.card },
  padded: { padding: space[4] },
  pressed: { opacity: 0.9 },
});
