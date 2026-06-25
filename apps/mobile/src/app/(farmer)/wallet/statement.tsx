// apps/mobile/src/app/(farmer)/wallet/statement.tsx · screen (wallet ledger statement). Thin screen (guide §3):
// the caller's OWN wallet ledger — the per-entry double-entry statement with a SERVER-computed running balance
// (balanceAfterMinor). Money is bigint minor-unit strings (Law 2); the client NEVER computes a balance, it only
// classifies the sign for colour (presentLedgerEntry, pure + tested). Keyset-paged ("load more"). Behind the
// `wallet` flag (kill-switch). FLAG_SECURE (money on screen). Degrade-never-die: a failed read → empty + retry.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import type { WalletLedgerEntry } from '@krishi-verse/sdk-js';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { walletLedger } from '../../../features/wallet/wallet.api';
import { presentLedgerEntry } from '../../../features/wallet/txn';
import { useSecureScreen } from '../../../core/security';

export default function Statement() {
  useSecureScreen(); // ledger amounts on screen — FLAG_SECURE (§4)
  const { t, lang } = useTranslation();
  const enabled = useFlag('wallet');
  const [rows, setRows] = useState<WalletLedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    const page = await walletLedger(next);
    setRows((prev) => (next ? [...prev, ...page.items] : page.items));
    setCursor(page.nextCursor);
    setFailed(!next && page.items.length === 0 && page.nextCursor === null);
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('wallet.statement')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('wallet.statement')}>
      {rows.length === 0 && !loading ? (
        failed
          ? <View style={{ gap: space[3] }}><EmptyState title={t('wallet.statementEmpty.title')} message={t('wallet.statementEmpty.message')} /><Button title={t('common.retry')} variant="outline" onPress={() => load()} /></View>
          : <EmptyState title={t('wallet.statementEmpty.title')} message={t('wallet.statementEmpty.message')} />
      ) : (
        <Card style={styles.card}>
          {rows.map((e) => {
            const v = presentLedgerEntry(e);
            return (
              <View key={v.id} style={styles.row}>
                <View style={styles.left}>
                  <Text style={styles.type}>{v.txnType ?? t('wallet.txnGeneric')}</Text>
                  {v.createdAt ? <Text style={styles.date}>{v.createdAt.slice(0, 10)}</Text> : null}
                </View>
                <View style={styles.right}>
                  <MoneyText minor={v.amountMinor} currencyCode={e.currencyCode} langCode={lang} size="md" tone={v.moneyTone} />
                  <Text style={styles.balLabel}>{t('wallet.colBalance')} <MoneyText minor={v.balanceAfterMinor} currencyCode={e.currencyCode} langCode={lang} size="xs" tone="muted" /></Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {cursor ? <View style={{ marginTop: space[3] }}><Button title={t('common.loadMore')} variant="outline" loading={loading} onPress={() => load(cursor)} /></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[1] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  type: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  date: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
  balLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400 },
});
