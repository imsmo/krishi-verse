// apps/mobile/src/app/(buyer)/make-offer.tsx · screen 99 (make an offer). Thin screen (guide §3): enter a quantity
// + a per-unit price (₹→paise via BigInt, Law 2) → offers.make (idempotent). On success → the offer detail to
// negotiate. Behind `offers_chat`. Degrade-never-die: a validation/permission error shows a friendly message.
import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, EmptyState, ScreenScaffold, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../core/i18n/useTranslation';
import { useFlag } from '../../core/flags/useFlag';
import { makeOffer } from '../../features/offers/offers.api';
import { rupeesToOfferMinor, normalizeQuantity } from '../../features/offers/offer-status';

export default function MakeOffer() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('offers_chat');
  const [qty, setQty] = useState('');
  const [rupees, setRupees] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!enabled) return <ScreenScaffold title={t('offer.makeTitle')}><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onSubmit = async () => {
    const q = normalizeQuantity(qty);
    const minor = rupeesToOfferMinor(rupees);
    if (!listingId || !q || !minor) { setError(t('offer.invalid')); return; }
    setBusy(true); setError(undefined);
    try {
      const offer = await makeOffer({ listingId, quantity: q, offeredPriceMinor: minor });
      router.replace({ pathname: '/(buyer)/offers/[id]', params: { id: offer.offerId, notice: t('offer.sent') } });
    } catch (e) {
      setError(e instanceof SdkError && e.isForbidden ? t('offer.notAllowed') : e instanceof SdkError && e.isConflict ? t('offer.exists') : t('offer.failed'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('offer.makeTitle')}
      footer={<Button title={t('offer.send')} onPress={onSubmit} loading={busy} disabled={!qty.trim() || !rupees.trim()} />}
    >
      <Text style={styles.help}>{t('offer.help')}</Text>
      <Input label={t('offer.quantity')} value={qty} onChangeText={setQty} keyboardType="decimal-pad" maxLength={14} />
      <Input label={t('offer.pricePerUnit')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" maxLength={13} error={error} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  help: { fontFamily: font.body, fontSize: font.size.md, color: color.ink600, marginBottom: space[3] },
});
