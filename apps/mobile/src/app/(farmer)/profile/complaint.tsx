// apps/mobile/src/app/(farmer)/profile/complaint.tsx · screen 124 (complaint / raise a ticket). Thin screen (guide
// §3): describe the issue + pick a severity, then open a support ticket (idempotent — Law 3). The server sets the
// SLA clock from severity. Behind `farmer_profile`. Degrade-never-die.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { openTicket } from '../../../features/profile/profile.api';
import { buildTicketDraft, severityTone, TICKET_SEVERITIES } from '../../../features/profile/profile';

export default function Complaint() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('farmer_profile');
  const [subject, setSubject] = useState('');
  const [severity, setSeverity] = useState('P2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('profile.complaint.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const submit = async () => {
    const draft = buildTicketDraft({ subject, severity });
    if (!draft.ok || !draft.input) { setError(t('profile.complaint.needSubject')); return; }
    setSaving(true); setError(undefined);
    try { await openTicket(draft.input); router.replace('/(farmer)/profile/help'); }
    catch { Alert.alert(t('profile.complaint.title'), t('profile.complaint.failed')); }
    finally { setSaving(false); }
  };

  return (
    <ScreenScaffold title={t('profile.complaint.title')}>
      <Card>
        <Input label={t('profile.complaint.subject')} value={subject} onChangeText={setSubject} multiline maxLength={250} error={error} placeholder={t('profile.complaint.placeholder')} />
        <Text style={styles.label}>{t('profile.complaint.severity')}</Text>
        <View style={styles.chips}>
          {TICKET_SEVERITIES.map((s) => {
            const on = severity === s;
            return <Pressable key={s} onPress={() => setSeverity(s)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}><Text style={[styles.chipText, on && styles.chipTextOn]}>{t(`profile.complaint.sev.${s}`)}</Text></Pressable>;
          })}
        </View>
        <Text style={styles.note}>{t('profile.complaint.slaNote')}</Text>
        <View style={{ marginTop: space[3] }}><Button title={t('profile.complaint.submit')} loading={saving} onPress={submit} /></View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3], marginBottom: space[2] },
  chips: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  chip: { minWidth: 56, minHeight: 44, paddingHorizontal: space[3], justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600 },
  chipText: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
