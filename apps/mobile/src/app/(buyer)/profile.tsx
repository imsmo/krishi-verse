// apps/mobile/src/app/(buyer)/profile.tsx · screens 132 (buyer profile) + 133 (buyer KYC status). Thin screen
// (guide §3): shows verification (KYC) status via the SHARED features/kyc, links to Saved + Addresses, and signs
// out (clears the secure token + cache scope). Behind `buyer_app`. Degrade-never-die.
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { KycDocument } from '@krishi-verse/sdk-js';
import { Button, Card, StatusPill, ScreenScaffold, color, font, space, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useAuth } from '../../core/auth/auth.store';
import { listKyc } from '../../features/kyc/kyc.api';

const KYC_TONE: Record<string, PillTone> = { verified: 'success', pending: 'warning', rejected: 'danger', expired: 'danger' };

export default function BuyerProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuth();
  const enabled = useFlag('buyer_app');
  const kycEnabled = useFlag('kyc');
  const [kyc, setKyc] = useState<KycDocument[] | null>(null);

  const load = useCallback(async () => { if (kycEnabled) setKyc(await listKyc()); }, [kycEnabled]);
  useFocusEffect(useCallback(() => { if (enabled) load(); }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('tabs.profile')} />;

  const latest = kyc?.[0];

  return (
    <ScreenScaffold title={t('tabs.profile')}>
      {kycEnabled ? (
        <Card>
          <View style={styles.row}>
            <Text style={styles.label}>{t('profile.kyc')}</Text>
            <StatusPill label={t(`kyc.status.${latest?.status ?? 'none'}`)} tone={latest ? (KYC_TONE[latest.status] ?? 'neutral') : 'neutral'} />
          </View>
        </Card>
      ) : null}

      <View style={styles.links}>
        <Pressable onPress={() => router.push('/(buyer)/saved')} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>{t('buyer.tabs.saved')}</Text></Pressable>
        <Pressable onPress={() => router.push('/(buyer)/addresses')} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>{t('address.title')}</Text></Pressable>
      </View>

      <View style={{ marginTop: space[5] }}>
        <Button title={t('profile.signOut')} variant="outline" onPress={() => signOut()} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700 },
  links: { marginTop: space[3] },
  link: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: color.ink100 },
  linkText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink800 },
});
