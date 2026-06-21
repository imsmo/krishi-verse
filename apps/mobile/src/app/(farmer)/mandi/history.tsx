// apps/mobile/src/app/(farmer)/mandi/history.tsx · screen 111 (mandi price history). Thin screen (guide §3): the
// price history for a yard (keyset, newest-first), with the latest-vs-previous trend. Money via MoneyText (Law 2);
// trend-% computed with BigInt (PURE historyTrendPct). Behind `mandi_weather`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { MandiPrice } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listPrices } from '../../../features/market/market.api';
import { historyTrendPct, changeTone, changeArrow } from '../../../features/market/market';

export default function MandiHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const enabled = useFlag('mandi_weather');
  const [items, setItems] = useState<MandiPrice[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);

  const load = useCallback(async () => { if (!id) return; setLoading(true); const r = await listPrices({ mandiId: id }); setItems(r.items); setCursor(r.nextCursor); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  const more = useCallback(async () => {
    if (!cursor || paging || !id) return;
    setPaging(true);
    try { const r = await listPrices({ mandiId: id }, cursor); setItems((prev) => [...prev, ...r.items]); setCursor(r.nextCursor); }
    finally { setPaging(false); }
  }, [cursor, paging, id]);

  if (!enabled) return <ScreenScaffold title={t('mandi.history.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const trend = historyTrendPct(items);

  return (
    <ScreenScaffold title={t('mandi.history.title')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('mandi.noPrices.title')} message={t('mandi.noPrices.message')} />
      ) : (
        <>
          {trend != null ? (
            <Card style={styles.trendCard}>
              <Text style={styles.k}>{t('mandi.trend')}</Text>
              <StatusPill label={`${changeArrow(trend)} ${Math.abs(trend).toFixed(1)}%`} tone={changeTone(trend)} />
            </Card>
          ) : null}
          <FlatList
            data={items}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Text style={styles.date}>{safeDate(item.priceDate, lang)}</Text>
                <MoneyText minor={item.modalMinor} langCode={lang} size="md" />
              </Card>
            )}
            onEndReached={more}
            onEndReachedThreshold={0.5}
            ListFooterComponent={paging ? <SkeletonCard lines={1} /> : null}
            contentContainerStyle={{ paddingVertical: space[3] }}
          />
        </>
      )}
    </ScreenScaffold>
  );
}

function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  trendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  k: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  date: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
});
