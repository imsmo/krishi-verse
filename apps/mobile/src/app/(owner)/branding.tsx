// apps/mobile/src/app/(owner)/branding.tsx · screen 82 (branding). Logo/theme editing → web console handoff
// (P-18). Behind `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function Branding() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.branding.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.branding.title" bodyKey="owner.branding.body" path={WEB_PATHS.branding} />;
}
