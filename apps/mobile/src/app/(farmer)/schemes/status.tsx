// apps/mobile/src/app/(farmer)/schemes/status.tsx · screen 107 (application status). Thin screen (guide §3): the
// caller's application status + govt ref + decision/rejection + observed DBT credits (bigint paise via MoneyText,
// Law 2). Resubmit/appeal when the status allows (server re-checks the transition). Link to the attached docs.
// Behind `schemes_govt`. Degrade-never-die.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SchemeApplication, DbtTransfer } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { formatDate } from '@krishi-verse/i18n';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getApplication, dbtTransfers, resubmitApplication, appealApplication } from '../../../features/schemes/schemes.api';
import { applicationStatusTone, canResubmit, canAppeal } from '../../../features/schemes/schemes';

export default function SchemeStatus() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('schemes_govt');
  const [app, setApp] = useState<SchemeApplication | null>(null);
  const [dbt, setDbt] = useState<DbtTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    const [a, d] = await Promise.all([getApplication(id), dbtTransfers(id)]);
    setApp(a); setDbt(d); setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('schemes.status.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const act = async (fn: (id: string) => Promise<unknown>) => {
    if (!app) return;
    setBusy(true);
    try { await fn(app.id); await load(); }
    catch { Alert.alert(t('schemes.status.title'), t('common.error.generic')); }
    finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('schemes.status.title')}>
      {loading ? <SkeletonCard lines={5} /> : !app ? (
        <EmptyState title={t('schemes.status.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.k}>{t('schemes.status.state')}</Text>
              <StatusPill label={t(`schemes.statusLabel.${app.status}`, { defaultValue: app.status })} tone={applicationStatusTone(app.status)} />
            </View>
            {app.govtAppRef ? <Row k={t('schemes.status.ref')} v={app.govtAppRef} /> : null}
            {app.submittedAt ? <Row k={t('schemes.status.submitted')} v={safeDate(app.submittedAt, lang)} /> : null}
            {app.decidedAt ? <Row k={t('schemes.status.decided')} v={safeDate(app.decidedAt, lang)} /> : null}
            {app.status === 'rejected' && app.rejectionReason ? <Text style={styles.reason}>{app.rejectionReason}</Text> : null}
            <View style={styles.docsLink}><Button title={t('schemes.docs.view')} variant="outline" onPress={() => router.push({ pathname: '/(farmer)/schemes/docs', params: { id: app.id } })} /></View>
          </Card>

          {dbt.length > 0 ? (
            <Card style={styles.section}>
              <Text style={styles.h}>{t('schemes.status.dbt')}</Text>
              {dbt.map((d) => (
                <View key={d.id} style={styles.row}>
                  <Text style={styles.k}>{d.creditedOn ? safeDate(d.creditedOn, lang) : (d.pfmsRef ?? d.id.slice(0, 8))}</Text>
                  <MoneyText minor={d.amountMinor} langCode={lang} size="md" />
                </View>
              ))}
            </Card>
          ) : null}

          {(canResubmit(app.status) || canAppeal(app.status)) ? (
            <View style={styles.actions}>
              {canResubmit(app.status) ? <Button title={t('schemes.status.resubmit')} loading={busy} onPress={() => act(resubmitApplication)} /> : null}
              {canAppeal(app.status) ? <Button title={t('schemes.status.appeal')} variant="outline" loading={busy} onPress={() => act(appealApplication)} /> : null}
            </View>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

function Row({ k, v }: { k: string; v: string }) { return <View style={styles.row}><Text style={styles.k}>{k}</Text><Text style={styles.v}>{v}</Text></View>; }
function safeDate(value: string, langCode: string): string { try { return formatDate(value, langCode); } catch { return value; } }

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[1] },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, flex: 1 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  reason: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark, marginTop: space[2] },
  docsLink: { marginTop: space[3] },
  section: { marginTop: space[3] },
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink900, marginBottom: space[2] },
  actions: { marginTop: space[4], gap: space[3] },
});
