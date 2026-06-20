// apps/mobile/src/app/(auth)/language.tsx · screen 02. Pick the UI language (hi/en/gu). Selecting one applies it
// immediately (the whole app re-renders via the i18n runtime) and persists it, then continues to phone entry.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LANGUAGES } from '@krishi-verse/i18n';
import { Button, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';

export default function LanguageScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { setLanguage } = useAuth();
  return (
    <ScreenScaffold
      title={t('language.title')}
      subtitle={t('language.subtitle')}
      footer={<Button title={t('common.continue')} onPress={() => router.push('/(auth)/phone')} />}
    >
      <View style={{ gap: space[3] }}>
        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <Pressable key={l.code} onPress={() => setLanguage(l.code)} style={[styles.row, active && styles.rowActive]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <View>
                <Text style={styles.native}>{l.nameNative}</Text>
                <Text style={styles.english}>{l.nameEnglish}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioOn]}>{active ? <Text style={styles.tick}>✓</Text> : null}</View>
            </Pressable>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[4], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  rowActive: { borderColor: color.primary600, backgroundColor: color.primary50 },
  native: { fontFamily: font.body, fontSize: font.size.xl, fontWeight: font.weight.semibold, color: color.ink800 },
  english: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: 2 },
  radio: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 2, borderColor: color.ink300, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.primary600, backgroundColor: color.primary600 },
  tick: { color: color.white, fontWeight: '700', fontSize: 14 },
});
