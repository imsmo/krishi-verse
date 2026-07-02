// apps/mobile/src/app/(worker)/insurance.tsx · screen 39 (PMSBY Insurance). Thin screen (guide §3): a faithful
// informational view of the Pradhan Mantri Suraksha Bima Yojana — a fixed GOVERNMENT scheme whose cover (₹2,00,000),
// premium (₹20/yr) and what's-covered terms are PUBLIC PROGRAM FACTS (the same for every worker), rendered as
// static content with money via MoneyText (Law 2, program constants — not per-user values). Behind `worker_app`.
// Degrade-never-die.
//
// §13 — FLAGGED: the labour/fintech contract has NO worker insurance/PMSBY enrolment, policy, nominee or claim
// endpoint yet. So this screen NEVER fabricates a per-user policy — the design's policy number (SBI-PMSBY-7842156),
// provider, coverage dates, nominee (Vikas Kumar · ****8245) and "ACTIVE" status are seed data with no source, so
// the per-user "Your policy" + nominee sections show an honest "appears once you're enrolled" state, and File-a-
// Claim / Download-PDF surface a coming-soon notice rather than calling a non-existent endpoint.
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { formatMoneyMinor } from '@krishi-verse/i18n';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';

// PMSBY statutory figures (public government scheme constants — bigint minor, Law 2; not per-user/seed data).
const COVER_MINOR = '20000000';        // ₹2,00,000 accidental death / total disability
const PARTIAL_MINOR = '10000000';      // ₹1,00,000 partial disability
const PREMIUM_MINOR = '2000';          // ₹20 / year

export default function WorkerInsurance() {
  const { t, lang } = useTranslation();
  const enabled = useFlag('worker_app');
  if (!enabled) return <ScreenScaffold title={t('worker.insurance.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const covered: Array<{ key: string; minor?: string }> = [
    { key: 'death', minor: COVER_MINOR },
    { key: 'totalDisability', minor: COVER_MINOR },
    { key: 'partialDisability', minor: PARTIAL_MINOR },
    { key: 'bothAccidents' },
    { key: 'roundClock' },
  ];

  return (
    <ScreenScaffold
      title={t('worker.insurance.title')} scroll={false}
      footer={
        <View style={styles.actions}>
          <Button title={t('worker.insurance.download')} variant="outline" onPress={() => Alert.alert(t('worker.insurance.title'), t('worker.insurance.comingSoon'))} />
          <View style={{ flex: 1 }}><Button title={t('worker.insurance.fileClaim')} onPress={() => Alert.alert(t('worker.insurance.fileClaim'), t('worker.insurance.comingSoon'))} fullWidth /></View>
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[4], gap: space[3] }}>
        {/* Hero — program facts */}
        <View style={styles.hero}>
          <View style={styles.badge}><Text style={styles.badgeTxt}>{t('worker.insurance.govtBacked')}</Text></View>
          <Text style={styles.heroTitle}>{t('worker.insurance.pmsby')}</Text>
          <Text style={styles.heroSub}>{t('worker.insurance.pmsbyFull')}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('worker.insurance.totalCover')}</Text>
              <MoneyText minor={COVER_MINOR} currencyCode="INR" langCode={lang} size="xl" style={{ color: color.white }} />
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('worker.insurance.premium')}</Text>
              <Text style={styles.heroPremium}>{t('worker.insurance.premiumOnly', { amount: formatMoneyMinor(PREMIUM_MINOR, 'INR', lang) })}</Text>
            </View>
          </View>
        </View>

        {/* What's covered — program facts */}
        <Card>
          <Text style={styles.h3}>{t('worker.insurance.whatsCovered')}</Text>
          {covered.map((c) => (
            <View key={c.key} style={styles.coverRow}>
              <Text style={styles.tick}>✓</Text>
              <Text style={styles.coverText}>
                {t(`worker.insurance.cover.${c.key}`)}{c.minor ? ` — ${formatMoneyMinor(c.minor, 'INR', lang)}` : ''}
              </Text>
            </View>
          ))}
        </Card>

        {/* Your policy — §13 no per-user policy contract */}
        <Card>
          <Text style={styles.h3}>{t('worker.insurance.yourPolicy')}</Text>
          <Text style={styles.note}>{t('worker.insurance.policyNote')}</Text>
        </Card>

        {/* Nominee — §13 */}
        <Card>
          <Text style={styles.h3}>{t('worker.insurance.nominee')}</Text>
          <Text style={styles.note}>{t('worker.insurance.nomineeNote')}</Text>
        </Card>

        {/* How to claim — program info */}
        <Card>
          <Text style={styles.h3}>{t('worker.insurance.howToClaim')}</Text>
          <Text style={styles.claimBody}>{t('worker.insurance.claimBody')}</Text>
        </Card>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space[3], alignItems: 'center' },
  hero: { backgroundColor: color.primary700, borderRadius: radius.lg, padding: space[5], alignItems: 'center' },
  badge: { paddingHorizontal: space[3], paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  badgeTxt: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.white, letterSpacing: 0.5 },
  heroTitle: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.white, marginTop: space[3] },
  heroSub: { fontFamily: font.body, fontSize: font.size.sm, color: color.primary100, marginTop: 2, textAlign: 'center' },
  heroStats: { flexDirection: 'row', gap: space[3], marginTop: space[4], width: '100%' },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.primary100, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroPremium: { fontFamily: font.display, fontSize: font.size.lg, fontWeight: font.weight.bold, color: color.accent300 },
  h3: { fontFamily: font.display, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  coverRow: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start', paddingVertical: 6 },
  tick: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.successDark },
  coverText: { flex: 1, fontFamily: font.body, fontSize: font.size.sm, color: color.ink700, lineHeight: font.size.sm * 1.4 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, lineHeight: font.size.sm * 1.5 },
  claimBody: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, lineHeight: font.size.sm * 1.6 },
});
