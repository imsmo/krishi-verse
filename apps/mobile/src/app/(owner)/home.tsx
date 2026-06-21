// apps/mobile/src/app/(owner)/home.tsx · screen 08 (tenant dashboard). Thin screen (guide §3): KPIs composed from
// REAL lists (active farmers, pending approvals, open disputes) via the PURE dashboardKpis — there's no fabricated
// metrics endpoint. Subscription status drives an apply/pending nudge. Quick links into the lite admin actions +
// monitoring (listings/payouts). Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { RoleAssignment, Dispute, Subscription } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { assignments, disputesList, currentSubscription } from '../../features/tenant/tenant.api';
import { dashboardKpis, subscriptionTone, needsToApply, isPending } from '../../features/tenant/tenant-admin';

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [asg, setAsg] = useState<RoleAssignment[]>([]);
  const [disp, setDisp] = useState<Dispute[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, d, s] = await Promise.all([assignments(), disputesList(), currentSubscription()]);
    setAsg(a); setDisp(d.items); setSub(s); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('owner.dashboard.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const k = dashboardKpis({ assignments: asg, disputes: disp });

  return (
    <ScreenScaffold title={t('owner.dashboard.title')}>
      {loading ? <SkeletonCard lines={5} /> : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.k}>{t('owner.subscription')}</Text>
              {needsToApply(sub) ? (
                <Button title={t('owner.apply.cta')} fullWidth={false} onPress={() => router.push('/(owner)/apply')} />
              ) : (
                <StatusPill label={t(`owner.subStatus.${sub!.status}`)} tone={subscriptionTone(sub!.status)} />
              )}
            </View>
            {isPending(sub) ? <Text style={styles.note}>{t('owner.pendingNote')}</Text> : null}
          </Card>

          <View style={styles.kpis}>
            <Card style={styles.kpi} onPress={() => router.push('/(owner)/farmers')}><Text style={styles.kpiVal}>{String(k.farmers)}</Text><Text style={styles.kpiLabel}>{t('owner.kpi.farmers')}</Text></Card>
            <Card style={styles.kpi} onPress={() => router.push('/(owner)/approvals')}><Text style={styles.kpiVal}>{String(k.pendingApprovals)}</Text><Text style={styles.kpiLabel}>{t('owner.kpi.approvals')}</Text></Card>
            <Card style={styles.kpi} onPress={() => router.push('/(owner)/disputes')}><Text style={styles.kpiVal}>{String(k.openDisputes)}</Text><Text style={styles.kpiLabel}>{t('owner.kpi.disputes')}</Text></Card>
          </View>

          <View style={styles.actions}>
            <Button title={t('owner.tabs.listings')} variant="outline" onPress={() => router.push('/(owner)/listings')} />
            <Button title={t('owner.tabs.payouts')} variant="outline" onPress={() => router.push('/(owner)/payouts')} />
          </View>
          <Text style={styles.lite}>{t('owner.liteNote')}</Text>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.warningDark, marginTop: space[2] },
  kpis: { flexDirection: 'row', gap: space[3], marginTop: space[3] },
  kpi: { flex: 1, alignItems: 'center', paddingVertical: space[4] },
  kpiVal: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink800 },
  kpiLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: space[1], textAlign: 'center' },
  actions: { marginTop: space[4], gap: space[3] },
  lite: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink400, marginTop: space[4], textAlign: 'center' },
});
