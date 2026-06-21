// apps/mobile/src/app/(ambassador)/leaderboard.tsx · screen 93 (leaderboard). FLAGGED: the ambassadors module has
// no leaderboard/ranking endpoint yet, so rather than fabricate ranks this screen states it's coming. The honest
// signal an ambassador already has is their own funnel (Home) + commission ledger. Behind `ambassador_training`.
import React from 'react';
import { ScreenScaffold, EmptyState } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function Leaderboard() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_training');
  return (
    <ScreenScaffold title={t('amb.leaderboard.title')}>
      <EmptyState title={enabled ? t('amb.leaderboard.soon.title') : t('common.unavailable')} message={enabled ? t('amb.leaderboard.soon.message') : undefined} />
    </ScreenScaffold>
  );
}
