// apps/mobile/src/app/(worker)/jobs.tsx · screen 30 (browse jobs). Thin screen (guide §3): the open-booking
// marketplace via features/labour.browseJobs (box=open, keyset). Tap → job detail. Money via MoneyText (Law 2).
// Behind `worker_app`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LabourBooking } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { browseJobs } from '../../features/labour/labour.api';

export default function Jobs() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_app');
  const [items, setItems] = useState<LabourBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setItems((await browseJobs()).items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }, [load]);

  if (!enabled) return <ScreenScaffold title={t('worker.tabs.jobs')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('worker.tabs.jobs')} scroll={false}>
      {loading ? <View style={{ gap: space[3] }}><SkeletonCard /><SkeletonCard /></View> : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.primary600} />}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          ListEmptyComponent={<EmptyState title={t('worker.jobs.empty.title')} message={t('worker.jobs.empty.message')} />}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/(worker)/jobs/[id]', params: { id: item.id } })} accessibilityLabel={t('worker.jobNo', { id: item.bookingNo })}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.id}>{t('worker.jobNo', { id: item.bookingNo })}</Text>
                  <Text style={styles.meta}>{t('worker.workersNeeded', { n: item.workersNeeded })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <MoneyText minor={item.wageOfferedMinor} currencyCode={item.currencyCode} langCode={lang} />
                  <StatusPill label={t(`worker.wageKind.${item.wageKind}`)} tone="info" />
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
});
