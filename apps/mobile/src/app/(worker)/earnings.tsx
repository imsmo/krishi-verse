// apps/mobile/src/app/(worker)/earnings.tsx · screen 35 (earnings). Thin screen (guide §3): total wages received
// = the PURE BigInt sum of PAID assignments (Law 2 — never a float), plus the list. A Withdraw CTA routes to the
// wallet withdrawal (the actual money-out is the server's, Law 11). Behind `worker_active_job`. Degrade-never-die.
// NOTE: the total reflects the loaded page (keyset); a "+ more below" hint shows when older pages remain — there's
// no server-side earnings aggregate endpoint yet (flagged), so we sum what the assignments feed returns.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LabourAssignment } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { myJobs } from '../../features/labour/labour.api';
import { sumEarningsMinor, categorizeAssignments } from '../../features/labour/worker-jobs';

export default function Earnings() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_active_job');
  const [items, setItems] = useState<LabourAssignment[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await myJobs(); setItems(r.items); setMore(!!r.nextCursor); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('worker.earnings.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const paid = categorizeAssignments(items).paid;
  const totalMinor = sumEarningsMinor(items);

  return (
    <ScreenScaffold title={t('worker.earnings.title')} footer={<Button title={t('worker.withdraw.action')} onPress={() => router.push('/(worker)/withdraw')} />}>
      {loading ? <SkeletonCard lines={5} /> : (
        <>
          <Card>
            <Text style={styles.k}>{t('worker.earnings.total')}</Text>
            <View style={styles.amount}><MoneyText minor={totalMinor} langCode={lang} size="xl" /></View>
            {more ? <Text style={styles.more}>{t('worker.earnings.more')}</Text> : null}
          </Card>
          {paid.length === 0 ? (
            <EmptyState title={t('worker.earnings.empty.title')} message={t('worker.earnings.empty.message')} />
          ) : (
            <FlatList
              data={paid}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => (
                <Card style={styles.rowCard}>
                  <Text style={styles.k}>{t('worker.payment.received')}</Text>
                  <MoneyText minor={item.wageMinor} langCode={lang} size="lg" />
                </Card>
              )}
              contentContainerStyle={{ paddingVertical: space[3] }}
            />
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  k: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  amount: { alignItems: 'center', marginTop: space[2] },
  more: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[2], textAlign: 'center' },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
});
