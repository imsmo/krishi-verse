// apps/mobile/src/app/(ambassador)/help-order.tsx · screen 163 (help a farmer place an order). FLAGGED: like
// help-listing, there is no place-an-order-on-behalf endpoint — orders are placed by the buyer/farmer themselves
// (the app never impersonates). So this is a GUIDE the ambassador walks the farmer through on the farmer's own
// login, not a proxied order POST. Behind `ambassador_app`.
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function HelpOrder() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_app');
  if (!enabled) return <ScreenScaffold title={t('amb.help.orderTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return (
    <ScreenScaffold title={t('amb.help.orderTitle')}>
      <Card>
        <Text style={styles.h}>{t('amb.help.order.heading')}</Text>
        <Text style={styles.body}>{t('amb.help.order.steps')}</Text>
        <Text style={styles.note}>{t('amb.help.onBehalfNote')}</Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
