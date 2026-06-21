// apps/mobile/src/app/(worker)/insurance.tsx · screens 39/145/146 (insurance + PMSBY enrol + claim). FLAGGED: the
// fintech module ships loans only — there is NO insurance/PMSBY enrolment or claim endpoint yet. Per the guide we
// do NOT fake a policy, premium, or claim flow; this screen honestly states the capability is coming and links
// back, rather than wiring fabricated data into the UI. Behind `worker_active_job`. Reads nothing.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function WorkerInsurance() {
  const { t } = useTranslation();
  const enabled = useFlag('worker_active_job');
  return (
    <ScreenScaffold title={t('worker.insurance.title')}>
      <EmptyState title={enabled ? t('worker.insurance.soon.title') : t('common.unavailable')} message={enabled ? t('worker.insurance.soon.message') : undefined} />
    </ScreenScaffold>
  );
}
