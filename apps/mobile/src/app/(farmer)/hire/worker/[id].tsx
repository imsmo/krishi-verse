// apps/mobile/src/app/(farmer)/hire/worker/[id].tsx · screen 25 (Worker Profile — employer/hire view). Thin screen
// (guide §3): a PII-minimised worker card driven by the REAL WorkerProfile + labour lookups + reviews summary —
// rating (avg + count), jobs done, years on platform, verified 18+ badge, resolved region + skills. If opened with
// an `assignBookingId`, the employer can ASSIGN this worker (idempotent; the server re-checks ownership, the 18+
// gate, headcount + wage floor), else the primary CTA books a new job. Behind `labour_hire`. Degrade-never-die.
//
// §13 (no contract → rendered honestly, never faked): the pool read is PII-MINIMISED — NO name/photo → we show an
// anonymised worker id + a person glyph, never "Sunita Kumari". Distance ("2.4 km away") isn't in the contract →
// omitted (region name IS resolved from lookups). The design's 30-day availability CALENDAR, PMSBY insurance and
// the worker's private monthly EARNINGS aren't exposed to a hiring employer → shown as honest "not shared" notes,
// never a fabricated calendar or ₹ figure.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { WorkerProfile, LabourLookups, ReviewSummary } from '@krishi-verse/sdk-js';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../../core/i18n/useTranslation';
import { useFlag } from '../../../../core/flags/useFlag';
import { getWorker, assignWorker, labourLookups, workerRatingSummary } from '../../../../features/labour/hire.api';
import { workerYears, skillLabels, regionName } from '../../../../features/labour/worker-profile';

export default function WorkerProfileEmployer() {
  const { id, assignBookingId } = useLocalSearchParams<{ id: string; assignBookingId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('labour_hire');
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [lookups, setLookups] = useState<LabourLookups | null>(null);
  const [rating, setRating] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const w = await getWorker(id);
    setWorker(w);
    setLookups(await labourLookups());
    setRating(w ? await workerRatingSummary(w.userId) : null);
    setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('workerProfile.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  if (loading) return <ScreenScaffold title={t('workerProfile.title')}><SkeletonCard lines={3} /><SkeletonCard lines={4} /></ScreenScaffold>;
  if (!worker) return <ScreenScaffold title={t('workerProfile.title')}><EmptyState title={t('hire.worker.unavailable')} actionLabel={t('common.retry')} onAction={load} /></ScreenScaffold>;

  const anon = t('hire.worker.anon', { id: worker.id.slice(0, 6).toUpperCase() });
  const region = regionName(lookups?.regions ?? [], worker.villageRegionId);
  const years = workerYears(worker.createdAt);
  const skills = skillLabels(lookups?.skills ?? [], worker.skillIds);
  const ratingAvg = worker.ratingAvg ?? (rating ? rating.averageStars : null);
  const ratingCount = rating?.count ?? 0;

  const assign = async () => {
    if (!assignBookingId || !id) return;
    setBusy(true);
    try {
      await assignWorker(assignBookingId, id);
      router.replace({ pathname: '/(farmer)/hire/booking/[id]', params: { id: assignBookingId, notice: t('hire.assign.done') } });
    } catch (e) {
      const msg = e instanceof SdkError && e.status === 422 ? t('hire.assign.belowFloor')
        : e instanceof SdkError && e.status === 409 ? t('hire.assign.full')
        : e instanceof SdkError && e.isForbidden ? t('hire.assign.notAllowed')
        : t('common.error.generic');
      Alert.alert(t('hire.assign.failed'), msg);
    } finally { setBusy(false); }
  };
  const book = () => router.push({ pathname: '/(farmer)/hire/book/task', params: { workerId: id } });

  const footer = assignBookingId
    ? <Button title={t('hire.assign.action')} loading={busy} disabled={busy} onPress={assign} />
    : <Button title={t('workerProfile.book')} onPress={book} />;

  return (
    <ScreenScaffold title={t('workerProfile.title')} footer={footer}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarGlyph}>👤</Text></View>
        <View style={styles.headRow}>
          <Text style={styles.name}>{anon}</Text>
          <StatusPill label={t(worker.ageVerified18 ? 'worker.verified' : 'worker.unverified')} tone={worker.ageVerified18 ? 'success' : 'warning'} />
        </View>
        {region ? <Text style={styles.location}>📍 {region}</Text> : null}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Stat value={ratingAvg != null ? `★ ${ratingAvg.toFixed(1)}` : '—'} label={t('workerProfile.ratings', { n: ratingCount })} />
        <Stat value={worker.bookingsCompleted != null ? String(worker.bookingsCompleted) : '—'} label={t('workerProfile.jobsDone')} />
        <Stat value={years != null ? t('workerProfile.yrs', { n: years }) : '—'} label={t('workerProfile.onPlatform')} />
      </View>

      {/* Skills */}
      <Text style={styles.h3}>{t('workerProfile.skills')}</Text>
      {skills.length > 0 ? (
        <View style={styles.chips}>{skills.map((s) => <View key={s} style={styles.chip}><Text style={styles.chipTxt}>{s}</Text></View>)}</View>
      ) : (
        <Card><Text style={styles.note}>{t('workerProfile.skillsNone')}</Text></Card>
      )}

      {/* §13: availability calendar not on the contract */}
      <Text style={styles.h3}>{t('workerProfile.availability')}</Text>
      <Card><Text style={styles.note}>{t('workerProfile.availabilityNote')}</Text></Card>

      {/* §13: insurance + private earnings not shared with a hiring employer */}
      <Text style={styles.h3}>{t('workerProfile.insuranceEarnings')}</Text>
      <Card><Text style={styles.note}>{t('workerProfile.insuranceNote')}</Text></Card>
    </ScreenScaffold>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space[3] },
  avatar: { width: 88, height: 88, borderRadius: radius.lg, backgroundColor: color.accent100, alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
  avatarGlyph: { fontSize: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800 },
  location: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
  stats: { flexDirection: 'row', marginTop: space[3], borderTopWidth: 1, borderTopColor: color.ink100, paddingTop: space[3] },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800 },
  statLbl: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: space[1], textAlign: 'center' },
  h3: { fontFamily: font.display, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800, marginTop: space[4], marginBottom: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[3], paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.primary300, backgroundColor: color.card },
  chipTxt: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.primary800 },
  note: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, lineHeight: font.size.xs * 1.5 },
});
