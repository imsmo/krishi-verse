// apps/mobile/src/app/(worker)/home.tsx · screen 29 (worker home). Thin screen (guide §3): if the caller has no
// worker profile yet → an onboarding CTA (register); else a dashboard — verification (18+) status + quick links to
// Jobs and Offers. Behind `worker_app`. Onboarding is ambassador-led + 18+ Aadhaar (server-gated); this screen
// reflects that status, it never grants it. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { WorkerProfile } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { getMyWorker } from '../../features/labour/labour.api';
import { canAcceptWork } from '../../features/labour/labour-status';

export default function WorkerHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_app');
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setWorker(await getMyWorker()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('worker.home.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('worker.home.title')}>
      {loading ? <SkeletonCard lines={3} /> : !worker ? (
        <Card>
          <Text style={styles.h}>{t('worker.onboard.title')}</Text>
          <Text style={styles.p}>{t('worker.onboard.body')}</Text>
          <View style={{ marginTop: space[4] }}><Button title={t('worker.onboard.register')} onPress={() => router.push('/(worker)/profile')} /></View>
        </Card>
      ) : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>{t('worker.verification')}</Text>
              <StatusPill label={t(canAcceptWork(worker) ? 'worker.verified' : 'worker.unverified')} tone={canAcceptWork(worker) ? 'success' : 'warning'} />
            </View>
            {!canAcceptWork(worker) ? <Text style={styles.note}>{t('worker.verifyNote')}</Text> : null}
          </Card>
          <View style={styles.actions}>
            <Button title={t('worker.tabs.offers')} onPress={() => router.push('/(worker)/offers')} />
            <Button title={t('worker.tabs.jobs')} variant="outline" onPress={() => router.push('/(worker)/jobs')} />
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  p: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[2] },
  actions: { marginTop: space[4], gap: space[3] },
});
