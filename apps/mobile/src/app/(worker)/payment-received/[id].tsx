// apps/mobile/src/app/(worker)/payment-received/[id].tsx · screen 34 (payment received). Thin confirmation
// (guide §3): reflects the SERVER's truth that the assignment's wage was settled (status `paid`) into the worker's
// wallet — the app never moves money (Law 11). Money via MoneyText (Law 2). Behind `worker_active_job`. Degrades.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LabourAssignment } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getOffer } from '../../../features/labour/labour.api';
import { assignmentStatusTone } from '../../../features/labour/labour-status';
import { isWagePaid } from '../../../features/labour/worker-jobs';

export default function PaymentReceived() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_active_job');
  const [offer, setOffer] = useState<LabourAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { if (!id) return; setLoading(true); setOffer(await getOffer(id)); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('worker.payment.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('worker.payment.title')}>
      {loading ? <SkeletonCard lines={4} /> : !offer ? (
        <EmptyState title={t('worker.offerUnavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <Text style={styles.h}>{isWagePaid(offer.status) ? t('worker.payment.received') : t('worker.payment.pending')}</Text>
            <View style={styles.amount}><MoneyText minor={offer.wageMinor} langCode={lang} size="xl" /></View>
            <View style={styles.row}>
              <Text style={styles.k}>{t('worker.payment.status')}</Text>
              <StatusPill label={t(`worker.offerStatus.${offer.status}`)} tone={assignmentStatusTone(offer.status)} />
            </View>
          </Card>
          <View style={{ marginTop: space[4] }}>
            <Button title={t('worker.earnings.title')} variant="outline" onPress={() => router.push('/(worker)/earnings')} />
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  amount: { alignItems: 'center', marginVertical: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
});
