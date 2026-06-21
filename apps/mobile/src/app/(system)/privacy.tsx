// apps/mobile/src/app/(system)/privacy.tsx · screen 178 (privacy & data). Thin screen (guide §3): DPDP rights hub —
// open the privacy policy (https), request a data export (179), or delete the account (177). Behind `system_screens`.
import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { config } from '../../core/config';

export default function Privacy() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');

  if (!enabled) return <ScreenScaffold title={t('system.privacy.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const openUrl = (url?: string) => {
    if (url && /^https:\/\//i.test(url)) Linking.openURL(url).catch(() => Alert.alert(t('system.privacy.title'), t('common.error.generic')));
    else Alert.alert(t('system.privacy.title'), t('system.privacy.noPolicy'));
  };

  return (
    <ScreenScaffold title={t('system.privacy.title')}>
      <Text style={styles.note}>{t('system.privacy.intro')}</Text>
      <View style={{ gap: space[2] }}>
        <Card onPress={() => openUrl(config.privacyUrl)} accessibilityLabel={t('system.privacy.policy')}><Text style={styles.link}>{t('system.privacy.policy')} →</Text></Card>
        <Card onPress={() => router.push('/(system)/data-download')} accessibilityLabel={t('system.dataDownload.title')}><Text style={styles.link}>{t('system.dataDownload.title')} →</Text></Card>
        <Card onPress={() => router.push('/(system)/account-delete')} accessibilityLabel={t('system.accountDelete.title')}><Text style={styles.linkDanger}>{t('system.accountDelete.title')} →</Text></Card>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[3] },
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700 },
  linkDanger: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.danger },
});
