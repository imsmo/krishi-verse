// apps/mobile/src/app/(farmer)/wallet/txn-detail.tsx · screen 71 (transaction detail). Thin screen (guide §3):
// loads one payment OR payout by id (the `kind` param decides which real endpoint) and renders it. Money via
// MoneyText (Law 2), status via StatusPill. Behind the `wallet` flag. Degrade-never-die: not-found/failure →
// EmptyState + retry. The server re-checks ownership on the read (no IDOR — a guessed id returns nothing yours).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getPayment, getPayout } from '../../../features/wallet/wallet.api';
import { presentPayment, presentPayout, statusLabelKey, txnTitleKey, type TxnView } from '../../../features/wallet/txn';
import { useSecureScreen } from '../../../core/security';

export default function TxnDetail() {
  useSecureScreen(); // transaction detail (amounts) on screen — FLAG_SECURE (§4)
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const { t, lang } = useTranslation();
  const enabled = useFlag('wallet');
  const [txn, setTxn] = useState<TxnView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    if (kind === 'payout') {
      const p = await getPayout(id); setTxn(p ? presentPayout(p) : null); setFailed(!p);
    } else {
      const p = await getPayment(id); setTxn(p ? presentPayment(p) : null); setFailed(!p);
    }
    setLoading(false);
  }, [id, kind]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('txnDetail.title')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('txnDetail.title')}>
      {loading ? <SkeletonCard lines={4} /> : !txn || failed ? (
        <EmptyState title={t('txnDetail.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          <View style={styles.amountWrap}>
            <MoneyText minor={txn.amountMinor} langCode={lang} size="3xl" tone={txn.moneyTone === 'positive' ? 'positive' : txn.moneyTone === 'negative' ? 'negative' : 'default'} />
            <StatusPill label={t(`wallet.status.${statusLabelKey(txn.status)}`)} tone={txn.tone} />
          </View>
          <Row label={t('txnDetail.type')} value={t(`wallet.txnTitle.${txnTitleKey(txn)}`)} />
          {txn.createdAt ? <Row label={t('txnDetail.date')} value={txn.createdAt.slice(0, 10)} /> : null}
          <Row label={t('txnDetail.reference')} value={txn.id} mono />
        </Card>
      )}
    </ScreenScaffold>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <Text style={[styles.v, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amountWrap: { alignItems: 'center', gap: space[2], paddingBottom: space[4], marginBottom: space[2], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { flex: 1, textAlign: 'right', fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  mono: { fontSize: font.size.sm, fontWeight: font.weight.regular },
});
