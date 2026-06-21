// apps/mobile/src/app/(farmer)/profile.tsx · the profile/settings tab. Shows the signed-in identity, an inline
// language switcher (applies + persists instantly), and Sign out (clears the encrypted token store → back to
// onboarding). Minimal but real; deeper profile/KYC/bank screens are later in the backlog.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LANGUAGES } from '@krishi-verse/i18n';
import { Button, Card, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';
import { useFlag } from '../../core/flags/useFlag';

export default function Profile() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { state, setLanguage, signOut } = useAuth();
  const kycEnabled = useFlag('kyc');
  const profileOn = useFlag('farmer_profile');

  const onSignOut = async () => { await signOut(); router.replace('/(auth)/welcome'); };

  const LINKS: Array<{ key: string; route: string; label: string }> = [
    { key: 'edit', route: '/(farmer)/profile/edit', label: t('profile.editProfile') },
    { key: 'farm', route: '/(farmer)/profile/farm', label: t('profile.farmDetails') },
    { key: 'bank', route: '/(farmer)/profile/bank', label: t('profile.bankAccounts') },
    { key: 'docs', route: '/(farmer)/profile/documents', label: t('profile.documents') },
    { key: 'help', route: '/(farmer)/profile/help', label: t('profile.help') },
  ];

  return (
    <ScreenScaffold title={t('tabs.profile')}>
      <Card>
        <Text style={styles.name}>{state.profile?.displayName ?? '—'}</Text>
        <Text style={styles.sub}>{(state.activeRole ?? 'farmer')}</Text>
      </Card>

      <Text style={styles.section}>{t('language.title')}</Text>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        {LANGUAGES.map((l) => {
          const active = l.code === lang;
          return (
            <Pressable key={l.code} onPress={() => setLanguage(l.code)} style={[styles.chip, active && styles.chipOn]}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{l.nameNative}</Text>
            </Pressable>
          );
        })}
      </View>

      {profileOn ? (
        <View style={{ marginTop: space[6], gap: space[2] }}>
          {LINKS.map((l) => (
            <Card key={l.key} onPress={() => router.push(l.route as never)} accessibilityLabel={l.label}>
              <Text style={styles.link}>{l.label} →</Text>
            </Card>
          ))}
        </View>
      ) : kycEnabled ? (
        <View style={{ marginTop: space[6] }}>
          <Card onPress={() => router.push('/(farmer)/kyc')} accessibilityLabel={t('profile.kyc')}>
            <Text style={styles.link}>{t('profile.kyc')} →</Text>
          </Card>
        </View>
      ) : null}

      <View style={{ marginTop: space[8] }}>
        <Button title={t('common.signOut')} variant="outline" onPress={onSignOut} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800 },
  sub: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, marginTop: 2, textTransform: 'capitalize' },
  section: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[6], marginBottom: space[2] },
  chip: { paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  link: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.primary700 },
});
