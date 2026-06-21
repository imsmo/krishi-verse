// apps/mobile/src/app/(farmer)/create-auction.tsx · screen 64 (create auction). Thin screen (guide §3): the seller
// turns one of their listings into an english auction — start price + min increment (₹→paise via BigInt, Law 2) +
// a duration (days). startsAt = now, endsAt = now + days. Idempotent create; the server authorizes ownership and
// re-validates. Behind `auctions`. Degrade-never-die.
import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { createAuction } from '../../features/auctions/auctions.api';
import { rupeesToOfferMinor } from '../../features/offers/offer-status';

export default function CreateAuction() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('auctions');
  const [start, setStart] = useState('');
  const [increment, setIncrement] = useState('');
  const [days, setDays] = useState('3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('createAuction.title')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSubmit = async () => {
    const startMinor = rupeesToOfferMinor(start);
    const incMinor = increment.trim() ? rupeesToOfferMinor(increment) : undefined;
    const d = Number(days);
    if (!listingId || !startMinor || !(d >= 1 && d <= 30)) { setError(t('createAuction.invalid')); return; }
    setBusy(true); setError(undefined);
    try {
      const now = Date.now();
      const a = await createAuction({
        listingId, kind: 'english_open', startPriceMinor: startMinor, minIncrementMinor: incMinor ?? undefined,
        startsAt: new Date(now).toISOString(), endsAt: new Date(now + d * 86400000).toISOString(),
      });
      router.replace({ pathname: '/(buyer)/auctions/[id]', params: { id: a.auctionId, notice: t('createAuction.created') } });
    } catch (e) {
      setError(e instanceof SdkError && e.isForbidden ? t('createAuction.notAllowed') : e instanceof SdkError && e.isConflict ? t('createAuction.exists') : t('createAuction.failed'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('createAuction.title')}
      footer={<Button title={t('createAuction.create')} onPress={onSubmit} loading={busy} disabled={!start.trim() || !days.trim()} />}
    >
      <Text style={styles.help}>{t('createAuction.help')}</Text>
      <Input label={t('createAuction.startPrice')} value={start} onChangeText={setStart} keyboardType="number-pad" maxLength={13} />
      <Input label={t('createAuction.increment')} value={increment} onChangeText={setIncrement} keyboardType="number-pad" maxLength={13} />
      <Input label={t('createAuction.days')} value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={2} error={error} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  help: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginBottom: space[3] },
});
