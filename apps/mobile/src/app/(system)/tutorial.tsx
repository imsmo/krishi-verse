// apps/mobile/src/app/(system)/tutorial.tsx · screen 186 (tutorial / how-it-works). Thin screen (guide §3): a short
// paged intro to the app's core actions. Static (no backend). Degrade-never-die.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';

const STEPS = ['sell', 'buy', 'pay', 'help'] as const;

export default function Tutorial() {
  const { t } = useTranslation();
  const router = useRouter();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <ScreenScaffold title={t('system.tutorial.title')}>
      <Card style={styles.card}>
        <Text style={styles.step}>{i + 1} / {STEPS.length}</Text>
        <Text style={styles.h}>{t(`system.tutorial.${step}.title`)}</Text>
        <Text style={styles.body}>{t(`system.tutorial.${step}.body`)}</Text>
      </Card>
      <View style={styles.actions}>
        {i > 0 ? <Button title={t('common.back')} variant="outline" onPress={() => setI((n) => n - 1)} /> : null}
        <View style={{ flex: 1 }}>
          <Button title={last ? t('system.tutorial.done') : t('common.next')} onPress={() => (last ? router.back() : setI((n) => n + 1))} />
        </View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 200 },
  step: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400 },
  h: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink900, marginTop: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, marginTop: space[2], lineHeight: 22 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[4] },
});
