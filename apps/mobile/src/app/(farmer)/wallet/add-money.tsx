// apps/mobile/src/app/(farmer)/wallet/add-money.tsx · screen 20 (add money). Thin screen: enter whole rupees →
// features/payments.addMoney (intent → Razorpay → poll). FLAG_SECURE while shown (money screen). Behind the
// payments_addmoney flag (kill-switch). Money is bigint minor units (rupees→paise via BigInt). Degrade-never-die:
// gateway/network failures show a friendly outcome, never a crash; the server webhook is the source of truth.
import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useSecureScreen } from '../../../core/security/screen-guard';
import { rupeesToPaiseMinor } from '../../../core/payments/money';
import { addMoney } from '../../../features/payments/payments.api';

export default function AddMoney() {
  useSecureScreen();
  const router = useRouter();
  const { t } = useTranslation();
  const enabled = useFlag('payments_addmoney');
  const [rupees, setRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) {
    return <ScreenScaffold title={t('addMoney.title')}><EmptyState title={t('addMoney.unavailable')} /></ScreenScaffold>;
  }

  const onPay = async () => {
    const minor = rupeesToPaiseMinor(rupees);
    if (!minor) { setError(t('addMoney.invalidAmount')); return; }
    setError(undefined); setBusy(true);
    try {
      const res = await addMoney(minor);
      const msgKey = res.outcome === 'success' ? 'addMoney.success' : res.outcome === 'failed' ? 'addMoney.failed' : 'addMoney.pending';
      router.replace({ pathname: '/(farmer)/wallet', params: { notice: t(msgKey) } });
    } catch {
      setError(t('addMoney.unavailable'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('addMoney.title')}
      footer={<Button title={t('addMoney.pay')} onPress={onPay} loading={busy} disabled={rupees.trim().length === 0} />}
    >
      <Input label={t('addMoney.amountLabel')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" autoFocus maxLength={7} error={error} />
      <Text style={styles.secure}>{t('addMoney.secure')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  secure: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
