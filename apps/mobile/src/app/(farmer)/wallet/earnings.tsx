// apps/mobile/src/app/(farmer)/wallet/earnings.tsx · screens 58/180 (money insights — earnings & spending).
// Thin screen (guide §3): the caller's OWN wallet insights over the default ~12-month window, aggregated
// FLOAT-FREE server-side (bigint-minor strings, Law 2) and just displayed here. A toggle flips between
// earnings (credits) and spending (debits). Behind the `wallet` flag. Degrade-never-die: a failed read → a
// friendly ₹0 view + retry, never a crash. FLAG_SECURE (money on screen).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import type { WalletInsights } from '@krishi-verse/sdk-js';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { walletEarnings, walletSpending } from '../../../features/wallet/wallet.api';
import { useSecureScreen } from '../../../core/security';

const EMPTY: WalletInsights = { fromIso: '', toIso: '', currencyCode: 'INR', totalMinor: '0', byMonth: [], byType: [] };

export default function Earnings() {
  useSecureScreen(); // money amounts on screen — FLAG_SECURE (§4)
  const { t, lang } = useTranslation();
  const enabled = useFlag('wallet');
  const [mode, setMode] = useState<'earnings' | 'spending'>('earnings');
  const [view, setView] = useState<WalletInsights>(EMPTY);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = mode === 'earnings' ? await walletEarnings() : await walletSpending();
    setView(res);
    setFailed(res.fromIso === '');
  }, [mode]);
  useEffect(() => { load(); }, [load]);

  if (!enabled) return <ScreenScaffold title={t('wallet.insights')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('wallet.insights')}>
      <View style={styles.toggle}>
        <Button title={t('wallet.earnings')} variant={mode === 'earnings' ? 'solid' : 'outline'} onPress={() => setMode('earnings')} />
        <Button title={t('wallet.spending')} variant={mode === 'spending' ? 'solid' : 'outline'} onPress={() => setMode('spending')} />
      </View>

      <Card style={styles.totalCard}>
        <Text style={styles.label}>{mode === 'earnings' ? t('wallet.totalEarned') : t('wallet.totalSpent')}</Text>
        <MoneyText minor={view.totalMinor} langCode={lang} size="3xl" style={{ color: color.white }} />
      </Card>

      {view.byMonth.length === 0 ? (
        <EmptyState title={t('wallet.insightsEmpty.title')} message={t('wallet.insightsEmpty.message')} />
      ) : (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('wallet.byMonth')}</Text>
          {view.byMonth.map((b) => (
            <View key={b.key} style={styles.row}>
              <Text style={styles.rowKey}>{b.key}</Text>
              <MoneyText minor={b.amountMinor} langCode={lang} size="md" />
            </View>
          ))}
        </Card>
      )}

      {view.byType.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('wallet.byType')}</Text>
          {view.byType.map((b) => (
            <View key={b.key} style={styles.row}>
              <Text style={styles.rowKey}>{b.key}</Text>
              <MoneyText minor={b.amountMinor} langCode={lang} size="md" />
            </View>
          ))}
        </Card>
      ) : null}

      {failed ? <View style={{ marginTop: space[3] }}><Button title={t('common.retry')} variant="outline" onPress={load} /></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', gap: space[3], marginBottom: space[4] },
  totalCard: { backgroundColor: color.primary600, paddingVertical: space[6], alignItems: 'center', gap: space[2] },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.primary100 },
  section: { marginTop: space[4], gap: space[2] },
  sectionTitle: { fontFamily: font.heading, fontSize: font.size.lg, color: color.text, marginBottom: space[1] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space[2] },
  rowKey: { fontFamily: font.body, fontSize: font.size.md, color: color.textMuted },
});
