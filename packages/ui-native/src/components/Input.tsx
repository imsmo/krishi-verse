// packages/ui-native/src/components/Input.tsx · labelled text field with an error slot. ≥ HIT_TARGET tall,
// large readable type (rural/outdoor audience), token colors, and an error border + message wired to
// accessibility. Controlled component — the screen owns the value.
import React from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { color, font, radius, space, HIT_TARGET } from '../theme';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  maxLength?: number;
  secureTextEntry?: boolean;
  error?: string;
  multiline?: boolean;
  testID?: string;
  editable?: boolean;
}

export function Input({ label, value, onChangeText, placeholder, keyboardType, autoFocus, maxLength, secureTextEntry, error, multiline, testID, editable = true }: InputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.ink300}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        editable={editable}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, !!error && styles.errorBorder, !editable && styles.disabled]}
      />
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  label: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink600 },
  input: {
    minHeight: HIT_TARGET, borderWidth: 1.5, borderColor: color.ink200, borderRadius: radius.md,
    paddingHorizontal: space[4], fontFamily: font.body, fontSize: font.size.lg, color: color.ink800, backgroundColor: color.white,
  },
  multiline: { minHeight: HIT_TARGET * 2, paddingTop: space[3], textAlignVertical: 'top' },
  errorBorder: { borderColor: color.danger },
  disabled: { backgroundColor: color.ink50, color: color.ink400 },
  error: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark },
});
