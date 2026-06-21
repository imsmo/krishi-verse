// apps/mobile/src/app/(worker)/reviews.tsx · screen 40 (my reviews / reputation). Thin screen (guide §3): the
// worker's reputation — bookings completed + no-shows from their own profile (server truth), plus the generic
// reviews summary keyed to their user id (best-effort; degrades when reviews are off). Behind `worker_active_job`.
// NOTE: labour-specific worker reviews aren't a distinct endpoint yet — the rating summary is the order-reviews
// aggregate the server resolves for this user id; we show the profile counters as the authoritative figures.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { WorkerProfile, ReviewSummary } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { getMyWorker, workerRating } from '../../features/labour/labour.api';

export default function WorkerReviews() {
  const { t } = useTranslation();
  const enabled = useFlag('worker_active_job');
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const w = await getMyWorker(); setWorker(w);
    if (w) setSummary(await workerRating(w.userId));
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('worker.reviews.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const stars = summary?.averageStars ?? worker?.ratingAvg ?? null;

  return (
    <ScreenScaffold title={t('worker.reviews.title')}>
      {loading ? <SkeletonCard lines={4} /> : !worker ? (
        <EmptyState title={t('worker.reviews.empty.title')} message={t('worker.reviews.empty.message')} />
      ) : (
        <Card>
          <View style={styles.row}><Text style={styles.k}>{t('worker.reviews.rating')}</Text><Text style={styles.v}>{stars != null ? `${stars.toFixed(1)} ★` : t('worker.reviews.none')}</Text></View>
          {summary ? <View style={styles.row}><Text style={styles.k}>{t('worker.reviews.count')}</Text><Text style={styles.v}>{String(summary.count)}</Text></View> : null}
          <View style={styles.row}><Text style={styles.k}>{t('worker.reviews.completed')}</Text><Text style={styles.v}>{String(worker.bookingsCompleted)}</Text></View>
          {worker.noShowCount > 0 ? <View style={styles.row}><Text style={styles.k}>{t('worker.reviews.noShows')}</Text><Text style={styles.v}>{String(worker.noShowCount)}</Text></View> : null}
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
