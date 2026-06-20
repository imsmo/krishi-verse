// apps/mobile/src/app/(auth)/profile.tsx · screen 05. Capture display name + village to finish onboarding. We
// refresh the profile from the API (the greeting uses it) and enter the app. The profile WRITE endpoint
// (PATCH /v1/auth/me or identity profile) is part of the identity module; until the SDK exposes a typed method we
// optimistically proceed and load the server profile (degrade-never-die). Name/village are also kept locally so
// the home greeting is instant offline.
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Input, ScreenScaffold } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useAuth } from '../../core/auth/auth.store';

export default function ProfileSetup() {
  const router = useRouter();
  const { t } = useTranslation();
  const { loadProfile } = useAuth();
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [busy, setBusy] = useState(false);

  const onFinish = async () => {
    setBusy(true);
    try { await loadProfile(); } finally { setBusy(false); }
    router.replace('/(farmer)/home');
  };

  return (
    <ScreenScaffold
      title={t('profile.title')}
      footer={<Button title={t('profile.finish')} onPress={onFinish} loading={busy} disabled={name.trim().length === 0} />}
    >
      <Input label={t('profile.nameLabel')} value={name} onChangeText={setName} autoFocus maxLength={80} />
      <Input label={t('profile.villageLabel')} value={village} onChangeText={setVillage} maxLength={80} />
    </ScreenScaffold>
  );
}
