// apps/mobile/src/app/(worker)/my-jobs.tsx · screen 32 (my jobs). Thin screen (guide §3): the worker's assignments
// bucketed (Upcoming / Paid / Closed) via the PURE categorizeAssignments — offers (pending) live in the Offers
// tab. Tapping an upcoming job opens the active-job screen. Behind `worker_active_job`. Degrade-never-die; keyset.
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { LabourAssignment } from '@krishi-verse/sdk-js';
import { Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { myJobs } from '../../features/labour/labour.api';
import { categorizeAssignments } from '../../features/labour/worker-jobs';
import { assignmentStatusTone } from '../../features/labour/labour-status';

type Section = { key: string; titleKey: string; data: LabourAssignment[] };

export default function MyJobs() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_active_job');
  const [items, setItems] = useState<LabourAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { const r = await myJobs(); setItems(r.items); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('worker.myJobs.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const b = categorizeAssignments(items);
  const sections: Section[] = [
    { key: 'upcoming', titleKey: 'worker.myJobs.upcoming', data: b.upcoming },
    { key: 'paid', titleKey: 'worker.myJobs.paid', data: b.paid },
    { key: 'closed', titleKey: 'worker.myJobs.closed', data: b.closed },
  ].filter((s) => s.data.length > 0);
  const rows = sections.flatMap((s) => [{ type: 'h' as const, key: s.key, titleKey: s.titleKey }, ...s.data.map((a) => ({ type: 'r' as const, a }))]);

  return (
    <ScreenScaffold title={t('worker.myJobs.title')}>
      {loading ? <SkeletonCard lines={5} /> : rows.length === 0 ? (
        <EmptyState title={t('worker.myJobs.empty.title')} message={t('worker.myJobs.empty.message')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it, i) => (it.type === 'h' ? `h-${it.key}` : `r-${it.a.id}`) + i}
          renderItem={({ item }) =>
            item.type === 'h' ? (
              <Text style={styles.section}>{t(item.titleKey)}</Text>
            ) : (
              <Pressable onPress={() => router.push({ pathname: '/(worker)/active-job/[id]', params: { id: item.a.id } })} accessibilityRole="button">
                <Card style={styles.card}>
                  <View style={styles.row}>
                    <StatusPill label={t(`worker.offerStatus.${item.a.status}`)} tone={assignmentStatusTone(item.a.status)} />
                    <MoneyText minor={item.a.wageMinor} langCode={lang} size="lg" />
                  </View>
                </Card>
              </Pressable>
            )
          }
          contentContainerStyle={{ paddingBottom: space[6] }}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink500, marginTop: space[4], marginBottom: space[2] },
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
