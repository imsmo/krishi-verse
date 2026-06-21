// apps/mobile/src/app/(farmer)/hire/booking/[id].tsx · screen 51 (booking detail) + 48/49 (accepted/rejected).
// Thin screen (guide §3): the booking + an assignment tally (accepted / pending / declined) + the employer
// lifecycle actions allowed for the current status (assign → workers, start, complete, pay, cancel). Each action
// is a REAL transition the SERVER authorizes/validates (owner-only, ≥1 accepted to start, completed to pay) — a
// 403/409/422 shows a precise message, never worked around. Pay settles wages SERVER-SIDE (Law 11). Behind
// `labour_hire`. Money via MoneyText (Law 2). Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LabourBooking, LabourAssignment } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../../core/i18n/useTranslation';
import { useFlag } from '../../../../core/flags/useFlag';
import { getBooking, bookingAssignments, startBooking, completeBooking, cancelBooking, payWages } from '../../../../features/labour/hire.api';
import { bookingLifecycleActions, bookingStatusTone, tallyAssignments, type EmployerAction } from '../../../../features/labour/booking-flow';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('labour_hire');
  const [booking, setBooking] = useState<LabourBooking | null>(null);
  const [assignments, setAssignments] = useState<LabourAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<EmployerAction | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [b, a] = await Promise.all([getBooking(id), bookingAssignments(id)]);
    setBooking(b); setAssignments(a); setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('hire.bookingTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const run = async (action: EmployerAction, fn: () => Promise<unknown>) => {
    setBusy(action);
    try { await fn(); await load(); }
    catch (e) {
      const msg = e instanceof SdkError && e.isForbidden ? t('hire.action.notAllowed')
        : e instanceof SdkError && (e.status === 409 || e.status === 422) ? t('hire.action.illegal')
        : t('common.error.generic');
      Alert.alert(t('hire.action.failed'), msg);
    } finally { setBusy(null); }
  };

  const onAction = (action: EmployerAction) => {
    if (!id || !booking) return;
    switch (action) {
      case 'assign': router.push({ pathname: '/(farmer)/hire/workers', params: { assignBookingId: id } }); break;
      case 'start': run('start', () => startBooking(id)); break;
      case 'complete': Alert.alert(t('hire.action.complete'), t('hire.action.completeConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('hire.action.complete'), onPress: () => run('complete', () => completeBooking(id)) }]); break;
      case 'pay': Alert.alert(t('hire.action.pay'), t('hire.action.payConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('hire.action.pay'), onPress: () => run('pay', () => payWages(id)) }]); break;
      case 'cancel': Alert.alert(t('hire.action.cancel'), t('hire.action.cancelConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('hire.action.cancel'), style: 'destructive', onPress: () => run('cancel', () => cancelBooking(id)) }]); break;
    }
  };

  const tally = tallyAssignments(assignments);
  const actions = booking ? bookingLifecycleActions(booking.status) : [];

  return (
    <ScreenScaffold title={booking ? t('worker.jobNo', { id: booking.bookingNo }) : ' '}>
      {loading ? <SkeletonCard lines={5} /> : !booking ? (
        <EmptyState title={t('hire.worker.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`worker.bookingStatus.${booking.status}`)} tone={bookingStatusTone(booking.status)} />
              <MoneyText minor={booking.wageOfferedMinor} currencyCode={booking.currencyCode} langCode={lang} size="xl" />
            </View>
            <Row k={t('worker.workers')} v={String(booking.workersNeeded)} />
            <Row k={t('worker.wage')} v={t(`worker.wageKind.${booking.wageKind}`)} />
          </Card>

          <Card style={{ marginTop: space[3] }}>
            <Text style={styles.section}>{t('hire.tally.title')}</Text>
            <Row k={t('hire.tally.accepted')} v={String(tally.accepted)} />
            <Row k={t('hire.tally.pending')} v={String(tally.pending)} />
            <Row k={t('hire.tally.rejected')} v={String(tally.rejected)} />
          </Card>

          <View style={styles.actions}>
            {actions.map((a) => (
              <Button key={a} title={t(`hire.action.${a}`)} variant={a === 'cancel' ? 'outline' : 'primary'} loading={busy === a} disabled={busy !== null} onPress={() => onAction(a)} />
            ))}
            {actions.length === 0 ? <Text style={styles.note}>{t('hire.action.terminal')}</Text> : null}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  actions: { marginTop: space[4], gap: space[3] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400 },
});
