// apps/mobile/src/app/(worker)/claim.tsx · screen 146 (File Insurance Claim — worker). Thin screen (guide §3): pick
// a claim type, enter incident details, see the required-document checklist, then submit. Behind `worker_app`.
// FLAG_SECURE (medical/incident + PII). Money via MoneyText where shown. Degrade-never-die.
//
// §13 — there is NO PMSBY claim / per-user policy / document-upload endpoint in the contract yet. So (never faked):
//  • the policy header shows a generic "Your PMSBY cover" + note, NEVER a fabricated "Policy #PMSBY-2026-009842 ·
//    Active till 31 May 2027";
//  • the FIR "filed at Anand PS on 22 Aug" status has no source → a neutral prompt, not an invented status;
//  • Upload / Submit / Save-Draft surface a coming-soon notice (the validated form is captured) rather than calling
//    a non-existent endpoint or minting a fake claim id.
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useSecureScreen } from '../../core/security/screen-guard';
import { CLAIM_TYPES, CLAIM_DOCS, normalizeClaimText, canSubmitClaim, type ClaimTypeKey } from '../../features/labour/insurance-claim';

export default function FileClaim() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('worker_app');
  useSecureScreen();
  const [type, setType] = useState<ClaimTypeKey | null>(null);
  const [date, setDate] = useState('');
  const [place, setPlace] = useState('');
  const [what, setWhat] = useState('');

  if (!enabled) return <ScreenScaffold title={t('insuranceClaim.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const soon = (title: string) => Alert.alert(title, t('insuranceClaim.comingSoon'));
  const submit = () => { if (canSubmitClaim(type, date, what)) { normalizeClaimText(what); soon(t('insuranceClaim.submit')); } };

  const footer = (
    <View style={styles.footerRow}>
      <Button title={t('insuranceClaim.saveDraft')} variant="outline" onPress={() => soon(t('insuranceClaim.saveDraft'))} />
      <View style={{ flex: 1 }}><Button title={t('insuranceClaim.submit')} onPress={submit} disabled={!canSubmitClaim(type, date, what)} fullWidth /></View>
    </View>
  );

  return (
    <ScreenScaffold title={t('insuranceClaim.title')} scroll={false} footer={footer}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space[4], gap: space[3] }}>
        {/* Policy header — §13 no per-user policy contract → generic, never a fabricated number */}
        <View style={styles.policy}>
          <Text style={styles.policyTitle}>{t('insuranceClaim.yourPmsby')}</Text>
          <Text style={styles.policyNote}>{t('insuranceClaim.policyNote')}</Text>
        </View>

        {/* Claim type */}
        <Text style={styles.section}>{t('insuranceClaim.whatType')}</Text>
        {CLAIM_TYPES.map((c) => {
          const on = type === c.key;
          return (
            <Pressable key={c.key} onPress={() => setType(c.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.typeRow, on && styles.typeOn]}>
              <Text style={styles.typeIcon}>{c.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeTitle, on && styles.typeTitleOn]}>{t(`insuranceClaim.type.${c.key}.title`)}</Text>
                <Text style={styles.typeSub}>{t(`insuranceClaim.type.${c.key}.sub`)}</Text>
              </View>
              {on ? <Text style={styles.tick}>✓</Text> : null}
            </Pressable>
          );
        })}

        {/* Incident details */}
        <Text style={styles.section}>{t('insuranceClaim.incidentDetails')}</Text>
        <Card>
          <Input label={t('insuranceClaim.dateOfIncident')} value={date} onChangeText={setDate} placeholder={t('insuranceClaim.datePh')} keyboardType="number-pad" maxLength={10} />
          <View style={{ marginTop: space[3] }}>
            <Input label={t('insuranceClaim.place')} value={place} onChangeText={setPlace} placeholder={t('insuranceClaim.placePh')} maxLength={120} />
          </View>
          <View style={{ marginTop: space[3] }}>
            <Input label={t('insuranceClaim.whatHappened')} value={what} onChangeText={setWhat} placeholder={t('insuranceClaim.whatPh')} multiline maxLength={2000} />
          </View>
        </Card>

        {/* Documents needed */}
        <Text style={styles.section}>{t('insuranceClaim.documentsNeeded')}</Text>
        <Card>
          {CLAIM_DOCS.map((d, i) => (
            <View key={d.key} style={[styles.docRow, i > 0 && styles.divide]}>
              <Text style={styles.docIcon}>{d.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{t(`insuranceClaim.doc.${d.key}.title`)}{d.required ? ' *' : ''}</Text>
                <Text style={styles.docSub}>{t(`insuranceClaim.doc.${d.key}.sub`)}</Text>
              </View>
              <Pressable onPress={() => soon(t('insuranceClaim.upload'))} accessibilityRole="button" style={styles.uploadBtn}>
                <Text style={styles.uploadTxt}>📷 {t('insuranceClaim.upload')}</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        {/* After-submission note — fixed program info */}
        <View style={styles.after}>
          <Text style={styles.afterTxt}>{t('insuranceClaim.afterNote')}</Text>
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  policy: { backgroundColor: color.primary50, borderRadius: radius.lg, padding: space[3] },
  policyTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.primary700 },
  policyNote: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink600, marginTop: 2 },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink700, marginTop: space[2], marginBottom: space[1] },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  typeOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  typeIcon: { fontSize: 24, width: 34, textAlign: 'center' },
  typeTitle: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  typeTitleOn: { color: color.primary700 },
  typeSub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  tick: { fontSize: 18, color: color.primary700, fontWeight: '700' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  divide: { borderTopWidth: 1, borderTopColor: color.ink100 },
  docIcon: { fontSize: 22, width: 30, textAlign: 'center' },
  docTitle: { fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.ink800 },
  docSub: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, marginTop: 2 },
  uploadBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: color.primary300 },
  uploadTxt: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.primary700 },
  after: { backgroundColor: color.successLight, borderRadius: radius.lg, padding: space[3] },
  afterTxt: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink600, lineHeight: font.size.xs * 1.5 },
  footerRow: { flexDirection: 'row', gap: space[3], alignItems: 'center' },
});
