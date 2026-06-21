// apps/mobile/src/app/(owner)/team.tsx · screen 83 (team / staff). Thin screen (guide §3): in-app hub to the real
// roster + approval flows (P-17). Editing roles/permissions in depth is heavy → web console handoff. Behind
// `tenant_admin_lite`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { openWebConsole } from '../../core/deeplink';

export default function Team() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [busy, setBusy] = useState(false);
  if (!enabled) return <ScreenScaffold title={t('owner.team.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  const manage = async () => { setBusy(true); try { const ok = await openWebConsole('/settings/team'); if (!ok) Alert.alert(t('owner.team.title'), t('owner.web.unavailable')); } finally { setBusy(false); } };
  return (
    <ScreenScaffold title={t('owner.team.title')}>
      <Card>
        <Text style={styles.body}>{t('owner.team.body')}</Text>
      </Card>
      <View style={styles.actions}>
        <Button title={t('owner.tabs.farmers')} variant="outline" onPress={() => router.push('/(owner)/farmers')} />
        <Button title={t('owner.tabs.approvals')} variant="outline" onPress={() => router.push('/(owner)/approvals')} />
        <Button title={t('owner.team.manageWeb')} variant="outline" loading={busy} onPress={manage} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  actions: { marginTop: space[4], gap: space[3] },
});
