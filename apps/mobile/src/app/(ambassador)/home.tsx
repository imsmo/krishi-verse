// apps/mobile/src/app/(ambassador)/home.tsx · screen 86 (ambassador home). Thin screen (guide §3): the
// ambassador's profile status (active/training) + an acquisition funnel (invited→signed-up→activated→rewarded
// from their referrals) + quick actions (onboard a farmer, log a visit, help). Behind `ambassador_app`.
// Degrade-never-die. PII-minimised: the profile carries no name/phone.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { AmbassadorProfile, Referral } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { myProfile, listReferrals } from '../../features/ambassador/ambassador.api';
import { referralFunnel } from '../../features/ambassador/referral-flow';

export default function AmbassadorHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('ambassador_app');
  const training = useFlag('ambassador_training');
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([myProfile(), listReferrals()]);
    setProfile(p); setRefs(r.items); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { if (enabled) { setLoading(true); load(); } }, [enabled, load]));

  if (!enabled) return <ScreenScaffold title={t('amb.home.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const f = referralFunnel(refs);

  return (
    <ScreenScaffold title={t('amb.home.title')} footer={<Button title={t('amb.onboard.cta')} onPress={() => router.push('/(ambassador)/onboard-start')} />}>
      {loading ? <SkeletonCard lines={4} /> : !profile ? (
        <EmptyState title={t('amb.home.notAmbassador.title')} message={t('amb.home.notAmbassador.message')} />
      ) : (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>{t('amb.status')}</Text>
              <StatusPill label={t(profile.isActive ? 'amb.active' : 'amb.suspended')} tone={profile.isActive ? 'success' : 'danger'} />
            </View>
            {!profile.trainingCompletedAt ? <Text style={styles.note}>{t('amb.trainingPending')}</Text> : null}
          </Card>

          <Text style={styles.section}>{t('amb.funnel.title')}</Text>
          <Card>
            <Stat k={t('amb.funnel.invited')} v={f.invited} />
            <Stat k={t('amb.funnel.signedUp')} v={f.signedUp} />
            <Stat k={t('amb.funnel.activated')} v={f.activated} />
            <Stat k={t('amb.funnel.rewarded')} v={f.rewarded} />
          </Card>

          <View style={styles.actions}>
            <Button title={t('amb.tabs.farmers')} variant="outline" onPress={() => router.push('/(ambassador)/farmers')} />
            <Button title={t('amb.visit.cta')} variant="outline" onPress={() => router.push('/(ambassador)/visit-log')} />
            <Button title={t('amb.help.title')} variant="outline" onPress={() => router.push('/(ambassador)/help-listing')} />
            {training ? (
              <>
                <Button title={t('amb.training.title')} variant="outline" onPress={() => router.push('/(ambassador)/training')} />
                <Button title={t('amb.commissions.title')} variant="outline" onPress={() => router.push('/(ambassador)/commissions')} />
                <Button title={t('amb.leaderboard.title')} variant="outline" onPress={() => router.push('/(ambassador)/leaderboard')} />
                <Button title={t('amb.targets.title')} variant="outline" onPress={() => router.push('/(ambassador)/targets')} />
                <Button title={t('amb.profile.title')} variant="outline" onPress={() => router.push('/(ambassador)/profile')} />
              </>
            ) : null}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return <View style={styles.row}><Text style={styles.label}>{k}</Text><Text style={styles.val}>{String(v)}</Text></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2] },
  label: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  val: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.bold, color: color.ink800 },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.warningDark, marginTop: space[1] },
  section: { fontFamily: font.body, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.ink700, marginTop: space[4], marginBottom: space[2] },
  actions: { marginTop: space[4], gap: space[3] },
});
