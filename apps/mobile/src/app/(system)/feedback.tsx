// apps/mobile/src/app/(system)/feedback.tsx · screen 195 (feedback). Thin screen (guide §3): send feedback, which
// opens a real low-priority support ticket (P-22 support module, idempotent — Law 3). Behind `system_screens`.
// Degrade-never-die.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { submitFeedback } from '../../features/system/system.api';

export default function Feedback() {
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('system_screens');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('system.feedback.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const submit = async () => {
    const body = text.trim();
    if (body.length < 5) { setError(t('system.feedback.tooShort')); return; }
    setBusy(true); setError(undefined);
    try { await submitFeedback(body); Alert.alert(t('system.feedback.title'), t('system.feedback.thanks')); router.back(); }
    catch { Alert.alert(t('system.feedback.title'), t('system.feedback.failed')); }
    finally { setBusy(false); }
  };

  return (
    <ScreenScaffold title={t('system.feedback.title')}>
      <Card>
        <Text style={styles.body}>{t('system.feedback.intro')}</Text>
        <Input label={t('system.feedback.label')} value={text} onChangeText={setText} multiline maxLength={250} error={error} placeholder={t('system.feedback.placeholder')} />
        <View style={{ marginTop: space[3] }}><Button title={t('system.feedback.send')} loading={busy} onPress={submit} /></View>
      </Card>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: font.body, fontSize: font.size.md, color: color.ink700, marginBottom: space[3] },
});
