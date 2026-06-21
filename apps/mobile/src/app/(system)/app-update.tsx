// apps/mobile/src/app/(system)/app-update.tsx · screen 190 (forced/optional update). Thin screen (guide §3): when
// the configured minimum supported version is above the current build, this blocks with an "update required"
// state + a store link (forced-update floor, §8). If no min is set / current ≥ min, it shows "you're up to date".
// Static (config-driven), no backend. Degrade-never-die.
import React from 'react';
import { View, Text, StyleSheet, Linking, Platform, Alert } from 'react-native';
import { Button, Card, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { config } from '../../core/config';
import { isUpdateRequired } from '../../features/system/system';

export default function AppUpdate() {
  const { t } = useTranslation();
  const required = isUpdateRequired(config.appVersion, config.minSupportedVersion);
  const storeUrl = Platform.OS === 'ios' ? config.iosStoreUrl : config.androidStoreUrl;

  const openStore = () => {
    if (storeUrl && /^https:\/\//i.test(storeUrl)) Linking.openURL(storeUrl).catch(() => Alert.alert(t('system.update.title'), t('common.error.generic')));
    else Alert.alert(t('system.update.title'), t('system.update.noStore'));
  };

  return (
    <ScreenScaffold title={t('system.update.title')}>
      <Card>
        <Text style={styles.h}>{required ? t('system.update.requiredHeading') : t('system.update.currentHeading')}</Text>
        <Text style={styles.body}>{required ? t('system.update.requiredBody') : t('system.update.currentBody')}</Text>
        <Text style={styles.ver}>{t('system.update.version', { v: config.appVersion })}</Text>
        {required ? <View style={{ marginTop: space[4] }}><Button title={t('system.update.cta')} onPress={openStore} /></View> : null}
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink900 },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, marginTop: space[2], lineHeight: 22 },
  ver: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
