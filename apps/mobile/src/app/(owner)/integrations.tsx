// apps/mobile/src/app/(owner)/integrations.tsx · screen 161 (integrations). API keys/webhooks → web console handoff
// (P-18; secrets are never edited on mobile). Behind `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function Integrations() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.integrations.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.integrations.title" bodyKey="owner.integrations.body" path={WEB_PATHS.integrations} noteKey="owner.integrations.note" />;
}
