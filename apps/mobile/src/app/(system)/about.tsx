// apps/mobile/src/app/(system)/about.tsx · screen 196 (about). Thin screen (guide §3): app name + version + env +
// links to the privacy policy / terms (https). Static (config-driven), no backend. Degrade-never-die.
import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { Card, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { config } from '../../core/config';

export default function About() {
  const { t } = useTranslation();
  const open = (url?: string) => {
    if (url && /^https:\/\//i.test(url)) Linking.openURL(url).catch(() => Alert.alert(t('system.about.title'), t('common.error.generic')));
    else Alert.alert(t('system.about.title'), t('system.about.noLink'));
  };
  return (
    <ScreenScaffold title={t('system.about.title')}>
      <Card>
        <Text style={styles.name}>{t('app.name')}</Text>
        <Row k={t('system.about.version')} v={config.appVersion} />
        <Row k={t('system.about.env')} v={config.appEnv} />
      </Card>
      <View style={{ gap: space[2], marginTop: space[3] }}>
        <Card onPress={() => open(config.privacyUrl)} accessibilityLabel={t('system.privacy.policy')}><Text style={styles.link}>{t('system.privacy.policy')} →</Text></Card>
        <Card onPress={() => open(config.termsUrl)} accessibilityLabel={t('system.about.terms')}><Text style={styles.link}>{t('system.about.terms')} →</Text></Card>
      </View>
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>; }

const styles = StyleSheet.create({
  name: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink900, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[1] },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, textTransform: 'capitalize' },
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700 },
});
