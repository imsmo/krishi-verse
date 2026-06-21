// apps/mobile/src/app/(farmer)/orders.tsx · the orders tab (screens 56 farmer-orders / 22 my-orders). Thin screen
// (guide §3): a Selling/Buying role switch → features/orders.listOrders (SWR-cached, keyset). Tap a row → detail.
// Money via MoneyText (Law 2). Degrade-never-die: empty/failed → friendly state, never a crash.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { OrderListItem, OrderRole } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { listOrders } from '../../features/orders/orders.api';
import { orderStatusTone } from '../../features/orders/order-status';

export default function Orders() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [role, setRole] = useState<OrderRole>('seller');
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setItems((await listOrders({ role })).items); setLoading(false); }, [role]);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  return (
    <ScreenScaffold title={t('tabs.orders')} scroll={false}>
      <View style={styles.tabs}>
        {(['seller', 'buyer'] as OrderRole[]).map((r) => {
          const active = role === r;
          return (
            <Pressable key={r} onPress={() => { setRole(r); setLoading(true); }} style={[styles.tab, active && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={[styles.tabText, active && styles.tabTextOn]}>{t(`orders.role.${r}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading ? <View style={{ gap: space[3], marginTop: space[3] }}><SkeletonCard /><SkeletonCard /></View> : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          style={{ marginTop: space[3] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          ListEmptyComponent={<EmptyState title={t('orders.empty.title')} message={t('orders.empty.message')} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/(farmer)/orders/[id]', params: { id: item.id, role } })} accessibilityLabel={t('orders.orderNo', { id: item.orderNo })}>
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
  tabs: { flexDirection: 'row', gap: space[2] },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space[2], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card, minHeight: 44, justifyContent: 'center' },
  tabOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  tabText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  tabTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
});
