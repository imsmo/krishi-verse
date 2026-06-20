// apps/mobile/src/app/(farmer)/listings/index.tsx · screen 12 (My Listings). Lists the farmer's listings with a
// keyset "load more", money via MoneyText, and a status pill. Empty/failed → friendly EmptyState with a CTA to
// create the first listing (degrade-never-die). A floating + opens the create flow.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { myListings } from '../../../features/listings/listings.api';

const TONE: Record<string, PillTone> = { active: 'success', draft: 'neutral', sold: 'info', expired: 'warning', paused: 'warning' };

export default function MyListings() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [items, setItems] = useState<ListingCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (reset: boolean) => {
    const page = await myListings(reset ? undefined : cursor ?? undefined, 30);
    setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
    setCursor(page.nextCursor);
    setLoading(false);
  }, [cursor]);

  useFocusEffect(useCallback(() => { setLoading(true); load(true); }, [])); // refresh on tab focus
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(true); } finally { setRefreshing(false); } }, [load]);

  return (
    <ScreenScaffold title={t('listings.title')} scroll={false}>
      {loading ? (
        <View style={{ gap: space[3], paddingTop: space[2] }}><SkeletonCard /><SkeletonCard /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (cursor) load(false); }}
          ListEmptyComponent={
            <EmptyState
              title={t('listings.empty.title')}
              message={t('listings.empty.message')}
              actionLabel={t('listings.create')}
              onAction={() => router.push('/(farmer)/listings/new')}
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/(farmer)/listings/${item.id}`)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.meta}>{item.quantityAvailable} {item.unitCode}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MoneyText minor={item.priceMinor} currencyCode={item.currencyCode} langCode={lang} size="lg" />
                  <StatusPill label={item.saleType} tone={TONE[item.saleType] ?? 'neutral'} />
                </View>
              </View>
            </Card>
          )}
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/(farmer)/listings/new')} accessibilityLabel={t('listings.create')}>
        <Text style={styles.fabPlus}>＋</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  title: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },
  fab: { position: 'absolute', right: space[5], bottom: space[5], width: 60, height: 60, borderRadius: radius.pill, backgroundColor: color.primary600, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  fabPlus: { color: color.white, fontSize: 32, lineHeight: 36, fontWeight: '700' },
});
