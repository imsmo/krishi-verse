// apps/mobile/src/app/(owner)/approve/[id].tsx · screen 148 (approve detail). Thin screen (guide §3): confirm +
// APPROVE a pending role assignment (the DoD's "approve a farmer"). REAL `approveAssignment`; needs
// identity.approve — authorized SERVER-SIDE (NOT god-mode, tenant-scoped — Law 11). A 403 shows a friendly
// "not allowed", never worked around. Behind `tenant_admin_lite`.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { approveAssignment } from '../../../features/tenant/tenant.api';

export default function ApproveDetail() {
  const { id, userId, roleCode } = useLocalSearchParams<{ id: string; userId?: string; roleCode?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [busy, setBusy] = useState(false);

  if (!enabled) return <ScreenScaffold title={t('owner.approve.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try { await approveAssignment(id); router.replace({ pathname: '/(owner)/approvals', params: { notice: t('owner.approve.done') } }); }
    catch (e) {
      const msg = e instanceof SdkError && e.isForbidden ? t('owner.notAllowed') : e instanceof SdkError && e.isConflict ? t('owner.approve.illegal') : t('owner.approve.failed');
      Alert.alert(t('owner.approve.title'), msg);
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('owner.approve.title')} footer={<Button title={t('owner.approve.cta')} loading={busy} disabled={busy} onPress={approve} />}>
      <Card>
        <Text style={styles.h}>{t('owner.approve.heading')}</Text>
        {roleCode ? <Row k={t('owner.approve.role')} v={t(`role.${roleCode}`, { defaultValue: roleCode })} /> : null}
        {userId ? <Row k={t('owner.farmer.ref.label')} v={userId.slice(0, 8).toUpperCase()} /> : null}
        <Text style={styles.note}>{t('owner.approve.note')}</Text>
      </Card>
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
