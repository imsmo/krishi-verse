// apps/mobile/src/app/(worker)/pmsby-enroll.tsx · screen 145 (PMSBY Enrollment — worker). Thin screen (guide §3):
// the PMSBY scheme facts (₹2L cover / ₹20 premium — public constants), the worker's REAL eligibility (18+ from the
// age-verified profile, a linked bank account, a verified Aadhaar KYC), and a nominee form. Behind `worker_app`.
// FLAG_SECURE (collects a nominee + optional Aadhaar). Money via MoneyText (Law 2). Degrade-never-die.
//
// §13 — REAL: eligibility booleans (worker/bank/KYC), and the auto-debit bank (bankLabel + last4). HONESTLY
// degraded (NEVER faked): there is NO PMSBY enrolment/policy/nominee endpoint in the contract yet → the "Enroll"
// CTA collects the form but surfaces a coming-soon notice instead of calling a non-existent endpoint or minting a
// fake policy; the auto-debit date/bank line falls back to a generic "your bank account" when none is linked.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { WorkerProfile, BankAccount, KycDocument, KycDocType } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useSecureScreen } from '../../core/security/screen-guard';
import { getMyWorker } from '../../features/labour/labour.api';
import { myDocuments, kycDocTypes } from '../../features/kyc/kyc.api';
import { myBankAccounts } from '../../features/profile/profile.api';
import { bankLabel } from '../../features/profile/profile';
import { bankAccount } from '../../features/labour/worker-documents';
import {
  NOMINEE_RELATIONSHIPS, PMSBY_COVER_MINOR, PMSBY_PARTIAL_MINOR, PMSBY_PREMIUM_MINOR,
  normalizeAadhaar, canEnroll, pmsbyEligibility, type NomineeRelationship,
} from '../../features/labour/pmsby-enroll';

