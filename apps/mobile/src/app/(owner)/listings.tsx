// apps/mobile/src/app/(owner)/listings.tsx · screen 79 (tenant listings monitor). Thin screen (guide §3): a
// read-only monitor of the tenant's published listings (tenant-scoped server-side). Money via MoneyText (Law 2).
// Behind `tenant_admin_lite`. Keyset; degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { tenantListings } from '../../features/tenant/tenant.api';

export default function Listings() {
  const { t, lang } = useTranslation();
  const enabled = useFlag('tenant_admin_lite');
  const [items, setItems] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await tenantListings(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.tabs.listings')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.tabs.listings')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('owner.listings.empty.title')} message={t('owner.listings.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <MoneyText minor={item.priceMinor} currencyCode={item.currencyCode} langCode={lang} size="md" />
              </View>
              <View style={[styles.row, { marginTop: space[1] }]}>
                <Text style={styles.meta}>{t('owner.listings.qty', { n: String(item.quantityAvailable), unit: item.unitCode })}</Text>
                {item.status ? <StatusPill label={item.status} tone="neutral" /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  title: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
});
