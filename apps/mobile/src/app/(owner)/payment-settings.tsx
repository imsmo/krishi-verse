// apps/mobile/src/app/(owner)/payment-settings.tsx · screen 159 (payment settings). Sensitive config → web console
// handoff (P-18). Behind `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function PaymentSettings() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.paymentSettings.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.paymentSettings.title" bodyKey="owner.paymentSettings.body" path={WEB_PATHS.paymentSettings} />;
}
