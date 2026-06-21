// apps/mobile/src/app/(ambassador)/withdraw.tsx · screen 168 (withdraw commission). Thin screen (guide §3):
// reuses the SAME features/wallet data layer + PURE `withdrawable` pre-check — the ambassador withdraws their
// credited commission to a tokenised bank/UPI destination via a REAL, idempotent payout. The SERVER is the
// authority (balance/KYC/limits); the app never moves money (Law 11). FLAG_SECURE while shown. Behind
// `ambassador_training` AND `wallet`. Money is bigint paise (Law 2). Degrade-never-die. Re-uses the wallet i18n.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { BankAccount } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useSecureScreen } from '../../core/security/screen-guard';
import { rupeesToPaiseMinor } from '../../core/payments/money';
import { withdrawable } from '../../features/wallet/txn';
import { walletBalance, listBankAccounts, requestWithdrawal } from '../../features/wallet/wallet.api';

export default function AmbassadorWithdraw() {
  useSecureScreen();
  const router = useRouter();
  const { t, lang } = useTranslation();
  const enabled = useFlag('ambassador_training') && useFlag('wallet');

  const [balanceMinor, setBalanceMinor] = useState('0');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rupees, setRupees] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const [bal, accts] = await Promise.all([walletBalance(), listBankAccounts()]);
    setBalanceMinor(bal.balanceMinor);
    setAccounts(accts);
    setSelected((prev) => prev ?? accts.find((a) => a.isPrimary)?.id ?? accts[0]?.id ?? null);
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('withdraw.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const minor = rupeesToPaiseMinor(rupees);
  const check = withdrawable(balanceMinor, minor);
  const canSubmit = !!selected && check.ok && !busy;

  const onSubmit = async () => {
    if (!minor || !selected) { setError(t('addMoney.invalidAmount')); return; }
    if (!check.ok) { setError(t(check.reason === 'exceeds' ? 'withdraw.exceeds' : 'addMoney.invalidAmount')); return; }
    setBusy(true); setError(undefined);
    try {
      await requestWithdrawal(minor, selected);
      router.replace({ pathname: '/(ambassador)/commissions', params: { notice: t('withdraw.requested') } });
    } catch (e) {
      const msg = e instanceof SdkError && e.status === 403 ? t('withdraw.notAllowed')
        : e instanceof SdkError && (e.status === 409 || e.status === 422) ? t('withdraw.exceeds')
        : t('withdraw.failed');
      setError(msg);
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('withdraw.title')}
      footer={accounts.length ? <Button title={t('withdraw.submit')} onPress={onSubmit} loading={busy} disabled={!canSubmit} /> : undefined}
    >
      {loading ? <SkeletonCard lines={3} /> : accounts.length === 0 ? (
        <EmptyState title={t('withdraw.noAccount.title')} message={t('withdraw.noAccount.message')} />
      ) : (
        <>
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t('wallet.available')}</Text>
            <MoneyText minor={balanceMinor} langCode={lang} size="2xl" />
          </Card>
          <Text style={styles.section}>{t('withdraw.toAccount')}</Text>
          {accounts.map((a) => {
            const active = selected === a.id;
            return (
              <Pressable key={a.id} onPress={() => setSelected(a.id)} style={[styles.acct, active && styles.acctOn]} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={acctLabel(a)}>
                <Text style={[styles.acctText, active && styles.acctTextOn]}>{acctLabel(a)}</Text>
                {a.isPrimary ? <Text style={styles.primary}>{t('withdraw.primary')}</Text> : null}
              </Pressable>
            );
          })}
          <View style={{ marginTop: space[4] }}>
            <Input label={t('withdraw.amountLabel')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" maxLength={7} error={error} />
          </View>
          <Text style={styles.note}>{t('withdraw.note')}</Text>
        </>
      )}
    </ScreenScaffold>
  );
}

function acctLabel(a: BankAccount): string {
  if (a.accountKind === 'upi') return a.upiId ?? 'UPI';
  const tail = a.accountLast4 ? `•••• ${a.accountLast4}` : 'Bank';
  return a.ifsc ? `${tail} · ${a.ifsc}` : tail;
}

const styles = StyleSheet.create({
  balanceCard: { alignItems: 'center', gap: space[1], paddingVertical: space[5] },
  balanceLabel: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink600, marginTop: space[4], marginBottom: space[2] },
  acct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card, marginBottom: space[2], minHeight: 52 },
  acctOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  acctText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
  acctTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  primary: { fontFamily: font.body, fontSize: font.size.xs, color: color.primary700 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
