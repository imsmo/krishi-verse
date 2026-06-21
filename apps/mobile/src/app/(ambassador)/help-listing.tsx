// apps/mobile/src/app/(ambassador)/help-listing.tsx · screen 162 (help a farmer list produce). FLAGGED: there is
// no "create a listing on behalf of another user" endpoint — listings are created by the listing's OWNER (the
// farmer), and the app never impersonates (Law 4/11). So this is a step-by-step GUIDE the ambassador follows with
// the farmer on the farmer's own device/login; it does not POST a listing as someone else. Behind `ambassador_app`.
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function HelpListing() {
  const { t } = useTranslation();
  const enabled = useFlag('ambassador_app');
  if (!enabled) return <ScreenScaffold title={t('amb.help.listingTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  return (
    <ScreenScaffold title={t('amb.help.listingTitle')}>
      <Card>
        <Text style={styles.h}>{t('amb.help.listing.heading')}</Text>
        <Text style={styles.body}>{t('amb.help.listing.steps')}</Text>
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
