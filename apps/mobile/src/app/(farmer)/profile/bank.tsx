// apps/mobile/src/app/(farmer)/profile/bank.tsx · screen 121 (bank accounts). Thin screen (guide §3): list the
// caller's payout destinations (MASKED — last-4/IFSC or VPA, never a raw number) + add a UPI destination. FLAG_SECURE
// while shown. Behind `farmer_profile`. Degrade-never-die.
// NOTE: full bank-account add needs a server-side vault tokenization step not exposed to mobile (flagged) — UPI add
// is supported here (a VPA is a public payment address, used as its own vaultRef). Idempotent (Law 3).
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BankAccount } from '@krishi-verse/sdk-js';
import { Button, Card, Input, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useSecureScreen } from '../../../core/security/screen-guard';
import { myBankAccounts, addUpiAccount } from '../../../features/profile/profile.api';
import { bankLabel, isValidVpa } from '../../../features/profile/profile';

export default function BankAccounts() {
  useSecureScreen();
  const { t } = useTranslation();
  const enabled = useFlag('farmer_profile');
  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [holderName, setHolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => { setItems(await myBankAccounts()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('profile.bankAccounts')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const add = async () => {
    if (!isValidVpa(upiId)) { setError(t('profile.bank.upiInvalid')); return; }
    setSaving(true); setError(undefined);
    try { await addUpiAccount({ upiId: upiId.trim(), holderName: holderName.trim() || undefined, isPrimary: items.length === 0 }); setUpiId(''); setHolderName(''); await load(); }
    catch { Alert.alert(t('profile.bankAccounts'), t('profile.bank.failed')); }
    finally { setSaving(false); }
  };

  return (
    <ScreenScaffold title={t('profile.bankAccounts')}>
      {loading ? <SkeletonCard lines={3} /> : items.length === 0 ? (
        <EmptyState title={t('profile.bank.empty.title')} message={t('profile.bank.empty.message')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>{bankLabel(item)}</Text>
                {item.isPrimary ? <StatusPill label={t('profile.bank.primary')} tone="success" /> : null}
              </View>
              <Text style={styles.kind}>{t(`profile.bank.kind.${item.accountKind}`)}</Text>
            </Card>
          )}
          scrollEnabled={false}
        />
      )}

      <Card style={styles.form}>
        <Text style={styles.h}>{t('profile.bank.addUpi')}</Text>
        <Input label={t('profile.bank.upiId')} value={upiId} onChangeText={setUpiId} autoCapitalize="none" keyboardType="email-address" maxLength={100} error={error} placeholder="name@bank" />
        <Input label={t('profile.bank.holder')} value={holderName} onChangeText={setHolderName} maxLength={200} />
        <View style={{ marginTop: space[2] }}><Button title={t('profile.bank.add')} loading={saving} onPress={add} /></View>
        <Text style={styles.note}>{t('profile.bank.bankNote')}</Text>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  kind: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[1] },
  form: { marginTop: space[3] },
  h: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800, marginBottom: space[2] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
