// packages/ui-native/src/components/SkeletonCard.tsx · loading placeholder shown while a list/detail fetch is in
// flight. A gentle opacity pulse via Animated (no external dep). Renders `lines` shimmer bars inside a card.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { color, radius, shadow, space } from '../theme';

export function SkeletonCard({ lines = 3, testID }: { lines?: number; testID?: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.card} testID={testID} accessibilityLabel="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View key={i} style={[styles.bar, { opacity: pulse, width: i === lines - 1 ? '55%' : '100%' }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.lg, padding: space[4], gap: space[3], ...shadow.card },
  bar: { height: 14, borderRadius: radius.sm, backgroundColor: color.ink100 },
});
