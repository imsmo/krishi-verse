// apps/mobile/src/app/(farmer)/mandi/index.tsx · screen 52 (mandi prices — browse yards). Thin screen (guide §3):
// lists mandis (market yards) near the farmer's region; tapping a yard opens its live prices. Entry to price
// alerts. Behind `mandi_weather`. Keyset; degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Mandi } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listMandis, defaultRegionId } from '../../../features/market/market.api';

export default function MandiPrices() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('mandi_weather');
  const [items, setItems] = useState<Mandi[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const region = await defaultRegionId();
    const r = await listMandis(region ?? undefined);
    setItems(r.items); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('mandi.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('mandi.title')}>
      <Pressable onPress={() => router.push('/(farmer)/mandi/alerts')} accessibilityRole="button"><Text style={styles.link}>🔔 {t('mandi.alerts.title')} →</Text></Pressable>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('mandi.empty.title')} message={t('mandi.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/mandi/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <Text style={styles.name}>{item.defaultName}</Text>
                {item.mandiCode ? <Text style={styles.code}>{item.mandiCode}</Text> : null}
              </Card>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700, paddingVertical: space[2] },
  card: { marginBottom: space[2] },
  name: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  code: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
