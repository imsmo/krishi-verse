// apps/mobile/src/app/(ambassador)/farmers.tsx · screen 87 (my farmers / referrals). Thin screen (guide §3): the
// ambassador's referrals (the farmers they've brought on), newest-first keyset, each showing its funnel status.
// Behind `ambassador_app`. Degrade-never-die. PII-minimised — a referral exposes only code + status, never the
// referred farmer's name/phone.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Referral } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { listReferrals } from '../../features/ambassador/ambassador.api';
import { referralStatusTone, isConverted } from '../../features/ambassador/referral-flow';

export default function Farmers() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_app');
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await listReferrals(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('amb.tabs.farmers')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('amb.tabs.farmers')} footer={<Button title={t('amb.onboard.cta')} onPress={() => router.push('/(ambassador)/onboard-start')} />}>
      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('amb.farmers.empty.title')} message={t('amb.farmers.empty.message')} actionLabel={t('amb.onboard.cta')} onAction={() => router.push('/(ambassador)/onboard-start')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.code}>{item.code}</Text>
                <StatusPill label={t(`amb.referralStatus.${item.status}`)} tone={referralStatusTone(item.status)} />
              </View>
              <Text style={styles.meta}>{t(isConverted(item.status) ? 'amb.farmers.onboarded' : 'amb.farmers.invitedOnly')}</Text>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, letterSpacing: 1 },
  meta: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
