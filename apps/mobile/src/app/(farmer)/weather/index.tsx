// apps/mobile/src/app/(farmer)/weather/index.tsx · screen 54 (weather). Thin screen (guide §3): regional weather
// advisories for the farmer's region (resolved from their default saved address — "weather by location" without a
// geocoder). Tap an advisory for detail. Behind `mandi_weather`. Degrade-never-die.
// NOTE: the backend serves regional ADVISORIES (read-only, ingested), not a live forecast — see README flagged gap.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { WeatherAlert } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { weatherAlerts, defaultRegionId } from '../../../features/market/market.api';
import { weatherSeverityTone, isAdvisoryActive } from '../../../features/market/market';

export default function Weather() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('mandi_weather');
  const [region, setRegion] = useState<string | null>(null);
  const [items, setItems] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await defaultRegionId();
    setRegion(r);
    setItems(r ? await weatherAlerts(r) : []);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('weather.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('weather.title')} footer={<View style={{ paddingVertical: space[1] }}><Pressable onPress={() => router.push('/(farmer)/weather/settings')} accessibilityRole="button"><Text style={styles.link}>{t('weather.settings.title')} →</Text></Pressable></View>}>
      {loading ? <SkeletonCard lines={4} /> : !region ? (
        <EmptyState title={t('weather.noRegion.title')} message={t('weather.noRegion.message')} actionLabel={t('weather.settings.title')} onAction={() => router.push('/(farmer)/weather/settings')} />
      ) : items.length === 0 ? (
        <EmptyState title={t('weather.empty.title')} message={t('weather.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/weather/[id]', params: { id: item.id, regionId: item.regionId } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.advisory} numberOfLines={2}>{t(item.advisoryTextKey)}</Text>
                  <StatusPill label={t(`weather.severity.${item.severity}`, { defaultValue: item.severity })} tone={weatherSeverityTone(item.severity)} />
                </View>
                {!isAdvisoryActive(item) ? <Text style={styles.expired}>{t('weather.expired')}</Text> : null}
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
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700 },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  advisory: { flex: 1, fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  expired: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[1] },
});
