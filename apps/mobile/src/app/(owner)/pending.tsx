// apps/mobile/src/app/(owner)/pending.tsx · screen 07 (application pending). Thin screen (guide §3): reflects the
// tenant's current subscription status while activation is pending (server-owned). Behind `tenant_admin_lite`.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Subscription } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { currentSubscription } from '../../features/tenant/tenant.api';
import { subscriptionTone, needsToApply } from '../../features/tenant/tenant-admin';

export default function Pending() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setSub(await currentSubscription()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.pending.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.pending.title')}>
      {loading ? <SkeletonCard lines={3} /> : needsToApply(sub) ? (
        <EmptyState title={t('owner.pending.none.title')} message={t('owner.pending.none.message')} actionLabel={t('owner.apply.cta')} onAction={() => router.replace('/(owner)/apply')} />
      ) : (
        <Card>
          <Text style={styles.h}>{t('owner.pending.heading')}</Text>
          <View style={styles.row}>
            <Text style={styles.k}>{t('owner.subscription')}</Text>
            <StatusPill label={t(`owner.subStatus.${sub!.status}`)} tone={subscriptionTone(sub!.status)} />
          </View>
          <Text style={styles.body}>{t('owner.pending.body')}</Text>
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space[2] },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginTop: space[1] },
});
