// apps/mobile/src/app/(owner)/apply.tsx · screen 06 (apply for a plan). Thin screen (guide §3): the public plan
// catalogue + apply (create subscription, idempotent — Law 3; a paid plan charges SERVER-SIDE, Law 11). Money via
// MoneyText (Law 2). Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { Plan } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { plans, applyForPlan } from '../../features/tenant/tenant.api';

export default function Apply() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { setItems(await plans()); setLoading(false); }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('owner.apply.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const apply = async (planId: string) => {
    setBusy(planId);
    try { await applyForPlan(planId, 'monthly'); router.replace('/(owner)/pending'); }
    catch (e) {
      const msg = e instanceof SdkError && e.isConflict ? t('owner.apply.already') : e instanceof SdkError && e.isForbidden ? t('owner.notAllowed') : t('owner.apply.failed');
      Alert.alert(t('owner.apply.title'), msg);
    } finally { setBusy(null); }
  };

  return (
    <ScreenScaffold title={t('owner.apply.title')}>
      {loading ? <SkeletonCard lines={5} /> : items.length === 0 ? (
        <EmptyState title={t('owner.apply.empty.title')} message={t('owner.apply.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        items.map((p) => (
          <Card key={p.id} style={styles.card}>
            <Text style={styles.name}>{p.defaultName}</Text>
            <View style={styles.row}>
              <MoneyText minor={p.monthlyPriceMinor} currencyCode={p.currencyCode} langCode={lang} size="lg" />
              <Text style={styles.per}>{t('owner.apply.perMonth')}</Text>
            </View>
            <View style={{ marginTop: space[3] }}><Button title={t('owner.apply.choose')} loading={busy === p.id} disabled={busy !== null} onPress={() => apply(p.id)} /></View>
          </Card>
        ))
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[3] },
  name: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  per: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500 },
});
