// apps/mobile/src/app/(owner)/disputes.tsx · screen 155 (dispute moderation queue). Thin screen (guide §3): the
// tenant moderation view (box=all) — needs dispute.resolve (server-enforced). Tap to action. Behind
// `tenant_admin_lite`. Keyset; degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Dispute } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { disputesList } from '../../features/tenant/tenant.api';
import { disputeStatusTone } from '../../features/tenant/tenant-admin';

export default function Disputes() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await disputesList(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.tabs.disputes')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.tabs.disputes')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('owner.disputes.empty.title')} message={t('owner.disputes.empty.message')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(owner)/dispute/[id]', params: { id: item.id } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.no}>{t('owner.dispute.ref', { id: item.id.slice(0, 8).toUpperCase() })}</Text>
                  <StatusPill label={t(`owner.disputeStatus.${item.status}`, { defaultValue: item.status })} tone={disputeStatusTone(item.status)} />
                </View>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
              </Card>
            </Pressable>
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
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  desc: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
