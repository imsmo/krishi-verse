// apps/mobile/src/app/(farmer)/schemes/[id].tsx · screen 105 (scheme detail + eligibility). Thin screen (guide §3):
// the scheme's benefits + required-doc count + processing fee (bigint paise via MoneyText, Law 2), and an
// explainable eligibility check (server-evaluated → eligible + reasons). "Apply" carries the scheme + required
// docs to the apply screen. Behind `schemes_govt`. Degrade-never-die.
// NOTE: eligibility attributes are entered by the farmer — there's no profile/parcel auto-fill endpoint (flagged).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Scheme, EligibilityResult } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getScheme, checkEligibility } from '../../../features/schemes/schemes.api';
import { buildEligibilityInput, eligibilitySummary } from '../../../features/schemes/schemes';

const GENDERS = ['male', 'female', 'other'] as const;

export default function SchemeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('schemes_govt');
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [acres, setAcres] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => { if (!id) { setLoading(false); return; } setLoading(true); setScheme(await getScheme(id)); setLoading(false); }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('schemes.detailTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const check = async () => {
    if (!id) return;
    setChecking(true);
    const input = buildEligibilityInput({ landholdingAcres: acres, gender: gender ?? undefined, age });
    setResult(await checkEligibility(id, input));
    setChecking(false);
  };
  const summary = eligibilitySummary(result);

  return (
    <ScreenScaffold title={scheme?.name ?? t('schemes.detailTitle')}>
      {loading ? <SkeletonCard lines={6} /> : !scheme ? (
        <EmptyState title={t('schemes.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
          <Card>
            <Text style={styles.h}>{t('schemes.benefits')}</Text>
            {renderSummary(scheme.benefitSummary).map(([k, v]) => (
              <View key={k} style={styles.kv}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>
            ))}
            <View style={styles.kv}><Text style={styles.k}>{t('schemes.processingFee')}</Text><MoneyText minor={scheme.processingFeeMinor} langCode={lang} size="md" /></View>
            <View style={styles.kv}><Text style={styles.k}>{t('schemes.docsRequired')}</Text><Text style={styles.v}>{scheme.requiredDocTypeIds.length}</Text></View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.h}>{t('schemes.eligibility.title')}</Text>
            <Text style={styles.note}>{t('schemes.eligibility.note')}</Text>
            <Input label={t('schemes.eligibility.landholding')} value={acres} onChangeText={setAcres} keyboardType="decimal-pad" maxLength={7} />
            <View style={styles.chips}>
              {GENDERS.map((g) => {
                const on = gender === g;
                return <Pressable key={g} onPress={() => setGender(on ? null : g)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}><Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`schemes.gender.${g}`)}</Text></Pressable>;
              })}
            </View>
            <Input label={t('schemes.eligibility.age')} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
            <View style={{ marginTop: space[2] }}><Button title={t('schemes.eligibility.check')} loading={checking} onPress={check} variant="outline" /></View>
            {result ? (
              <View style={styles.result}>
                <StatusPill label={t(summary.eligible ? 'schemes.eligibility.eligible' : 'schemes.eligibility.notEligible')} tone={summary.eligible ? 'success' : 'warning'} />
                {result.reasons.map((r, i) => <Text key={i} style={styles.reason}>• {r}</Text>)}
              </View>
            ) : null}
          </Card>

          <View style={{ marginTop: space[4] }}>
            <Button title={t('schemes.apply.cta')} onPress={() => router.push({ pathname: '/(farmer)/schemes/apply', params: { id: scheme.id, docs: scheme.requiredDocTypeIds.join(',') } })} />
          </View>
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

/** Defensively render the opaque benefitSummary: only primitive string/number entries (never invent data). */
function renderSummary(summary: Record<string, unknown>): Array<[string, string]> {
  if (!summary || typeof summary !== 'object') return [];
  return Object.entries(summary).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => [k, String(v)] as [string, string]).slice(0, 12);
}

const styles = StyleSheet.create({
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink900, marginBottom: space[2] },
  section: { marginTop: space[3] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginBottom: space[2] },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[1] },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, flex: 1 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  chips: { flexDirection: 'row', gap: space[2], marginVertical: space[2] },
  chip: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  result: { marginTop: space[3], gap: space[1] },
  reason: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
});
