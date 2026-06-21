// apps/mobile/src/app/(system)/account-delete.tsx · screen 177 (DPDP account deletion). Thin screen (guide §3):
// request erasure after a typed confirmation. The server runs retention/anti-fraud holds then erases — the app
// NEVER deletes data locally (Law 11). On success it signs out. Behind `system_screens`. Degrade-never-die.
// NOTE: the deletion endpoint isn't live yet → an honest "unavailable" message until it lands (flagged).
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useAuth } from '../../core/auth/auth.store';
import { requestAccountDeletion } from '../../features/system/system.api';
import { deleteConfirmationOk } from '../../features/system/system';

export default function AccountDelete() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'idle' | 'unavailable'>('idle');

  if (!enabled) return <ScreenScaffold title={t('system.accountDelete.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const expected = t('system.accountDelete.confirmWord');
  const ready = deleteConfirmationOk(confirm, expected);

  const submit = async () => {
    setBusy(true);
    const r = await requestAccountDeletion(reason.trim() || undefined);
    if (r.ok) { await signOut(); router.replace('/(auth)/welcome'); }
    else { setResult('unavailable'); setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('system.accountDelete.title')}>
      <Card>
        <Text style={styles.warn}>{t('system.accountDelete.warning')}</Text>
        <Text style={styles.body}>{t('system.accountDelete.intro')}</Text>
        <Input label={t('system.accountDelete.reason')} value={reason} onChangeText={setReason} multiline maxLength={500} />
        <Input label={t('system.accountDelete.confirmLabel', { word: expected })} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" maxLength={20} />
        {result === 'unavailable' ? <Text style={styles.note}>{t('system.accountDelete.unavailable')}</Text> : null}
        <View style={{ marginTop: space[4] }}>
          <Button title={t('system.accountDelete.submit')} variant="danger" loading={busy} disabled={!ready} onPress={submit} />
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  warn: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.danger, marginBottom: space[2] },
  body: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink600, marginBottom: space[3], lineHeight: 20 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3] },
});
