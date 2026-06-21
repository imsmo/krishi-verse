// apps/mobile/src/app/(owner)/analytics.tsx · screens 84/150/151/152 (KPIs + analytics). Thin screen (guide §3):
// lists the 15 CORE_REPORTS as a catalogue; tapping a report opens it on the web console (full charts live there).
// Entry to custom-report + export. Behind `tenant_admin_lite`. Degrade-never-die.
//
// FLAGGED (NOT faked): there is no mobile analytics/metrics READ API yet, so this app does NOT render figures it
// can't fetch — it shows WHICH reports exist and hands off to the web console to view them. No fabricated numbers.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { openWebConsole } from '../../core/deeplink';
import { CORE_REPORTS } from '../../features/tenant/web-console';

export default function Analytics() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [busy, setBusy] = useState(false);

  const openReport = useCallback(async (path: string) => {
    setBusy(true);
    try { const ok = await openWebConsole(path); if (!ok) Alert.alert(t('owner.analytics.title'), t('owner.web.unavailable')); }
    finally { setBusy(false); }
  }, [t]);

  if (!enabled) return <ScreenScaffold title={t('owner.analytics.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.analytics.title')}>
      <Text style={styles.lead}>{t('owner.analytics.lead')}</Text>
      <FlatList
        data={CORE_REPORTS}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Pressable disabled={busy} onPress={() => openReport(item.path)} accessibilityRole="button">
            <Card style={styles.card}>
              <Text style={styles.title}>{t(item.titleKey)}</Text>
              <Text style={styles.chev}>↗</Text>
            </Card>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable onPress={() => router.push('/(owner)/custom-report')} accessibilityRole="button"><Text style={styles.link}>{t('owner.analytics.custom')} →</Text></Pressable>
            <Pressable onPress={() => router.push('/(owner)/export')} accessibilityRole="button"><Text style={styles.link}>{t('owner.analytics.export')} →</Text></Pressable>
          </View>
        }
        contentContainerStyle={{ paddingBottom: space[6] }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginBottom: space[3] },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  title: { flex: 1, fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  chev: { fontFamily: font.body, fontSize: font.size.lg, color: color.primary600 },
  footer: { marginTop: space[3], gap: space[3] },
  link: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.primary700, paddingVertical: space[2] },
});
