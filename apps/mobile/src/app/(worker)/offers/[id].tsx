// apps/mobile/src/app/(worker)/offers/[id].tsx · screen 141/142 (job offer detail + accept/decline). Thin screen
// (guide §3): the assignment (wage + status) + the linked booking for context; accept/decline while pending. The
// SERVER enforces the accept/decline window (a 409 → "expired") and the 18+ gate; the accept control is hidden
// unless the worker is age-verified (canAcceptWork). Behind `worker_app`. Money via MoneyText (Law 2).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LabourAssignment, LabourBooking, WorkerProfile } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getOffer, getJob, getMyWorker, respondOffer } from '../../../features/labour/labour.api';
import { assignmentStatusTone, assignmentActions, canAcceptWork } from '../../../features/labour/labour-status';

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_app');
  const [offer, setOffer] = useState<LabourAssignment | null>(null);
  const [booking, setBooking] = useState<LabourBooking | null>(null);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const a = await getOffer(id); setOffer(a); setFailed(!a);
    setWorker(await getMyWorker());
    if (a) setBooking(await getJob(a.bookingId));
    setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('worker.offerTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const respond = async (decision: 'accept' | 'reject') => {
    if (!id) return;
    setBusy(decision);
    try {
      await respondOffer(id, decision);
      router.replace({ pathname: '/(worker)/offers', params: { notice: t(decision === 'accept' ? 'worker.accepted' : 'worker.declined') } });
    } catch (e) {
      const msg = e instanceof SdkError && e.isConflict ? t('worker.windowExpired') : e instanceof SdkError && e.isForbidden ? t('worker.cannotAccept') : t('common.error.generic');
      Alert.alert(t('worker.respondFailed'), msg);
    } finally { setBusy(null); }
  };

  const actions = offer ? assignmentActions(offer.status) : [];
  const ageOk = canAcceptWork(worker);

  return (
    <ScreenScaffold title={t('worker.offerTitle')}>
      {loading ? <SkeletonCard lines={5} /> : !offer || failed ? (
        <EmptyState title={t('worker.offerUnavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`worker.offerStatus.${offer.status}`)} tone={assignmentStatusTone(offer.status)} />
              <MoneyText minor={offer.wageMinor} langCode={lang} size="xl" />
            </View>
            {booking ? <Text style={styles.meta}>{t('worker.jobNo', { id: booking.bookingNo })} · {t(`worker.wageKind.${booking.wageKind}`)}</Text> : null}
            {booking?.respondBy ? <Text style={styles.window}>{t('worker.respondBy')}</Text> : null}
          </Card>

          {actions.length ? (
            ageOk ? (
              <View style={styles.actions}>
                <View style={{ flex: 1 }}><Button title={t('worker.accept')} loading={busy === 'accept'} disabled={busy !== null} onPress={() => respond('accept')} /></View>
                <View style={{ flex: 1 }}><Button title={t('worker.decline')} variant="outline" loading={busy === 'reject'} disabled={busy !== null} onPress={() => respond('reject')} /></View>
              </View>
            ) : <Text style={styles.gate}>{t('worker.verifyToAccept')}</Text>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  meta: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginTop: space[1] },
  window: { fontFamily: font.body, fontSize: font.size.sm, color: color.warningDark, marginTop: space[2] },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[4] },
  gate: { fontFamily: font.body, fontSize: font.size.md, color: color.dangerDark, marginTop: space[4] },
});
