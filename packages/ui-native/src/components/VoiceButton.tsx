// packages/ui-native/src/components/VoiceButton.tsx · the "Speak to sell" mic affordance (Phase-1's marquee
// voice-first action for low-literacy farmers). Pulses while `listening`. This component is presentation +
// interaction only — the actual STT lives in the app's core/voice layer; the screen wires onPress/onStop to it.
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space, HIT_TARGET } from '../theme';

export interface VoiceButtonProps {
  label: string;
  hint?: string;
  listening?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function VoiceButton({ label, hint, listening, onPress, testID }: VoiceButtonProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!listening) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!listening }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.mic, listening && styles.micLive, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.icon}>🎙️</Text>
      </Animated.View>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  pressed: { opacity: 0.85 },
  mic: { width: HIT_TARGET + 8, height: HIT_TARGET + 8, borderRadius: radius.pill, backgroundColor: color.primary600, alignItems: 'center', justifyContent: 'center' },
  micLive: { backgroundColor: color.danger },
  icon: { fontSize: 24 },
  labels: { flex: 1 },
  label: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  hint: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
});
