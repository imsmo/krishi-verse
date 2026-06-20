// apps/mobile/src/app/(farmer)/listings/edit.tsx · screen 113 (edit listing) — PRICE edit. The API exposes price
// change with optimistic concurrency (expectedVersion), so this is the real edit path; full-field editing has no
// endpoint yet (flagged). Loads the listing (for current price + version), accepts a new ₹ amount (→ paise via
// BigInt, Law 2), and saves with the version. A concurrency conflict shows a friendly "reopen & retry".
import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SdkError } from '@krishi-verse/sdk-js';
import { Button, Input, EmptyState, ScreenScaffold, SkeletonCard } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { getListing, changeListingPrice } from '../../../features/listings/listings.api';
import { rupeesToPaiseMinor } from '../../../core/payments/money';

export default function EditPrice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [rupees, setRupees] = useState('');
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const { listing } = await getListing(id);
    if (listing) {
      try { setRupees((BigInt(listing.priceMinor) / 100n).toString()); } catch { /* ignore */ }
      setVersion(typeof listing.version === 'number' ? listing.version : null);
    } else { setFailed(true); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const onSave = async () => {
    const minor = rupeesToPaiseMinor(rupees);
    if (!id || !minor || version === null) { setError(t('addMoney.invalidAmount')); return; }
    setBusy(true); setError(undefined);
    try {
      await changeListingPrice(id, minor, version);
      router.replace({ pathname: '/(farmer)/listings', params: { notice: t('editPrice.saved') } });
    } catch (e) {
      setError(e instanceof SdkError && e.isConflict ? t('editPrice.conflict') : t('common.error.generic'));
    } finally { setBusy(false); }
  };

  return (
    <ScreenScaffold
      title={t('editPrice.title')}
      footer={!failed ? <Button title={t('editPrice.save')} onPress={onSave} loading={busy} disabled={loading || rupees.trim().length === 0} /> : undefined}
    >
      {loading ? <SkeletonCard lines={2} /> : failed ? (
        <EmptyState title={t('listings.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Input label={t('editPrice.label')} value={rupees} onChangeText={setRupees} keyboardType="number-pad" autoFocus maxLength={7} error={error} />
      )}
    </ScreenScaffold>
  );
}
