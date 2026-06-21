// apps/mobile/src/app/(buyer)/search.tsx · screen 67 (search results). Thin screen (guide §3): a debounced search
// box + the shared BrowseList over a ListingQuery built from the current filter form (pure search-query). A
// "Filters (N)" button opens the filter sheet (68) which returns its state via params; "Save search" persists the
// query on-device. Keyset paging + SWR cache (DoD: <2s on 3G). Behind `buyer_app`.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Input, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { buildListingQuery, activeFilterCount, describeSearch, type FilterForm, type SortKey } from '../../features/buyer/search-query';
import { addSavedSearch } from '../../features/buyer/saved.api';
import { BrowseList } from '../../features/buyer/components/BrowseList';

export default function BuyerSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  // Filters return via route params (set by the filters screen).
  const params = useLocalSearchParams<{ saleType?: string; organic?: string; priceMinRupees?: string; priceMaxRupees?: string; sort?: string }>();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q), 350); return () => clearTimeout(id); }, [q]);

  const form: FilterForm = {
    q: debouncedQ,
    saleType: params.saleType || undefined,
    organic: params.organic === '1',
    priceMinRupees: params.priceMinRupees || undefined,
    priceMaxRupees: params.priceMaxRupees || undefined,
    sort: (params.sort as SortKey) || undefined,
  };
  const filterN = activeFilterCount(form);

  const onSaveSearch = async () => {
    await addSavedSearch(describeSearch(form), form);
    Alert.alert(t('buyer.savedSearch.done'));
  };

  const Header = (
    <View style={{ gap: space[2], marginBottom: space[3] }}>
      <Input label={t('buyer.searchLabel')} value={q} onChangeText={setQ} autoFocus placeholder={t('buyer.searchHint')} />
      <View style={styles.bar}>
        <Pressable onPress={() => router.push({ pathname: '/(buyer)/filters', params })} style={styles.btn} accessibilityRole="button" accessibilityLabel={t('buyer.filters')}>
          <Text style={styles.btnText}>{filterN > 0 ? t('buyer.filtersN', { n: filterN }) : t('buyer.filters')}</Text>
        </Pressable>
        <Pressable onPress={onSaveSearch} style={styles.btn} accessibilityRole="button" accessibilityLabel={t('buyer.saveSearch')}>
          <Text style={styles.btnText}>{t('buyer.saveSearch')}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenScaffold title={t('buyer.tabs.search')} scroll={false}>
      <BrowseList query={buildListingQuery(form)} ListHeader={Header}
        emptyTitle={t('buyer.noResults.title')} emptyMessage={t('buyer.noResults.message')} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: space[2] },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.primary600, backgroundColor: color.primary50 },
  btnText: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary800 },
});
