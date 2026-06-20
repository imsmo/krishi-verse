// packages/ui-native/src/components/EmptyState.tsx · the friendly "nothing here / something went wrong" panel.
// Used by every list when data is empty OR when a degrade-never-die fallback kicks in (Law 12) — so a flaky API
// shows this, never a crash. Optional action (e.g. "Retry" / "Create your first listing").
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '../theme';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({ title, message, icon, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}><Button title={actionLabel} onPress={onAction} variant="outline" fullWidth={false} /></View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: space[10], paddingHorizontal: space[6], gap: space[2] },
  icon: { marginBottom: space[2] },
  title: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink700, textAlign: 'center' },
  message: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, textAlign: 'center' },
  action: { marginTop: space[4] },
});
