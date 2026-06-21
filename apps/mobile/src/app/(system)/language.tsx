// apps/mobile/src/app/(system)/language.tsx · screen 187 (language switcher). Thin screen (guide §3): pick the app
// language (hi/en/gu); applies + persists instantly via the auth store. Static (no backend) — renders regardless
// of flags so the user can always change language. Degrade-never-die.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LANGUAGES } from '@krishi-verse/i18n';
import { Card, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';

export default function LanguageSwitcher() {
  const { t, lang } = useTranslation();
  const { setLanguage } = useAuth();

  return (
    <ScreenScaffold title={t('system.language.title')}>
      <Text style={styles.note}>{t('system.language.note')}</Text>
      <View style={{ gap: space[2] }}>
        {LANGUAGES.map((l) => {
          const on = l.code === lang;
          return (
            <Pressable key={l.code} onPress={() => setLanguage(l.code)} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Card style={[styles.card, on && styles.cardOn]}>
                <View style={styles.row}>
                  <Text style={styles.name}>{l.nameNative}</Text>
                  {on ? <Text style={styles.check}>✓</Text> : null}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[3] },
  card: { borderWidth: 1.5, borderColor: color.ink100, borderRadius: radius.lg },
  cardOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  check: { fontFamily: font.body, fontSize: font.size.lg, color: color.primary700 },
});
