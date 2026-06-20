// packages/ui-native/src/components/Button.tsx · the primary action control. Variants map to the design system
// (primary green / accent gold / outline / ghost / danger). Always ≥ HIT_TARGET tall, shows a spinner while
// `loading` (and is then non-interactive), and exposes accessibility props. No hardcoded colors — tokens only.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { color, font, radius, space, HIT_TARGET } from '../theme';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}

const BG: Record<ButtonVariant, string> = {
  primary: color.primary600, accent: color.accent500, outline: color.transparent,
  ghost: color.transparent, danger: color.danger,
};
const FG: Record<ButtonVariant, string> = {
  primary: color.white, accent: color.ink900, outline: color.primary700,
  ghost: color.primary700, danger: color.white,
};

export function Button({ title, onPress, variant = 'primary', size = 'lg', disabled, loading, fullWidth = true, leftIcon, testID, style }: ButtonProps) {
  const inert = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BG[variant], minHeight: size === 'lg' ? HIT_TARGET + 4 : HIT_TARGET, alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        variant === 'outline' && styles.outline,
        inert && styles.inert,
        pressed && !inert && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.row}>
          {leftIcon}
          <Text style={[styles.label, { color: FG[variant] }]} numberOfLines={1}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, paddingHorizontal: space[5], alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1.5, borderColor: color.primary600 },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold },
});
