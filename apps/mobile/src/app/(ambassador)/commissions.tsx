// apps/mobile/src/app/(ambassador)/commissions.tsx · screen 92 (commission ledger). Thin screen (guide §3): the
// ambassador's full commission ledger (keyset, load-more) with BigInt totals (Law 2) + paid/unpaid split, and a
// Withdraw CTA. The ledger is the SERVER's truth; the app never moves money (payout is server-side, Law 11).
// Behind `ambassador_training`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { AmbassadorEarning } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { myEarnings } from '../../features/ambassador/ambassador.api';
import { sumEarningsMinor } from '../../features/ambassador/referral-flow';

export default function Commissions() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_training');
  const [items, setItems] = useState<AmbassadorEarning[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);

  const load = useCallback(async () => { const r = await myEarnings(); setItems(r.items); setCursor(r.nextCursor); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  const more = useCallback(async () => {
    if (!cursor || paging) return;
    setPaging(true);
    try { const r = await myEarnings(cursor); setItems((prev) => [...prev, ...r.items]); setCursor(r.nextCursor); }
    finally { setPaging(false); }
  }, [cursor, paging]);

  if (!enabled) return <ScreenScaffold title={t('amb.commissions.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('amb.commissions.title')} footer={<Button title={t('amb.withdraw.cta')} onPress={() => router.push('/(ambassador)/withdraw')} />}>
      {loading ? <SkeletonCard lines={5} /> : (
        <>
          <Card>
            <Text style={styles.k}>{t('amb.earnings.total')}</Text>
            <View style={styles.amount}><MoneyText minor={sumEarningsMinor(items)} langCode={lang} size="xl" /></View>
            <View style={[styles.row, { marginTop: space[2] }]}>
              <Text style={styles.k}>{t('amb.earnings.unpaid')}</Text>
              <MoneyText minor={sumEarningsMinor(items, true)} langCode={lang} size="md" />
            </View>
          </Card>
          {items.length === 0 ? (
            <EmptyState title={t('amb.earnings.empty.title')} message={t('amb.earnings.empty.message')} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(e) => e.id}
              renderItem={({ item }) => (
                <Card style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.k}>{t('amb.earnings.item')}</Text>
                    <StatusPill label={t(item.payoutId ? 'amb.earnings.paid' : 'amb.earnings.unpaid')} tone={item.payoutId ? 'success' : 'warning'} />
                  </View>
                  <MoneyText minor={item.amountMinor} langCode={lang} size="md" />
                </Card>
              )}
              onEndReached={more}
              onEndReachedThreshold={0.5}
              ListFooterComponent={paging ? <SkeletonCard lines={1} /> : null}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], marginBottom: space[2] },
});