export default function PmsbyEnroll() {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_app');
  useSecureScreen();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [docTypes, setDocTypes] = useState<KycDocType[]>([]);
  const [kyc, setKyc] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState<NomineeRelationship | null>(null);
  const [aadhaar, setAadhaar] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const [w, b, dt, k] = await Promise.all([getMyWorker(), myBankAccounts(), kycDocTypes(), myDocuments()]);
      setWorker(w); setBanks(b ?? []); setDocTypes(dt ?? []); setKyc(k ?? []); setFailed(!w);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('pmsbyEnroll.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const elig = pmsbyEligibility(worker, banks, docTypes, kyc);
  const bank = bankAccount(banks);
  const debitBank = bank ? bankLabel(bank) : null;

  const enroll = () => {
    if (!canEnroll(name, rel)) return;
    // §13: no PMSBY enrolment endpoint → do not fabricate a policy; capture the intent + surface coming-soon.
    Alert.alert(t('pmsbyEnroll.title'), t('pmsbyEnroll.comingSoon'));
  };

  const benefits: Array<{ key: string; icon: string; minor: string }> = [
    { key: 'death', icon: '💰', minor: PMSBY_COVER_MINOR },
    { key: 'total', icon: '🦽', minor: PMSBY_COVER_MINOR },
    { key: 'partial', icon: '🦾', minor: PMSBY_PARTIAL_MINOR },
  ];

  const footer = (
    <View style={styles.footerRow}>
      <Button title={t('pmsbyEnroll.later')} variant="outline" onPress={() => router.back()} />
      <View style={{ flex: 1 }}>
        <Button title={t('pmsbyEnroll.enrollCta', { amount: formatMoneyMinor(PMSBY_PREMIUM_MINOR, 'INR', lang) })} onPress={enroll} disabled={!canEnroll(name, rel, aadhaar)} fullWidth />
      </View>
    </View>
  );

  return (
    <ScreenScaffold title={t('pmsbyEnroll.title')} scroll={false} footer={footer}>
      {loading ? <SkeletonCard lines={10} /> : failed ? (
        <EmptyState title={t('common.error.generic')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[4], gap: space[3] }}>
          {/* Hero — scheme facts */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t('pmsbyEnroll.pmsby')}</Text>
            <Text style={styles.heroSub}>{t('pmsbyEnroll.pmsbyFull')}</Text>
            <MoneyText minor={PMSBY_COVER_MINOR} currencyCode="INR" langCode={lang} size="3xl" style={{ color: color.white }} />
            <Text style={styles.heroCover}>{t('pmsbyEnroll.coverDesc')}</Text>
            <View style={styles.premiumTag}><Text style={styles.premiumTxt}>{t('pmsbyEnroll.premiumTag', { amount: formatMoneyMinor(PMSBY_PREMIUM_MINOR, 'INR', lang) })}</Text></View>
          </View>

          {/* What you get */}
          <Text style={styles.section}>{t('pmsbyEnroll.whatYouGet')}</Text>
          <Card>
            {benefits.map((b, i) => (
              <View key={b.key} style={[styles.benefit, i > 0 && styles.divide]}>
                <Text style={styles.benefitIcon}>{b.icon}</Text>
                <View style={{ flex: 1 }}>
                  <MoneyText minor={b.minor} currencyCode="INR" langCode={lang} size="md" />
                  <Text style={styles.benefitTitle}>{t(`pmsbyEnroll.benefit.${b.key}.title`)}</Text>
                  <Text style={styles.benefitSub}>{t(`pmsbyEnroll.benefit.${b.key}.sub`)}</Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Eligibility — real */}
          <Text style={styles.section}>{t('pmsbyEnroll.eligibility')}</Text>
          <View style={[styles.eligCard, elig.qualifies ? styles.eligOk : styles.eligPending]}>
            <Text style={styles.eligIcon}>{elig.qualifies ? '✓' : '⏳'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.eligTitle}>{elig.qualifies ? t('pmsbyEnroll.qualify') : t('pmsbyEnroll.notYet')}</Text>
              <Text style={styles.eligDetail}>
                {t('pmsbyEnroll.ageRange')} {mark(elig.ageOk)} · {t('pmsbyEnroll.bankAccount')} {mark(elig.bankOk)} · {t('pmsbyEnroll.aadhaarLinked')} {mark(elig.aadhaarOk)}
              </Text>
            </View>
          </View>

          {/* Add nominee */}
          <Text style={styles.section}>{t('pmsbyEnroll.addNominee')}</Text>
          <Card>
            <Input label={t('pmsbyEnroll.nomineeName')} value={name} onChangeText={setName} placeholder={t('pmsbyEnroll.nomineeNamePh')} maxLength={100} />
            <Text style={styles.fieldLabel}>{t('pmsbyEnroll.relationship')}</Text>
            <View style={styles.relRow}>
              {NOMINEE_RELATIONSHIPS.map((r) => {
                const on = rel === r;
                return (
                  <Pressable key={r} onPress={() => setRel(r)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.relChip, on && styles.relChipOn]}>
                    <Text style={[styles.relTxt, on && styles.relTxtOn]}>{t(`pmsbyEnroll.rel.${r}`)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ marginTop: space[3] }}>
              <Input label={t('pmsbyEnroll.nomineeAadhaar')} value={aadhaar} onChangeText={(v) => setAadhaar(normalizeAadhaar(v))} placeholder={t('pmsbyEnroll.aadhaarPh')} keyboardType="number-pad" maxLength={12} />
            </View>
          </Card>

          {/* Auto-debit mandate note */}
          <View style={styles.mandate}>
            <Text style={styles.mandateTxt}>
              {debitBank ? t('pmsbyEnroll.mandateBank', { amount: formatMoneyMinor(PMSBY_PREMIUM_MINOR, 'INR', lang), bank: debitBank }) : t('pmsbyEnroll.mandateGeneric', { amount: formatMoneyMinor(PMSBY_PREMIUM_MINOR, 'INR', lang) })}
            </Text>
          </View>
        </ScrollView>
      )}
    </ScreenScaffold>
  );
}

function mark(ok: boolean): string { return ok ? '✓' : '✗'; }

const styles = StyleSheet.create({
  hero: { padding: space[4], borderRadius: radius.lg, backgroundColor: color.primary700, alignItems: 'center', gap: 4 },
  heroTitle: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.white },
  heroSub: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary50, marginBottom: space[2], textAlign: 'center' },
  heroCover: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary50, marginTop: 2, textAlign: 'center' },
  premiumTag: { marginTop: space[2], backgroundColor: color.accent, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 6 },
  premiumTxt: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.bold, color: color.ink900 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink700, marginTop: space[2], marginBottom: space[1] },
  benefit: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start', paddingTop: space[2] },
  divide: { borderTopWidth: 1, borderTopColor: color.ink100, marginTop: space[2] },
  benefitIcon: { fontSize: 26, width: 34, textAlign: 'center' },
  benefitTitle: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink800, marginTop: 2 },
  benefitSub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  eligCard: { flexDirection: 'row', gap: space[3], alignItems: 'center', borderRadius: radius.lg, padding: space[3], borderWidth: 1 },
  eligOk: { backgroundColor: color.successLight, borderColor: color.success },
  eligPending: { backgroundColor: color.warningLight, borderColor: color.warning },
  eligIcon: { fontSize: 24 },
  eligTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800 },
  eligDetail: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink600, marginTop: 2 },
  fieldLabel: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[3], marginBottom: space[2] },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  relChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  relChipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  relTxt: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink700 },
  relTxtOn: { color: color.primary700 },
  mandate: { backgroundColor: color.ink50, borderRadius: radius.md, padding: space[3] },
  mandateTxt: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink600, lineHeight: font.size.xs * 1.5 },
  footerRow: { flexDirection: 'row', gap: space[3], alignItems: 'center' },
});
