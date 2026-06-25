// apps/mobile/src/app/(farmer)/wallet/index.tsx · the wallet HUB (screen 19). Thin screen (guide §3): calls
// features/wallet/wallet.api → renders. Balance is the SERVER's reconciled truth, shown as a bigint-minor string
// via MoneyText (Law 2). Degrade-never-die: a failed read shows ₹0 + a retry, never a crash. Actions route to
// add-money (Razorpay recharge, `payments_addmoney`), and — behind the `wallet` flag — transactions, withdraw,
// and payout history. A post-action notice is surfaced via the route param.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Button, Card, MoneyText, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { walletBalance } from '../../../features/wallet/wallet.api';
import { useSecureScreen } from '../../../core/security';

export default function Wallet() {
  useSecureScreen(); // wallet balance on screen — FLAG_SECURE (§4)
  const { t, lang } = useTranslation();
  const router = useRouter();
  const addMoneyEnabled = useFlag('payments_addmoney');
  const walletEnabled = useFlag('wallet');
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [balanceMinor, setBalanceMinor] = useState<string>('0');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await walletBalance();
    setBalanceMinor(res.balanceMinor);
    setFailed(res.failed);
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load])); // refresh after returning from an action

  return (
    <ScreenScaffold title={t('tabs.wallet')}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Card style={styles.balanceCard}>
        <Text style={styles.label}>{t('wallet.available')}</Text>
        <MoneyText minor={balanceMinor} langCode={lang} size="3xl" style={{ color: color.white }} />
      </Card>

      <View style={styles.actions}>
        {addMoneyEnabled ? <Button title={t('wallet.addMoney')} onPress={() => router.push('/(farmer)/wallet/add-money')} /> : null}
        {walletEnabled ? <Button title={t('wallet.withdraw')} variant="outline" onPress={() => router.push('/(farmer)/wallet/withdraw')} /> : null}
        {walletEnabled ? <Button title={t('wallet.transactions')} variant="outline" onPress={() => router.push('/(farmer)/wallet/transactions')} /> : null}
        {walletEnabled ? <Button title={t('wallet.payouts')} variant="outline" onPress={() => router.push('/(farmer)/wallet/payouts')} /> : null}
        {walletEnabled ? <Button title={t('wallet.insights')} variant="outline" onPress={() => router.push('/(farmer)/wallet/earnings')} /> : null}
        {walletEnabled ? <Button title={t('wallet.autopay')} variant="outline" onPress={() => router.push('/(farmer)/wallet/autopay')} /> : null}
      </View>

      {failed ? <View style={{ marginTop: space[3] }}><Button title={t('common.retry')} variant="outline" onPress={load} /></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: color.primary600, paddingVertical: space[8], alignItems: 'center', gap: space[2] },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.primary100 },
  actions: { marginTop: space[4], gap: space[3] },
  notice: { fontFamily: font.body, fontSize: font.size.md, color: color.successDark, marginBottom: space[3], textAlign: 'center' },
});
