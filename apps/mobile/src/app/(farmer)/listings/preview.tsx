// apps/mobile/src/app/(farmer)/listings/preview.tsx · screen 11 (review & publish). Loads the just-created draft
// by id and lets the farmer publish it (POST /listings/:id/publish). Thin screen over features/listings;
// degrade-never-die (load failure → retry). On publish, return to My Listings with a success notice.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ListingCard } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, MoneyText, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { getListing, publishListing } from '../../../features/listings/listings.api';

export default function ListingPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [listing, setListing] = useState<ListingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setFailed(false);
    const res = await getListing(id);
    setListing(res.listing); setFailed(!res.listing); setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const onPublish = async () => {
    if (!id) return;
    setPublishing(true); setError(undefined);
    try {
      await publishListing(id);
      router.replace({ pathname: '/(farmer)/listings', params: { notice: t('preview.published') } });
    } catch { setError(t('preview.publishFailed')); }
    finally { setPublishing(false); }
  };

  return (
    <ScreenScaffold
      title={t('preview.title')}
      footer={listing ? <Button title={t('preview.publish')} onPress={onPublish} loading={publishing} /> : undefined}
    >
      {loading ? <SkeletonCard lines={4} /> : !listing || failed ? (
        <EmptyState title={t('preview.unavailable')} actionLabel={t('common.retry')} onAction={load} />
      ) : (
        <Card>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.row}><Text style={styles.k}>{t('createListing.priceLabel')}</Text><MoneyText minor={listing.priceMinor} currencyCode={listing.currencyCode} langCode={lang} size="lg" /></View>
          <View style={styles.row}><Text style={styles.k}>{t('createListing.qtyLabel')}</Text><Text style={styles.v}>{listing.quantityAvailable} {listing.unitCode}</Text></View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: font.size.xl, fontWeight: font.weight.bold, color: color.ink800, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[3], borderTopWidth: 1, borderTopColor: color.ink100 },
  k: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500 },
  v: { fontFamily: font.body, fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.ink800 },
  error: { fontFamily: font.body, fontSize: font.size.md, color: color.dangerDark, marginTop: space[3] },
});
