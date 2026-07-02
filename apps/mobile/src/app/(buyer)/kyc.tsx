// apps/mobile/src/app/(buyer)/kyc.tsx · screen 133 (Business KYC · documents step). Thin screen (guide §3):
// upload the real KYC documents for the caller's account. The doc-type catalogue (kycDocTypes), the caller's
// submitted statuses (listKyc → kycStatusFor) and the submit (media upload → submitKyc, idempotent Law 3) are ALL
// real; raw document NUMBERS are never sent (only the photo + server-side verification, §4/DPDP). FLAG_SECURE (KYC
// surface). Behind the `kyc` flag. Degrade-never-die (skeleton / friendly / per-row inline).
//
// §13 (no contract → rendered honestly, never faked): there is NO business-KYC field contract — the profile patch
// carries only {fullName, languageCode, email}, so Business type / GSTIN / FSSAI can't be persisted here (GST/FSSAI
// go in as uploaded DOCUMENTS below; PAN/Aadhaar verify through the separate eKYC provider flow, returning masked
// values only). We therefore persist the real Business name and note the rest, never storing a raw GSTIN/PAN or
// fabricating "auto-verified with GSTN/NSDL".
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import type { KycDocument, KycDocType, KycStatus, UserProfile } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useSecureScreen } from '../../core/security/screen-guard';
import { getMyProfile, updateMyProfile } from '../../features/profile/profile.api';
import { listKyc, kycDocTypes, submitKyc } from '../../features/kyc/kyc.api';
import { kycStatusFor } from '../../features/kyc/kyc';
import { pickFromGallery } from '../../core/media/picker';
import { uploadPickedImage } from '../../core/media/uploader';

const TONE: Record<KycStatus, PillTone> = { pending: 'warning', verified: 'success', rejected: 'danger', expired: 'neutral' };

export default function BusinessKyc() {
  useSecureScreen();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('kyc');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [types, setTypes] = useState<KycDocType[]>([]);
  const [docs, setDocs] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadDocs = useCallback(async () => { setDocs(await listKyc()); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    const p = await getMyProfile();
    setProfile(p); setName(p?.displayName ?? '');
    setTypes(await kycDocTypes());
    await reloadDocs();
    setLoading(false);
  }, [reloadDocs]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('businessKyc.title')}><EmptyState title={t('kyc.unavailable')} /></ScreenScaffold>;

  const upload = async (docTypeId: string) => {
    const picked = await pickFromGallery();
    if (!picked) return;
    setBusyType(docTypeId);
    try {
      const res = await uploadPickedImage(picked);
      if (res.mediaId) { await submitKyc({ docTypeId, mediaId: res.mediaId }); await reloadDocs(); }
      else Alert.alert(t('businessKyc.uploadQueued'));
    } catch { Alert.alert(t('businessKyc.uploadFailed')); }
    finally { setBusyType(null); }
  };

  const onContinue = async () => {
    setSaving(true);
    try {
      const trimmed = name.trim();
      if (trimmed && trimmed !== (profile?.displayName ?? '')) await updateMyProfile({ fullName: trimmed });
      router.back();
    } catch { Alert.alert(t('businessKyc.saveFailed')); }
    finally { setSaving(false); }
  };

  const footer = (
    <View style={styles.footerRow}>
      <Button title={t('common.back')} variant="outline" onPress={() => router.back()} />
      <View style={{ flex: 1 }}><Button title={t('businessKyc.continue')} onPress={onContinue} loading={saving} disabled={name.trim().length < 2} fullWidth /></View>
    </View>
  );

  return (
    <ScreenScaffold title={t('businessKyc.title')} footer={footer}>
      {/* Step 2 of 3 */}
      <View style={styles.progress}>
        <View style={styles.bar}>
          <View style={[styles.seg, styles.segDone]} />
          <View style={[styles.seg, styles.segCurrent]} />
          <View style={[styles.seg, styles.segPending]} />
        </View>
        <View style={styles.progressRow}><Text style={styles.step}>{t('businessKyc.step')}</Text><Text style={styles.stepLabel}>{t('businessKyc.stepName')}</Text></View>
      </View>

      {loading ? <View style={{ marginTop: space[4] }}><SkeletonCard lines={3} /><SkeletonCard lines={4} /></View> : (
        <>
          <View style={styles.why}><Text style={styles.whyText}><Text style={styles.whyBold}>{t('businessKyc.whyTitle')} </Text>{t('businessKyc.whyBody')}</Text></View>

          <Text style={styles.h3}>{t('businessKyc.businessProof')}</Text>
          <Input label={t('businessKyc.businessName')} value={name} onChangeText={setName} maxLength={120} />
          <Card style={{ marginTop: space[2] }}><Text style={styles.note}>{t('businessKyc.fieldsNote')}</Text></Card>

          <Text style={styles.h3}>{t('businessKyc.documents')}</Text>
          {types.length === 0 ? (
            <Card><Text style={styles.note}>{t('businessKyc.noTypes')}</Text></Card>
          ) : types.map((dt) => {
            const status = kycStatusFor(docs, dt.id);
            return (
              <Card key={dt.id} style={styles.doc}>
                <View style={styles.docRow}>
                  <Text style={styles.docName}>{dt.name}</Text>
                  {status ? <StatusPill label={t(`kyc.status.${status}`)} tone={TONE[status] ?? 'neutral'} /> : null}
                </View>
                {!status || status === 'rejected' ? (
                  <View style={{ marginTop: space[2] }}>
                    <Button title={t('businessKyc.upload')} variant="outline" size="sm" onPress={() => upload(dt.id)} loading={busyType === dt.id} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  progress: { paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  bar: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  segDone: { backgroundColor: color.success },
  segCurrent: { backgroundColor: color.primary600 },
  segPending: { backgroundColor: color.earth200 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[2] },
  step: { fontFamily: font.body, fontSize: font.size.xs, fontWeight: font.weight.bold, color: color.ink600 },
  stepLabel: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500 },
  why: { marginTop: space[4], padding: space[3], borderRadius: radius.md, backgroundColor: color.infoLight },
  whyText: { fontFamily: font.body, fontSize: font.size.xs, color: color.infoDark, lineHeight: font.size.xs * 1.5 },
  whyBold: { fontWeight: font.weight.bold },
  h3: { fontFamily: font.display, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800, marginTop: space[4], marginBottom: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.xs, color: color.ink500, lineHeight: font.size.xs * 1.5 },
  doc: { marginBottom: space[2] },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  docName: { flex: 1, fontFamily: font.body, fontSize: font.size.sm, fontWeight: font.weight.bold, color: color.ink800 },
  footerRow: { flexDirection: 'row', gap: space[3], alignItems: 'center' },
});
