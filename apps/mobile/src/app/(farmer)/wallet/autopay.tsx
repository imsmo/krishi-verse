// apps/mobile/src/app/(farmer)/wallet/autopay.tsx · screens 181/182 (UPI AutoPay mandates — list + register +
// cancel). Thin screen (guide §3): calls features/wallet → renders. A mandate is a standing instruction; the raw
// VPA is masked SERVER-side (we only ever show "ab***@psp"). The actual auto-debit collection is still PSP-gated
// (flagged) — registering records the instruction, it does NOT pull money. Behind the `wallet` flag.
// Degrade-never-die: a failed list → empty + retry. FLAG_SECURE (financial instrument on screen).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import type { AutopayMandate } from '@krishi-verse/sdk-js';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listAutopayMandates, registerAutopayMandate, cancelAutopayMandate } from '../../../features/wallet/wallet.api';
import { useSecureScreen } from '../../../core/security';

export default function Autopay() {
  useSecureScreen(); // a payment instrument (VPA + cap) on screen — FLAG_SECURE (§4)
  const { t } = useTranslation();
  const enabled = useFlag('wallet');
  const [items, setItems] = useState<AutopayMandate[]>([]);
  const [failed, setFailed] = useState(false);
  const [vpa, setVpa] = useState('');
  const [maxRupees, setMaxRupees] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await listAutopayMandates();
    setItems(res.items);
    setFailed(res.items.length === 0 && res.nextCursor === null && failed); // keep prior failure flag conservative
  }, [failed]);
  useEffect(() => { listAutopayMandates().then((r) => setItems(r.items)).catch(() => setFailed(true)); }, []);

  const submit = useCallback(async () => {
    const rupees = Number(maxRupees);
    if (!vpa.includes('@') || !Number.isFinite(rupees) || rupees <= 0) { Alert.alert(t('wallet.autopayInvalid')); return; }
    setBusy(true);
    try {
      const maxAmountMinor = String(Math.round(rupees * 100));   // rupees → paise (Law 2; integer minor units)
      await registerAutopayMandate({ vpa: vpa.trim(), purpose: 'general', maxAmountMinor, frequency: 'as_presented' });
      setVpa(''); setMaxRupees('');
      await load();
    } catch (e: any) {
      Alert.alert(e?.code === 'MANDATE_ALREADY_EXISTS' ? t('wallet.autopayExists') : t('common.errorGeneric'));
    } finally { setBusy(false); }
  }, [vpa, maxRupees, load, t]);

  const cancel = useCallback((id: string) => {
    Alert.alert(t('wallet.autopayCancelTitle'), t('wallet.autopayCancelMsg'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: async () => { try { await cancelAutopayMandate(id); await load(); } catch { Alert.alert(t('common.errorGeneric')); } } },
    ]);
  }, [load, t]);

  if (!enabled) return <ScreenScaffold title={t('wallet.autopay')}><EmptyState title={t('wallet.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('wallet.autopay')}>
      <Card style={styles.form}>
        <Text style={styles.formTitle}>{t('wallet.autopayNew')}</Text>
        <TextInput style={styles.input} placeholder={t('wallet.autopayVpaPlaceholder')} autoCapitalize="none" value={vpa} onChangeText={setVpa} />
        <TextInput style={styles.input} placeholder={t('wallet.autopayCapPlaceholder')} keyboardType="numeric" value={maxRupees} onChangeText={setMaxRupees} />
        <Button title={t('wallet.autopayRegister')} onPress={submit} disabled={busy} />
        <Text style={styles.note}>{t('wallet.autopayNote')}</Text>
      </Card>

      {items.length === 0 ? (
        <EmptyState title={t('wallet.autopayEmpty.title')} message={t('wallet.autopayEmpty.message')} />
      ) : items.map((m) => (
        <Card key={m.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vpa}>{m.vpaMasked}</Text>
            <Text style={styles.meta}>{t(`wallet.autopayPurpose.${m.purpose}`)} · {t(`wallet.autopayStatus.${m.status}`)}</Text>
          </View>
          {(m.status === 'pending' || m.status === 'active' || m.status === 'paused') ? (
            <Button title={t('wallet.autopayCancel')} variant="outline" onPress={() => cancel(m.id)} />
          ) : null}
        </Card>
      ))}

      {failed ? <View style={{ marginTop: space[3] }}><Button title={t('common.retry')} variant="outline" onPress={load} /></View> : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[3], marginBottom: space[4] },
  formTitle: { fontFamily: font.heading, fontSize: font.size.lg, color: color.text },
  input: { borderWidth: 1, borderColor: color.border, borderRadius: 8, paddingHorizontal: space[3], paddingVertical: space[2], fontFamily: font.body, fontSize: font.size.md, color: color.text },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[2] },
  vpa: { fontFamily: font.heading, fontSize: font.size.md, color: color.text },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space[1] },
});
