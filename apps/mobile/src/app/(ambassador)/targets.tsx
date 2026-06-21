// apps/mobile/src/app/(ambassador)/targets.tsx · screen 169 (targets). FLAGGED: there is no ambassador targets/
// quota endpoint yet (the profile carries no target fields), so targets are stated as coming rather than faked.
// Behind `ambassador_training`.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function Targets() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_training');
  return (
    <ScreenScaffold title={t('amb.targets.title')}>
      <EmptyState title={enabled ? t('amb.targets.soon.title') : t('common.unavailable')} message={enabled ? t('amb.targets.soon.message') : undefined} />
    </ScreenScaffold>
  );
}
