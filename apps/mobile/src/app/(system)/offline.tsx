// apps/mobile/src/app/(system)/offline.tsx · screen 188 (offline fallback). Thin screen (guide §3): a friendly
// "no connection" state with retry. A global fallback (Law 12) — static, no backend. When connectivity returns the
// caller can retry; queued writes replay automatically (sync engine).
import React from 'react';
import { useRouter } from 'expo-router';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useConnectivity } from '../../core/connectivity/connectivity';

export default function Offline() {
  const { t } = useTranslation();
  const router = useRouter();
  const online = useConnectivity();
  return (
    <ScreenScaffold title={t('system.offline.title')}>
      <EmptyState
        title={t('system.offline.heading')}
        message={online ? t('system.offline.back') : t('system.offline.message')}
        actionLabel={t('common.retry')}
        onAction={() => router.back()}
      />
    </ScreenScaffold>
  );
}
