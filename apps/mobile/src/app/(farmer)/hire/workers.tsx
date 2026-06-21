// apps/mobile/src/app/(farmer)/hire/workers.tsx · screens 42 (browse workers) + 43 (filter). Thin screen
// (guide §3): the worker pool (PII-minimised — no name/phone, only region/rating/availability), with an inline
// filter (region + verified-only). When opened with an `assignBookingId` param, tapping a worker carries it
// through so the employer can assign them to that open booking. Behind `labour_hire`. Keyset; degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import type { WorkerProfile } from '@krishi-verse/sdk-js';
import { Card, EmptyState, Input, StatusPill, Toggle, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { browseWorkers } from '../../../features/labour/hire.api';
import { workerFilterParams } from '../../../features/labour/booking-flow';

export default function BrowseWorkers() {
  const { t } = useTranslation();
  const router = useRouter();
  const { assignBookingId } = useLocalSearchParams<{ assignBookingId?: string }>();
  const enabled = useFlag('labour_hire');
  const [region, setRegion] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [items, setItems] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await browseWorkers(workerFilterParams({ villageRegionId: region, verifiedOnly }));
    setItems(r.items); setLoading(false);
  }, [region, verifiedOnly]);
  useFocusEffect(useCallback(() => { if (enabled) load(); }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('hire.workers.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('hire.workers.title')}>
      <Card style={{ marginBottom: space[3] }}>
        <Input label={t('hire.filter.region')} value={region} onChangeText={setRegion} maxLength={40} placeholder={t('hire.filter.regionHint')} />
        <View style={{ marginTop: space[2] }}>
          <Toggle label={t('hire.filter.verifiedOnly')} value={verifiedOnly} onValueChange={setVerifiedOnly} />
        </View>
      </Card>
      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('hire.workers.empty.title')} message={t('hire.workers.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(farmer)/hire/worker/[id]', params: { id: item.id, ...(assignBookingId ? { assignBookingId } : {}) } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{t('hire.worker.anon', { id: item.id.slice(0, 6).toUpperCase() })}</Text>
                  <StatusPill label={t(item.ageVerified18 ? 'worker.verified' : 'worker.unverified')} tone={item.ageVerified18 ? 'success' : 'warning'} />
                </View>
                <Text style={styles.meta}>{t('hire.worker.rating', { rating: item.ratingAvg != null ? item.ratingAvg.toFixed(1) : '–', jobs: String(item.bookingsCompleted) })}</Text>
                {item.travelKm != null ? <Text style={styles.meta}>{t('hire.worker.travel', { km: String(item.travelKm) })}</Text> : null}
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
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
