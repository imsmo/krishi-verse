// apps/mobile/src/app/(ambassador)/onboard-verify.tsx · screen 90 (OTP-consent / verify). FLAGGED: ambassador-
// driven OTP-consent that creates/verifies the farmer's account on their behalf has no endpoint — phone-OTP auth
// is enumeration-safe and self-service (the farmer verifies their OWN number, P-01), never proxied by another
// user. So this explains the real consent flow instead of faking an on-behalf verify. Behind `ambassador_app`.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function OnboardVerify() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_app');
  return (
    <ScreenScaffold title={t('amb.onboard.verifyTitle')}>
      <EmptyState title={enabled ? t('amb.onboard.verify.title') : t('common.unavailable')} message={enabled ? t('amb.onboard.verify.message') : undefined} />
    </ScreenScaffold>
  );
}
