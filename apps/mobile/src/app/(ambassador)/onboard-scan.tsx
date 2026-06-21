// apps/mobile/src/app/(ambassador)/onboard-scan.tsx · screen 89 (assisted doc scan). FLAGGED: there is no
// ambassador-assisted "create the farmer's account from scanned docs" endpoint (account creation is the farmer's
// own self-service OTP + KYC, P-01/P-03; admin user-create is back-office, Law 11). So rather than fake a
// create-account-from-scan call, this screen explains the real flow (the farmer scans their own docs during their
// KYC after claiming the code). Behind `ambassador_app`.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function OnboardScan() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_app');
  return (
    <ScreenScaffold title={t('amb.onboard.scanTitle')}>
      <EmptyState title={enabled ? t('amb.onboard.scan.title') : t('common.unavailable')} message={enabled ? t('amb.onboard.scan.message') : undefined} />
    </ScreenScaffold>
  );
}
