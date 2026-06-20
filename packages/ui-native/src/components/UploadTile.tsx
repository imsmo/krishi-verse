// packages/ui-native/src/components/UploadTile.tsx · a square photo tile showing the local thumbnail with an
// upload state overlay: uploading (progress bar), queued (offline badge), failed (retry), or done. Presentational
// only — the screen passes the state + callbacks; the actual upload lives in core/media. Tokens-only, a11y.
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space } from '../theme';
import { ProgressBar } from './ProgressBar';

export type UploadStatus = 'uploading' | 'queued' | 'failed' | 'done';

export interface UploadTileProps {
  uri: string;
  status: UploadStatus;
  progress?: number;        // 0..1 when uploading
  queuedLabel?: string;     // localized "Will upload when online"
  retryLabel?: string;      // localized "Retry"
  removeLabel?: string;     // localized a11y label for remove
  onRetry?: () => void;
  onRemove?: () => void;
  size?: number;
  testID?: string;
}

export function UploadTile({ uri, status, progress = 0, queuedLabel, retryLabel, removeLabel = 'Remove', onRetry, onRemove, size = 96, testID }: UploadTileProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID={testID}>
      <Image source={{ uri }} style={styles.img} accessibilityIgnoresInvertColors />
      {status === 'uploading' && (
        <View style={[styles.overlay, styles.bottom]}><ProgressBar value={progress} /></View>
      )}
      {status === 'queued' && (
        <View style={[styles.overlay, styles.center]}><Text style={styles.badge}>⏳</Text>{queuedLabel ? <Text style={styles.smallText}>{queuedLabel}</Text> : null}</View>
      )}
      {status === 'failed' && (
        <Pressable style={[styles.overlay, styles.center, styles.failed]} onPress={onRetry} accessibilityRole="button" accessibilityLabel={retryLabel ?? 'Retry'}>
          <Text style={styles.retry}>↻ {retryLabel ?? 'Retry'}</Text>
        </Pressable>
      )}
      {onRemove && (
        <Pressable style={styles.remove} onPress={onRemove} accessibilityRole="button" accessibilityLabel={removeLabel} hitSlop={8}>
          <Text style={styles.removeX}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.ink100 },
  img: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', left: 0, right: 0, padding: space[1] },
  bottom: { bottom: 0 },
  center: { top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: color.overlay },
  failed: { backgroundColor: 'rgba(192,57,43,0.55)' },
  badge: { fontSize: font.size.lg },
  smallText: { fontFamily: font.body, fontSize: font.size.xs, color: color.white, textAlign: 'center', marginTop: 2 },
  retry: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.white },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: radius.pill, backgroundColor: color.overlay, alignItems: 'center', justifyContent: 'center' },
  removeX: { color: color.white, fontSize: 14, fontWeight: '700' },
});
