// apps/mobile/src/app/(ambassador)/onboard-complete.tsx · screen 91 (onboarding ready). Thin screen (guide §3):
// shows the created referral code for the ambassador to share; the farmer signs up and claims it (attribution +
// commission recorded SERVER-SIDE). Links to the (flagged) doc-scan / verify helper steps. Behind `ambassador_app`.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

export default function OnboardComplete() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_app');
  if (!enabled) return <ScreenScaffold title={t('amb.onboard.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('amb.onboard.completeTitle')}>
      <Card>
        <Text style={styles.h}>✓ {t('amb.onboard.complete.heading')}</Text>
        <Text style={styles.body}>{t('amb.onboard.complete.body')}</Text>
        {code ? <View style={styles.codeBox}><Text style={styles.code} accessibilityLabel={t('amb.onboard.codeLabel')}>{code}</Text></View> : null}
        <Text style={styles.steps}>{t('amb.onboard.complete.steps')}</Text>
      </Card>
      <View style={{ marginTop: space[4], gap: space[3] }}>
        <Button title={t('amb.onboard.scanStep')} variant="outline" onPress={() => router.push('/(ambassador)/onboard-scan')} />
        <Button title={t('amb.onboard.verifyStep')} variant="outline" onPress={() => router.push('/(ambassador)/onboard-verify')} />
        <Button title={t('amb.onboard.done')} onPress={() => router.replace('/(ambassador)/farmers')} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.successDark, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  codeBox: { marginTop: space[3], paddingVertical: space[4], alignItems: 'center', backgroundColor: color.primary50, borderRadius: 12 },
  code: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.primary800, letterSpacing: 3 },
  steps: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3] },
});
