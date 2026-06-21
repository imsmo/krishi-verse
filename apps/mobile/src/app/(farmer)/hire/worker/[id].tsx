// apps/mobile/src/app/(farmer)/hire/worker/[id].tsx · screen 25 (worker profile — employer view). Thin screen
// (guide §3): a PII-minimised worker card (region/rating/availability — no name/phone). If opened with an
// `assignBookingId`, the employer can ASSIGN this worker to that open booking (idempotent; the server re-checks
// ownership, the 18+ gate, headcount + wage floor). Behind `labour_hire`. Money via MoneyText. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { WorkerProfile } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../../core/i18n/useTranslation';
import { useFlag } from '../../../../core/flags/useFlag';
import { getWorker, assignWorker } from '../../../../features/labour/hire.api';

export default function WorkerProfileEmployer() {
  const { id, assignBookingId } = useLocalSearchParams<{ id: string; assignBookingId?: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('labour_hire');
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { if (!id) return; setLoading(true); setWorker(await getWorker(id)); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('hire.workerTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const assign = async () => {
    if (!assignBookingId || !id) return;
    setBusy(true);
    try {
      await assignWorker(assignBookingId, id);
      router.replace({ pathname: '/(farmer)/hire/booking/[id]', params: { id: assignBookingId, notice: t('hire.assign.done') } });
    } catch (e) {
      const msg = e instanceof SdkError && e.status === 422 ? t('hire.assign.belowFloor')
        : e instanceof SdkError && e.status === 409 ? t('hire.assign.full')
        : e instanceof SdkError && e.isForbidden ? t('hire.assign.notAllowed')
        : t('common.error.generic');
      Alert.alert(t('hire.assign.failed'), msg);
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('hire.workerTitle')}
      footer={assignBookingId && worker ? <Button title={t('hire.assign.action')} loading={busy} disabled={busy} onPress={assign} /> : undefined}
    >
      {loading ? <SkeletonCard lines={4} /> : !worker ? (
        <EmptyState title={t('hire.worker.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          <View style={styles.row}>
            <Text style={styles.name}>{t('hire.worker.anon', { id: worker.id.slice(0, 6).toUpperCase() })}</Text>
            <StatusPill label={t(worker.ageVerified18 ? 'worker.verified' : 'worker.unverified')} tone={worker.ageVerified18 ? 'success' : 'warning'} />
          </View>
          <Field label={t('hire.worker.ratingLabel')} value={worker.ratingAvg != null ? `${worker.ratingAvg.toFixed(1)} ★` : t('worker.reviews.none')} />
          <Field label={t('worker.reviews.completed')} value={String(worker.bookingsCompleted)} />
          {worker.travelKm != null ? <Field label={t('worker.travelKm')} value={String(worker.travelKm)} /> : null}
          {worker.stayAwayOk ? <Field label={t('worker.stayAway')} value={t(`worker.stayAway.${worker.stayAwayOk}`)} /> : null}
          {worker.minWageExpectationMinor ? (
            <View style={styles.field}>
              <Text style={styles.k}>{t('worker.minWage')}</Text>
              <MoneyText minor={worker.minWageExpectationMinor} langCode={lang} size="md" />
            </View>
          ) : null}
        </Card>
      )}
    </ScreenScaffold>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.k}>{label}</Text><Text style={styles.v} numberOfLines={1}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { flex: 1, textAlign: 'right', fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
