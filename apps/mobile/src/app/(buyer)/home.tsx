// apps/mobile/src/app/(buyer)/home.tsx · screen 13 (buyer home). Thin screen (guide §3): a tap-through search bar
// (→ Search) + a fresh-produce browse feed (newest listings) via the shared BrowseList. Behind `buyer_app`.
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { buildListingQuery } from '../../features/buyer/search-query';
import { BrowseList } from '../../features/buyer/components/BrowseList';

export default function BuyerHome() {
  const { t } = useTranslation();
  const router = useRouter();

  const SearchBar = (
    <Pressable onPress={() => router.push('/(buyer)/search')} style={styles.search} accessibilityRole="search" accessibilityLabel={t('buyer.searchHint')}>
      <Text style={styles.searchGlyph}>🔍</Text>
      <Text style={styles.searchText}>{t('buyer.searchHint')}</Text>
    </Pressable>
  );

  return (
    <ScreenScaffold title={t('buyer.home.title')} scroll={false}>
      <BrowseList query={buildListingQuery({ sort: 'newest' })} ListHeader={<View style={{ marginBottom: space[3] }}>{SearchBar}</View>}
        emptyTitle={t('buyer.empty.title')} emptyMessage={t('buyer.empty.message')} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingHorizontal: space[4], borderRadius: radius.pill, backgroundColor: color.ink50, borderWidth: 1, borderColor: color.ink200 },
  searchGlyph: { fontSize: 18 },
  searchText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
});
