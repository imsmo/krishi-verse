// apps/mobile/src/app/(system)/change-phone.tsx · screen 176 (change phone). Thin screen (guide §3): two steps —
// enter the new number (server sends an OTP to it, enumeration-safe) → confirm with the OTP. Behind `system_screens`.
// Degrade-never-die. NOTE: the change-phone endpoints aren't live yet → an honest "unavailable" message (flagged).
// We validate E.164-ish on the client for UX; the server re-validates + owns the OTP.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, OtpInput, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { startPhoneChange, confirmPhoneChange } from '../../features/system/system.api';

const PHONE_RE = /^[6-9]\d{9}$/; // India 10-digit mobile (server re-validates + normalizes to E.164)

export default function ChangePhone() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'enter' | 'verify'>('enter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('system.changePhone.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const start = async () => {
    if (!PHONE_RE.test(phone.trim())) { setError(t('system.changePhone.phoneInvalid')); return; }
    setBusy(true); setError(undefined);
    const r = await startPhoneChange(`+91${phone.trim()}`);
    if (r.ok) setStep('verify'); else setError(t('system.changePhone.unavailable'));
    setBusy(false);
  };
  const confirm = async () => {
    setBusy(true); setError(undefined);
    const r = await confirmPhoneChange(`+91${phone.trim()}`, code);
    if (r.ok) router.back(); else setError(t('system.changePhone.codeInvalid'));
    setBusy(false);
  };

  return (
    <ScreenScaffold title={t('system.changePhone.title')}>
      <Card>
        {step === 'enter' ? (
          <>
            <Text style={styles.body}>{t('system.changePhone.intro')}</Text>
            <Input label={t('system.changePhone.newPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} error={error} />
            <View style={{ marginTop: space[3] }}><Button title={t('system.changePhone.sendOtp')} loading={busy} onPress={start} /></View>
          </>
        ) : (
          <>
            <Text style={styles.body}>{t('system.changePhone.enterOtp', { phone: `+91 ${phone}` })}</Text>
            <OtpInput value={code} onChange={setCode} length={6} />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <View style={{ marginTop: space[3] }}><Button title={t('system.changePhone.confirm')} loading={busy} disabled={code.length < 6} onPress={confirm} /></View>
          </>
        )}
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, marginBottom: space[3] },
  err: { fontFamily: font.body, fontSize: font.size.sm, color: color.danger, marginTop: space[2] },
});
