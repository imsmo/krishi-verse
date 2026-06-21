// apps/mobile/src/app/(ambassador)/onboard-start.tsx · screen 88 (onboard a farmer — start). Thin screen
// (guide §3): the REAL, attributable onboarding mechanism — the ambassador creates a referral CODE (validated
// client-side, server re-validates + records attribution). The farmer then self-signs-up and claims it. create is
// idempotent (Law 3) and throws on a real error (409 the code is taken). Behind `ambassador_app`.
//
// FLAGGED (NOT faked): the spec's "scan farmer docs + create the farmer's account for them" needs an
// ambassador-assisted registration endpoint that does NOT exist (account creation is self-service OTP; admin
// user-create is back-office, Law 11). So doc-scan / verify are explained as the farmer's own next steps (88→
// scan/verify are informational) rather than a fabricated create-account call.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { createReferral } from '../../features/ambassador/ambassador.api';
import { normalizeReferralCode, isValidReferralCode } from '../../features/ambassador/referral-flow';

export default function OnboardStart() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_app');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('amb.onboard.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const norm = normalizeReferralCode(code);
  const valid = isValidReferralCode(norm);

  const onCreate = async () => {
    if (!valid) { setError(t('amb.onboard.codeInvalid')); return; }
    setBusy(true); setError(undefined);
    try {
      const r = await createReferral(norm);
      router.replace({ pathname: '/(ambassador)/onboard-complete', params: { code: r.code } });
    } catch (e) {
      setError(e instanceof SdkError && e.isConflict ? t('amb.onboard.codeTaken') : t('amb.onboard.createFailed'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('amb.onboard.title')} footer={<Button title={t('amb.onboard.create')} onPress={onCreate} loading={busy} disabled={busy || !valid} />}>
      <Card>
        <Text style={styles.h}>{t('amb.onboard.start.heading')}</Text>
        <Text style={styles.body}>{t('amb.onboard.start.body')}</Text>
        <View style={{ marginTop: space[3] }}>
          <Input label={t('amb.onboard.codeLabel')} value={code} onChangeText={setCode} maxLength={20} placeholder="RAMESH24" error={error} />
        </View>
        {code && !valid ? <Text style={styles.hint}>{t('amb.onboard.codeRule')}</Text> : null}
      </Card>
      <Card style={{ marginTop: space[3] }}>
        <Text style={styles.note}>{t('amb.onboard.docsNote')}</Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  hint: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400 },
});
