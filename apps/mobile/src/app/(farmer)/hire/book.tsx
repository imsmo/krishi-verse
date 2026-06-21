// apps/mobile/src/app/(farmer)/hire/book.tsx · screens 26 + 44/45/62/46/63 + 27 (post a booking + confirm). Thin
// screen (guide §3): collects the real booking fields — headcount, dates, wage (₹→paise via BigInt, Law 2),
// wage-kind, women-only, farm GPS (core/location), respond-by — validates via the PURE buildBookingDraft, and
// POSTs a REAL idempotent createBooking (the server snapshots the statutory floor and REJECTS a sub-floor wage —
// 422). Behind `labour_hire`. Degrade-never-die.
//
// FLAGGED BACKEND GAP (NOT faked): the work-type / skill / region / skill-level taxonomy has no mobile lookups
// READ endpoint yet, so those pickers can't be populated from real data. They're collected as advanced fields and
// buildBookingDraft flags the `taxonomy` group until a lookups endpoint exists — we never invent ids.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, Input, Toggle, EmptyState, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getCurrentFix } from '../../../core/location';
import { buildBookingDraft, type BookingDraftField } from '../../../features/labour/booking-flow';
import { createBooking } from '../../../features/labour/hire.api';

const SKILLS = ['unskilled', 'semi_skilled', 'skilled', 'highly_skilled'] as const;
const WAGE_KINDS = ['per_day', 'per_hour', 'per_task'] as const;

export default function BookWorker() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('labour_hire');

  const [demandTypeCode, setDemand] = useState('');
  const [taskSkillId, setSkill] = useState('');
  const [regionId, setRegion] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [workersNeeded, setWorkers] = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');
  const [wageKind, setWageKind] = useState('per_day');
  const [wageRupees, setWage] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [farm, setFarm] = useState<{ lat: number; lng: number } | null>(null);
  const [respondByHours, setRespondBy] = useState('');
  const [errors, setErrors] = useState<BookingDraftField[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const r = await getCurrentFix();
      if (r.ok && r.fix) setFarm({ lat: r.fix.lat, lng: r.fix.lng });
      else Alert.alert(t('hire.book.location'), t(`worker.clockIn.gps.${r.reason ?? 'error'}`));
    } finally { setLocating(false); }
  }, [t]);

  if (!enabled) return <ScreenScaffold title={t('hire.post')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const submit = async () => {
    const draft = buildBookingDraft({ demandTypeCode, taskSkillId, regionId, skillLevel, workersNeeded, startDate, endDate, wageKind, wageRupees, womenOnly, farmLat: farm?.lat ?? null, farmLng: farm?.lng ?? null, respondByHours });
    setErrors(draft.errors);
    if (!draft.ok || !draft.input) return;
    setBusy(true);
    try {
      const b = await createBooking(draft.input);
      router.replace({ pathname: '/(farmer)/hire/sent', params: { bookingNo: b.bookingNo, id: b.id } });
    } catch (e) {
      const msg = e instanceof SdkError && e.status === 422 ? t('hire.book.belowFloor')
        : e instanceof SdkError && e.isForbidden ? t('hire.assign.notAllowed')
        : t('hire.book.failed');
      Alert.alert(t('hire.book.error'), msg);
    } finally { setBusy(false); }
  };

  const err = (f: BookingDraftField) => errors.includes(f) ? t(`hire.book.err.${f}`) : undefined;

  return (
    <ScreenScaffold title={t('hire.post')} footer={<Button title={t('hire.book.submit')} onPress={submit} loading={busy} />}>
      <Card style={styles.flagCard}>
        <Text style={styles.flagTitle}>{t('hire.book.taxonomy.title')}</Text>
        <Text style={styles.flagNote}>{t('hire.book.taxonomy.note')}</Text>
        <Input label={t('hire.book.demandType')} value={demandTypeCode} onChangeText={setDemand} maxLength={40} />
        <Input label={t('hire.book.skillId')} value={taskSkillId} onChangeText={setSkill} maxLength={40} />
        <Input label={t('hire.book.regionId')} value={regionId} onChangeText={setRegion} maxLength={40} error={err('taxonomy')} />
        <Text style={styles.sub}>{t('hire.book.skillLevel')}</Text>
        <Chips options={SKILLS} value={skillLevel} onPick={setSkillLevel} labelKey={(s) => `hire.skillLevel.${s}`} t={t} />
      </Card>

      <Input label={t('worker.workers')} value={workersNeeded} onChangeText={setWorkers} keyboardType="number-pad" maxLength={3} error={err('workers')} />
      <Input label={t('worker.startDate') + ' (YYYY-MM-DD)'} value={startDate} onChangeText={setStart} maxLength={10} placeholder="2026-07-01" />
      <Input label={t('worker.endDate') + ' (YYYY-MM-DD)'} value={endDate} onChangeText={setEnd} maxLength={10} placeholder="2026-07-05" error={err('dates')} />

      <Text style={styles.sub}>{t('hire.book.wageKind')}</Text>
      <Chips options={WAGE_KINDS} value={wageKind} onPick={setWageKind} labelKey={(k) => `worker.wageKind.${k}`} t={t} />
      <Input label={t('hire.book.wage')} value={wageRupees} onChangeText={setWage} keyboardType="number-pad" maxLength={9} error={err('wage')} />

      <View style={{ marginTop: space[3] }}><Toggle label={t('worker.womenOnly')} value={womenOnly} onValueChange={setWomenOnly} /></View>

      <Text style={styles.sub}>{t('hire.book.farmLocation')}</Text>
      <Card style={styles.locCard}>
        <Text style={styles.locText}>{farm ? t('hire.book.located', { lat: farm.lat.toFixed(4), lng: farm.lng.toFixed(4) }) : t('hire.book.noLocation')}</Text>
        <View style={{ marginTop: space[2] }}><Button title={t('hire.book.useLocation')} variant="outline" loading={locating} onPress={useMyLocation} /></View>
        {errors.includes('location') ? <Text style={styles.errText}>{t('hire.book.err.location')}</Text> : null}
      </Card>

      <Input label={t('hire.book.respondBy')} value={respondByHours} onChangeText={setRespondBy} keyboardType="number-pad" maxLength={3} placeholder="4" />
    </ScreenScaffold>
  );
}

function Chips<T extends string>({ options, value, onPick, labelKey, t }: { options: readonly T[]; value: string; onPick: (v: T) => void; labelKey: (v: T) => string; t: (k: string) => string }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable key={o} onPress={() => onPick(o)} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: active }}>
            <Text style={[styles.chipText, active && styles.chipTextOn]}>{t(labelKey(o))}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flagCard: { backgroundColor: color.warningLight, marginBottom: space[3] },
  flagTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.warningDark, marginBottom: space[1] },
  flagNote: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginBottom: space[2] },
  sub: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3], marginBottom: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  locCard: {},
  locText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  errText: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark, marginTop: space[2] },
});
