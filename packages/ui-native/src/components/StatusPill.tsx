// packages/ui-native/src/components/StatusPill.tsx · a small colored chip for entity states (listing active,
// order placed, KYC pending, …). `tone` selects a semantic ramp; the label is provided by the caller (already
// localized). Pure presentational.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space } from '../theme';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const BG: Record<PillTone, string> = {
  neutral: color.ink100, success: color.successLight, warning: color.warningLight,
  danger: color.dangerLight, info: color.infoLight, accent: color.accent100,
};
const FG: Record<PillTone, string> = {
  neutral: color.ink600, success: color.successDark, warning: color.warningDark,
  danger: color.dangerDark, info: color.infoDark, accent: color.accent800,
};

export function StatusPill({ label, tone = 'neutral', testID }: { label: string; tone?: PillTone; testID?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: BG[tone] }]} testID={testID}>
      <Text style={[styles.text, { color: FG[tone] }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.pill },
  text: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, textTransform: 'capitalize' },
});
