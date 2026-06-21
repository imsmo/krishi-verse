// apps/mobile/src/app/(buyer)/filters.tsx · screen 68 (search filters). Thin screen (guide §3): edit sale type /
// organic / price range / sort, then "Apply" returns to Search with the state as route params (the pure
// search-query builder turns them into a ListingQuery). Money inputs are whole rupees → paise server-side (Law 2).
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Toggle, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import type { SortKey } from '../../features/buyer/search-query';

const SALE_TYPES = ['', 'direct', 'auction', 'preorder'] as const;
const SORTS: SortKey[] = ['newest', 'price_asc', 'price_desc'];

export default function BuyerFilters() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ saleType?: string; organic?: string; priceMinRupees?: string; priceMaxRupees?: string; sort?: string }>();
  const [saleType, setSaleType] = useState(params.saleType || '');
  const [organic, setOrganic] = useState(params.organic === '1');
  const [min, setMin] = useState(params.priceMinRupees || '');
  const [max, setMax] = useState(params.priceMaxRupees || '');
  const [sort, setSort] = useState<SortKey>((params.sort as SortKey) || 'newest');

  const apply = () => router.replace({ pathname: '/(buyer)/search', params: {
    saleType: saleType || undefined, organic: organic ? '1' : undefined,
    priceMinRupees: min.trim() || undefined, priceMaxRupees: max.trim() || undefined, sort,
  } });
  const reset = () => { setSaleType(''); setOrganic(false); setMin(''); setMax(''); setSort('newest'); };

  return (
    <ScreenScaffold title={t('buyer.filters')} footer={<Button title={t('buyer.applyFilters')} onPress={apply} />}>
      <Text style={styles.section}>{t('buyer.saleType')}</Text>
      <View style={styles.chips}>
        {SALE_TYPES.map((s) => {
          const active = saleType === s;
          return (
            <Pressable key={s || 'any'} onPress={() => setSaleType(s)} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{t(s ? `listings.saleType.${s}` : 'buyer.any')}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: space[2] }}>
        <Toggle label={t('buyer.organicOnly')} value={organic} onValueChange={setOrganic} />
      </View>

      <Text style={styles.section}>{t('buyer.priceRange')}</Text>
      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}><Input label={t('buyer.priceMin')} value={min} onChangeText={setMin} keyboardType="number-pad" maxLength={9} /></View>
        <View style={{ flex: 1 }}><Input label={t('buyer.priceMax')} value={max} onChangeText={setMax} keyboardType="number-pad" maxLength={9} /></View>
      </View>

      <Text style={styles.section}>{t('buyer.sort')}</Text>
      <View style={styles.chips}>
        {SORTS.map((s) => {
          const active = sort === s;
          return (
            <Pressable key={s} onPress={() => setSort(s)} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{t(`buyer.sort.${s}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={reset} style={styles.reset} accessibilityRole="button"><Text style={styles.resetText}>{t('buyer.resetFilters')}</Text></Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  priceRow: { flexDirection: 'row', gap: space[3] },
  reset: { marginTop: space[5], alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  resetText: { fontFamily: font.body, fontSize: font.size.md, color: color.primary700, fontWeight: font.weight.semibold },
});
