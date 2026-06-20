// packages/ui-native/src/components/Toggle.tsx · a labelled on/off switch row (RN Switch tinted with tokens).
// Used by notification preferences + settings. Accessible (the native Switch carries the switch role/state); the
// row label is associated for screen readers.
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { color, font, space } from '../theme';

export interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
  testID?: string;
}

export function Toggle({ label, value, onValueChange, hint, disabled, testID }: ToggleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: color.ink200, true: color.primary300 }}
        thumbColor={value ? color.primary600 : color.ink50}
        ios_backgroundColor={color.ink200}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[3], minHeight: 48, gap: space[3] },
  labels: { flex: 1 },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  hint: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },
});
