// apps/mobile/src/app/(farmer)/schemes/apply.tsx · screen 106 (apply). Thin screen (guide §3): upload each required
// supporting document (core/media P-01: pick → EXIF-drop/downscale → presign → PUT → confirm), give consent, then
// apply (idempotent draft) + submit. FLAG_SECURE while shown (identity documents). Behind `schemes_govt`.
// Degrade-never-die. NOTE: doc-type names aren't exposed (UUIDs) → shown as "Document N"; flagged, never faked.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Toggle, AddMediaTile, UploadTile, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useSecureScreen } from '../../../core/security/screen-guard';
import { captureFromCamera, pickFromGallery } from '../../../core/media';
import { uploadSchemeDocument, applyToScheme, submitApplication } from '../../../features/schemes/schemes.api';
import { docChecklist, allDocsUploaded, buildApplyDraft } from '../../../features/schemes/schemes';

export default function SchemeApply() {
  useSecureScreen();
  const { id, docs } = useLocalSearchParams<{ id: string; docs?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('schemes_govt');
  const requiredDocTypeIds = useMemo(() => (docs ? docs.split(',').filter(Boolean) : []), [docs]);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return <ScreenScaffold title={t('schemes.apply.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;
  if (!id) return <ScreenScaffold title={t('schemes.apply.title')}><EmptyState title={t('schemes.unavailable')} /></ScreenScaffold>;

  const attach = (docTypeId: string) => {
    Alert.alert(t('schemes.docs.add'), undefined, [
      { text: t('schemes.docs.camera'), onPress: () => runUpload(docTypeId, captureFromCamera) },
      { text: t('schemes.docs.gallery'), onPress: () => runUpload(docTypeId, pickFromGallery) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };
  const runUpload = useCallback(async (docTypeId: string, pick: () => Promise<any>) => {
    setBusyDoc(docTypeId);
    try {
      const picked = await pick();
      if (!picked) return;
      const mediaId = await uploadSchemeDocument(picked);
      if (mediaId) setUploaded((prev) => ({ ...prev, [docTypeId]: mediaId }));
      else Alert.alert(t('schemes.apply.title'), t('schemes.docs.uploadFailed'));
    } finally { setBusyDoc(null); }
  }, [t]);

  const submit = async () => {
    const draft = buildApplyDraft({ schemeId: id, requiredDocTypeIds, uploaded, consent });
    if (!draft.ok || !draft.input) {
      Alert.alert(t('schemes.apply.title'), t(draft.reason === 'consent' ? 'schemes.apply.needConsent' : draft.reason === 'documents' ? 'schemes.apply.needDocs' : 'common.error.generic'));
      return;
    }
    setSubmitting(true);
    try {
      const app = await applyToScheme(draft.input);
      await submitApplication(app.id);
      router.replace({ pathname: '/(farmer)/schemes/status', params: { id: app.id } });
    } catch { Alert.alert(t('schemes.apply.title'), t('schemes.apply.failed')); }
    finally { setSubmitting(false); }
  };

  const checklist = docChecklist(requiredDocTypeIds, uploaded);
  const ready = allDocsUploaded(requiredDocTypeIds, uploaded) && consent;

  return (
    <ScreenScaffold title={t('schemes.apply.title')}>
      <ScrollView contentContainerStyle={{ paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.h}>{t('schemes.docs.title')}</Text>
          {checklist.length === 0 ? <Text style={styles.note}>{t('schemes.docs.none')}</Text> : checklist.map((d) => (
            <View key={d.docTypeId} style={styles.docRow}>
              <Text style={styles.docLabel}>{t('schemes.docs.item', { n: d.index + 1 })}</Text>
              {d.mediaId ? (
                <UploadTile uri={''} status="done" removeLabel={t('schemes.docs.remove')} onRemove={() => setUploaded((p) => { const n = { ...p }; delete n[d.docTypeId]; return n; })} size={64} />
              ) : (
                <AddMediaTile label={busyDoc === d.docTypeId ? t('schemes.docs.uploading') : t('schemes.docs.add')} onPress={() => attach(d.docTypeId)} disabled={busyDoc === d.docTypeId} size={64} />
              )}
            </View>
          ))}
        </Card>

        <Card style={styles.section}>
          <Toggle label={t('schemes.apply.consent')} hint={t('schemes.apply.consentHint')} value={consent} onValueChange={setConsent} />
        </Card>

        <View style={{ marginTop: space[4] }}>
          <Button title={t('schemes.apply.submit')} loading={submitting} disabled={!ready} onPress={submit} />
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink900, marginBottom: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400 },
  section: { marginTop: space[3] },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2] },
  docLabel: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, flex: 1 },
});
