// apps/mobile/src/app/(farmer)/profile/documents.tsx · screen 122 (documents). Thin screen (guide §3): the caller's
// KYC documents + verification status (MASKED — last-4/doc-no only, never a raw Aadhaar/PAN). FLAG_SECURE while
// shown. Behind `farmer_profile`. Degrade-never-die. Submitting a new doc deep-links to the KYC flow (P-03).
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { KycDocument, KycStatus } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, type PillTone } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { useSecureScreen } from '../../../core/security/screen-guard';
import { myDocuments } from '../../../features/profile/profile.api';

const TONE: Record<KycStatus, PillTone> = { pending: 'warning', verified: 'success', rejected: 'danger', expired: 'neutral' };

export default function Documents() {
  useSecureScreen();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('farmer_profile');
  const kycEnabled = useFlag('kyc');
  const [items, setItems] = useState<KycDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await myDocuments()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('profile.documents')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('profile.documents')} scroll={false}>
      {loading ? <View style={{ gap: space[3] }}><SkeletonCard lines={2} /><SkeletonCard lines={2} /></View> : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          ListEmptyComponent={<EmptyState title={t('profile.docs.empty.title')} message={t('profile.docs.empty.message')} />}
          ListFooterComponent={kycEnabled ? <View style={{ marginTop: space[4] }}><Button title={t('profile.docs.manage')} variant="outline" onPress={() => router.push('/(farmer)/kyc')} /></View> : null}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <Text style={styles.id}>{item.docNoMasked ?? item.id.slice(0, 8)}</Text>
                <StatusPill label={t(`kyc.status.${item.status}`, { defaultValue: item.status })} tone={TONE[item.status] ?? 'neutral'} />
              </View>
              {item.status === 'rejected' && item.rejectReason ? <Text style={styles.reason}>{item.rejectReason}</Text> : null}
            </Card>
          )}
        />
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
  reason: { fontFamily: font.body, fontSize: font.size.sm, color: color.dangerDark, marginTop: space[2] },
});
