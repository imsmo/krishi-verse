// apps/mobile/src/app/(owner)/approvals.tsx · screen 147 (approval queue). Thin screen (guide §3): pending role
// assignments (e.g. farmers awaiting approval into the tenant). Tap to review + approve. Needs identity.report to
// read, identity.approve to act — authorized SERVER-SIDE (NOT god-mode, Law 11). Behind `tenant_admin_lite`.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { RoleAssignment } from '@krishi-verse/sdk-js';
import { Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { assignments } from '../../features/tenant/tenant.api';
import { approvalStatusTone } from '../../features/tenant/tenant-admin';

export default function Approvals() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [items, setItems] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await assignments({ pendingOnly: true })); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.tabs.approvals')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.tabs.approvals')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('owner.approvals.empty.title')} message={t('owner.approvals.empty.message')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/(owner)/approve/[id]', params: { id: item.id, userId: item.userId, roleCode: item.roleCode } })} accessibilityRole="button">
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.role}>{t(`role.${item.roleCode}`, { defaultValue: item.roleCode })}</Text>
                  <StatusPill label={t(`kyc.status.${item.kycStatus}`)} tone={approvalStatusTone(item.kycStatus)} />
                </View>
                <Text style={styles.id}>{t('owner.farmer.ref', { id: item.userId.slice(0, 8).toUpperCase() })}</Text>
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
  role: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  id: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
});
