// packages/ui-native/src/components/SegmentedControl.tsx · a single-choice selector used wherever the design has
// a short option set (the 05-profile-setup "Farm Size" select, filter chips, etc.). Two layouts: 'row' (equal
// pills side-by-side) and 'stack' (full-width rows with a check when selected). Tokens-only, ≥48px targets,
// a11y radiogroup semantics. Presentational — the screen owns the value/onChange.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { color, font, space, radius } from '../theme';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** 'row' = equal pills in a line; 'stack' = full-width rows (good for long labels). Default 'row'. */
  layout?: 'row' | 'stack';
  /** Group label for screen readers. */
  accessibilityLabel?: string;
}

export function SegmentedControl({ options, value, onChange, layout = 'row', accessibilityLabel }: SegmentedControlProps) {
  const stack = layout === 'stack';
  return (
    <View
      style={stack ? styles.stack : styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              stack ? styles.stackItem : styles.rowItem,
              active && styles.itemActive,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {stack && active ? <Icon name="check" size={18} color={color.primary600} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const baseItem = {
  minHeight: 48,
  borderWidth: 1.5,
  borderColor: color.earth200,
  backgroundColor: color.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2] },
  rowItem: { ...baseItem, flex: 1, flexDirection: 'row', paddingHorizontal: space[2], borderRadius: radius.md },
  stack: { gap: space[2] },
  stackItem: { ...baseItem, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[4], borderRadius: radius.md },
  itemActive: { borderColor: color.primary600, backgroundColor: color.primary50 },
  label: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700 },
  labelActive: { color: color.primary700 },
});
