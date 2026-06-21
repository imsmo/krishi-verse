// apps/mobile/src/app/(buyer)/listings/[id].tsx · screen 14 (buyer listing detail). Thin screen (guide §3): load
// the public listing (anonymous, cached) → render price (Law 2 MoneyText), qty, organic, a hero placeholder, a
// save (♥) toggle (on-device), and a link to the seller. Behind `buyer_app`. Degrade-never-die: not-found/failure
// → EmptyState + retry. NOTE: the public read-model carries no media URLs yet, so the gallery is a neutral
// placeholder (flagged) rather than a fake image.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, StatusPill, ScreenScaffold, SkeletonCard, color, font, space, radius } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { getPublicListing } from '../../../features/buyer/browse.api';
import { getSavedListings, toggleSavedListing } from '../../../features/buyer/saved.api';
import { addToCart } from '../../../features/cart/cart.api';

export default function BuyerListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const enabled = useFlag('buyer_app');
  const canBuy = useFlag('buyer_checkout');
  const [listing, setListing] = useState<ListingCard | null>(null);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const l = await getPublicListing(id);
    setListing(l); setFailed(!l);
    setSaved((await getSavedListings()).some((x) => x.id === id));
    setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title=" "><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onToggleSave = async () => {
    if (!listing) return;
    const next = await toggleSavedListing(listing);
    setSaved(next.some((x) => x.id === listing.id));
  };
  const onAddToCart = async () => {
    if (!listing) return;
    setAdding(true);
    try {
      const ok = await addToCart(listing.id, Math.min(1, listing.quantityAvailable) || 1);
      Alert.alert(t(ok ? 'cart.added' : 'cart.addFailed'));
    } finally { setAdding(false); }
  };

  const footer = listing ? (
    <View style={styles.footer}>
      {canBuy && listing.quantityAvailable > 0 ? <Button title={t('cart.addToCart')} onPress={onAddToCart} loading={adding} /> : null}
      <Button title={t(saved ? 'buyer.saved' : 'buyer.save')} variant="outline" onPress={onToggleSave} />
    </View>
  ) : undefined;

  return (
    <ScreenScaffold
      title={listing?.title ?? ' '}
      footer={footer}
    >
      {loading ? <SkeletonCard lines={6} /> : !listing || failed ? (
        <EmptyState title={t('buyer.detail.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <>
          <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no"><Text style={styles.heroGlyph}>🌾</Text></View>
          <Card>
            <View style={styles.headRow}>
              <Text style={styles.title}>{listing.title}</Text>
              <MoneyText minor={listing.priceMinor} currencyCode={listing.currencyCode} langCode={lang} size="2xl" />
            </View>
            <Text style={styles.qty}>{listing.quantityAvailable} {listing.unitCode}</Text>
            <View style={styles.pills}>
              <StatusPill label={t(`listings.saleType.${listing.saleType}`)} tone="info" />
              {listing.organicClaim ? <StatusPill label={t('listings.organic')} tone="success" /> : null}
              {listing.boosted ? <StatusPill label={t('buyer.promoted')} tone="accent" /> : null}
            </View>
          </Card>
          <Button title={t('buyer.viewSeller')} variant="ghost" onPress={() => router.push({ pathname: '/(buyer)/seller/[id]', params: { id: listing.sellerUserId } })} />
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { height: 160, borderRadius: radius.lg, backgroundColor: color.primary50, alignItems: 'center', justifyContent: 'center', marginBottom: space[3] },
  heroGlyph: { fontSize: 64 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  title: { flex: 1, fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800 },
  qty: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, marginTop: space[1] },
  pills: { flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap' },
  footer: { gap: space[2] },
});
