// apps/mobile/src/app/(owner)/payouts.tsx · screen 80 (payouts monitor). Thin screen (guide §3): a read-only
// monitor of payouts (money-OUT) — amounts are bigint paise via MoneyText (Law 2); the app never moves money
// (Law 11), this only reflects server state. Behind `tenant_admin_lite`. Keyset; degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { PayoutSummary } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { tenantPayouts } from '../../features/tenant/tenant.api';
import { statusTone } from '../../features/wallet/txn';

export default function Payouts() {
  const { t, lang } = useTranslation();
  const enabled = useFlag('tenant_admin_lite');
  const [items, setItems] = useState<PayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await tenantPayouts(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.tabs.payouts')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.tabs.payouts')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('owner.payouts.empty.title')} message={t('owner.payouts.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <MoneyText minor={item.amountMinor} langCode={lang} size="md" />
                <StatusPill label={t(`owner.payoutStatus.${item.status}`)} tone={statusTone(item.status)} />
              </View>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
