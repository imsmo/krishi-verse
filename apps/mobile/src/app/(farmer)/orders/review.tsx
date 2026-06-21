// apps/mobile/src/app/(farmer)/orders/review.tsx · screen 24 (review after completion). Thin screen (guide §3):
// pick a 1–5 star rating + optional note → submitReview. The target (who is reviewed) is resolved SERVER-SIDE from
// the completed order (anti-IDOR) — the client never sends a target id. Idempotent. Behind `orders_fulfilment`.
// Degrade-never-die: a not-eligible/duplicate error shows a friendly message, never a crash.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { submitReview } from '../../../features/reviews/reviews.api';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewOrder() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('orders_fulfilment');
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('review.title')}><EmptyState title={t('orders.unavailable')} /></ScreenScaffold>;

  const onSubmit = async () => {
    if (!orderId || stars < 1) { setError(t('review.pickStars')); return; }
    setBusy(true); setError(undefined);
    try {
      await submitReview({ orderId, stars, body: body.trim() || undefined });
      router.replace({ pathname: '/(farmer)/orders', params: { notice: t('review.thanks') } });
    } catch (e) {
      setError(e instanceof SdkError && e.isConflict ? t('review.already')
        : e instanceof SdkError && e.isForbidden ? t('review.notEligible') : t('review.failed'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('review.title')}
      footer={<Button title={t('review.submit')} onPress={onSubmit} loading={busy} disabled={stars < 1} />}
    >
      <Text style={styles.prompt}>{t('review.prompt')}</Text>
      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={t('review.stars', { n: stars })}>
        {STARS.map((s) => (
          <Pressable key={s} onPress={() => setStars(s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('review.starN', { n: s })}>
            <Text style={[styles.star, s <= stars && styles.starOn]}>{s <= stars ? '★' : '☆'}</Text>
          </Pressable>
        ))}
      </View>
      <Input label={t('review.noteLabel')} value={body} onChangeText={setBody} multiline maxLength={1000} error={error} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  prompt: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginBottom: space[3] },
  stars: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
  star: { fontSize: 40, color: color.ink300 },
  starOn: { color: color.accent500 },
});
