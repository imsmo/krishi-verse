// apps/mobile/src/app/(farmer)/mandi/alerts.tsx · screen 110 (price alerts). Thin screen (guide §3): the farmer's
// price-threshold subscriptions (list + activate/deactivate). When opened from a price row (productId/regionId/
// rupees params) it shows a create form — direction + threshold (₹→paise via BigInt, Law 2) built by the PURE
// buildAlertDraft; create is idempotent (Law 3). Delivery is a server PUSH (P-04) when a price crosses. Behind
// `mandi_weather`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PriceAlert } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, MoneyText, StatusPill, Toggle, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { listAlerts, createAlert, setAlertActive } from '../../../features/market/market.api';
import { buildAlertDraft, alertTone } from '../../../features/market/market';

const DIRS = ['above', 'below'] as const;

export default function MandiAlerts() {
  const { productId, regionId, rupees: rupeesParam } = useLocalSearchParams<{ productId?: string; regionId?: string; rupees?: string }>();
  const { t, lang } = useTranslation();
  const enabled = useFlag('mandi_weather');
  const [items, setItems] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [rupees, setRupees] = useState(rupeesParam ?? '');
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => { const r = await listAlerts(); setItems(r.items); setLoading(false); }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('mandi.alerts.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const toggle = async (a: PriceAlert) => {
    try { await setAlertActive(a.id, !a.isActive); await load(); }
    catch { Alert.alert(t('mandi.alerts.title'), t('common.error.generic')); }
  };

  const create = async () => {
    const draft = buildAlertDraft({ productId, regionId: regionId || null, direction, rupees });
    if (!draft.ok || !draft.input) { setError(t(draft.reason === 'threshold' ? 'mandi.alerts.amountInvalid' : 'mandi.alerts.invalid')); return; }
    setBusy(true); setError(undefined);
    try { await createAlert(draft.input); setRupees(''); await load(); }
    catch { Alert.alert(t('mandi.alerts.title'), t('mandi.alerts.createFailed')); }
    finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('mandi.alerts.title')}>
      {productId ? (
        <Card style={styles.createCard}>
          <Text style={styles.h}>{t('mandi.alerts.newTitle')}</Text>
          <View style={styles.dirs}>
            {DIRS.map((d) => {
              const on = direction === d;
              return (
                <Pressable key={d} onPress={() => setDirection(d)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`mandi.alerts.dir.${d}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Input label={t('mandi.alerts.threshold')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" maxLength={9} error={error} />
          <View style={{ marginTop: space[3] }}><Button title={t('mandi.alerts.create')} loading={busy} onPress={create} /></View>
          <Text style={styles.note}>{t('mandi.alerts.pushNote')}</Text>
        </Card>
      ) : null}

      {loading ? <SkeletonCard lines={4} /> : items.length === 0 ? (
        <EmptyState title={t('mandi.alerts.empty.title')} message={t('mandi.alerts.empty.message')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.dirLabel}>{t(`mandi.alerts.dir.${item.direction}`)}</Text>
                <MoneyText minor={item.thresholdMinor} langCode={lang} size="md" />
              </View>
              <View style={[styles.row, { marginTop: space[2] }]}>
                <StatusPill label={t(item.isActive ? 'mandi.alerts.active' : 'mandi.alerts.paused')} tone={alertTone(item)} />
                <Toggle label={t('mandi.alerts.enabled')} value={item.isActive} onValueChange={() => toggle(item)} />
              </View>
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  createCard: { backgroundColor: color.primary50, marginBottom: space[3] },
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  dirs: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  chip: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.card },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dirLabel: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
