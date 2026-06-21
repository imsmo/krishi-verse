// apps/mobile/src/app/(owner)/dispute/[id].tsx · screen 156 (dispute detail + moderation actions). Thin screen
// (guide §3): the dispute + the moderator actions allowed for its status (review → escalate/resolve) via the PURE
// disputeActions. Resolve picks a resolution type (+ a partial-refund amount in ₹→paise via BigInt, Law 2) built
// by the PURE buildResolution. Every action needs dispute.resolve — authorized SERVER-SIDE; refunds/reversals move
// money SERVER-SIDE (the app never does — Law 11). Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Dispute } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getDispute, reviewDispute, escalateDispute, resolveDispute } from '../../../features/tenant/tenant.api';
import { disputeStatusTone, disputeActions, RESOLUTION_OPTIONS, buildResolution } from '../../../features/tenant/tenant-admin';

export default function DisputeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const enabled = useFlag('tenant_admin_lite');
  const [d, setD] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resType, setResType] = useState('');
  const [rupees, setRupees] = useState('');
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => { if (!id) return; setLoading(true); setD(await getDispute(id)); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('owner.dispute.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await fn(); await load(); }
    catch (e) {
      const msg = e instanceof SdkError && e.isForbidden ? t('owner.notAllowed') : e instanceof SdkError && (e.status === 409 || e.status === 422) ? t('owner.dispute.illegal') : t('owner.dispute.failed');
      Alert.alert(t('owner.dispute.title'), msg);
    } finally { setBusy(false); }
  };

  const onResolve = () => {
    if (!id) return;
    const r = buildResolution(resType, rupees);
    if (!r.ok) { setError(t(r.reason === 'amount' ? 'owner.dispute.amountInvalid' : 'owner.dispute.pickType')); return; }
    run(() => resolveDispute(id, r.body));
  };

  const actions = d ? disputeActions(d.status) : [];

  return (
    <ScreenScaffold title={t('owner.dispute.title')}>
      {loading ? <SkeletonCard lines={5} /> : !d ? (
        <EmptyState title={t('owner.dispute.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.no}>{t('owner.dispute.ref', { id: d.id.slice(0, 8).toUpperCase() })}</Text>
              <StatusPill label={t(`owner.disputeStatus.${d.status}`, { defaultValue: d.status })} tone={disputeStatusTone(d.status)} />
            </View>
            {d.description ? <Text style={styles.desc}>{d.description}</Text> : null}
            {d.resolutionType ? (
              <View style={[styles.row, { marginTop: space[2] }]}>
                <Text style={styles.k}>{t(`owner.resolution.${d.resolutionType}`, { defaultValue: d.resolutionType })}</Text>
                {d.resolutionAmountMinor ? <MoneyText minor={d.resolutionAmountMinor} langCode={lang} size="md" /> : null}
              </View>
            ) : null}
          </Card>

          {actions.includes('review') ? <View style={styles.act}><Button title={t('owner.dispute.review')} loading={busy} disabled={busy} onPress={() => run(() => reviewDispute(id!))} /></View> : null}
          {actions.includes('escalate') ? <View style={styles.act}><Button title={t('owner.dispute.escalate')} variant="outline" loading={busy} disabled={busy} onPress={() => run(() => escalateDispute(id!))} /></View> : null}

          {actions.includes('resolve') ? (
            <Card style={{ marginTop: space[3] }}>
              <Text style={styles.section}>{t('owner.dispute.resolveTitle')}</Text>
              <View style={styles.chips}>
                {RESOLUTION_OPTIONS.map((o) => {
                  const on = resType === o;
                  return (
                    <Pressable key={o} onPress={() => setResType(o)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`owner.resolution.${o}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {resType === 'refund_partial' ? <View style={{ marginTop: space[3] }}><Input label={t('owner.dispute.amount')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" maxLength={9} error={error} /></View> : (error ? <Text style={styles.err}>{error}</Text> : null)}
              <View style={{ marginTop: space[3] }}><Button title={t('owner.dispute.resolve')} loading={busy} disabled={busy || !resType} onPress={onResolve} /></View>
            </Card>
          ) : null}

          {actions.length === 0 ? <Text style={styles.note}>{t('owner.dispute.terminal')}</Text> : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  no: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  desc: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginTop: space[2] },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  act: { marginTop: space[3] },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginBottom: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  err: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark, marginTop: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
