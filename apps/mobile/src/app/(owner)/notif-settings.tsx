// apps/mobile/src/app/(owner)/notif-settings.tsx · screen 160 (notification settings). Channel/template config →
// web console handoff (P-18); personal device notification prefs live in the user's own settings. Behind
// `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function NotifSettings() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.notifSettings.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.notifSettings.title" bodyKey="owner.notifSettings.body" path={WEB_PATHS.notifications} />;
}
