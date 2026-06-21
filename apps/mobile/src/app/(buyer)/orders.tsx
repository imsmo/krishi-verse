// apps/mobile/src/app/(buyer)/orders.tsx · screens 22/69 (buyer orders). Thin screen (guide §3): the buyer's order
// history via the SHARED features/orders.listOrders (role=buyer, keyset, SWR-cached). Tap → buyer order detail.
// Money via MoneyText (Law 2). Behind `buyer_app`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { OrderListItem } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { listOrders } from '../../features/orders/orders.api';
import { orderStatusTone } from '../../features/orders/order-status';

export default function BuyerOrders() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('buyer_app');
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setItems((await listOrders({ role: 'buyer' })).items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  if (!enabled) return <ScreenScaffold title={t('tabs.orders')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('tabs.orders')} scroll={false}>
      {loading ? <View style={{ gap: space[3] }}><SkeletonCard /><SkeletonCard /></View> : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          ListEmptyComponent={<EmptyState title={t('buyer.orders.empty.title')} message={t('buyer.orders.empty.message')} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/(buyer)/orders/[id]', params: { id: item.id } })} accessibilityLabel={t('orders.orderNo', { id: item.orderNo })}>
              <View style={styles.row}>
                <Text style={styles.id}>{t('orders.orderNo', { id: item.orderNo })}</Text>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MoneyText minor={item.totalMinor} langCode={lang} />
                  <StatusPill label={t(`orders.status.${item.status}`)} tone={orderStatusTone(item.status)} />
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
});
