// apps/mobile/src/app/(buyer)/auctions/bid.tsx · screen 17 (place a bid). Thin screen (guide §3): enter a bid
// (₹→paise via BigInt, Law 2), validated client-side against the required minimum (pure validateBidRupees) → place
// the bid. Placing holds the EMD SERVER-SIDE (the app never moves money — Law 11); the server is the authority on
// whether the bid is legal (highest/increment/EMD/timing) — a 409/422 is shown friendly. Behind `auctions`.
import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, MoneyText, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { placeBid } from '../../../features/auctions/auctions.api';
import { validateBidRupees } from '../../../features/auctions/auction-status';

export default function PlaceBid() {
  const { id, minNextMinor } = useLocalSearchParams<{ id: string; minNextMinor?: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('auctions');
  const [rupees, setRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const minNext = minNextMinor ?? '0';

  if (!enabled) return <ScreenScaffold title={t('auction.placeBid')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSubmit = async () => {
    const check = validateBidRupees(rupees, minNext);
    if (!id || !check.ok) { setError(t(check.ok ? 'auction.bidFailed' : check.reason === 'too_low' ? 'auction.bidTooLow' : 'addMoney.invalidAmount')); return; }
    setBusy(true); setError(undefined);
    try {
      await placeBid(id, (BigInt(rupees.trim()) * 100n).toString());
      router.replace({ pathname: '/(buyer)/auctions/[id]', params: { id, notice: t('auction.bidPlaced') } });
    } catch (e) {
      setError(e instanceof SdkError && (e.isConflict || e.isValidation) ? t('auction.bidRejected')
        : e instanceof SdkError && e.isForbidden ? t('auction.bidNotAllowed') : t('auction.bidFailed'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('auction.placeBid')}
      footer={<Button title={t('auction.confirmBid')} onPress={onSubmit} loading={busy} disabled={rupees.trim().length === 0} />}
    >
      <Text style={styles.min}>{t('auction.minNext')} <MoneyText minor={minNext} langCode={lang} size="md" /></Text>
      <Input label={t('auction.yourBid')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" autoFocus maxLength={13} error={error} />
      <Text style={styles.emd}>{t('auction.emdNote')}</Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  min: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginBottom: space[3] },
  emd: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[3] },
});
