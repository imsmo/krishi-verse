// apps/mobile/src/app/(ambassador)/profile.tsx · screen 95 (ambassador profile). Thin screen (guide §3): the
// caller's own ambassador profile (status, training, kiosk/AePS capability flags — all server-owned) + sign out.
// Behind `ambassador_training`. Degrade-never-die. PII-minimised (no name/phone on the profile read).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AmbassadorProfile } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { useAuth } from '../../core/auth/auth.store';
import { myProfile } from '../../features/ambassador/ambassador.api';

export default function AmbassadorProfileScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const enabled = useFlag('ambassador_training');
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setProfile(await myProfile()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('amb.profile.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  return (
    <ScreenScaffold title={t('amb.profile.title')} footer={<Button title={t('profile.signOut')} variant="outline" onPress={() => signOut()} />}>
      {loading ? <SkeletonCard lines={4} /> : !profile ? (
        <EmptyState title={t('amb.home.notAmbassador.title')} message={t('amb.home.notAmbassador.message')} />
      ) : (
        <Card>
          <View style={styles.row}><Text style={styles.k}>{t('amb.status')}</Text><StatusPill label={t(profile.isActive ? 'amb.active' : 'amb.suspended')} tone={profile.isActive ? 'success' : 'danger'} /></View>
          <View style={styles.row}><Text style={styles.k}>{t('amb.profile.training')}</Text><Text style={styles.v}>{profile.trainingCompletedAt ? t('amb.profile.trained') : t('amb.profile.pending')}</Text></View>
          <View style={styles.row}><Text style={styles.k}>{t('amb.profile.kiosk')}</Text><Text style={styles.v}>{t(profile.kioskEnabled ? 'common.yes' : 'common.no')}</Text></View>
          <View style={styles.row}><Text style={styles.k}>{t('amb.profile.aeps')}</Text><Text style={styles.v}>{t(profile.aepsEnabled ? 'common.yes' : 'common.no')}</Text></View>
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink800 },
});
