// apps/mobile/src/app/(owner)/add-farmer.tsx · screen 78 (add a farmer). Thin screen (guide §3): admin-add a
// farmer who can't self-register — phone (validated client-side via PURE validateAddFarmer, server re-validates +
// normalizes) + optional name. REAL + idempotent (Law 3). Needs identity.approve — authorized SERVER-SIDE (NOT
// god-mode, tenant-scoped — Law 11). Behind `tenant_admin_lite`. Degrade-never-die.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { addFarmer } from '../../features/tenant/tenant.api';
import { validateAddFarmer } from '../../features/tenant/tenant-admin';

export default function AddFarmer() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('tenant_admin_lite');
  const [phone, setPhone] = useState('');
  const [fullName, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('owner.addFarmer.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const submit = async () => {
    const v = validateAddFarmer({ phone, fullName });
    if (!v.ok) { setError(t('owner.addFarmer.phoneInvalid')); return; }
    setBusy(true); setError(undefined);
    try { await addFarmer(v.input); router.replace({ pathname: '/(owner)/farmers', params: { notice: t('owner.addFarmer.added') } }); }
    catch (e) {
      const msg = e instanceof SdkError && e.isConflict ? t('owner.addFarmer.exists') : e instanceof SdkError && e.isForbidden ? t('owner.notAllowed') : t('owner.addFarmer.failed');
      Alert.alert(t('owner.addFarmer.title'), msg);
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('owner.addFarmer.title')} footer={<Button title={t('owner.addFarmer.submit')} onPress={submit} loading={busy} />}>
      <Card>
        <Text style={styles.body}>{t('owner.addFarmer.body')}</Text>
        <View style={{ marginTop: space[3] }}>
          <Input label={t('owner.addFarmer.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="+9198XXXXXXXX" error={error} />
        </View>
        <Input label={t('owner.addFarmer.name')} value={fullName} onChangeText={setName} maxLength={200} />
      </Card>
      <Text style={styles.note}>{t('owner.addFarmer.consentNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
