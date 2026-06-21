// apps/mobile/src/app/(owner)/broadcast.tsx · screen 157 (broadcast). FLAGGED: there is no mobile broadcast-send
// endpoint (composing + sending a campaign is a web-console capability), so we do NOT fake a send — we hand off to
// the console. Behind `tenant_admin_lite`.
import React from 'react';
import { EmptyState, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { WebHandoff } from '../../features/tenant/components/WebHandoff';
import { WEB_PATHS } from '../../features/tenant/web-console';
export default function Broadcast() {
  const { t } = useTranslation();
  if (!useFlag('tenant_admin_lite')) return <ScreenScaffold title={t('owner.broadcast.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return <WebHandoff titleKey="owner.broadcast.title" bodyKey="owner.broadcast.body" path={WEB_PATHS.broadcast} noteKey="owner.broadcast.note" />;
}
