// apps/mobile/src/app/(worker)/jobs/[id].tsx · screen 31 (job detail). Thin screen (guide §3): the booking's
// wage/kind/workers/dates/status. Behind `worker_app`. Degrade-never-die. NOTE: there's no direct worker "apply"
// endpoint (140) — jobs are offered to workers by the employer/ambassador as assignments (see Offers); so this
// screen is read-only with an explanatory note rather than a faked apply button.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { LabourBooking } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getJob } from '../../../features/labour/labour.api';
import { bookingStatusTone } from '../../../features/labour/labour-status';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const enabled = useFlag('worker_app');
  const [job, setJob] = useState<LabourBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const b = await getJob(id); setJob(b); setFailed(!b); setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('worker.tabs.jobs')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={job ? t('worker.jobNo', { id: job.bookingNo }) : ' '}>
      {loading ? <SkeletonCard lines={5} /> : !job || failed ? (
        <EmptyState title={t('worker.jobUnavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.head}>
              <StatusPill label={t(`worker.bookingStatus.${job.status}`)} tone={bookingStatusTone(job.status)} />
              <MoneyText minor={job.wageOfferedMinor} currencyCode={job.currencyCode} langCode={lang} size="xl" />
            </View>
            <Row label={t('worker.wage')} value={t(`worker.wageKind.${job.wageKind}`)} />
            <Row label={t('worker.workers')} value={String(job.workersNeeded)} />
            <Row label={t('worker.startDate')} value={safeDate(job.startDate, lang)} />
            {job.endDate ? <Row label={t('worker.endDate')} value={safeDate(job.endDate, lang)} /> : null}
            {job.womenOnly ? <Row label={t('worker.womenOnly')} value="✓" /> : null}
          </Card>
          <Text style={styles.note}>{t('worker.applyNote')}</Text>
        </>
      )}
    </ScreenScaffold>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { flex: 1, textAlign: 'right', fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
