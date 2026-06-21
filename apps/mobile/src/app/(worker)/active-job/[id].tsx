// apps/mobile/src/app/(worker)/active-job/[id].tsx · screen 33 (active job + geo-attendance). Thin screen
// (guide §3): the accepted assignment + its booking; once the employer has STARTED the booking (in_progress) the
// worker may CLOCK IN — gated by the PURE clockInEligibility (within 100m of the farm, a usable GPS fix). The
// geofence is the DoD invariant ("clock-in blocked outside 100m"); a real attendance POST must re-verify the fix
// SERVER-SIDE (a rooted device can spoof GPS) — see the flagged gap below. Behind `worker_active_job`.
//
// FLAGGED BACKEND GAPS (real geofence built; NOT faked): there is (1) no attendance/clock-in endpoint in the
// labour API yet and (2) the booking read-model does not expose the farm's lat/lng. So the button computes and
// shows the geofence decision (the honest, testable invariant) and, on a pass, surfaces "attendance recording is
// coming soon" rather than POSTing to a non-existent endpoint or inventing coordinates.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LabourAssignment, LabourBooking } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getOffer, getJob } from '../../../features/labour/labour.api';
import { assignmentStatusTone, bookingStatusTone } from '../../../features/labour/labour-status';
import { canClockIn, isWagePaid } from '../../../features/labour/worker-jobs';
import { getCurrentFix, clockInEligibility, distanceParts, type GeoPoint } from '../../../core/location';

/** Farm coordinates aren't in the booking read-model yet; read defensively so the geofence lights up the moment
 * the contract adds them (never fabricated). */
function farmOf(b: LabourBooking | null): GeoPoint | null {
  const x = b as unknown as { farmLat?: number; farmLng?: number } | null;
  return x && typeof x.farmLat === 'number' && typeof x.farmLng === 'number' ? { lat: x.farmLat, lng: x.farmLng } : null;
}

export default function ActiveJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_active_job');
  const [offer, setOffer] = useState<LabourAssignment | null>(null);
  const [booking, setBooking] = useState<LabourBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const a = await getOffer(id); setOffer(a); setFailed(!a);
    if (a) setBooking(await getJob(a.bookingId));
    setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('worker.activeJob.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const clockIn = async () => {
    setBusy(true);
    try {
      const fix = await getCurrentFix();
      if (!fix.ok) { Alert.alert(t('worker.clockIn.title'), t(`worker.clockIn.gps.${fix.reason}`)); return; }
      const check = clockInEligibility({ here: fix.fix, farm: farmOf(booking) });
      if (!check.ok) {
        const dist = check.distanceM != null ? `${distanceParts(check.distanceM).value} ${t(`worker.unit.${distanceParts(check.distanceM).unit}`)}` : '';
        Alert.alert(t('worker.clockIn.blocked'), `${t(`worker.clockIn.reason.${check.reason}`)} ${dist}`.trim());
        return;
      }
      // Geofence PASSED — but there is no attendance endpoint yet. Do NOT fake a server write.
      Alert.alert(t('worker.clockIn.title'), t('worker.clockIn.comingSoon'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('worker.activeJob.title')}>
      {loading ? <SkeletonCard lines={5} /> : !offer || failed ? (
        <EmptyState title={t('worker.offerUnavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`worker.offerStatus.${offer.status}`)} tone={assignmentStatusTone(offer.status)} />
              <MoneyText minor={offer.wageMinor} langCode={lang} size="xl" />
            </View>
            {booking ? (
              <View style={[styles.row, { marginTop: space[2] }]}>
                <Text style={styles.k}>{t('worker.jobNo', { id: booking.bookingNo })}</Text>
                <StatusPill label={t(`worker.bookingStatus.${booking.status}`)} tone={bookingStatusTone(booking.status)} />
              </View>
            ) : null}
          </Card>

          {canClockIn(booking?.status) ? (
            <View style={{ marginTop: space[4] }}>
              <Button title={t('worker.clockIn.action')} loading={busy} disabled={busy} onPress={clockIn} />
              <Text style={styles.note}>{t('worker.clockIn.fence')}</Text>
            </View>
          ) : <Text style={styles.note}>{t('worker.activeJob.notStarted')}</Text>}

          {isWagePaid(offer.status) ? (
            <View style={{ marginTop: space[4] }}>
              <Button title={t('worker.payment.view')} variant="outline" onPress={() => router.push({ pathname: '/(worker)/payment-received/[id]', params: { id: offer.id } })} />
            </View>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[2] },
});
