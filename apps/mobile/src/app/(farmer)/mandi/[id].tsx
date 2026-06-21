// apps/mobile/src/app/(farmer)/mandi/[id].tsx · screen 53 (mandi detail + today's prices). Thin screen (guide §3):
// the yard + its recent price rows (modal/min/max per unit — bigint paise via MoneyText, Law 2). Tap a row to set
// a price alert on that commodity, or open the price history. Behind `mandi_weather`. Degrade-never-die.
// NOTE: the price read-model carries product/grade by id (no name) — we show the grade ref + unit + date; a
// commodity-name join is a later catalogue enhancement (flagged), never faked here.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Mandi, MandiPrice } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getMandi, listPrices } from '../../../features/market/market.api';

export default function MandiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('mandi_weather');
  const [mandi, setMandi] = useState<Mandi | null>(null);
  const [prices, setPrices] = useState<MandiPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [m, p] = await Promise.all([getMandi(id), listPrices({ mandiId: id })]);
    setMandi(m); setPrices(p.items); setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('mandi.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={mandi?.defaultName ?? t('mandi.title')}>
      {loading ? <SkeletonCard lines={5} /> : !mandi ? (
        <EmptyState title={t('mandi.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : prices.length === 0 ? (
        <EmptyState title={t('mandi.noPrices.title')} message={t('mandi.noPrices.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={prices}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={<Pressable onPress={() => router.push({ pathname: '/(farmer)/mandi/history', params: { id } })} accessibilityRole="button"><Text style={styles.link}>{t('mandi.history.title')} →</Text></Pressable>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/(farmer)/mandi/alerts', params: { productId: item.productId, regionId: item.regionId ?? '', rupees: paiseToRupees(item.modalMinor) } })}
              accessibilityRole="button"
            >
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.date}>{safeDate(item.priceDate, lang)}</Text>
                  <MoneyText minor={item.modalMinor} langCode={lang} size="lg" />
                </View>
                <Text style={styles.meta}>{t('mandi.range', { min: paiseToRupees(item.minMinor ?? item.modalMinor), max: paiseToRupees(item.maxMinor ?? item.modalMinor) })} · {t('mandi.perUnit', { unit: item.unitCode })}</Text>
                <Text style={styles.setAlert}>🔔 {t('mandi.setAlert')}</Text>
              </Card>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }
/** Display-only paise→rupees (whole) for range copy; the precise value is rendered by MoneyText. */
function paiseToRupees(minor: string): string { try { return (BigInt(minor) / 100n).toString(); } catch { return '—'; } }

const styles = StyleSheet.create({
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700, paddingVertical: space[2] },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
  setAlert: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary700, marginTop: space[2] },
});
