// apps/mobile/src/app/(worker)/profile/edit.tsx · screen 136 (edit worker profile / register). Thin screen
// (guide §3): register a worker profile (if none) or edit prefs — travel radius, stay-away, min wage (₹→paise via
// BigInt, Law 2), emergency contact — via the pure buildWorkerPatch. Shows the 18+/KYC status (server-owned).
// Behind `worker_app`. Degrade-never-die. (The read-only profile dashboard is screen 38 at (worker)/profile.tsx.)
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { WorkerProfile, KycDocument } from '@krishi-verse/sdk-js';
import { Button, Card, Input, StatusPill, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useAuth } from '../../../core/auth/auth.store';
import { getMyWorker, registerWorker, updateWorker } from '../../../features/labour/labour.api';
import { buildWorkerPatch, canAcceptWork } from '../../../features/labour/labour-status';
import { listKyc } from '../../../features/kyc/kyc.api';

const STAY = ['same_day', 'overnight', 'weekly', 'monthly'] as const;
const KYC_TONE: Record<string, PillTone> = { verified: 'success', pending: 'warning', rejected: 'danger', expired: 'danger' };

export default function WorkerProfileEdit() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const enabled = useFlag('worker_app');
  const kycEnabled = useFlag('kyc');
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [kyc, setKyc] = useState<KycDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [travelKm, setTravelKm] = useState('');
  const [stayAwayOk, setStayAwayOk] = useState('');
  const [minWageRupees, setMinWageRupees] = useState('');
  const [emergencyContactName, setName] = useState('');
  const [emergencyContactPhone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    const w = await getMyWorker(); setWorker(w);
    if (kycEnabled) setKyc((await listKyc())[0] ?? null);
    if (w) { setTravelKm(w.travelKm != null ? String(w.travelKm) : ''); setStayAwayOk(w.stayAwayOk ?? ''); }
    setLoading(false);
  }, [kycEnabled]);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('worker.editProfile.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSave = async () => {
    const patch = buildWorkerPatch({ travelKm, stayAwayOk, minWageRupees, emergencyContactName, emergencyContactPhone });
    setBusy(true); setError(undefined);
    try {
      const next = worker ? (patch ? await updateWorker(patch) : worker) : await registerWorker(patch ?? {});
      setWorker(next); setMinWageRupees(''); setName(''); setPhone('');
    } catch { setError(t('worker.saveFailed')); }
    finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('worker.editProfile.title')}
      footer={<Button title={t(worker ? 'worker.saveProfile' : 'worker.onboard.register')} onPress={onSave} loading={busy} />}
    >
      {loading ? <SkeletonCard lines={4} /> : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>{t('worker.verification')}</Text>
              <StatusPill label={t(canAcceptWork(worker) ? 'worker.verified' : 'worker.unverified')} tone={canAcceptWork(worker) ? 'success' : 'warning'} />
            </View>
            {kycEnabled ? (
              <View style={[styles.row, { marginTop: space[2] }]}>
                <Text style={styles.label}>{t('profile.kyc')}</Text>
                <StatusPill label={t(`kyc.status.${kyc?.status ?? 'none'}`)} tone={kyc ? (KYC_TONE[kyc.status] ?? 'neutral') : 'neutral'} />
              </View>
            ) : null}
          </Card>

          <Text style={styles.section}>{t('worker.availability')}</Text>
          <Input label={t('worker.travelKm')} value={travelKm} onChangeText={setTravelKm} keyboardType="number-pad" maxLength={4} />
          <Text style={styles.sub}>{t('worker.stayAway')}</Text>
          <View style={styles.chips}>
            {STAY.map((s) => {
              const active = stayAwayOk === s;
              return (
                <Pressable key={s} onPress={() => setStayAwayOk(s)} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>{t(`worker.stayAway.${s}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Input label={t('worker.minWage')} value={minWageRupees} onChangeText={setMinWageRupees} keyboardType="number-pad" maxLength={9} />

          <Text style={styles.section}>{t('worker.emergency')}</Text>
          <Input label={t('worker.contactName')} value={emergencyContactName} onChangeText={setName} maxLength={150} />
          <Input label={t('worker.contactPhone')} value={emergencyContactPhone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} error={error} />

          <View style={{ marginTop: space[4] }}><Button title={t('profile.signOut')} variant="outline" onPress={() => signOut()} /></View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  sub: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2], marginBottom: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
});
