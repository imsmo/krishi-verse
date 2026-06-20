// apps/mobile/src/app/(auth)/welcome.tsx · screen 01. The brand hero + single primary CTA into the flow. Pure
// presentation; no data. Localized via useTranslation.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';

export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <ScreenScaffold scroll={false} footer={<Button title={t('welcome.getStarted')} onPress={() => router.push('/(auth)/language')} />}>
      <View style={styles.hero}>
        <View style={styles.logo}><Text style={styles.logoMark}>🌾</Text></View>
        <Text style={styles.brand}>{t('app.name')}</Text>
        <Text style={styles.tag}>{t('welcome.tagline')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], paddingHorizontal: space[6] },
  logo: { width: 88, height: 88, borderRadius: radius.xl, backgroundColor: color.primary600, alignItems: 'center', justifyContent: 'center', marginBottom: space[4] },
  logoMark: { fontSize: 44 },
  brand: { fontFamily: font.display, fontSize: font.size['3xl'], fontWeight: font.weight.bold, color: color.ink800 },
  tag: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary700, letterSpacing: 1, textTransform: 'uppercase' },
  subtitle: { fontFamily: font.body, fontSize: font.size.lg, color: color.ink500, textAlign: 'center', marginTop: space[2] },
});
