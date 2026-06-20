// apps/mobile/src/app/(farmer)/orders.tsx · the farmer's orders tab. Thin screen (guide §3): calls
// features/orders/orders.api → renders. Money via MoneyText. Degrade-never-die: empty/failed → EmptyState.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { sellerOrders, type OrderRow } from '../../features/orders/orders.api';

const TONE: Record<string, PillTone> = { placed: 'info', confirmed: 'success', shipped: 'accent', delivered: 'success', cancelled: 'danger' };

export default function Orders() {
  const { t, lang } = useTranslation();
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const page = await sellerOrders(undefined, 30);
    setItems(page.items);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  return (
    <ScreenScaffold title={t('tabs.orders')} scroll={false}>
      {loading ? <View style={{ gap: space[3] }}><SkeletonCard /><SkeletonCard /></View> : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          ListEmptyComponent={<EmptyState title={t('orders.empty.title')} message={t('orders.empty.message')} />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <Text style={styles.id}>{t('orders.orderNo', { id: item.id.slice(0, 8) })}</Text>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MoneyText minor={item.totalMinor} currencyCode={item.currencyCode} langCode={lang} />
                  <StatusPill label={item.status} tone={TONE[item.status] ?? 'neutral'} />
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
