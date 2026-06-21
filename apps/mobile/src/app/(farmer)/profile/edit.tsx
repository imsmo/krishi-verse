// apps/mobile/src/app/(farmer)/profile/edit.tsx · screen 119 (edit profile). Thin screen (guide §3): edit the
// caller's own name / language / email (PATCH /users/me). Only changed fields are sent (buildProfilePatch).
// Behind `farmer_profile`. Degrade-never-die. NOTE: the profile read exposes name + locale only — gender/dob start
// blank (no read field) and are written if entered; flagged.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LANGUAGES } from '@krishi-verse/i18n';
import { Button, Card, Input, EmptyState, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getMyProfile, updateMyProfile } from '../../../features/profile/profile.api';
import { buildProfilePatch } from '../../../features/profile/profile';

export default function EditProfile() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('farmer_profile');
  const [fullName, setFullName] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const p = await getMyProfile();
    if (p) { setFullName(p.displayName ?? ''); setLanguageCode(p.locale ?? ''); }
    setLoading(false);
  }, []);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title={t('profile.editProfile')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const save = async () => {
    const draft = buildProfilePatch({ fullName, languageCode, email });
    if (!draft.ok || !draft.patch) { setError(t(draft.reason === 'email' ? 'profile.edit.emailInvalid' : draft.reason === 'empty' ? 'profile.edit.noChanges' : 'common.error.generic')); return; }
    setSaving(true); setError(undefined);
    try { await updateMyProfile(draft.patch); router.back(); }
    catch { Alert.alert(t('profile.editProfile'), t('profile.edit.failed')); }
    finally { setSaving(false); }
  };

  return (
    <ScreenScaffold title={t('profile.editProfile')}>
      {loading ? <SkeletonCard lines={4} /> : (
        <Card>
          <Input label={t('profile.edit.name')} value={fullName} onChangeText={setFullName} maxLength={200} />
          <Text style={styles.label}>{t('language.title')}</Text>
          <View style={styles.chips}>
            {LANGUAGES.map((l) => {
              const on = l.code === languageCode;
              return <Pressable key={l.code} onPress={() => setLanguageCode(l.code)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}><Text style={[styles.chipText, on && styles.chipTextOn]}>{l.nameNative}</Text></Pressable>;
            })}
          </View>
          <Input label={t('profile.edit.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={200} error={error} />
          <View style={{ marginTop: space[3] }}><Button title={t('common.save')} loading={saving} onPress={save} /></View>
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink500, marginTop: space[3], marginBottom: space[2] },
  chips: { flexDirection: 'row', gap: space[2] },
  chip: { paddingHorizontal: space[4], minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.ink200, backgroundColor: color.card },
  chipOn: { borderColor: color.primary600, backgroundColor: color.primary50 },
  chipText: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600 },
  chipTextOn: { color: color.primary800, fontWeight: font.weight.semibold },
});
