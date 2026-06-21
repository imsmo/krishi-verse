// apps/mobile/src/app/(system)/server-error.tsx · screen 189 (server-error fallback). Thin screen (guide §3): a
// friendly 5xx/unknown-error state with retry — the global fallback so a failed call NEVER white-screens (Law 12).
// Static, no backend. An optional `?ref=` request id (from the SDK error) is shown for support, never any PII.
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';

export default function ServerError() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  return (
    <ScreenScaffold title={t('system.error.title')}>
      <EmptyState title={t('system.error.heading')} message={t('system.error.message')} actionLabel={t('common.retry')} onAction={() => router.back()} />
      {ref ? <View style={styles.refBox}><Text style={styles.ref}>{t('system.error.ref', { ref })}</Text></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  refBox: { marginTop: space[3], alignItems: 'center' },
  ref: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
});
