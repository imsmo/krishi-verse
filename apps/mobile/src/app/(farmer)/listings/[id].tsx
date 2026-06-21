// apps/mobile/src/app/(farmer)/listings/[id].tsx · listing detail (screen 112). Thin screen (guide §3): calls
// features/listings/listings.api.getListing → renders. Degrade-never-die: not-found/failure shows an EmptyState
// with retry. Money via MoneyText (Law 2). All labels are i18n keys.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getListing } from '../../../features/listings/listings.api';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const boostOn = useFlag('listing_boost');
  const auctionsOn = useFlag('auctions');
  const [listing, setListing] = useState<ListingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const res = await getListing(id);
    setListing(res.listing);
    setFailed(!res.listing);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Boost is a real paid action (wallet debit → boost-tier) but the tier-pricing + debit endpoint isn't wired
  // yet, so behind the default-OFF `listing_boost` flag it honestly says it's coming — never a fake boosted state.
  const onBoost = () => Alert.alert(t('listings.boost'), t('listings.boost.soon'));

  return (
    <ScreenScaffold title={listing?.title ?? ' '}>
      {loading ? <SkeletonCard lines={4} /> : !listing || failed ? (
        <EmptyState title={t('listings.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <Card>
            <Row label={t('createListing.priceLabel')} value={<MoneyText minor={listing.priceMinor} currencyCode={listing.currencyCode} langCode={lang} size="xl" />} />
            <Row label={t('createListing.qtyLabel')} value={<Text style={styles.v}>{listing.quantityAvailable} {listing.unitCode}</Text>} />
            <Row label={t('listings.type')} value={<StatusPill label={listing.saleType} tone="success" />} />
            <Row label={t('listings.organic')} value={<Text style={styles.v}>{listing.organicClaim ? '✓' : '—'}</Text>} />
          </Card>
          <View style={styles.actions}>
            <Button title={t('listings.edit')} onPress={() => router.push({ pathname: '/(farmer)/listings/edit', params: { id: listing.id } })} />
            <Button title={t('listings.repost')} variant="outline" onPress={() => router.push({ pathname: '/(farmer)/listings/new', params: { repostFrom: listing.id } })} />
            {boostOn ? <Button title={t('listings.boost')} variant="outline" onPress={onBoost} /> : null}
            {auctionsOn ? <Button title={t('listings.auction')} variant="outline" onPress={() => router.push({ pathname: '/(farmer)/create-auction', params: { listingId: listing.id } })} /> : null}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{label}</Text>
      <View>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  actions: { gap: space[3], marginTop: space[5] },
});
