// apps/mobile/src/app/(auth)/verify.tsx · screen 03b. Enter the 6-digit OTP. Verifies via the SDK, stores tokens
// in the auth store (→ secure storage), and moves to role selection. Resend is gated by a cooldown clock
// (otp.flow). A wrong/expired code maps to a friendly message and clears the field; repeated failures surface the
// API's throttle message — we never reveal whether the number exists (enumeration-safe).
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, OtpInput, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { verifyOtp, requestOtp, resendSecondsRemaining } from '../../core/auth/otp.flow';
import { newId } from '../../core/util/ids';
import { useAuth } from '../../core/auth/auth.store';
import { useSecureScreen } from '../../core/security';

export default function VerifyScreen() {
  useSecureScreen(); // OTP on screen — block screenshots/recording (§4)
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(Date.now());
  const [remaining, setRemaining] = useState(resendSecondsRemaining(Date.now(), Date.now()));

  useEffect(() => {
    const id = setInterval(() => setRemaining(resendSecondsRemaining(sentAt, Date.now())), 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  const onVerify = async (value: string) => {
    if (!phone || value.length !== 6 || busy) return;
    setBusy(true); setError(undefined);
    try {
      const tokens = await verifyOtp(phone, value, newId());
      await signIn(tokens);
      router.replace('/(auth)/role');
    } catch (e) {
      // Log the real cause to the Metro terminal (status/code/message) so failures are diagnosable; UI stays friendly.
      console.error('[verify] verifyOtp failed:', JSON.stringify({ message: (e as any)?.message, code: (e as any)?.code, status: (e as any)?.status }), e);
      const code = e instanceof SdkError ? e.code : '';
      setError(/too many|rate|throttle/i.test(code) ? t('otp.error.tooMany') : t('otp.error.invalid'));
      setCode('');
    } finally { setBusy(false); }
  };

  const onResend = async () => {
    if (remaining > 0 || !phone) return;
    try { await requestOtp(phone, newId()); setSentAt(Date.now()); setRemaining(resendSecondsRemaining(Date.now(), Date.now(), 30)); } catch { /* ignore */ }
  };

  return (
    <ScreenScaffold
      title={t('otp.verifyTitle')}
      subtitle={t('otp.verifyHint', { phone: phone ?? '' })}
      footer={<Button title={t('otp.verifyCta')} onPress={() => onVerify(code)} loading={busy} disabled={code.length !== 6} />}
    >
      <OtpInput value={code} onChange={setCode} onComplete={onVerify} autoFocus error={!!error} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.resend} onPress={onResend}>
        {remaining > 0 ? t('otp.resendIn', { seconds: remaining }) : t('otp.resend')}
      </Text>
      <Text style={styles.safety}>🔒 {t('otp.safety')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: font.body, fontSize: font.size.md, color: color.dangerDark, textAlign: 'center', marginTop: space[3] },
  resend: { fontFamily: font.body, fontSize: font.size.md, color: color.primary700, fontWeight: font.weight.semibold, textAlign: 'center', marginTop: space[4] },
  safety: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, textAlign: 'center', marginTop: space[6] },
});
