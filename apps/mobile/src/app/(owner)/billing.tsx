// apps/mobile/src/app/(owner)/billing.tsx · screen 85 (billing). Thin screen (guide §3): the tenant's REAL current
// subscription (plan/status/period/price) — money via MoneyText (Law 2). Changing the plan / payment method is
// heavy editing → web console handoff. Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Subscription } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { currentSubscription } from '../../features/tenant/tenant.api';
import { subscriptionTone, needsToApply } from '../../features/tenant/tenant-admin';
import { openWebConsole } from '../../core/deeplink';
import { WEB_PATHS } from '../../features/tenant/web-console';

export default function Billing() {
  const { t, lang } = useTranslation();
  const enabled = useFlag('tenant_admin_lite');
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { setSub(await currentSubscription()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.billing.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const manage = async () => { setBusy(true); try { const ok = await openWebConsole(WEB_PATHS.billing); if (!ok) Alert.alert(t('owner.billing.title'), t('owner.web.unavailable')); } finally { setBusy(false); } };

  return (
    <ScreenScaffold title={t('owner.billing.title')} footer={<Button title={t('owner.billing.manage')} variant="outline" loading={busy} onPress={manage} />}>
      {loading ? <SkeletonCard lines={4} /> : needsToApply(sub) ? (
        <EmptyState title={t('owner.billing.none.title')} message={t('owner.billing.none.message')} />
      ) : (
        <Card>
          <View style={styles.row}>
            <Text style={styles.k}>{t('owner.subscription')}</Text>
            <StatusPill label={t(`owner.subStatus.${sub!.status}`)} tone={subscriptionTone(sub!.status)} />
          </View>
          <View style={[styles.row, { marginTop: space[2] }]}>
            <Text style={styles.k}>{t('owner.billing.price')}</Text>
            <MoneyText minor={sub!.priceMinor} currencyCode={sub!.currencyCode} langCode={lang} size="md" />
          </View>
          <Row k={t('owner.billing.cycle')} v={t(`owner.cycle.${sub!.billingCycle}`, { defaultValue: sub!.billingCycle })} />
          {sub!.currentPeriodEnd ? <Row k={t('owner.billing.renews')} v={safeDate(sub!.currentPeriodEnd, lang)} /> : null}
        </Card>
      )}
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>;
}
function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
