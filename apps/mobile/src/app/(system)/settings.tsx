// apps/mobile/src/app/(system)/settings.tsx · screen 75 (settings hub). Thin screen (guide §3): a list of links to
// the cross-cutting screens (language, privacy, permissions, tutorial, about, feedback) + sign out. Behind
// `system_screens`. Degrade-never-die.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useAuth } from '../../core/auth/auth.store';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');
  const notifOn = useFlag('notifications');
  const { signOut } = useAuth();

  if (!enabled) return <ScreenScaffold title={t('system.settings.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSignOut = async () => { await signOut(); router.replace('/(auth)/welcome'); };

  const LINKS: Array<{ key: string; route: string; label: string }> = [
    { key: 'search', route: '/(system)/search', label: t('system.search.title') },
    { key: 'language', route: '/(system)/language', label: t('system.language.title') },
    ...(notifOn ? [{ key: 'notif', route: '/(farmer)/notifications/settings', label: t('system.settings.notifications') }] : []),
    { key: 'privacy', route: '/(system)/privacy', label: t('system.privacy.title') },
    { key: 'permissions', route: '/(system)/permissions', label: t('system.permissions.title') },
    { key: 'feedback', route: '/(system)/feedback', label: t('system.feedback.title') },
    { key: 'tutorial', route: '/(system)/tutorial', label: t('system.tutorial.title') },
    { key: 'about', route: '/(system)/about', label: t('system.about.title') },
  ];

  return (
    <ScreenScaffold title={t('system.settings.title')}>
      <View style={{ gap: space[2] }}>
        {LINKS.map((l) => (
          <Card key={l.key} onPress={() => router.push(l.route as never)} accessibilityLabel={l.label}>
            <Text style={styles.link}>{l.label} →</Text>
          </Card>
        ))}
      </View>
      <View style={{ marginTop: space[8] }}>
        <Button title={t('common.signOut')} variant="outline" onPress={onSignOut} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.primary700 },
});
