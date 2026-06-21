// apps/mobile/src/app/(ambassador)/goal-setting.tsx · screen 170 (goal-setting). FLAGGED: no endpoint to persist
// an ambassador's self-set goals yet, so this states it's coming rather than storing goals only on-device (which
// would be misleading). Behind `ambassador_training`.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function GoalSetting() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_training');
  return (
    <ScreenScaffold title={t('amb.goals.title')}>
      <EmptyState title={enabled ? t('amb.goals.soon.title') : t('common.unavailable')} message={enabled ? t('amb.goals.soon.message') : undefined} />
    </ScreenScaffold>
  );
}
