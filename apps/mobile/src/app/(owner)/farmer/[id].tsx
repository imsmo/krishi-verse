// apps/mobile/src/app/(owner)/farmer/[id].tsx · screen 77 (farmer detail). Thin screen (guide §3): a tenant
// member's PII-minimised profile (display name + roles + locale — the server returns a masked view, tenant-scoped,
// 404 for a non-member: anti-IDOR). Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { UserProfile } from '@krishi-verse/sdk-js';
import { Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getUser } from '../../../features/tenant/tenant.api';

export default function FarmerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const enabled = useFlag('tenant_admin_lite');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { if (!id) return; setLoading(true); setUser(await getUser(id)); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('owner.farmer.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('owner.farmer.title')}>
      {loading ? <SkeletonCard lines={4} /> : !user ? (
        <EmptyState title={t('owner.farmer.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          <Text style={styles.name}>{user.displayName ?? t('owner.farmer.ref', { id: user.id.slice(0, 8).toUpperCase() })}</Text>
          <Row k={t('owner.farmer.roles')} v={user.roles.length ? user.roles.map((r) => t(`role.${r}`, { defaultValue: r })).join(', ') : '—'} />
          <Row k={t('owner.farmer.locale')} v={user.locale} />
          <Row k={t('owner.farmer.ref.label')} v={user.id.slice(0, 8).toUpperCase()} />
        </Card>
      )}
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v} numberOfLines={1}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { flex: 1, textAlign: 'right', fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
