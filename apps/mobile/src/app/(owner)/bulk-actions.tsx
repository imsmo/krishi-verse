// apps/mobile/src/app/(owner)/bulk-actions.tsx · screen 149 (bulk actions). Mass edits/imports → web console
// handoff (P-18; bounded + audited there). Behind `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function BulkActions() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.bulk.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.bulk.title" bodyKey="owner.bulk.body" path={WEB_PATHS.bulkActions} />;
}
