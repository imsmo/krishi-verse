// apps/mobile/src/app/(buyer)/seller/[id].tsx · screen 100 (seller profile). Thin screen (guide §3): shows the
// seller's aggregate rating (REAL, reviews.summary) + a follow (save-seller) toggle (on-device). Behind `buyer_app`.
// FLAGGED: there is no public seller-profile endpoint yet (name/bio/their listings), so this is intentionally
// minimal — the rating is real; the rest is noted as pending rather than faked.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { ReviewSummary } from '@krishi-verse/sdk-js';
import { Button, Card, EmptyState, ScreenScaffold, SkeletonCard, color, font, space } from '@krishi-verse/ui-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFlag } from '../../../core/flags/useFlag';
import { sellerSummary } from '../../../features/buyer/browse.api';
import { getSavedSellers, toggleSavedSeller } from '../../../features/buyer/saved.api';

export default function SellerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const enabled = useFlag('buyer_app');
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setSummary(await sellerSummary(id));
    setFollowing((await getSavedSellers()).includes(id));
    setLoading(false);
  }, [id]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);

  if (!enabled) return <ScreenScaffold title=" "><EmptyState title={t('common.unavailable')} /></ScreenScaffold>;

  const onFollow = async () => { if (!id) return; setFollowing((await toggleSavedSeller(id)).includes(id)); };

  return (
    <ScreenScaffold
      title={t('seller.title')}
      footer={<Button title={t(following ? 'seller.following' : 'seller.follow')} variant={following ? 'outline' : 'primary'} onPress={onFollow} />}
    >
      {loading ? <SkeletonCard lines={3} /> : (
        <>
          <Card>
            <Text style={styles.rating}>{summary && summary.count > 0 ? `★ ${summary.averageStars.toFixed(1)}` : t('seller.noRating')}</Text>
            <Text style={styles.count}>{summary ? t('seller.reviewCount', { n: summary.count }) : ''}</Text>
          </Card>
          <Text style={styles.note}>{t('seller.profilePending')}</Text>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  rating: { fontFamily: font.display, fontSize: font.size['2xl'], fontWeight: font.weight.bold, color: color.ink900 },
  count: { fontFamily: font.body, fontSize: font.size.md, color: color.ink500, marginTop: space[1] },
  note: { fontFamily: font.body, fontSize: font.size.sm, color: color.ink400, marginTop: space[4] },
});
