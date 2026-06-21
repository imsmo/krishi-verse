// apps/mobile/src/app/(buyer)/saved.tsx · screens 126/127/128 (saved listings / searches / sellers) in one screen
// with sub-tabs. Thin screen (guide §3): reads the on-device saved lists (saved.api) on focus and renders them.
// Tapping a saved search re-applies it (→ Search with params); listings/sellers deep-link to their detail. All
// saves are local-until-server (flagged). Behind `buyer_app`. Degrade-never-die: empty → friendly state.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { BuyerListingCard } from '../../features/buyer/components/BuyerListingCard';
import { getSavedListings, toggleSavedListing, getSavedSellers, getSavedSearches, removeSavedSearch, type SavedSearch } from '../../features/buyer/saved.api';

type Tab = 'listings' | 'searches' | 'sellers';

export default function SavedScreen() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('buyer_app');
  const [tab, setTab] = useState<Tab>('listings');
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [sellers, setSellers] = useState<string[]>([]);

  const load = useCallback(async () => {
    setListings(await getSavedListings()); setSearches(await getSavedSearches()); setSellers(await getSavedSellers());
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) load(); }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('buyer.tabs.saved')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const unsaveListing = async (card: ListingCard) => setListings(await toggleSavedListing(card));
  const applySearch = (s: SavedSearch) => router.push({ pathname: '/(buyer)/search', params: {
    saleType: s.form.saleType || undefined, organic: s.form.organic ? '1' : undefined,
    priceMinRupees: s.form.priceMinRupees || undefined, priceMaxRupees: s.form.priceMaxRupees || undefined, sort: s.form.sort,
  } });
  const dropSearch = async (id: string) => setSearches(await removeSavedSearch(id));

  return (
    <ScreenScaffold title={t('buyer.tabs.saved')} scroll={false}>
      <View style={styles.tabs}>
        {(['listings', 'searches', 'sellers'] as Tab[]).map((tb) => {
          const active = tab === tb;
          return (
            <Pressable key={tb} onPress={() => setTab(tb)} style={[styles.tab, active && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={[styles.tabText, active && styles.tabTextOn]}>{t(`buyer.saved.${tb}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'listings' ? (
        <FlatList
          data={listings} keyExtractor={(l) => l.id} style={{ marginTop: space[3] }}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('buyer.saved.empty.listings')} />}
          renderItem={({ item }) => (
            <BuyerListingCard card={item} langCode={lang} saved
              onPress={() => router.push({ pathname: '/(buyer)/listings/[id]', params: { id: item.id } })}
              onToggleSave={() => unsaveListing(item)} saveLabel={t('buyer.unsave')} />
          )}
        />
      ) : tab === 'searches' ? (
        <FlatList
          data={searches} keyExtractor={(s) => s.id} style={{ marginTop: space[3] }}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('buyer.saved.empty.searches')} />}
          renderItem={({ item }) => (
            <Card onPress={() => applySearch(item)} accessibilityLabel={item.label}>
              <View style={styles.row}>
                <Text style={styles.rowText} numberOfLines={1}>{item.label}</Text>
                <Pressable onPress={() => dropSearch(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}><Text style={styles.remove}>✕</Text></Pressable>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={sellers} keyExtractor={(s) => s} style={{ marginTop: space[3] }}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          ListEmptyComponent={<EmptyState title={t('buyer.saved.empty.sellers')} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/(buyer)/seller/[id]', params: { id: item } })} accessibilityLabel={t('seller.title')}>
              <Text style={styles.rowText}>{t('seller.shortId', { id: item.slice(0, 8) })}</Text>
            </Card>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space[2] },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  tabOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  tabText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  tabTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  rowText: { flex: 1, fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  remove: { fontSize: 18, color: color.ink400 },
});
